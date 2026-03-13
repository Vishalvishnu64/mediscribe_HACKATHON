const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Connection = require('../models/Connection');
const Prescription = require('../models/Prescription');

// Doctor directory search (for patient)
router.get('/list', auth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);

    const filter = { role: 'DOCTOR' };

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { name: regex },
      { specialization: regex },
      { hospital: regex },
      { registrationNumber: regex }
    ];

    const doctors = await User.find(filter)
      .select('name profilePic specialization hospital registrationNumber qualifications experienceYears schedule')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Patient-specific doctor list inferred from scanned prescriptions
router.get('/my', auth, async (req, res) => {
  try {
    if (req.user.role !== 'PATIENT') return res.status(403).json({ error: 'Unauthorized' });

    const stripDoctorPrefix = (value) =>
      String(value || '')
        .replace(/^\s*(dr\.?\s*)+/i, '')
        .trim();

    const normalize = (value) =>
      stripDoctorPrefix(value)
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const prescriptions = await Prescription.find({ patientId: req.user.id })
      .select('doctorRecognizedName doctorRegNo date createdAt')
      .sort({ date: -1, createdAt: -1 });

    if (!prescriptions.length) return res.json([]);

    const dbDoctors = await User.find({ role: 'DOCTOR' })
      .select('name profilePic specialization hospital registrationNumber qualifications experienceYears schedule');

    const byRegNo = new Map();
    const byNormalizedName = new Map();
    dbDoctors.forEach((doc) => {
      if (doc.registrationNumber) byRegNo.set(doc.registrationNumber, doc);
      byNormalizedName.set(normalize(doc.name), doc);
    });

    const merged = new Map();

    prescriptions.forEach((p) => {
      const recognizedName = stripDoctorPrefix(p.doctorRecognizedName || '');
      const regNo = (p.doctorRegNo || '').trim();
      const nName = normalize(recognizedName);

      const matchedDoctor = (regNo && byRegNo.get(regNo)) || byNormalizedName.get(nName) || null;
      const key = matchedDoctor ? `db:${matchedDoctor._id}` : `ocr:${nName || regNo || p._id}`;
      const pDate = p.date || p.createdAt || new Date();

      if (!merged.has(key)) {
        merged.set(key, {
          doctorId: matchedDoctor?._id || null,
          name: stripDoctorPrefix(matchedDoctor?.name || recognizedName || 'Unknown Doctor'),
          profilePic: matchedDoctor?.profilePic || null,
          specialization: matchedDoctor?.specialization || null,
          hospital: matchedDoctor?.hospital || null,
          registrationNumber: matchedDoctor?.registrationNumber || regNo || null,
          inDatabase: !!matchedDoctor,
          canOpenProfile: !!matchedDoctor,
          latestPrescriptionDate: pDate,
          prescriptionCount: 1,
        });
      } else {
        const row = merged.get(key);
        row.prescriptionCount += 1;
        if (new Date(pDate).getTime() > new Date(row.latestPrescriptionDate).getTime()) {
          row.latestPrescriptionDate = pDate;
        }
      }
    });

    const out = Array.from(merged.values()).sort(
      (a, b) => new Date(b.latestPrescriptionDate).getTime() - new Date(a.latestPrescriptionDate).getTime()
    );

    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Doctor profile by id
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const doctor = await User.findOne({ _id: req.params.id, role: 'DOCTOR' })
      .select('name email profilePic specialization hospital registrationNumber qualifications experienceYears clinicAddress consultationFee bio schedule');

    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    res.json(doctor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. Identify Doctor from OCR (Called after Upload)
router.get('/match/:regno', auth, async (req, res) => {
  try {
    const regNo = req.params.regno;
    if (!regNo || regNo === 'undefined' || regNo === 'null') {
      return res.json({ match: false });
    }

    const doctor = await User.findOne({ role: 'DOCTOR', registrationNumber: regNo });
    if (!doctor) {
      return res.json({ match: false });
    }

    res.json({ match: true, doctor: { id: doctor._id, name: doctor.name, hospital: doctor.hospital, spec: doctor.specialization }});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Patient Action -> Request Verification
router.post('/request-connection', auth, async (req, res) => {
  try {
    const { doctorId, prescriptionId } = req.body;
    
    // Check if already requested/linked
    let connection = await Connection.findOne({ doctorId, patientId: req.user.id });
    if (!connection) {
      connection = new Connection({
        doctorId,
        patientId: req.user.id,
        status: 'PENDING',
        initiatedBy: req.user.id,
        prescriptionReference: prescriptionId
      });
      await connection.save();
    }
    
    // Set Prescription status to Pending
    await Prescription.findByIdAndUpdate(prescriptionId, { verificationStatus: 'PENDING_DOCTOR', doctorId });

    res.json({ success: true, message: 'Connection requested' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Doctor Action -> Get Pending Requests
router.get('/requests', auth, async (req, res) => {
  try {
    if (req.user.role !== 'DOCTOR') return res.status(403).json({ error: 'Unauthorized' });

    const requests = await Connection.find({ doctorId: req.user.id, status: 'PENDING' })
      .populate('patientId', 'name age gender')
      .populate('prescriptionReference', 'date rawOcrData');

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Doctor Action -> Approve/Reject Status
router.put('/requests/:id/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'DOCTOR') return res.status(403).json({ error: 'Unauthorized' });

    const { status } = req.body; // 'APPROVED' or 'REJECTED'
    const connection = await Connection.findById(req.params.id);

    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    
    connection.status = status;
    await connection.save();

    if (status === 'APPROVED') {
       await Prescription.findByIdAndUpdate(connection.prescriptionReference, { verificationStatus: 'VERIFIED' });
    }

    res.json({ success: true, connection });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

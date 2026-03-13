const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Connection = require('../models/Connection');
const Prescription = require('../models/Prescription');

const stripDoctorPrefix = (value) =>
  String(value || '')
    .replace(/^\s*((dr|doctor)\.?\s*)+/i, '')
    .trim();

const normalizeDoctorName = (value) =>
  stripDoctorPrefix(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

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

    const normalize = (value) => normalizeDoctorName(value);

    const prescriptions = await Prescription.find({ patientId: req.user.id })
      .select('doctorRecognizedName doctorRegNo date createdAt')
      .sort({ date: -1, createdAt: -1 });

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

    const linkedConnections = await Connection.find({
      patientId: req.user.id,
      status: { $in: ['APPROVED', 'CORRECTED'] }
    })
      .populate('doctorId', 'name profilePic specialization hospital registrationNumber qualifications experienceYears schedule')
      .sort({ updatedAt: -1, createdAt: -1 });

    linkedConnections.forEach((conn) => {
      const doctor = conn.doctorId;
      if (!doctor) return;
      const key = `db:${doctor._id}`;
      const linkedAt = conn.updatedAt || conn.createdAt || new Date();

      if (!merged.has(key)) {
        merged.set(key, {
          doctorId: doctor._id,
          name: stripDoctorPrefix(doctor.name || 'Unknown Doctor'),
          profilePic: doctor.profilePic || null,
          specialization: doctor.specialization || null,
          hospital: doctor.hospital || null,
          registrationNumber: doctor.registrationNumber || null,
          inDatabase: true,
          canOpenProfile: true,
          latestPrescriptionDate: linkedAt,
          prescriptionCount: 0,
        });
      } else {
        const row = merged.get(key);
        if (new Date(linkedAt).getTime() > new Date(row.latestPrescriptionDate).getTime()) {
          row.latestPrescriptionDate = linkedAt;
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

// Find doctor and create verification request for a prescription
router.post('/request-verification', auth, async (req, res) => {
  try {
    if (req.user.role !== 'PATIENT') return res.status(403).json({ error: 'Unauthorized' });

    const { prescriptionId } = req.body;
    if (!prescriptionId) return res.status(400).json({ error: 'prescriptionId is required' });

    const prescription = await Prescription.findOne({ _id: prescriptionId, patientId: req.user.id });
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

    const regNo = String(prescription.doctorRegNo || '').trim();
    const recognizedName = String(prescription.doctorRecognizedName || '').trim();
    const normalizedName = normalizeDoctorName(recognizedName);

    const connectedDoctorIds = await Connection.find({
      patientId: req.user.id,
      status: { $in: ['APPROVED', 'CORRECTED'] }
    }).distinct('doctorId');

    let doctor = null;

    if (connectedDoctorIds.length) {
      doctor = await User.findOne({
        _id: { $in: connectedDoctorIds },
        role: 'DOCTOR',
        ...(regNo
          ? { registrationNumber: regNo }
          : normalizedName
            ? { name: new RegExp(`^\\s*(dr\\.?\\s*)*${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') }
            : {})
      });

      if (!doctor && normalizedName) {
        const connectedDocs = await User.find({ _id: { $in: connectedDoctorIds }, role: 'DOCTOR' }).select('name registrationNumber');
        doctor = connectedDocs.find((d) => normalizeDoctorName(d.name) === normalizedName) || null;
      }
    }

    if (!doctor) {
      if (regNo) {
        doctor = await User.findOne({ role: 'DOCTOR', registrationNumber: regNo });
      }
      if (!doctor && normalizedName) {
        const doctors = await User.find({ role: 'DOCTOR' }).select('name registrationNumber');
        doctor = doctors.find((d) => normalizeDoctorName(d.name) === normalizedName) || null;
      }
    }

    if (!doctor) {
      return res.status(404).json({
        found: false,
        error: 'Doctor not found in your doctors or doctor database'
      });
    }

    let connection = await Connection.findOne({
      doctorId: doctor._id,
      patientId: req.user.id,
      prescriptionReference: prescription._id
    });

    if (!connection) {
      connection = new Connection({
        doctorId: doctor._id,
        patientId: req.user.id,
        status: 'PENDING',
        initiatedBy: req.user.id,
        prescriptionReference: prescription._id
      });
    } else {
      connection.status = 'PENDING';
    }

    await connection.save();

    prescription.doctorId = doctor._id;
    prescription.verificationStatus = 'PENDING_DOCTOR';
    await prescription.save();

    res.json({
      success: true,
      found: true,
      doctor: {
        id: doctor._id,
        name: doctor.name,
        registrationNumber: doctor.registrationNumber || null,
      },
      requestId: connection._id,
    });
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
      .populate('prescriptionReference', 'date rawOcrData imagePath doctorRecognizedName doctorRegNo verificationStatus correctedOcrData verificationNote');

    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Doctor Action -> Approve/Reject Status
router.put('/requests/:id/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'DOCTOR') return res.status(403).json({ error: 'Unauthorized' });

    const { status, correctedData, note } = req.body;
    const connection = await Connection.findById(req.params.id);

    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    const next = String(status || '').toUpperCase();
    if (!['APPROVED', 'VERIFIED', 'REJECTED', 'CORRECTED'].includes(next)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    connection.status = next === 'VERIFIED' ? 'APPROVED' : next;
    await connection.save();

    const update = { reviewedAt: new Date() };
    if (next === 'APPROVED' || next === 'VERIFIED') {
      update.verificationStatus = 'VERIFIED';
      update.verificationNote = note || '';
    } else if (next === 'REJECTED') {
      update.verificationStatus = 'REJECTED';
      update.verificationNote = note || '';
    } else if (next === 'CORRECTED') {
      update.verificationStatus = 'CORRECTED';
      if (correctedData) update.correctedOcrData = correctedData;
      update.verificationNote = note || 'Corrected by doctor';
    }

    await Prescription.findByIdAndUpdate(connection.prescriptionReference, update);

    res.json({ success: true, connection });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

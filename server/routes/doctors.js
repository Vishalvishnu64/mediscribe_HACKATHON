const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Connection = require('../models/Connection');
const Prescription = require('../models/Prescription');

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

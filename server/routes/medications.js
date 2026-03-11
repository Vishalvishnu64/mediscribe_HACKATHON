const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Medication = require('../models/Medication');
const Prescription = require('../models/Prescription');

// Get all active medications for the logged-in patient
router.get('/active', auth, async (req, res) => {
  try {
    const meds = await Medication.find({ patientId: req.user.id, status: 'ACTIVE' })
      .populate('prescriptionId', 'doctorRecognizedName date verificationStatus')
      .sort({ createdAt: -1 });
    res.json(meds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all history medications
router.get('/history', auth, async (req, res) => {
  try {
    const meds = await Medication.find({ patientId: req.user.id, status: { $in: ['HISTORY', 'COMPLETED'] } })
      .populate('prescriptionId', 'doctorRecognizedName date verificationStatus')
      .sort({ createdAt: -1 });
    res.json(meds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all medications (for dashboard stats)
router.get('/all', auth, async (req, res) => {
  try {
    const meds = await Medication.find({ patientId: req.user.id })
      .populate('prescriptionId', 'doctorRecognizedName date verificationStatus')
      .sort({ createdAt: -1 });
    res.json(meds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all prescriptions for the patient
router.get('/prescriptions', auth, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.user.id })
      .sort({ createdAt: -1 });
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a medication as completed
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const med = await Medication.findOneAndUpdate(
      { _id: req.params.id, patientId: req.user.id },
      { status: 'COMPLETED' },
      { new: true }
    );
    if (!med) return res.status(404).json({ error: 'Not found' });
    res.json(med);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update medication details (e.g., doctorName, reminderTimes)
router.put('/:id', auth, async (req, res) => {
  try {
    const update = {};
    if (req.body.doctorName !== undefined) update.doctorName = req.body.doctorName;
    if (req.body.reminderTimes !== undefined) update.reminderTimes = req.body.reminderTimes;
    const med = await Medication.findOneAndUpdate(
      { _id: req.params.id, patientId: req.user.id },
      update,
      { new: true }
    ).populate('prescriptionId', 'doctorRecognizedName date verificationStatus');
    if (!med) return res.status(404).json({ error: 'Not found' });
    res.json(med);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

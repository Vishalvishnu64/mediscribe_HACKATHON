const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Medication = require('../models/Medication');
const Prescription = require('../models/Prescription');
const TestResult = require('../models/TestResult');
const MetricEntry = require('../models/MetricEntry');

// Get all active medications for the logged-in patient
router.get('/active', auth, async (req, res) => {
  try {
    // Auto-move expired active meds to history before returning list
    await Medication.updateMany(
      {
        patientId: req.user.id,
        status: 'ACTIVE',
        endDate: { $exists: true, $ne: null, $lt: new Date() }
      },
      { status: 'HISTORY' }
    );

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

// Get all uploaded test results for the patient
router.get('/test-results', auth, async (req, res) => {
  try {
    const results = await TestResult.find({ patientId: req.user.id })
      .sort({ testDate: -1, createdAt: -1 });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get manual/custom metric points for charting
router.get('/metrics', auth, async (req, res) => {
  try {
    const rows = await MetricEntry.find({ patientId: req.user.id }).sort({ recordedAt: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add manual metric point for charting
router.post('/metrics', auth, async (req, res) => {
  try {
    const { metricKey, metricLabel, value, recordedAt, unit } = req.body;
    if (!metricKey || !metricLabel || value == null || !recordedAt) {
      return res.status(400).json({ error: 'metricKey, metricLabel, value and recordedAt are required' });
    }

    const num = Number(value);
    if (!Number.isFinite(num)) {
      return res.status(400).json({ error: 'value must be numeric' });
    }

    const date = new Date(recordedAt);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid recordedAt date' });
    }

    const entry = await MetricEntry.create({
      patientId: req.user.id,
      metricKey,
      metricLabel,
      value: num,
      unit: unit || '',
      recordedAt: date,
      source: 'MANUAL'
    });

    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a prescription's visit details (patient-owned only)
router.patch('/prescriptions/:id', auth, async (req, res) => {
  try {
    const allowedTypes = ['NEW', 'OLD'];
    const update = {};

    if (req.body.doctorRecognizedName !== undefined) update.doctorRecognizedName = req.body.doctorRecognizedName;
    if (req.body.doctorRegNo !== undefined) update.doctorRegNo = req.body.doctorRegNo;
    if (req.body.date !== undefined) update.date = req.body.date ? new Date(req.body.date) : null;
    if (req.body.type !== undefined) {
      if (!allowedTypes.includes(req.body.type)) {
        return res.status(400).json({ error: 'Invalid prescription type' });
      }
      update.type = req.body.type;
    }
    if (req.body.rawOcrData !== undefined) update.rawOcrData = req.body.rawOcrData;

    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, patientId: req.user.id },
      update,
      { new: true }
    );

    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    res.json(prescription);
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
    if (req.body.locationImage !== undefined) update.locationImage = req.body.locationImage;
    if (req.body.endDate !== undefined) {
      if (req.body.endDate === null || req.body.endDate === '') {
        update.endDate = null;
      } else {
        const parsedDate = new Date(req.body.endDate);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: 'Invalid endDate' });
        }
        update.endDate = parsedDate;
        update.status = parsedDate < new Date() ? 'HISTORY' : 'ACTIVE';
      }
    }

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

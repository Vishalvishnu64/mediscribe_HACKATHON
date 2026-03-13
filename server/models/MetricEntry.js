const mongoose = require('mongoose');

const metricEntrySchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metricKey: { type: String, required: true },
  metricLabel: { type: String, required: true },
  value: { type: Number, required: true },
  unit: { type: String, default: '' },
  recordedAt: { type: Date, required: true },
  source: {
    type: String,
    enum: ['MANUAL', 'OCR', 'DOCTOR_EHR', 'DOCTOR_LAB', 'DOCTOR_RADIOLOGY', 'DOCTOR_WEARABLE'],
    default: 'MANUAL'
  }
}, { timestamps: true });

metricEntrySchema.index({ patientId: 1, metricKey: 1, recordedAt: 1 });

module.exports = mongoose.model('MetricEntry', metricEntrySchema);

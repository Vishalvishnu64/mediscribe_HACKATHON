const mongoose = require('mongoose');

const labResultSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorPatient', required: true },
  test_name: { type: String, required: true },
  value: { type: Number },
  unit: { type: String },
  ref_low: { type: Number },
  ref_high: { type: Number },
  flag: { type: String, default: 'normal' },
  recorded_at: { type: Date, default: Date.now }
}, { timestamps: true });

labResultSchema.index({ patient_id: 1 });

module.exports = mongoose.model('LabResult', labResultSchema);

const mongoose = require('mongoose');

const vitalSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorPatient', required: true },
  source: { type: String, default: 'EHR' },
  heart_rate: { type: Number },
  systolic: { type: Number },
  diastolic: { type: Number },
  spo2: { type: Number },
  temperature: { type: Number },
  resp_rate: { type: Number },
  recorded_at: { type: Date, default: Date.now }
}, { timestamps: true });

vitalSchema.index({ patient_id: 1 });

module.exports = mongoose.model('Vital', vitalSchema);

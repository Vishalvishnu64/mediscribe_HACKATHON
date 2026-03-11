const mongoose = require('mongoose');

const imagingSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorPatient', required: true },
  modality: { type: String, required: true },
  body_part: { type: String },
  finding: { type: String },
  impression: { type: String },
  status: { type: String, default: 'Final' },
  recorded_at: { type: Date, default: Date.now }
}, { timestamps: true });

imagingSchema.index({ patient_id: 1 });

module.exports = mongoose.model('Imaging', imagingSchema);

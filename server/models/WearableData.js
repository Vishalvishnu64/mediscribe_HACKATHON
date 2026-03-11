const mongoose = require('mongoose');

const wearableDataSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorPatient', required: true },
  metric: { type: String, required: true },
  value: { type: Number },
  recorded_at: { type: Date, default: Date.now }
}, { timestamps: true });

wearableDataSchema.index({ patient_id: 1 });

module.exports = mongoose.model('WearableData', wearableDataSchema);

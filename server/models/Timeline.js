const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorPatient', required: true },
  event_type: { type: String, required: true },
  title: { type: String, required: true },
  detail: { type: String },
  source: { type: String },
  event_date: { type: String, default: () => new Date().toISOString().slice(0, 10) }
}, { timestamps: true });

timelineSchema.index({ patient_id: 1 });

module.exports = mongoose.model('Timeline', timelineSchema);

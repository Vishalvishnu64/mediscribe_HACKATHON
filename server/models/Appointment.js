const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorPatient', required: true },
  time: { type: String, required: true },
  purpose: { type: String },
  room: { type: String },
  priority: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  date: { type: String, default: () => new Date().toISOString().slice(0, 10) }
}, { timestamps: true });

appointmentSchema.index({ date: 1 });
appointmentSchema.index({ patient_id: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);

const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  name: { type: String, required: true },
  dosage: { type: String },
  frequency: { type: String },
  duration: { type: String },
  
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  
  reminderTimes: [{ type: String }], // e.g., ["08:00", "20:00"]
  doctorName: { type: String },
  
  status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'HISTORY'], default: 'ACTIVE' },
  isManual: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Medication', medicationSchema);

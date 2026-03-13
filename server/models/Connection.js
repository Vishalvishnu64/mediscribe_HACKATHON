const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'CORRECTED'], default: 'PENDING' },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  prescriptionReference: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' }
}, { timestamps: true });

module.exports = mongoose.model('Connection', connectionSchema);

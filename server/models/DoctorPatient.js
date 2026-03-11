const mongoose = require('mongoose');

const doctorPatientSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  age: { type: Number },
  gender: { type: String },
  blood_type: { type: String },
  primary_condition: { type: String },
  status: { type: String, default: 'Stable' },
  smoking_status: { type: String },
  allergies: { type: String },
  medications: { type: String },
  last_visit: { type: String }
}, { timestamps: true });

doctorPatientSchema.index({ doctorId: 1 });
doctorPatientSchema.index({ doctorId: 1, patientId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('DoctorPatient', doctorPatientSchema);

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ['PATIENT', 'DOCTOR'], required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  
  // Doctor specific
  registrationNumber: { type: String },
  hospital: { type: String },
  specialization: { type: String },
  
  // Patient specific
  age: { type: Number },
  gender: { type: String },
  medicalConditions: { type: String },
  allergies: { type: String },
  emergencyContact: { type: String },
  
  profilePic: { type: String },
  pushSubscription: { type: Object } // Added Web Push Token
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

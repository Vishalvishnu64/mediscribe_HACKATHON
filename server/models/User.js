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

  // Nominee (caregiver/family member who also gets reminders)
  nominee: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    pushSubscription: { type: Object }
  },

  settings: {
    darkMode: { type: Boolean, default: false },
    fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' }
  },
  
  profilePic: { type: String },
  pushSubscription: { type: Object } // Added Web Push Token
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

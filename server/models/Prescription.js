const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  doctorRecognizedName: { type: String },
  doctorRegNo: { type: String },
  
  date: { type: Date, default: Date.now },
  imagePath: { type: String },
  
  type: { type: String, enum: ['NEW', 'OLD'], required: true },
  verificationStatus: { 
    type: String, 
    enum: ['UNVERIFIED', 'PENDING_DOCTOR', 'VERIFIED', 'REJECTED', 'CORRECTED'],
    default: 'UNVERIFIED'
  },

  correctedOcrData: { type: Object },
  verificationNote: { type: String },
  reviewedAt: { type: Date },
  
  rawOcrData: { type: Object }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);

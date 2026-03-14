const mongoose = require('mongoose');

const chatRequestSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'DENIED', 'EXPIRED'], default: 'PENDING' },
  requestedBy: { type: String, enum: ['PATIENT'], default: 'PATIENT' },
  acceptedAt: { type: Date },
  expiresAt: { type: Date },
  deniedAt: { type: Date },
  lastMessageAt: { type: Date }
}, { timestamps: true });

chatRequestSchema.index({ patientId: 1, doctorId: 1, createdAt: -1 });
chatRequestSchema.index({ doctorId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ChatRequest', chatRequestSchema);

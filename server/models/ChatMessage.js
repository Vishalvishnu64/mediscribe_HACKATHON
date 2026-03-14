const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  chatRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRequest', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['PATIENT', 'DOCTOR'], required: true },
  text: { type: String, required: true }
}, { timestamps: true });

chatMessageSchema.index({ chatRequestId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);

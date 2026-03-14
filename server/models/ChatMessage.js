const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  chatRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRequest', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['PATIENT', 'DOCTOR'], required: true },
  text: { type: String, default: '' },
  imageUrl: { type: String, default: '' }
}, { timestamps: true });

chatMessageSchema.pre('validate', function () {
  const hasText = Boolean(String(this.text || '').trim());
  const hasImage = Boolean(String(this.imageUrl || '').trim());
  if (!hasText && !hasImage) {
    throw new Error('Message text or image is required');
  }
});

chatMessageSchema.index({ chatRequestId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);

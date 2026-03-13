const mongoose = require('mongoose');

const unmatchedSourceUploadSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sourceType: { type: String, enum: ['EHR', 'Lab', 'Radiology', 'Wearable'], required: true },
  patientName: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  recorded_at: { type: Date, default: Date.now }
}, { timestamps: true });

unmatchedSourceUploadSchema.index({ doctorId: 1, sourceType: 1, createdAt: -1 });

module.exports = mongoose.model('UnmatchedSourceUpload', unmatchedSourceUploadSchema);

const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Lab Test Result' },
  testDate: { type: Date, default: Date.now },
  imagePath: { type: String },
  rawOcrData: { type: Object },
}, { timestamps: true });

module.exports = mongoose.model('TestResult', testResultSchema);

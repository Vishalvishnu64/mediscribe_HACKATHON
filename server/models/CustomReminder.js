const mongoose = require('mongoose');

const customReminderSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByRole: { type: String, enum: ['PATIENT', 'DOCTOR'], required: true },
    text: { type: String, required: true, trim: true, maxlength: 300 },
    remindAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ['SCHEDULED', 'DONE', 'CANCELLED'], default: 'SCHEDULED', index: true },
    notifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CustomReminder', customReminderSchema);

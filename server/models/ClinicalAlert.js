const mongoose = require('mongoose');

const clinicalAlertSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorPatient', required: true },
  severity: { type: String, default: 'warning' },
  message: { type: String, required: true },
  source: { type: String },
  resolved: { type: Boolean, default: false }
}, { timestamps: true });

clinicalAlertSchema.index({ patient_id: 1 });
clinicalAlertSchema.index({ resolved: 1, severity: 1 });

module.exports = mongoose.model('ClinicalAlert', clinicalAlertSchema);

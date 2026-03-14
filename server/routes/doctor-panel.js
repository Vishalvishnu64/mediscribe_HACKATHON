const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Connection = require('../models/Connection');
const Medication = require('../models/Medication');
const Prescription = require('../models/Prescription');
const CustomReminder = require('../models/CustomReminder');
const DoctorPatient = require('../models/DoctorPatient');
const Vital = require('../models/Vital');
const LabResult = require('../models/LabResult');
const Imaging = require('../models/Imaging');
const Timeline = require('../models/Timeline');
const WearableData = require('../models/WearableData');
const ClinicalAlert = require('../models/ClinicalAlert');
const Appointment = require('../models/Appointment');
const MetricEntry = require('../models/MetricEntry');
const UnmatchedSourceUpload = require('../models/UnmatchedSourceUpload');

// --- Helper: extract doctor ID from JWT ---
function getDoctorId(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'DOCTOR') return null;
    return decoded.id;
  } catch {
    return null;
  }
}

// Build a filter that includes both the doctor's own patients AND unassigned (seeded) patients
function buildDoctorFilter(doctorId) {
  if (!doctorId) return {};
  return { $or: [{ doctorId }, { doctorId: null }, { doctorId: { $exists: false } }] };
}

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeName = (value = '') => String(value || '').trim().replace(/\s+/g, ' ');
const slugifyMetricKey = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'doctor_metric';

async function resolveDoctorPatient({ doctorId, patient_id, patient_name }) {
  if (patient_id && mongoose.Types.ObjectId.isValid(patient_id)) {
    const byId = await DoctorPatient.findById(patient_id);
    if (byId) return byId;
  }

  const name = normalizeName(patient_name);
  if (!name) return null;
  const filter = buildDoctorFilter(doctorId);
  const nameFilter = { name: new RegExp(`^${escapeRegExp(name)}$`, 'i') };
  const combined = Object.keys(filter).length ? { $and: [filter, nameFilter] } : nameFilter;
  return DoctorPatient.findOne(combined);
}

async function resolvePatientUserId(doctorPatient, fallbackName) {
  if (doctorPatient?.patientId) return doctorPatient.patientId;
  const lookupName = normalizeName(fallbackName || doctorPatient?.name || '');
  if (!lookupName) return null;
  const row = await User.findOne({ role: 'PATIENT', name: new RegExp(`^${escapeRegExp(lookupName)}$`, 'i') }).select('_id');
  return row?._id || null;
}

async function addMetricEntries(patientId, rows) {
  if (!patientId || !Array.isArray(rows) || rows.length === 0) return;
  const docs = rows
    .filter((r) => Number.isFinite(Number(r.value)))
    .map((r) => ({
      patientId,
      metricKey: r.metricKey,
      metricLabel: r.metricLabel,
      value: Number(r.value),
      unit: r.unit || '',
      recordedAt: r.recordedAt || new Date(),
      source: r.source,
    }));
  if (docs.length) await MetricEntry.insertMany(docs);
}

// --- Auth (login via main app JWT — no separate login) ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  // Delegate to main auth — this endpoint is kept for the standalone login page
  try {
    const bcrypt = require('bcrypt');
    const user = await User.findOne({ email, role: 'DOCTOR' });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id, role: 'DOCTOR' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, doctor: user.name });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// --- Dashboard Stats ---
router.get('/stats', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const filter = buildDoctorFilter(doctorId);
    const totalPatients = await DoctorPatient.countDocuments(filter);
    const patientIds = (await DoctorPatient.find(filter).select('_id')).map(p => p._id);
    const critAlerts = patientIds.length
      ? await ClinicalAlert.countDocuments({ patient_id: { $in: patientIds }, severity: 'critical', resolved: false })
      : 0;
    const activeMonitors = patientIds.length
      ? (await WearableData.distinct('metric', { patient_id: { $in: patientIds } })).length
      : 0;
    const dataSources = 4; // EHR, Lab, Radiology, Wearable
    res.json({ total_patients: totalPatients, active_monitors: activeMonitors, critical_alerts: critAlerts, data_sources: dataSources });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// --- Patients ---
router.get('/patients', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const filter = buildDoctorFilter(doctorId);
    const q = req.query.q;
    if (q) {
      const regex = new RegExp(q, 'i');
      const searchFilter = { $or: [{ name: regex }, { primary_condition: regex }] };
      // Combine with doctor filter using $and to avoid $or conflict
      const combined = Object.keys(filter).length ? { $and: [filter, searchFilter] } : searchFilter;
      const rows = await DoctorPatient.find(combined).sort({ last_visit: -1 });
      return res.json(rows.map(p => ({ id: p._id, ...p.toObject() })));
    }
    const rows = await DoctorPatient.find(filter).sort({ last_visit: -1 });
    res.json(rows.map(p => ({ id: p._id, ...p.toObject() })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load patients' });
  }
});

// --- Add Patient ---
router.post('/patients', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const { name, age, gender, blood_type, primary_condition, status, smoking_status, allergies, medications } = req.body;
    if (!name || !primary_condition) return res.status(400).json({ error: 'Name and primary condition are required' });
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 150) return res.status(400).json({ error: 'Invalid age' });
    const today = new Date().toISOString().slice(0, 10);
    const cleanName = normalizeName(name);

    const matchedPatientUser = await User.findOne({
      role: 'PATIENT',
      name: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i')
    }).select('_id name');

    let patient = null;
    if (matchedPatientUser && doctorId) {
      patient = await DoctorPatient.findOneAndUpdate(
        { doctorId, patientId: matchedPatientUser._id },
        {
          doctorId,
          patientId: matchedPatientUser._id,
          name: cleanName,
          age: ageNum,
          gender: gender || undefined,
          blood_type: blood_type || undefined,
          primary_condition: primary_condition.trim(),
          status: status || 'Stable',
          smoking_status: smoking_status || undefined,
          allergies: allergies || undefined,
          medications: medications || undefined,
          last_visit: today,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      await Connection.findOneAndUpdate(
        { doctorId, patientId: matchedPatientUser._id },
        {
          doctorId,
          patientId: matchedPatientUser._id,
          status: 'APPROVED',
          initiatedBy: doctorId,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } else {
      patient = await DoctorPatient.create({
        doctorId: doctorId || undefined,
        name: cleanName,
        age: ageNum,
        gender: gender || undefined,
        blood_type: blood_type || undefined,
        primary_condition: primary_condition.trim(),
        status: status || 'Stable',
        smoking_status: smoking_status || undefined,
        allergies: allergies || undefined,
        medications: medications || undefined,
        last_visit: today,
      });
    }

    res.status(201).json({
      id: patient._id,
      ...patient.toObject(),
      matchedPatientInDb: Boolean(matchedPatientUser),
      matchedPatientName: matchedPatientUser?.name || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add patient' });
  }
});

// --- Enriched Patients ---
router.get('/patients/enriched', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const filter = buildDoctorFilter(doctorId);
    const patients = await DoctorPatient.find(filter).sort({ last_visit: -1 });
    const today = new Date().toISOString().slice(0, 10);

    const enriched = await Promise.all(patients.map(async (p) => {
      const pid = p._id;
      const critAlerts = await ClinicalAlert.countDocuments({ patient_id: pid, severity: 'critical', resolved: false });
      const warnAlerts = await ClinicalAlert.countDocuments({ patient_id: pid, severity: 'warning', resolved: false });
      const totalAlerts = await ClinicalAlert.countDocuments({ patient_id: pid, resolved: false });
      const monitors = (await WearableData.distinct('metric', { patient_id: pid })).length;
      const nextAppt = await Appointment.findOne({ patient_id: pid, date: { $gte: today } }).sort({ date: 1, time: 1 });

      const sources = [];
      if (await Vital.exists({ patient_id: pid, source: 'EHR' })) sources.push('EHR');
      if (await LabResult.exists({ patient_id: pid })) sources.push('Lab');
      if (await Imaging.exists({ patient_id: pid })) sources.push('Radiology');
      if (await WearableData.exists({ patient_id: pid })) sources.push('Wearable');

      let risk = 'Low';
      if (p.status === 'Critical' || critAlerts > 0) risk = 'High';
      else if (p.status === 'Review' || warnAlerts > 0) risk = 'Medium';

      return {
        id: p._id, ...p.toObject(), risk,
        critical_alerts: critAlerts, total_alerts: totalAlerts,
        active_monitors: monitors,
        next_appointment: nextAppt ? { time: nextAppt.time, date: nextAppt.date, purpose: nextAppt.purpose } : null,
        data_sources: sources,
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Enriched error:', err);
    res.status(500).json({ error: 'Failed to load enriched patients' });
  }
});

// --- Single Patient ---
router.get('/patients/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const row = await DoctorPatient.findById(id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ id: row._id, ...row.toObject() });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Full Patient Profile ---
router.get('/patients/:id/profile', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const patient = await DoctorPatient.findById(id);
    if (!patient) return res.status(404).json({ error: 'Not found' });

    const patientUserId = patient.patientId || null;

    const [vitals, labs, images, timeline, wearable, alerts, prescriptions, reminders, customReminders] = await Promise.all([
      Vital.find({ patient_id: id }).sort({ recorded_at: -1 }),
      LabResult.find({ patient_id: id }).sort({ recorded_at: -1 }),
      Imaging.find({ patient_id: id }).sort({ recorded_at: -1 }),
      Timeline.find({ patient_id: id }).sort({ event_date: -1 }),
      WearableData.find({ patient_id: id }).sort({ recorded_at: 1 }),
      ClinicalAlert.find({ patient_id: id, resolved: false }).sort({ severity: -1, createdAt: -1 }),
      patientUserId ? Prescription.find({ patientId: patientUserId }).sort({ createdAt: -1 }) : [],
      patientUserId ? Medication.find({ patientId: patientUserId, status: 'ACTIVE' }).sort({ createdAt: -1 }) : [],
      patientUserId
        ? CustomReminder.find({ patientId: patientUserId })
            .sort({ remindAt: 1 })
            .populate('createdById', 'name profilePic role')
        : [],
    ]);

    res.json({
      patient: { id: patient._id, ...patient.toObject() },
      vitals,
      labs,
      images,
      timeline,
      wearable,
      alerts,
      prescriptions,
      reminders,
      customReminders: (customReminders || []).map((r) => ({
        _id: r._id,
        text: r.text,
        remindAt: r.remindAt,
        status: r.status,
        createdByRole: r.createdByRole,
        createdBy: r.createdById
          ? {
              id: r.createdById._id,
              name: r.createdById.name,
              role: r.createdById.role,
              profilePic: r.createdById.profilePic || null,
            }
          : null,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Doctor creates custom reminder for patient ---
router.post('/patients/:id/reminders', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    if (!doctorId) return res.status(401).json({ error: 'Invalid token' });

    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const patient = await DoctorPatient.findById(id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (!patient.patientId) return res.status(400).json({ error: 'This patient is not linked to a patient account' });

    const text = String(req.body?.text || '').trim();
    const date = String(req.body?.date || '').trim();
    const time = String(req.body?.time || '').trim();
    if (!text) return res.status(400).json({ error: 'Reminder text is required' });
    if (!date || !time) return res.status(400).json({ error: 'Date and time are required' });

    const remindAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(remindAt.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

    const doctorUser = await User.findById(doctorId).select('name profilePic role');

    const reminder = await CustomReminder.create({
      patientId: patient.patientId,
      createdById: doctorId,
      createdByRole: 'DOCTOR',
      text,
      remindAt,
      status: 'SCHEDULED',
    });

    res.status(201).json({
      _id: reminder._id,
      text: reminder.text,
      remindAt: reminder.remindAt,
      status: reminder.status,
      createdByRole: reminder.createdByRole,
      createdBy: doctorUser
        ? {
            id: doctorUser._id,
            name: doctorUser.name,
            role: doctorUser.role,
            profilePic: doctorUser.profilePic || null,
          }
        : null,
      createdAt: reminder.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to add reminder' });
  }
});

// --- Doctor adds prescription for patient ---
router.post('/patients/:id/prescriptions', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    if (!doctorId) return res.status(401).json({ error: 'Invalid token' });

    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const patient = await DoctorPatient.findById(id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (!patient.patientId) return res.status(400).json({ error: 'This patient is not linked to a patient account' });

    const { type = 'NEW', medicines = [], instructions = '' } = req.body;
    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({ error: 'At least one medicine is required' });
    }

    const doctorUser = await User.findById(doctorId).select('name registrationNumber');

    const normalizedMeds = medicines.map((m) => ({
      name: String(m.name || '').trim(),
      dosage: String(m.dosage || '').trim(),
      frequency: String(m.frequency || '').trim(),
      duration: String(m.duration || '').trim(),
      route: String(m.route || '').trim(),
      reminderTimes: Array.isArray(m.reminderTimes)
        ? m.reminderTimes.map((t) => String(t || '').trim()).filter(Boolean)
        : [],
    })).filter((m) => m.name);

    if (!normalizedMeds.length) return res.status(400).json({ error: 'Medicine names are required' });

    const prescription = await Prescription.create({
      patientId: patient.patientId,
      doctorId,
      doctorRecognizedName: doctorUser?.name || 'Doctor',
      doctorRegNo: doctorUser?.registrationNumber || '',
      date: new Date(),
      type: type === 'OLD' ? 'OLD' : 'NEW',
      verificationStatus: 'VERIFIED',
      verificationNote: 'Added directly by doctor',
      reviewedAt: new Date(),
      rawOcrData: {
        doctor: {
          name: doctorUser?.name || 'Doctor',
          regNo: doctorUser?.registrationNumber || '',
          clinic: '',
          date: new Date().toISOString().slice(0, 10),
        },
        patient: { name: patient.name || '' },
        medicines: normalizedMeds.map(({ reminderTimes, ...rest }) => rest),
        instructions: String(instructions || '').trim(),
      }
    });

    const medsToInsert = normalizedMeds.map((m) => ({
      prescriptionId: prescription._id,
      patientId: patient.patientId,
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: m.duration,
      reminderTimes: m.reminderTimes,
      doctorName: doctorUser?.name || 'Doctor',
      status: prescription.type === 'NEW' ? 'ACTIVE' : 'HISTORY',
      isManual: false,
    }));

    await Medication.insertMany(medsToInsert);

    res.status(201).json({
      success: true,
      prescription,
      medicationsAdded: medsToInsert.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to add prescription' });
  }
});

// --- Vitals ---
router.get('/patients/:id/vitals', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const rows = await Vital.find({ patient_id: id }).sort({ recorded_at: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Lab Results ---
router.get('/patients/:id/labs', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const rows = await LabResult.find({ patient_id: id }).sort({ recorded_at: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Imaging ---
router.get('/patients/:id/imaging', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const rows = await Imaging.find({ patient_id: id }).sort({ recorded_at: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Timeline ---
router.get('/patients/:id/timeline', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const rows = await Timeline.find({ patient_id: id }).sort({ event_date: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Wearable Data ---
router.get('/patients/:id/wearable', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const filter = { patient_id: id };
    if (req.query.metric) filter.metric = req.query.metric;
    const rows = await WearableData.find(filter).sort({ recorded_at: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Clinical Alerts ---
router.get('/alerts', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const dFilter = buildDoctorFilter(doctorId);
    const patientIds = (await DoctorPatient.find(dFilter).select('_id')).map(p => p._id);
    const filter = { resolved: false };
    if (patientIds.length) filter.patient_id = { $in: patientIds };

    const alerts = await ClinicalAlert.find(filter).sort({ severity: -1, createdAt: -1 });

    // Attach patient names
    const pIds = [...new Set(alerts.map(a => a.patient_id.toString()))];
    const patients = await DoctorPatient.find({ _id: { $in: pIds } }).select('name');
    const nameMap = {};
    patients.forEach(p => { nameMap[p._id.toString()] = p.name; });

    const result = alerts.map(a => ({
      ...a.toObject(),
      id: a._id,
      patient_name: nameMap[a.patient_id.toString()] || 'Unknown',
      patient_id: a.patient_id,
    }));

    // Sort: critical first, then warning, then info
    result.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
    });

    res.json(result);
  } catch (err) {
    console.error('Alerts error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Appointments ---
router.get('/appointments', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const doctorId = getDoctorId(req);
    const dFilter = buildDoctorFilter(doctorId);
    const patientIds = (await DoctorPatient.find(dFilter).select('_id')).map(p => p._id);
    const filter = { date };
    if (patientIds.length) filter.patient_id = { $in: patientIds };

    const appts = await Appointment.find(filter).sort({ completed: 1, time: 1 });

    const pIds = [...new Set(appts.map(a => a.patient_id.toString()))];
    const patients = await DoctorPatient.find({ _id: { $in: pIds } }).select('name primary_condition status');
    const pMap = {};
    patients.forEach(p => { pMap[p._id.toString()] = p; });

    const result = appts.map(a => ({
      id: a._id,
      time: a.time,
      purpose: a.purpose,
      room: a.room,
      priority: a.priority,
      date: a.date,
      completed: a.completed,
      patient_name: pMap[a.patient_id.toString()]?.name || 'Unknown',
      patient_id: a.patient_id,
      primary_condition: pMap[a.patient_id.toString()]?.primary_condition || '',
      patient_status: pMap[a.patient_id.toString()]?.status || '',
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch('/appointments/:id/done', async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid ID' });
    const appt = await Appointment.findById(id);
    if (!appt) return res.status(404).json({ error: 'Not found' });
    appt.completed = !appt.completed;
    await appt.save();
    res.json({ id: appt._id, completed: appt.completed });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Data Sources Summary ---
router.get('/sources', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const dFilter = buildDoctorFilter(doctorId);
    const patientIds = (await DoctorPatient.find(dFilter).select('_id')).map(p => p._id);
    const pFilter = patientIds.length ? { patient_id: { $in: patientIds } } : {};

    const unmatchedFilter = doctorId ? { doctorId } : {};

    const [ehr, wearable, labs, imaging, unmatchedEhr, unmatchedLabs, unmatchedImaging, unmatchedWearable] = await Promise.all([
      Vital.countDocuments({ ...pFilter, source: 'EHR' }),
      Vital.countDocuments({ ...pFilter, source: 'Wearable' }),
      LabResult.countDocuments(pFilter),
      Imaging.countDocuments(pFilter),
      UnmatchedSourceUpload.countDocuments({ ...unmatchedFilter, sourceType: 'EHR' }),
      UnmatchedSourceUpload.countDocuments({ ...unmatchedFilter, sourceType: 'Lab' }),
      UnmatchedSourceUpload.countDocuments({ ...unmatchedFilter, sourceType: 'Radiology' }),
      UnmatchedSourceUpload.countDocuments({ ...unmatchedFilter, sourceType: 'Wearable' }),
    ]);

    res.json({
      sources: [
        { name: 'Electronic Health Records', type: 'EHR', count: ehr + unmatchedEhr, status: 'Connected' },
        { name: 'Laboratory Systems', type: 'Lab', count: labs + unmatchedLabs, status: 'Connected' },
        { name: 'Radiology / Imaging', type: 'Radiology', count: imaging + unmatchedImaging, status: 'Connected' },
        { name: 'Wearable Devices', type: 'Wearable', count: wearable + unmatchedWearable, status: 'Connected' },
      ]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Source Detail Records ---
router.get('/sources/ehr', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const rows = await Vital.find({ source: 'EHR' }).sort({ recorded_at: -1 });
    const pIds = [...new Set(rows.map(r => r.patient_id.toString()))];
    const patients = await DoctorPatient.find({ _id: { $in: pIds } }).select('name');
    const nameMap = {};
    patients.forEach(p => { nameMap[p._id.toString()] = p.name; });
    const matched = rows.map(r => ({ ...r.toObject(), id: r._id, notInDb: false, patient_name: nameMap[r.patient_id.toString()] || 'Unknown' }));
    const unmatchedRows = await UnmatchedSourceUpload.find({ ...(doctorId ? { doctorId } : {}), sourceType: 'EHR' }).sort({ recorded_at: -1, createdAt: -1 });
    const unmatched = unmatchedRows.map((u) => ({
      id: u._id,
      patient_name: `${u.patientName} (not in db)`,
      notInDb: true,
      heart_rate: u.payload?.heart_rate,
      systolic: u.payload?.systolic,
      diastolic: u.payload?.diastolic,
      spo2: u.payload?.spo2,
      temperature: u.payload?.temperature,
      resp_rate: u.payload?.resp_rate,
      recorded_at: u.recorded_at || u.createdAt,
    }));
    res.json([...matched, ...unmatched].sort((a, b) => new Date(b.recorded_at || b.createdAt || 0) - new Date(a.recorded_at || a.createdAt || 0)));
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/sources/lab', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const rows = await LabResult.find().sort({ recorded_at: -1 });
    const pIds = [...new Set(rows.map(r => r.patient_id.toString()))];
    const patients = await DoctorPatient.find({ _id: { $in: pIds } }).select('name');
    const nameMap = {};
    patients.forEach(p => { nameMap[p._id.toString()] = p.name; });
    const matched = rows.map(r => ({ ...r.toObject(), id: r._id, notInDb: false, patient_name: nameMap[r.patient_id.toString()] || 'Unknown' }));
    const unmatchedRows = await UnmatchedSourceUpload.find({ ...(doctorId ? { doctorId } : {}), sourceType: 'Lab' }).sort({ recorded_at: -1, createdAt: -1 });
    const unmatched = unmatchedRows.map((u) => ({
      id: u._id,
      patient_name: `${u.patientName} (not in db)`,
      notInDb: true,
      test_name: u.payload?.test_name,
      value: u.payload?.value,
      unit: u.payload?.unit,
      ref_low: u.payload?.ref_low,
      ref_high: u.payload?.ref_high,
      flag: u.payload?.flag || 'normal',
      recorded_at: u.recorded_at || u.createdAt,
    }));
    res.json([...matched, ...unmatched].sort((a, b) => new Date(b.recorded_at || b.createdAt || 0) - new Date(a.recorded_at || a.createdAt || 0)));
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/sources/radiology', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const rows = await Imaging.find().sort({ recorded_at: -1 });
    const pIds = [...new Set(rows.map(r => r.patient_id.toString()))];
    const patients = await DoctorPatient.find({ _id: { $in: pIds } }).select('name');
    const nameMap = {};
    patients.forEach(p => { nameMap[p._id.toString()] = p.name; });
    const matched = rows.map(r => ({ ...r.toObject(), id: r._id, notInDb: false, patient_name: nameMap[r.patient_id.toString()] || 'Unknown' }));
    const unmatchedRows = await UnmatchedSourceUpload.find({ ...(doctorId ? { doctorId } : {}), sourceType: 'Radiology' }).sort({ recorded_at: -1, createdAt: -1 });
    const unmatched = unmatchedRows.map((u) => ({
      id: u._id,
      patient_name: `${u.patientName} (not in db)`,
      notInDb: true,
      modality: u.payload?.modality,
      body_part: u.payload?.body_part,
      finding: u.payload?.finding,
      impression: u.payload?.impression,
      status: u.payload?.status || 'Final',
      recorded_at: u.recorded_at || u.createdAt,
    }));
    res.json([...matched, ...unmatched].sort((a, b) => new Date(b.recorded_at || b.createdAt || 0) - new Date(a.recorded_at || a.createdAt || 0)));
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/sources/wearable', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const rows = await WearableData.find().sort({ recorded_at: -1 });
    const pIds = [...new Set(rows.map(r => r.patient_id.toString()))];
    const patients = await DoctorPatient.find({ _id: { $in: pIds } }).select('name');
    const nameMap = {};
    patients.forEach(p => { nameMap[p._id.toString()] = p.name; });
    const matched = rows.map(r => ({ ...r.toObject(), id: r._id, notInDb: false, patient_name: nameMap[r.patient_id.toString()] || 'Unknown' }));
    const unmatchedRows = await UnmatchedSourceUpload.find({ ...(doctorId ? { doctorId } : {}), sourceType: 'Wearable' }).sort({ recorded_at: -1, createdAt: -1 });
    const unmatched = unmatchedRows.map((u) => ({
      id: u._id,
      patient_name: `${u.patientName} (not in db)`,
      notInDb: true,
      metric: u.payload?.metric,
      value: u.payload?.value,
      recorded_at: u.recorded_at || u.createdAt,
    }));
    res.json([...matched, ...unmatched].sort((a, b) => new Date(b.recorded_at || b.createdAt || 0) - new Date(a.recorded_at || a.createdAt || 0)));
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Add Source Records ---
router.post('/sources/ehr', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const { patient_id, patient_name, heart_rate, systolic, diastolic, spo2, temperature, resp_rate } = req.body;
    const row = await resolveDoctorPatient({ doctorId, patient_id, patient_name });

    if (!row) {
      const fallbackName = normalizeName(patient_name);
      if (!fallbackName) return res.status(400).json({ error: 'Patient is required' });
      await UnmatchedSourceUpload.create({
        doctorId: doctorId || undefined,
        sourceType: 'EHR',
        patientName: fallbackName,
        payload: { heart_rate, systolic, diastolic, spo2, temperature, resp_rate },
      });
      return res.status(202).json({ ok: true, unmatched: true, patient_name: `${fallbackName} (not in db)` });
    }

    const vital = await Vital.create({
      patient_id: row._id,
      source: 'EHR',
      heart_rate,
      systolic,
      diastolic,
      spo2,
      temperature,
      resp_rate,
    });

    const linkedPatientId = await resolvePatientUserId(row, patient_name);
    await addMetricEntries(linkedPatientId, [
      { metricKey: 'heart_rate', metricLabel: 'Heart Rate', value: heart_rate, unit: 'bpm', recordedAt: vital.recorded_at, source: 'DOCTOR_EHR' },
      { metricKey: 'systolic_bp', metricLabel: 'Systolic BP', value: systolic, unit: 'mmHg', recordedAt: vital.recorded_at, source: 'DOCTOR_EHR' },
      { metricKey: 'diastolic_bp', metricLabel: 'Diastolic BP', value: diastolic, unit: 'mmHg', recordedAt: vital.recorded_at, source: 'DOCTOR_EHR' },
      { metricKey: 'spo2', metricLabel: 'SpO₂', value: spo2, unit: '%', recordedAt: vital.recorded_at, source: 'DOCTOR_EHR' },
      { metricKey: 'temperature', metricLabel: 'Temperature', value: temperature, unit: '°F', recordedAt: vital.recorded_at, source: 'DOCTOR_EHR' },
      { metricKey: 'resp_rate', metricLabel: 'Respiratory Rate', value: resp_rate, unit: '/min', recordedAt: vital.recorded_at, source: 'DOCTOR_EHR' },
    ]);

    res.status(201).json({ ok: true, linkedToPatient: Boolean(linkedPatientId) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/sources/lab', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const { patient_id, patient_name, test_name, value, unit, ref_low, ref_high, flag } = req.body;
    if (!test_name) return res.status(400).json({ error: 'Test name is required' });

    const row = await resolveDoctorPatient({ doctorId, patient_id, patient_name });
    if (!row) {
      const fallbackName = normalizeName(patient_name);
      if (!fallbackName) return res.status(400).json({ error: 'Patient is required' });
      await UnmatchedSourceUpload.create({
        doctorId: doctorId || undefined,
        sourceType: 'Lab',
        patientName: fallbackName,
        payload: { test_name: test_name.trim(), value, unit, ref_low, ref_high, flag: flag || 'normal' },
      });
      return res.status(202).json({ ok: true, unmatched: true, patient_name: `${fallbackName} (not in db)` });
    }

    const lab = await LabResult.create({ patient_id: row._id, test_name: test_name.trim(), value, unit, ref_low, ref_high, flag: flag || 'normal' });
    const linkedPatientId = await resolvePatientUserId(row, patient_name);
    await addMetricEntries(linkedPatientId, [
      {
        metricKey: `lab_${slugifyMetricKey(test_name)}`,
        metricLabel: test_name.trim(),
        value,
        unit: unit || '',
        recordedAt: lab.recorded_at,
        source: 'DOCTOR_LAB',
      },
    ]);

    res.status(201).json({ ok: true, linkedToPatient: Boolean(linkedPatientId) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/sources/radiology', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const { patient_id, patient_name, modality, body_part, finding, impression, status } = req.body;
    if (!modality) return res.status(400).json({ error: 'Modality is required' });

    const row = await resolveDoctorPatient({ doctorId, patient_id, patient_name });
    if (!row) {
      const fallbackName = normalizeName(patient_name);
      if (!fallbackName) return res.status(400).json({ error: 'Patient is required' });
      await UnmatchedSourceUpload.create({
        doctorId: doctorId || undefined,
        sourceType: 'Radiology',
        patientName: fallbackName,
        payload: { modality: modality.trim(), body_part, finding, impression, status: status || 'Final' },
      });
      return res.status(202).json({ ok: true, unmatched: true, patient_name: `${fallbackName} (not in db)` });
    }

    await Imaging.create({ patient_id: row._id, modality: modality.trim(), body_part, finding, impression, status: status || 'Final' });
    const linkedPatientId = await resolvePatientUserId(row, patient_name);

    res.status(201).json({ ok: true, linkedToPatient: Boolean(linkedPatientId) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/sources/wearable', async (req, res) => {
  try {
    const doctorId = getDoctorId(req);
    const { patient_id, patient_name, metric, value } = req.body;
    if (!metric || value == null) return res.status(400).json({ error: 'Metric and value are required' });

    const row = await resolveDoctorPatient({ doctorId, patient_id, patient_name });
    if (!row) {
      const fallbackName = normalizeName(patient_name);
      if (!fallbackName) return res.status(400).json({ error: 'Patient is required' });
      await UnmatchedSourceUpload.create({
        doctorId: doctorId || undefined,
        sourceType: 'Wearable',
        patientName: fallbackName,
        payload: { metric: metric.trim(), value },
      });
      return res.status(202).json({ ok: true, unmatched: true, patient_name: `${fallbackName} (not in db)` });
    }

    const wearable = await WearableData.create({ patient_id: row._id, metric: metric.trim(), value: Number(value) });
    const linkedPatientId = await resolvePatientUserId(row, patient_name);
    await addMetricEntries(linkedPatientId, [
      {
        metricKey: `wearable_${slugifyMetricKey(metric)}`,
        metricLabel: `Wearable: ${metric.trim()}`,
        value: Number(value),
        unit: '',
        recordedAt: wearable.recorded_at,
        source: 'DOCTOR_WEARABLE',
      },
    ]);

    res.status(201).json({ ok: true, linkedToPatient: Boolean(linkedPatientId) });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Glance ---
router.get('/glance', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const doctorId = getDoctorId(req);
    const dFilter = buildDoctorFilter(doctorId);
    const patientIds = (await DoctorPatient.find(dFilter).select('_id')).map(p => p._id);
    const apptFilter = { date: today };
    const alertFilter = { severity: 'critical', resolved: false };
    if (patientIds.length) {
      apptFilter.patient_id = { $in: patientIds };
      alertFilter.patient_id = { $in: patientIds };
    }
    const todayCount = await Appointment.countDocuments(apptFilter);
    const criticalCount = await ClinicalAlert.countDocuments(alertFilter);
    res.json({ today_patients: todayCount, critical_alerts: criticalCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// --- Sync patients from MongoDB (connected patients for logged-in doctor) ---
router.post('/sync', async (req, res) => {
  const doctorId = getDoctorId(req);
  if (!doctorId) return res.status(401).json({ error: 'Invalid token' });

  try {
    const doctor = await User.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    // Find all approved connections for this doctor
    const connections = await Connection.find({ doctorId, status: 'APPROVED' }).populate('patientId');

    let synced = 0;
    for (const conn of connections) {
      const patient = conn.patientId;
      if (!patient) continue;

      // Get active medications for this patient
      const meds = await Medication.find({ patientId: patient._id, status: 'ACTIVE' });
      const medsStr = meds.map(m => `${m.name}${m.dosage ? ' ' + m.dosage : ''}`).join(', ') || null;

      // Upsert into DoctorPatient
      await DoctorPatient.findOneAndUpdate(
        { doctorId, patientId: patient._id },
        {
          doctorId,
          patientId: patient._id,
          name: patient.name,
          age: patient.age || undefined,
          gender: patient.gender || undefined,
          primary_condition: patient.medicalConditions || 'General',
          allergies: patient.allergies || undefined,
          medications: medsStr,
          last_visit: new Date().toISOString().slice(0, 10),
        },
        { upsert: true, new: true }
      );
      synced++;
    }

    const total = await DoctorPatient.countDocuments({ doctorId });
    res.json({ synced, total, doctor: doctor.name });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

module.exports = router;

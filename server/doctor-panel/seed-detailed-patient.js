/**
 * Create or refresh one highly detailed demo patient with dense time-series data.
 * Usage: node doctor-panel/seed-detailed-patient.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');
const bcrypt = require('bcrypt');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const DoctorPatient = require('../models/DoctorPatient');
const Vital = require('../models/Vital');
const LabResult = require('../models/LabResult');
const Imaging = require('../models/Imaging');
const Timeline = require('../models/Timeline');
const WearableData = require('../models/WearableData');
const ClinicalAlert = require('../models/ClinicalAlert');
const Appointment = require('../models/Appointment');
const CustomReminder = require('../models/CustomReminder');
const Prescription = require('../models/Prescription');
const Medication = require('../models/Medication');
const TestResult = require('../models/TestResult');
const MetricEntry = require('../models/MetricEntry');

const DEMO_EMAIL = 'detailed.demo.patient@mediscribe.local';
const DEMO_NAME = 'Ritika Sharma (Detailed Demo)';

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

function withTime(date, hh, mm = 0) {
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function clamp(v, low, high) {
  return Math.max(low, Math.min(high, v));
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 10000,
    });
  } catch (err) {
    const dnsBlocked = err?.code === 'ECONNREFUSED' && (err?.syscall === 'querySrv' || err?.syscall === 'queryA');
    if (!dnsBlocked) throw err;

    console.warn('⚠️ Atlas DNS lookup failed. Retrying with 1.1.1.1 and 8.8.8.8 ...');
    dns.setServers(['1.1.1.1', '8.8.8.8']);

    await mongoose.connect(process.env.MONGODB_URI, {
      tlsAllowInvalidCertificates: true,
      serverSelectionTimeoutMS: 10000,
    });
  }
  console.log('Connected to MongoDB');

  // 1) Ensure patient account exists (for linked reminders/prescriptions features)
  let patientUser = await User.findOne({ email: DEMO_EMAIL });
  if (!patientUser) {
    const passwordHash = await bcrypt.hash('Demo@1234', 10);
    patientUser = await User.create({
      role: 'PATIENT',
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      passwordHash,
      age: 46,
      gender: 'Female',
      medicalConditions: 'Type 2 Diabetes, Hypertension, Early CKD, Dyslipidemia',
      allergies: 'Penicillin, Sulfa',
      emergencyContact: '+91-9000000000',
      profilePic: 'https://api.dicebear.com/7.x/notionists/svg?seed=Ritika%20Sharma',
    });
    console.log('Created linked PATIENT user');
  }

  // 2) Create/update DoctorPatient row
  const today = new Date();
  const patient = await DoctorPatient.findOneAndUpdate(
    { patientId: patientUser._id },
    {
      name: DEMO_NAME,
      age: 46,
      gender: 'Female',
      blood_type: 'B+',
      primary_condition: 'Type 2 Diabetes with Hypertension',
      status: 'Review',
      smoking_status: 'Never',
      allergies: 'Penicillin, Sulfa',
      medications: 'Metformin 1000mg BID, Telmisartan 40mg OD, Rosuvastatin 20mg HS, Empagliflozin 10mg OD',
      last_visit: fmtDate(today),
      patientId: patientUser._id,
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  // 3) Clear old detail data for this patient row, then repopulate densely
  await Promise.all([
    Vital.deleteMany({ patient_id: patient._id }),
    LabResult.deleteMany({ patient_id: patient._id }),
    Imaging.deleteMany({ patient_id: patient._id }),
    Timeline.deleteMany({ patient_id: patient._id }),
    WearableData.deleteMany({ patient_id: patient._id }),
    ClinicalAlert.deleteMany({ patient_id: patient._id }),
    Appointment.deleteMany({ patient_id: patient._id }),
    CustomReminder.deleteMany({ patientId: patientUser._id }),
    Prescription.deleteMany({ patientId: patientUser._id }),
    Medication.deleteMany({ patientId: patientUser._id }),
    TestResult.deleteMany({ patientId: patientUser._id }),
    MetricEntry.deleteMany({ patientId: patientUser._id }),
  ]);

  const start = new Date();
  start.setDate(start.getDate() - 89); // 90-day history

  // 4) Dense Wearable + Vitals time-series for bigger graphs
  const wearableRows = [];
  const vitalRows = [];

  for (let i = 0; i < 90; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);

    const trend = i / 89;
    const hrBase = 76 + Math.sin(i / 6) * 5 + trend * 3;
    const spo2Base = 97.2 - trend * 0.8 + Math.sin(i / 10) * 0.3;
    const glucoseBase = 158 + Math.sin(i / 4) * 22 + trend * 10;
    const stepBase = 5200 + Math.sin(i / 5) * 900 - trend * 1200;

    const morning = withTime(day, 8);
    const evening = withTime(day, 20);

    wearableRows.push(
      { patient_id: patient._id, metric: 'heart_rate', value: Math.round(clamp(hrBase - 2, 58, 120)), recorded_at: morning },
      { patient_id: patient._id, metric: 'heart_rate', value: Math.round(clamp(hrBase + 2, 58, 120)), recorded_at: evening },
      { patient_id: patient._id, metric: 'spo2', value: Number(clamp(spo2Base, 90, 99).toFixed(1)), recorded_at: morning },
      { patient_id: patient._id, metric: 'glucose', value: Math.round(clamp(glucoseBase, 95, 290)), recorded_at: withTime(day, 14) },
      { patient_id: patient._id, metric: 'steps', value: Math.round(clamp(stepBase, 1200, 12000)), recorded_at: withTime(day, 21) }
    );

    if (i % 2 === 0) {
      const systolic = Math.round(clamp(126 + Math.sin(i / 7) * 8 + trend * 9, 108, 172));
      const diastolic = Math.round(clamp(80 + Math.sin(i / 8) * 5 + trend * 5, 66, 108));
      const temp = Number((36.5 + Math.sin(i / 11) * 0.4).toFixed(1));
      const resp = Math.round(clamp(16 + Math.sin(i / 9) * 2, 12, 24));

      vitalRows.push({
        patient_id: patient._id,
        source: i % 4 === 0 ? 'EHR' : 'Wearable',
        heart_rate: Math.round(clamp(hrBase, 58, 120)),
        systolic,
        diastolic,
        spo2: Number(clamp(spo2Base, 90, 99).toFixed(1)),
        temperature: temp,
        resp_rate: resp,
        recorded_at: withTime(day, 9),
      });
    }
  }

  await WearableData.insertMany(wearableRows);
  await Vital.insertMany(vitalRows);

  // 5) Rich lab panel snapshots (12 dates x multiple tests)
  const labs = [];
  const labDates = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(today);
    d.setDate(today.getDate() - k * 8);
    return d;
  });

  labDates.forEach((d, idx) => {
    const t = idx / 11;
    labs.push(
      { patient_id: patient._id, test_name: 'HbA1c', value: Number((8.4 + t * 1.0).toFixed(1)), unit: '%', ref_low: 4.0, ref_high: 5.6, flag: t > 0.5 ? 'High' : 'Critical', recorded_at: d },
      { patient_id: patient._id, test_name: 'Fasting Glucose', value: Math.round(156 + t * 40), unit: 'mg/dL', ref_low: 70, ref_high: 100, flag: 'High', recorded_at: d },
      { patient_id: patient._id, test_name: 'Creatinine', value: Number((1.0 + t * 0.5).toFixed(2)), unit: 'mg/dL', ref_low: 0.7, ref_high: 1.3, flag: t > 0.65 ? 'High' : 'Normal', recorded_at: d },
      { patient_id: patient._id, test_name: 'eGFR', value: Math.round(84 - t * 22), unit: 'mL/min', ref_low: 60, ref_high: 120, flag: t > 0.7 ? 'Low' : 'Normal', recorded_at: d },
      { patient_id: patient._id, test_name: 'LDL Cholesterol', value: Math.round(128 + t * 24), unit: 'mg/dL', ref_low: 0, ref_high: 100, flag: 'High', recorded_at: d },
      { patient_id: patient._id, test_name: 'Triglycerides', value: Math.round(180 + t * 55), unit: 'mg/dL', ref_low: 0, ref_high: 150, flag: 'High', recorded_at: d }
    );
  });

  await LabResult.insertMany(labs);

  // 6) Imaging records
  const imagingRows = [
    {
      patient_id: patient._id,
      modality: 'Echocardiogram',
      body_part: 'Heart',
      finding: 'Mild concentric LVH, EF 52%',
      impression: 'Borderline diastolic dysfunction; monitor BP control.',
      status: 'Final',
      recorded_at: new Date(today.getFullYear(), today.getMonth() - 2, 14),
    },
    {
      patient_id: patient._id,
      modality: 'Fundus Photography',
      body_part: 'Eyes',
      finding: 'Mild non-proliferative diabetic retinopathy',
      impression: 'Yearly retinal follow-up advised.',
      status: 'Final',
      recorded_at: new Date(today.getFullYear(), today.getMonth() - 1, 20),
    },
    {
      patient_id: patient._id,
      modality: 'Renal Ultrasound',
      body_part: 'Kidneys',
      finding: 'Mild increased cortical echogenicity',
      impression: 'Consistent with early chronic kidney disease changes.',
      status: 'Final',
      recorded_at: new Date(today.getFullYear(), today.getMonth() - 1, 3),
    },
    {
      patient_id: patient._id,
      modality: 'Chest X-Ray',
      body_part: 'Chest',
      finding: 'No focal consolidation or pleural effusion',
      impression: 'No active cardiopulmonary disease.',
      status: 'Final',
      recorded_at: new Date(today.getFullYear(), today.getMonth(), 2),
    },
  ];
  await Imaging.insertMany(imagingRows);

  // 7) Timeline entries (many)
  const timelineRows = [];
  for (let i = 0; i < 36; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 2);
    const kind = i % 6;
    const events = [
      { event_type: 'wearable', title: 'Home trend sync', detail: 'Wearable data synced successfully from mobile app.', source: 'Wearable' },
      { event_type: 'lab', title: 'Lab panel reviewed', detail: 'Diabetes and lipid panel reviewed with treatment notes.', source: 'Lab' },
      { event_type: 'visit', title: 'Follow-up consultation', detail: 'Lifestyle and medication adherence counseling done.', source: 'EHR' },
      { event_type: 'medication', title: 'Medication plan adjusted', detail: 'Dose timing optimized for improved fasting glucose.', source: 'EHR' },
      { event_type: 'imaging', title: 'Imaging report added', detail: 'Imaging reviewed; no urgent progression noted.', source: 'Radiology' },
      { event_type: 'alert', title: 'Risk alert generated', detail: 'Out-of-range trend detected and added to monitoring queue.', source: 'AI Monitor' },
    ][kind];

    timelineRows.push({
      patient_id: patient._id,
      event_type: events.event_type,
      title: events.title,
      detail: events.detail,
      source: events.source,
      event_date: fmtDate(d),
    });
  }
  await Timeline.insertMany(timelineRows);

  // 8) Alerts
  const alerts = [
    { patient_id: patient._id, severity: 'warning', message: 'Fasting glucose trend elevated for 2 weeks.', source: 'Lab', resolved: false },
    { patient_id: patient._id, severity: 'warning', message: 'Night-time heart rate variability reduced.', source: 'Wearable', resolved: false },
    { patient_id: patient._id, severity: 'critical', message: 'eGFR downtrend suggests CKD progression risk.', source: 'Lab', resolved: false },
    { patient_id: patient._id, severity: 'info', message: 'Medication adherence improved from 62% to 81%.', source: 'EHR', resolved: false },
  ];
  await ClinicalAlert.insertMany(alerts);

  // 9) Appointments
  const appts = [
    { patient_id: patient._id, time: '09:00', purpose: 'Diabetes review', room: 'Room 2', priority: true, date: fmtDate(new Date(today.getTime() + 2 * 86400000)) },
    { patient_id: patient._id, time: '11:30', purpose: 'Nephrology consult', room: 'Room 5', priority: true, date: fmtDate(new Date(today.getTime() + 7 * 86400000)) },
    { patient_id: patient._id, time: '10:00', purpose: 'Dietician follow-up', room: 'Room 1', priority: false, date: fmtDate(new Date(today.getTime() + 14 * 86400000)) },
  ];
  await Appointment.insertMany(appts);

  // 10) Custom reminders linked to patient account
  const reminders = [
    { patientId: patientUser._id, createdById: patientUser._id, createdByRole: 'PATIENT', text: 'Check fasting sugar before breakfast', remindAt: withTime(new Date(today.getTime() + 1 * 86400000), 7, 0), status: 'SCHEDULED' },
    { patientId: patientUser._id, createdById: patientUser._id, createdByRole: 'PATIENT', text: 'Evening walk 30 minutes', remindAt: withTime(new Date(today.getTime() + 1 * 86400000), 19, 0), status: 'SCHEDULED' },
  ];
  await CustomReminder.insertMany(reminders);

  // 11) User-facing prescriptions + medications (used in patient dashboard/history/reminders)
  const rxNew = await Prescription.create({
    patientId: patientUser._id,
    doctorRecognizedName: 'Dr. A. Mehta',
    doctorRegNo: 'MH-REG-77821',
    date: new Date(today.getTime() - 5 * 86400000),
    type: 'NEW',
    verificationStatus: 'VERIFIED',
    verificationNote: 'Seeded detailed demo data',
    reviewedAt: new Date(today.getTime() - 5 * 86400000),
    rawOcrData: {
      doctor: { name: 'Dr. A. Mehta', regNo: 'MH-REG-77821', clinic: 'City Endocrine Clinic', date: fmtDate(new Date(today.getTime() - 5 * 86400000)) },
      patient: { name: DEMO_NAME },
      medicines: [
        { name: 'Metformin', dosage: '1000mg', frequency: 'Twice daily', duration: '90 days', route: 'Oral' },
        { name: 'Telmisartan', dosage: '40mg', frequency: 'Once daily', duration: '90 days', route: 'Oral' },
        { name: 'Rosuvastatin', dosage: '20mg', frequency: 'Nightly', duration: '90 days', route: 'Oral' },
      ],
      instructions: 'Take after meals. Continue daily walking and low-salt diet.',
    },
  });

  const rxOld = await Prescription.create({
    patientId: patientUser._id,
    doctorRecognizedName: 'Dr. R. Kulkarni',
    doctorRegNo: 'MH-REG-55810',
    date: new Date(today.getTime() - 48 * 86400000),
    type: 'OLD',
    verificationStatus: 'VERIFIED',
    verificationNote: 'Seeded historical prescription',
    reviewedAt: new Date(today.getTime() - 47 * 86400000),
    rawOcrData: {
      doctor: { name: 'Dr. R. Kulkarni', regNo: 'MH-REG-55810', clinic: 'Metro Internal Medicine', date: fmtDate(new Date(today.getTime() - 48 * 86400000)) },
      patient: { name: DEMO_NAME },
      medicines: [
        { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', duration: '60 days', route: 'Oral' },
        { name: 'Glimepiride', dosage: '2mg', frequency: 'Once daily', duration: '60 days', route: 'Oral' },
      ],
      instructions: 'Historical treatment before regimen optimization.',
    },
  });

  const meds = [
    {
      prescriptionId: rxNew._id,
      patientId: patientUser._id,
      name: 'Metformin',
      dosage: '1000mg',
      frequency: 'Twice daily',
      duration: '90 days',
      reminderTimes: ['08:00', '20:00'],
      doctorName: 'Dr. A. Mehta',
      status: 'ACTIVE',
      isManual: false,
      startDate: new Date(today.getTime() - 5 * 86400000),
      endDate: new Date(today.getTime() + 85 * 86400000),
    },
    {
      prescriptionId: rxNew._id,
      patientId: patientUser._id,
      name: 'Telmisartan',
      dosage: '40mg',
      frequency: 'Once daily',
      duration: '90 days',
      reminderTimes: ['07:30'],
      doctorName: 'Dr. A. Mehta',
      status: 'ACTIVE',
      isManual: false,
      startDate: new Date(today.getTime() - 5 * 86400000),
      endDate: new Date(today.getTime() + 85 * 86400000),
    },
    {
      prescriptionId: rxNew._id,
      patientId: patientUser._id,
      name: 'Rosuvastatin',
      dosage: '20mg',
      frequency: 'Nightly',
      duration: '90 days',
      reminderTimes: ['22:00'],
      doctorName: 'Dr. A. Mehta',
      status: 'ACTIVE',
      isManual: false,
      startDate: new Date(today.getTime() - 5 * 86400000),
      endDate: new Date(today.getTime() + 85 * 86400000),
    },
    {
      prescriptionId: rxOld._id,
      patientId: patientUser._id,
      name: 'Amlodipine',
      dosage: '5mg',
      frequency: 'Once daily',
      duration: '60 days',
      reminderTimes: ['09:00'],
      doctorName: 'Dr. R. Kulkarni',
      status: 'COMPLETED',
      isManual: false,
      startDate: new Date(today.getTime() - 48 * 86400000),
      endDate: new Date(today.getTime() - 2 * 86400000),
    },
    {
      prescriptionId: rxOld._id,
      patientId: patientUser._id,
      name: 'Glimepiride',
      dosage: '2mg',
      frequency: 'Once daily',
      duration: '60 days',
      reminderTimes: ['08:30'],
      doctorName: 'Dr. R. Kulkarni',
      status: 'HISTORY',
      isManual: false,
      startDate: new Date(today.getTime() - 48 * 86400000),
      endDate: new Date(today.getTime() - 1 * 86400000),
    },
  ];
  await Medication.insertMany(meds);

  // 12) Test reports with OCR-style tests (used by Medical History cards + trends)
  const testReports = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 14);
    const t = i / 5;
    testReports.push({
      patientId: patientUser._id,
      title: `Comprehensive Metabolic Panel #${6 - i}`,
      testDate: d,
      rawOcrData: {
        labName: 'MediLab Diagnostics',
        tests: [
          { name: 'Blood Sugar (Fasting)', value: String(Math.round(150 + t * 35)), unit: 'mg/dL' },
          { name: 'HbA1c', value: (8.1 + t * 1.1).toFixed(1), unit: '%' },
          { name: 'Creatinine', value: (1.0 + t * 0.45).toFixed(2), unit: 'mg/dL' },
          { name: 'LDL Cholesterol', value: String(Math.round(126 + t * 28)), unit: 'mg/dL' },
          { name: 'Hemoglobin', value: (12.6 - t * 0.8).toFixed(1), unit: 'g/dL' },
        ],
      },
    });
  }
  await TestResult.insertMany(testReports);

  // 13) Dense MetricEntry rows for Health Stats Trends graph
  const metricRows = [];
  for (let i = 0; i < 90; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    metricRows.push(
      {
        patientId: patientUser._id,
        metricKey: 'blood_sugar',
        metricLabel: 'Blood Sugar',
        value: Math.round(clamp(152 + Math.sin(i / 4) * 20 + (i / 89) * 14, 90, 300)),
        unit: 'mg/dL',
        recordedAt: withTime(d, 7, 30),
        source: 'DOCTOR_WEARABLE',
      },
      {
        patientId: patientUser._id,
        metricKey: 'cholesterol',
        metricLabel: 'Cholesterol',
        value: Math.round(clamp(205 + Math.sin(i / 10) * 14 + (i / 89) * 18, 130, 320)),
        unit: 'mg/dL',
        recordedAt: withTime(d, 9, 0),
        source: 'DOCTOR_LAB',
      },
      {
        patientId: patientUser._id,
        metricKey: 'creatinine',
        metricLabel: 'Creatinine',
        value: Number((clamp(1.0 + (i / 89) * 0.45 + Math.sin(i / 11) * 0.05, 0.6, 2.5)).toFixed(2)),
        unit: 'mg/dL',
        recordedAt: withTime(d, 9, 10),
        source: 'DOCTOR_LAB',
      },
      {
        patientId: patientUser._id,
        metricKey: 'hemoglobin',
        metricLabel: 'Hemoglobin',
        value: Number((clamp(12.9 - (i / 89) * 1.1 + Math.sin(i / 14) * 0.2, 9.0, 15.5)).toFixed(1)),
        unit: 'g/dL',
        recordedAt: withTime(d, 9, 20),
        source: 'DOCTOR_LAB',
      }
    );
  }
  await MetricEntry.insertMany(metricRows);

  console.log('');
  console.log('✅ Detailed patient seeded successfully');
  console.log(`DoctorPatient ID: ${patient._id}`);
  console.log(`Linked User ID: ${patientUser._id}`);
  console.log(`Wearable points: ${wearableRows.length}`);
  console.log(`Vitals points: ${vitalRows.length}`);
  console.log(`Lab rows: ${labs.length}`);
  console.log(`Timeline rows: ${timelineRows.length}`);
  console.log(`Prescriptions: 2`);
  console.log(`Medications: ${meds.length}`);
  console.log(`Test reports: ${testReports.length}`);
  console.log(`Metric entries: ${metricRows.length}`);

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Seed detailed patient error:', err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  });

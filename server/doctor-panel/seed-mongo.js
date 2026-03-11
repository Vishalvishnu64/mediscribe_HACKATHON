/**
 * Seed script for MediDash clinical data into MongoDB.
 * Usage: node doctor-panel/seed-mongo.js
 * Requires MONGODB_URI in .env
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DoctorPatient = require('../models/DoctorPatient');
const Vital = require('../models/Vital');
const LabResult = require('../models/LabResult');
const Imaging = require('../models/Imaging');
const Timeline = require('../models/Timeline');
const WearableData = require('../models/WearableData');
const ClinicalAlert = require('../models/ClinicalAlert');
const Appointment = require('../models/Appointment');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, { tlsAllowInvalidCertificates: true });
  console.log('Connected to MongoDB');

  // Clear existing clinical data
  await Promise.all([
    DoctorPatient.deleteMany({}),
    Vital.deleteMany({}),
    LabResult.deleteMany({}),
    Imaging.deleteMany({}),
    Timeline.deleteMany({}),
    WearableData.deleteMany({}),
    ClinicalAlert.deleteMany({}),
    Appointment.deleteMany({}),
  ]);
  console.log('Cleared existing clinical data');

  // --- Patients (20 patients, no doctorId = demo data) ---
  const patientsData = [
    { name: 'Olivia Hart',    age: 34, gender: 'F', blood_type: 'O+',  primary_condition: 'Coronary Artery Disease',  status: 'Stable',   smoking_status: 'Never',   allergies: 'Penicillin',      medications: 'Aspirin 81mg, Atorvastatin 40mg, Metoprolol 25mg',        last_visit: '2026-03-11' },
    { name: 'Noah Patel',     age: 58, gender: 'M', blood_type: 'A+',  primary_condition: 'Hypertension',             status: 'Review',   smoking_status: 'Former',  allergies: 'None',            medications: 'Lisinopril 20mg, Amlodipine 5mg, HCTZ 25mg',              last_visit: '2026-03-11' },
    { name: 'Emma Rossi',     age: 27, gender: 'F', blood_type: 'B+',  primary_condition: 'Asthma',                   status: 'Stable',   smoking_status: 'Never',   allergies: 'Sulfa drugs',     medications: 'Albuterol PRN, Fluticasone 250mcg',                       last_visit: '2026-03-11' },
    { name: 'Liam Carter',    age: 45, gender: 'M', blood_type: 'AB+', primary_condition: 'Type 2 Diabetes',          status: 'Critical', smoking_status: 'Never',   allergies: 'None',            medications: 'Metformin 1000mg, Glipizide 5mg, Insulin Glargine 20u',   last_visit: '2026-03-11' },
    { name: 'Ava Thompson',   age: 62, gender: 'F', blood_type: 'A-',  primary_condition: 'COPD',                     status: 'Review',   smoking_status: 'Current', allergies: 'Latex',           medications: 'Tiotropium 18mcg, Prednisone 10mg, Albuterol PRN',        last_visit: '2026-03-10' },
    { name: 'Mason Lee',      age: 51, gender: 'M', blood_type: 'O-',  primary_condition: 'Atrial Fibrillation',      status: 'Stable',   smoking_status: 'Never',   allergies: 'Iodine contrast', medications: 'Warfarin 5mg, Diltiazem 120mg, Digoxin 0.125mg',          last_visit: '2026-03-09' },
    { name: 'Sophia Khan',    age: 39, gender: 'F', blood_type: 'B-',  primary_condition: 'Chronic Kidney Disease',   status: 'Review',   smoking_status: 'Never',   allergies: 'ACE inhibitors',  medications: 'Erythropoietin, Calcitriol 0.25mcg, Sevelamer 800mg',     last_visit: '2026-03-08' },
    { name: 'Lucas Gray',     age: 70, gender: 'M', blood_type: 'A+',  primary_condition: 'Heart Failure',            status: 'Critical', smoking_status: 'Former',  allergies: 'None',            medications: 'Furosemide 40mg, Carvedilol 12.5mg, Spironolactone 25mg', last_visit: '2026-03-07' },
    { name: 'Isabella Chen',  age: 29, gender: 'F', blood_type: 'O+',  primary_condition: 'Migraine with Aura',       status: 'Stable',   smoking_status: 'Never',   allergies: 'NSAIDs',          medications: 'Sumatriptan 50mg PRN, Topiramate 50mg',                   last_visit: '2026-03-06' },
    { name: 'James Okoro',    age: 67, gender: 'M', blood_type: 'AB-', primary_condition: 'Lung Cancer Stage II',      status: 'Critical', smoking_status: 'Former',  allergies: 'Carboplatin',     medications: 'Pembrolizumab, Ondansetron 8mg, Morphine 15mg PRN',       last_visit: '2026-03-05' },
    { name: 'Mia Fernandez',  age: 42, gender: 'F', blood_type: 'A+',  primary_condition: 'Rheumatoid Arthritis',     status: 'Stable',   smoking_status: 'Never',   allergies: 'None',            medications: 'Methotrexate 15mg, Folic Acid 1mg',                       last_visit: '2026-03-10' },
    { name: 'Ethan Brooks',   age: 55, gender: 'M', blood_type: 'O+',  primary_condition: 'Chronic Heart Failure',    status: 'Review',   smoking_status: 'Former',  allergies: 'Aspirin',         medications: 'Enalapril 10mg, Metoprolol 50mg',                         last_visit: '2026-03-09' },
    { name: 'Charlotte Wu',   age: 31, gender: 'F', blood_type: 'B+',  primary_condition: 'Epilepsy',                 status: 'Stable',   smoking_status: 'Never',   allergies: 'None',            medications: 'Levetiracetam 500mg, Lamotrigine 100mg',                  last_visit: '2026-03-08' },
    { name: 'Daniel Singh',   age: 48, gender: 'M', blood_type: 'AB+', primary_condition: 'Chronic Liver Disease',     status: 'Review',   smoking_status: 'Never',   allergies: 'Codeine',         medications: 'Lactulose 30mL, Spironolactone 100mg',                    last_visit: '2026-03-07' },
    { name: 'Amelia Johnson', age: 36, gender: 'F', blood_type: 'A-',  primary_condition: 'Systemic Lupus',           status: 'Stable',   smoking_status: 'Never',   allergies: 'Sulfonamides',    medications: 'Hydroxychloroquine 200mg, Prednisone 5mg',                last_visit: '2026-03-06' },
    { name: 'Benjamin Diaz',  age: 60, gender: 'M', blood_type: 'O-',  primary_condition: 'Peripheral Artery Disease',status: 'Review',   smoking_status: 'Current', allergies: 'Heparin',         medications: 'Clopidogrel 75mg, Atorvastatin 80mg',                     last_visit: '2026-03-05' },
    { name: 'Harper Scott',   age: 25, gender: 'F', blood_type: 'B-',  primary_condition: 'Type 1 Diabetes',          status: 'Stable',   smoking_status: 'Never',   allergies: 'None',            medications: 'Insulin Lispro, Insulin Glargine 18u',                    last_visit: '2026-03-04' },
    { name: 'Alexander Kim',  age: 72, gender: 'M', blood_type: 'A+',  primary_condition: 'Parkinson Disease',        status: 'Review',   smoking_status: 'Never',   allergies: 'None',            medications: 'Levodopa/Carbidopa 25/100mg, Pramipexole 0.5mg',          last_visit: '2026-03-03' },
    { name: 'Evelyn Taylor',  age: 44, gender: 'F', blood_type: 'O+',  primary_condition: 'Multiple Sclerosis',       status: 'Stable',   smoking_status: 'Never',   allergies: 'Latex',           medications: 'Dimethyl Fumarate 240mg, Baclofen 10mg',                  last_visit: '2026-03-02' },
    { name: 'William Adams',  age: 63, gender: 'M', blood_type: 'AB-', primary_condition: 'Chronic Kidney Disease',   status: 'Critical', smoking_status: 'Former',  allergies: 'None',            medications: 'Erythropoietin, Calcitriol, Phosphate Binder',            last_visit: '2026-03-01' },
  ];

  const patients = await DoctorPatient.insertMany(patientsData);
  console.log(`Inserted ${patients.length} patients`);

  // Build a lookup by index for easy referencing
  const p = (idx) => patients[idx]._id;

  // --- Vitals ---
  const vitalsData = [
    { patient_id: p(0), source: 'EHR',      heart_rate: 72, systolic: 118, diastolic: 76, spo2: 98.2, temperature: 36.7, resp_rate: 16, recorded_at: new Date('2026-03-11T08:00') },
    { patient_id: p(0), source: 'Wearable', heart_rate: 68, spo2: 97.8, recorded_at: new Date('2026-03-11T10:00') },
    { patient_id: p(0), source: 'Wearable', heart_rate: 74, spo2: 98.0, recorded_at: new Date('2026-03-11T12:00') },
    { patient_id: p(1), source: 'EHR',      heart_rate: 80, systolic: 152, diastolic: 94, spo2: 97.5, temperature: 36.8, resp_rate: 18, recorded_at: new Date('2026-03-11T09:00') },
    { patient_id: p(1), source: 'Wearable', heart_rate: 84, spo2: 97.2, recorded_at: new Date('2026-03-11T11:00') },
    { patient_id: p(2), source: 'EHR',      heart_rate: 76, systolic: 112, diastolic: 72, spo2: 96.8, temperature: 36.6, resp_rate: 20, recorded_at: new Date('2026-03-11T10:00') },
    { patient_id: p(2), source: 'Wearable', heart_rate: 78, spo2: 97.0, recorded_at: new Date('2026-03-11T14:00') },
    { patient_id: p(3), source: 'EHR',      heart_rate: 92, systolic: 140, diastolic: 88, spo2: 96.0, temperature: 37.2, resp_rate: 22, recorded_at: new Date('2026-03-11T07:30') },
    { patient_id: p(3), source: 'Wearable', heart_rate: 96, spo2: 95.5, recorded_at: new Date('2026-03-11T09:00') },
    { patient_id: p(3), source: 'Wearable', heart_rate: 88, spo2: 96.2, recorded_at: new Date('2026-03-11T12:00') },
    { patient_id: p(4), source: 'EHR',      heart_rate: 86, systolic: 134, diastolic: 82, spo2: 91.0, temperature: 37.0, resp_rate: 24, recorded_at: new Date('2026-03-10T14:00') },
    { patient_id: p(4), source: 'Wearable', heart_rate: 90, spo2: 89.5, recorded_at: new Date('2026-03-10T18:00') },
    { patient_id: p(7), source: 'EHR',      heart_rate: 98, systolic: 148, diastolic: 92, spo2: 93.0, temperature: 37.1, resp_rate: 26, recorded_at: new Date('2026-03-07T08:00') },
    { patient_id: p(7), source: 'Wearable', heart_rate: 102, spo2: 92.5, recorded_at: new Date('2026-03-07T12:00') },
    { patient_id: p(9), source: 'EHR',      heart_rate: 88, systolic: 128, diastolic: 78, spo2: 90.0, temperature: 37.8, resp_rate: 28, recorded_at: new Date('2026-03-05T09:00') },
    { patient_id: p(9), source: 'Wearable', heart_rate: 92, spo2: 89.0, recorded_at: new Date('2026-03-05T15:00') },
  ];
  await Vital.insertMany(vitalsData);
  console.log(`Inserted ${vitalsData.length} vitals`);

  // --- Lab Results ---
  const labData = [
    { patient_id: p(0), test_name: 'Total Cholesterol',  value: 242,   unit: 'mg/dL',  ref_low: 0,    ref_high: 200,  flag: 'High',     recorded_at: new Date('2026-03-11') },
    { patient_id: p(0), test_name: 'LDL Cholesterol',    value: 158,   unit: 'mg/dL',  ref_low: 0,    ref_high: 100,  flag: 'High',     recorded_at: new Date('2026-03-11') },
    { patient_id: p(0), test_name: 'HDL Cholesterol',    value: 52,    unit: 'mg/dL',  ref_low: 40,   ref_high: 60,   flag: 'Normal',   recorded_at: new Date('2026-03-11') },
    { patient_id: p(0), test_name: 'Troponin I',         value: 0.02,  unit: 'ng/mL',  ref_low: 0,    ref_high: 0.04, flag: 'Normal',   recorded_at: new Date('2026-03-11') },
    { patient_id: p(0), test_name: 'BNP',                value: 45,    unit: 'pg/mL',  ref_low: 0,    ref_high: 100,  flag: 'Normal',   recorded_at: new Date('2026-03-11') },
    { patient_id: p(1), test_name: 'Creatinine',         value: 1.1,   unit: 'mg/dL',  ref_low: 0.7,  ref_high: 1.3,  flag: 'Normal',   recorded_at: new Date('2026-03-11') },
    { patient_id: p(1), test_name: 'Potassium',          value: 4.8,   unit: 'mEq/L',  ref_low: 3.5,  ref_high: 5.0,  flag: 'Normal',   recorded_at: new Date('2026-03-11') },
    { patient_id: p(1), test_name: 'BUN',                value: 22,    unit: 'mg/dL',  ref_low: 7,    ref_high: 20,   flag: 'High',     recorded_at: new Date('2026-03-11') },
    { patient_id: p(3), test_name: 'HbA1c',              value: 9.2,   unit: '%',      ref_low: 4.0,  ref_high: 5.6,  flag: 'Critical', recorded_at: new Date('2026-03-11') },
    { patient_id: p(3), test_name: 'Fasting Glucose',    value: 218,   unit: 'mg/dL',  ref_low: 70,   ref_high: 100,  flag: 'Critical', recorded_at: new Date('2026-03-11') },
    { patient_id: p(3), test_name: 'Creatinine',         value: 1.6,   unit: 'mg/dL',  ref_low: 0.7,  ref_high: 1.3,  flag: 'High',     recorded_at: new Date('2026-03-11') },
    { patient_id: p(3), test_name: 'eGFR',               value: 52,    unit: 'mL/min', ref_low: 60,   ref_high: 120,  flag: 'Low',      recorded_at: new Date('2026-03-11') },
    { patient_id: p(4), test_name: 'WBC',                value: 12.4,  unit: 'K/uL',   ref_low: 4.5,  ref_high: 11.0, flag: 'High',     recorded_at: new Date('2026-03-10') },
    { patient_id: p(4), test_name: 'CRP',                value: 28,    unit: 'mg/L',   ref_low: 0,    ref_high: 10,   flag: 'High',     recorded_at: new Date('2026-03-10') },
    { patient_id: p(4), test_name: 'ABG pH',             value: 7.32,  unit: '',       ref_low: 7.35, ref_high: 7.45, flag: 'Low',      recorded_at: new Date('2026-03-10') },
    { patient_id: p(4), test_name: 'pCO2',               value: 52,    unit: 'mmHg',   ref_low: 35,   ref_high: 45,   flag: 'High',     recorded_at: new Date('2026-03-10') },
    { patient_id: p(6), test_name: 'Creatinine',         value: 3.8,   unit: 'mg/dL',  ref_low: 0.7,  ref_high: 1.3,  flag: 'Critical', recorded_at: new Date('2026-03-08') },
    { patient_id: p(6), test_name: 'eGFR',               value: 18,    unit: 'mL/min', ref_low: 60,   ref_high: 120,  flag: 'Critical', recorded_at: new Date('2026-03-08') },
    { patient_id: p(6), test_name: 'Phosphorus',         value: 6.2,   unit: 'mg/dL',  ref_low: 2.5,  ref_high: 4.5,  flag: 'High',     recorded_at: new Date('2026-03-08') },
    { patient_id: p(6), test_name: 'Calcium',            value: 8.0,   unit: 'mg/dL',  ref_low: 8.5,  ref_high: 10.5, flag: 'Low',      recorded_at: new Date('2026-03-08') },
    { patient_id: p(7), test_name: 'BNP',                value: 890,   unit: 'pg/mL',  ref_low: 0,    ref_high: 100,  flag: 'Critical', recorded_at: new Date('2026-03-07') },
    { patient_id: p(7), test_name: 'Sodium',             value: 131,   unit: 'mEq/L',  ref_low: 136,  ref_high: 145,  flag: 'Low',      recorded_at: new Date('2026-03-07') },
    { patient_id: p(7), test_name: 'Troponin I',         value: 0.08,  unit: 'ng/mL',  ref_low: 0,    ref_high: 0.04, flag: 'High',     recorded_at: new Date('2026-03-07') },
    { patient_id: p(9), test_name: 'Hemoglobin',         value: 10.2,  unit: 'g/dL',   ref_low: 13.5, ref_high: 17.5, flag: 'Low',      recorded_at: new Date('2026-03-05') },
    { patient_id: p(9), test_name: 'Platelets',          value: 98,    unit: 'K/uL',   ref_low: 150,  ref_high: 400,  flag: 'Low',      recorded_at: new Date('2026-03-05') },
    { patient_id: p(9), test_name: 'LDH',                value: 340,   unit: 'U/L',    ref_low: 120,  ref_high: 246,  flag: 'High',     recorded_at: new Date('2026-03-05') },
    { patient_id: p(9), test_name: 'CEA',                value: 18.5,  unit: 'ng/mL',  ref_low: 0,    ref_high: 3.0,  flag: 'Critical', recorded_at: new Date('2026-03-05') },
  ];
  await LabResult.insertMany(labData);
  console.log(`Inserted ${labData.length} lab results`);

  // --- Imaging ---
  const imagingData = [
    { patient_id: p(0), modality: 'Echocardiogram', body_part: 'Heart',  finding: 'EF 55%, mild mitral regurgitation',          impression: 'Preserved systolic function. Mild MR.', status: 'Final', recorded_at: new Date('2026-03-11') },
    { patient_id: p(0), modality: 'Chest X-Ray',    body_part: 'Chest',  finding: 'Clear lung fields, normal cardiac silhouette',impression: 'No acute cardiopulmonary process.',     status: 'Final', recorded_at: new Date('2026-03-09') },
    { patient_id: p(1), modality: 'CT Angiography', body_part: 'Chest',  finding: 'No pulmonary embolism, mild cardiomegaly',    impression: 'Negative for PE. Mild LVH noted.',      status: 'Final', recorded_at: new Date('2026-03-11') },
    { patient_id: p(3), modality: 'Retinal Scan',   body_part: 'Eyes',   finding: 'Early diabetic retinopathy bilateral',        impression: 'Microaneurysms and dot hemorrhages. Refer ophthalmology.', status: 'Final', recorded_at: new Date('2026-03-10') },
    { patient_id: p(3), modality: 'CT Abdomen',     body_part: 'Abdomen',finding: 'Fatty liver, normal kidneys',                impression: 'Hepatic steatosis. No renal calculi.', status: 'Final', recorded_at: new Date('2026-03-08') },
    { patient_id: p(4), modality: 'Chest X-Ray',    body_part: 'Chest',  finding: 'Hyperinflated lungs, flattened diaphragm',    impression: 'Findings consistent with COPD.',        status: 'Final', recorded_at: new Date('2026-03-10') },
    { patient_id: p(4), modality: 'CT Chest',       body_part: 'Chest',  finding: 'Emphysematous changes bilateral upper lobes', impression: 'Moderate emphysema. No mass or nodule.', status: 'Final', recorded_at: new Date('2026-03-08') },
    { patient_id: p(7), modality: 'Chest X-Ray',    body_part: 'Chest',  finding: 'Cardiomegaly, bilateral pleural effusions',   impression: 'Worsening heart failure.',               status: 'Final', recorded_at: new Date('2026-03-07') },
    { patient_id: p(7), modality: 'Echocardiogram', body_part: 'Heart',  finding: 'EF 30%, severe MR, dilated LV',              impression: 'Reduced EF. Severe MR. Dilated cardiomyopathy.', status: 'Final', recorded_at: new Date('2026-03-06') },
    { patient_id: p(9), modality: 'CT Chest',       body_part: 'Chest',  finding: 'RUL mass 3.2cm, mediastinal lymphadenopathy', impression: 'Progressing RUL tumor.',                  status: 'Final', recorded_at: new Date('2026-03-05') },
    { patient_id: p(9), modality: 'PET/CT',         body_part: 'Whole Body', finding: 'FDG-avid RUL mass, FDG-avid mediastinal nodes', impression: 'Metabolically active primary lung malignancy.', status: 'Final', recorded_at: new Date('2026-03-03') },
  ];
  await Imaging.insertMany(imagingData);
  console.log(`Inserted ${imagingData.length} imaging records`);

  // --- Timeline ---
  const timelineData = [
    { patient_id: p(0), event_type: 'visit',     title: 'Cardiology Follow-up',       detail: 'Stress test normal. Continue current medications.',      source: 'EHR',      event_date: '2026-03-11' },
    { patient_id: p(0), event_type: 'lab',        title: 'Lipid Panel Results',        detail: 'LDL elevated at 158. Consider statin dose adjustment.', source: 'Lab',      event_date: '2026-03-11' },
    { patient_id: p(0), event_type: 'imaging',    title: 'Echocardiogram',             detail: 'EF 55%, mild MR.',                                      source: 'Radiology',event_date: '2026-03-11' },
    { patient_id: p(0), event_type: 'wearable',   title: 'Home BP Trend',              detail: 'Avg BP 120/78 last 7 days.',                            source: 'Wearable', event_date: '2026-03-10' },
    { patient_id: p(0), event_type: 'medication', title: 'Statin Dose Increased',      detail: 'Atorvastatin increased from 20mg to 40mg.',             source: 'EHR',      event_date: '2026-02-15' },
    { patient_id: p(3), event_type: 'lab',        title: 'HbA1c Critical',             detail: 'HbA1c 9.2% — uncontrolled diabetes.',                   source: 'Lab',      event_date: '2026-03-11' },
    { patient_id: p(3), event_type: 'visit',      title: 'Endocrinology Consultation', detail: 'Insulin dose adjusted. Diet counseling ordered.',        source: 'EHR',      event_date: '2026-03-11' },
    { patient_id: p(3), event_type: 'imaging',    title: 'Diabetic Retinal Screening', detail: 'Early diabetic retinopathy detected.',                   source: 'Radiology',event_date: '2026-03-10' },
    { patient_id: p(3), event_type: 'wearable',   title: 'Glucose Monitor Alert',      detail: 'Average glucose 210 mg/dL over 14 days via CGM.',       source: 'Wearable', event_date: '2026-03-09' },
    { patient_id: p(3), event_type: 'medication', title: 'Insulin Glargine Started',   detail: 'Basal insulin 20 units at bedtime added.',               source: 'EHR',      event_date: '2026-03-01' },
    { patient_id: p(4), event_type: 'visit',      title: 'Pulmonology Visit',          detail: 'COPD exacerbation. Steroids initiated.',                 source: 'EHR',      event_date: '2026-03-10' },
    { patient_id: p(4), event_type: 'lab',        title: 'Inflammatory Markers Elevated', detail: 'CRP 28, WBC 12.4. Respiratory acidosis.',             source: 'Lab',      event_date: '2026-03-10' },
    { patient_id: p(4), event_type: 'imaging',    title: 'Chest CT',                   detail: 'Emphysematous changes bilateral upper lobes.',           source: 'Radiology',event_date: '2026-03-08' },
    { patient_id: p(4), event_type: 'wearable',   title: 'SpO2 Dropping',              detail: 'Home oximeter: SpO2 averaging 89-91% past 3 days.',     source: 'Wearable', event_date: '2026-03-09' },
    { patient_id: p(7), event_type: 'visit',      title: 'Heart Failure Admission',    detail: 'Admitted for acute decompensated heart failure.',         source: 'EHR',      event_date: '2026-03-07' },
    { patient_id: p(7), event_type: 'lab',        title: 'BNP Critically Elevated',    detail: 'BNP 890 pg/mL. Troponin I marginally elevated.',         source: 'Lab',      event_date: '2026-03-07' },
    { patient_id: p(7), event_type: 'imaging',    title: 'Echocardiogram',             detail: 'EF 30%. Severe MR. Dilated LV.',                        source: 'Radiology',event_date: '2026-03-06' },
    { patient_id: p(7), event_type: 'wearable',   title: 'Weight Gain Alert',          detail: '3kg weight gain in 5 days per smart scale.',             source: 'Wearable', event_date: '2026-03-05' },
    { patient_id: p(9), event_type: 'visit',      title: 'Oncology Review',            detail: 'Pembrolizumab cycle 4. Partial response on imaging.',    source: 'EHR',      event_date: '2026-03-05' },
    { patient_id: p(9), event_type: 'imaging',    title: 'PET/CT Scan',                detail: 'FDG-avid RUL mass. Nodal involvement persists.',         source: 'Radiology',event_date: '2026-03-03' },
    { patient_id: p(9), event_type: 'lab',        title: 'Tumor Markers Elevated',     detail: 'CEA 18.5, LDH 340. Anemia and thrombocytopenia.',       source: 'Lab',      event_date: '2026-03-05' },
    { patient_id: p(9), event_type: 'wearable',   title: 'Activity Decline',           detail: 'Daily steps dropped from 4000 to 1200 over 2 weeks.',   source: 'Wearable', event_date: '2026-03-04' },
  ];
  await Timeline.insertMany(timelineData);
  console.log(`Inserted ${timelineData.length} timeline entries`);

  // --- Wearable Trend Data ---
  const wearableData = [];
  [68, 72, 70, 74, 69, 71, 68].forEach((v, i) => {
    wearableData.push({ patient_id: p(0), metric: 'heart_rate', value: v, recorded_at: new Date(`2026-03-${String(5 + i).padStart(2, '0')}T08:00`) });
  });
  [98.0, 97.8, 98.2, 97.5, 98.0, 97.8, 98.1].forEach((v, i) => {
    wearableData.push({ patient_id: p(0), metric: 'spo2', value: v, recorded_at: new Date(`2026-03-${String(5 + i).padStart(2, '0')}T08:00`) });
  });
  [195, 210, 230, 205, 245, 218, 200].forEach((v, i) => {
    wearableData.push({ patient_id: p(3), metric: 'glucose', value: v, recorded_at: new Date(`2026-03-${String(5 + i).padStart(2, '0')}T08:00`) });
  });
  [93, 92, 91, 90, 89, 91, 90].forEach((v, i) => {
    wearableData.push({ patient_id: p(4), metric: 'spo2', value: v, recorded_at: new Date(`2026-03-${String(5 + i).padStart(2, '0')}T08:00`) });
  });
  [84, 84.5, 85, 86, 86.5, 87, 87].forEach((v, i) => {
    wearableData.push({ patient_id: p(7), metric: 'weight', value: v, recorded_at: new Date(`2026-03-${String(1 + i).padStart(2, '0')}T08:00`) });
  });
  await WearableData.insertMany(wearableData);
  console.log(`Inserted ${wearableData.length} wearable data points`);

  // --- Clinical Alerts ---
  const alertsData = [
    { patient_id: p(1),  severity: 'warning',  message: 'Blood pressure 152/94 — above target',                       source: 'EHR' },
    { patient_id: p(3),  severity: 'critical', message: 'HbA1c 9.2% — uncontrolled diabetes, medication review needed',source: 'Lab' },
    { patient_id: p(3),  severity: 'critical', message: 'Fasting glucose 218 mg/dL — hyperglycemia',                  source: 'Lab' },
    { patient_id: p(3),  severity: 'warning',  message: 'Early diabetic retinopathy — ophthalmology referral needed',  source: 'Radiology' },
    { patient_id: p(4),  severity: 'critical', message: 'SpO2 89% — below safe threshold',                            source: 'Wearable' },
    { patient_id: p(4),  severity: 'warning',  message: 'Respiratory acidosis — ABG pH 7.32, pCO2 52',               source: 'Lab' },
    { patient_id: p(6),  severity: 'critical', message: 'eGFR 18 mL/min — Stage 4 CKD, nephrology follow-up',        source: 'Lab' },
    { patient_id: p(7),  severity: 'critical', message: 'BNP 890 pg/mL — acute decompensation suspected',             source: 'Lab' },
    { patient_id: p(7),  severity: 'warning',  message: '3kg weight gain in 5 days — fluid retention',                source: 'Wearable' },
    { patient_id: p(7),  severity: 'critical', message: 'EF 30% — severely reduced systolic function',               source: 'Radiology' },
    { patient_id: p(9),  severity: 'critical', message: 'Platelets 98K — thrombocytopenia, bleeding risk',            source: 'Lab' },
    { patient_id: p(9),  severity: 'warning',  message: 'Activity decline 70% — functional status deteriorating',     source: 'Wearable' },
    { patient_id: p(0),  severity: 'info',     message: 'LDL 158 mg/dL — consider statin dose adjustment',            source: 'Lab' },
    { patient_id: p(19), severity: 'critical', message: 'eGFR critically low — dialysis evaluation needed',           source: 'Lab' },
  ];
  await ClinicalAlert.insertMany(alertsData);
  console.log(`Inserted ${alertsData.length} clinical alerts`);

  // --- Appointments ---
  const apptsData = [
    { patient_id: p(0), time: '09:30', purpose: 'Cardiology Follow-up',       room: 'Room 3', priority: false, date: '2026-03-11' },
    { patient_id: p(1), time: '10:15', purpose: 'Hypertension Review',        room: 'Room 1', priority: false, date: '2026-03-11' },
    { patient_id: p(2), time: '11:00', purpose: 'Asthma Check-up',            room: 'Room 2', priority: false, date: '2026-03-11' },
    { patient_id: p(3), time: '13:00', purpose: 'Diabetes Management',        room: 'Room 4', priority: true,  date: '2026-03-11' },
    { patient_id: p(4), time: '14:30', purpose: 'COPD Exacerbation Follow-up',room: 'Room 5', priority: true,  date: '2026-03-11' },
    { patient_id: p(7), time: '15:45', purpose: 'Heart Failure Review',       room: 'Room 3', priority: true,  date: '2026-03-11' },
  ];
  await Appointment.insertMany(apptsData);
  console.log(`Inserted ${apptsData.length} appointments`);

  console.log('\n✅ MongoDB seeded successfully with 20 patients!');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});

const { getDb } = require('./db');
const db = getDb();

// Clear existing data
db.exec(`
  DELETE FROM wearable_data;
  DELETE FROM alerts;
  DELETE FROM timeline;
  DELETE FROM imaging;
  DELETE FROM lab_results;
  DELETE FROM vitals;
  DELETE FROM appointments;
  DELETE FROM patients;
  DELETE FROM stats;
`);

// --- Patients ---
const insertPatient = db.prepare(`
  INSERT INTO patients (name, age, gender, blood_type, primary_condition, status, smoking_status, allergies, medications, last_visit)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const patients = [
  ['Olivia Hart',    34, 'F', 'O+', 'Coronary Artery Disease',  'Stable',  'Never',   'Penicillin',       'Aspirin 81mg, Atorvastatin 40mg, Metoprolol 25mg',       '2026-03-11'],
  ['Noah Patel',     58, 'M', 'A+', 'Hypertension',             'Review',  'Former',  'None',             'Lisinopril 20mg, Amlodipine 5mg, Hydrochlorothiazide 25mg','2026-03-11'],
  ['Emma Rossi',     27, 'F', 'B+', 'Asthma',                   'Stable',  'Never',   'Sulfa drugs',      'Albuterol PRN, Fluticasone 250mcg',                       '2026-03-11'],
  ['Liam Carter',    45, 'M', 'AB+','Type 2 Diabetes',          'Critical','Never',   'None',             'Metformin 1000mg, Glipizide 5mg, Insulin Glargine 20u',   '2026-03-11'],
  ['Ava Thompson',   62, 'F', 'A-', 'COPD',                     'Review',  'Current', 'Latex',            'Tiotropium 18mcg, Prednisone 10mg, Albuterol PRN',        '2026-03-10'],
  ['Mason Lee',      51, 'M', 'O-', 'Atrial Fibrillation',      'Stable',  'Never',   'Iodine contrast',  'Warfarin 5mg, Diltiazem 120mg, Digoxin 0.125mg',          '2026-03-09'],
  ['Sophia Khan',    39, 'F', 'B-', 'Chronic Kidney Disease',   'Review',  'Never',   'ACE inhibitors',   'Erythropoietin, Calcitriol 0.25mcg, Sevelamer 800mg',     '2026-03-08'],
  ['Lucas Gray',     70, 'M', 'A+', 'Heart Failure',            'Critical','Former',  'None',             'Furosemide 40mg, Carvedilol 12.5mg, Spironolactone 25mg', '2026-03-07'],
  ['Isabella Chen',  29, 'F', 'O+', 'Migraine with Aura',       'Stable',  'Never',   'NSAIDs',           'Sumatriptan 50mg PRN, Topiramate 50mg',                   '2026-03-06'],
  ['James Okoro',    67, 'M', 'AB-','Lung Cancer Stage II',      'Critical','Former',  'Carboplatin',      'Pembrolizumab, Ondansetron 8mg, Morphine 15mg PRN',       '2026-03-05'],
];

const insertMany = db.transaction(() => {
  for (const p of patients) insertPatient.run(...p);
});
insertMany();

// --- Vitals (from EHR + Wearables) ---
const insertVital = db.prepare(`
  INSERT INTO vitals (patient_id, source, heart_rate, systolic, diastolic, spo2, temperature, resp_rate, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const vitalsData = [
  // Olivia - stable cardiac patient
  [1, 'EHR',      72, 118, 76, 98.2, 36.7, 16, '2026-03-11 08:00'],
  [1, 'Wearable', 68, null, null, 97.8, null, null, '2026-03-11 10:00'],
  [1, 'Wearable', 74, null, null, 98.0, null, null, '2026-03-11 12:00'],
  // Noah - hypertension
  [2, 'EHR',      80, 152, 94, 97.5, 36.8, 18, '2026-03-11 09:00'],
  [2, 'Wearable', 84, null, null, 97.2, null, null, '2026-03-11 11:00'],
  // Emma - asthma
  [3, 'EHR',      76, 112, 72, 96.8, 36.6, 20, '2026-03-11 10:00'],
  [3, 'Wearable', 78, null, null, 97.0, null, null, '2026-03-11 14:00'],
  // Liam - diabetic, critical
  [4, 'EHR',      92, 140, 88, 96.0, 37.2, 22, '2026-03-11 07:30'],
  [4, 'Wearable', 96, null, null, 95.5, null, null, '2026-03-11 09:00'],
  [4, 'Wearable', 88, null, null, 96.2, null, null, '2026-03-11 12:00'],
  // Ava - COPD
  [5, 'EHR',      86, 134, 82, 91.0, 37.0, 24, '2026-03-10 14:00'],
  [5, 'Wearable', 90, null, null, 89.5, null, null, '2026-03-10 18:00'],
  // Lucas - heart failure
  [8, 'EHR',      98, 148, 92, 93.0, 37.1, 26, '2026-03-07 08:00'],
  [8, 'Wearable', 102, null, null, 92.5, null, null, '2026-03-07 12:00'],
  // James - lung cancer
  [10, 'EHR',     88, 128, 78, 90.0, 37.8, 28, '2026-03-05 09:00'],
  [10, 'Wearable', 92, null, null, 89.0, null, null, '2026-03-05 15:00'],
];

const insertVitals = db.transaction(() => {
  for (const v of vitalsData) insertVital.run(...v);
});
insertVitals();

// --- Lab Results ---
const insertLab = db.prepare(`
  INSERT INTO lab_results (patient_id, test_name, value, unit, ref_low, ref_high, flag, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const labData = [
  // Olivia
  [1, 'Total Cholesterol',  242,   'mg/dL',  0,   200, 'High',    '2026-03-11'],
  [1, 'LDL Cholesterol',    158,   'mg/dL',  0,   100, 'High',    '2026-03-11'],
  [1, 'HDL Cholesterol',    52,    'mg/dL',  40,  60,  'Normal',  '2026-03-11'],
  [1, 'Troponin I',         0.02,  'ng/mL',  0,   0.04,'Normal',  '2026-03-11'],
  [1, 'BNP',                45,    'pg/mL',  0,   100, 'Normal',  '2026-03-11'],
  // Noah
  [2, 'Creatinine',         1.1,   'mg/dL',  0.7, 1.3, 'Normal',  '2026-03-11'],
  [2, 'Potassium',          4.8,   'mEq/L',  3.5, 5.0, 'Normal',  '2026-03-11'],
  [2, 'BUN',                22,    'mg/dL',  7,   20,  'High',    '2026-03-11'],
  // Liam - diabetic
  [4, 'HbA1c',              9.2,   '%',      4.0, 5.6, 'Critical','2026-03-11'],
  [4, 'Fasting Glucose',    218,   'mg/dL',  70,  100, 'Critical','2026-03-11'],
  [4, 'Creatinine',         1.6,   'mg/dL',  0.7, 1.3, 'High',    '2026-03-11'],
  [4, 'eGFR',               52,    'mL/min', 60,  120, 'Low',     '2026-03-11'],
  // Ava - COPD
  [5, 'WBC',                12.4,  'K/uL',   4.5, 11.0,'High',    '2026-03-10'],
  [5, 'CRP',                28,    'mg/L',   0,   10,  'High',    '2026-03-10'],
  [5, 'ABG pH',             7.32,  '',        7.35,7.45,'Low',     '2026-03-10'],
  [5, 'pCO2',               52,    'mmHg',   35,  45,  'High',    '2026-03-10'],
  // Sophia - CKD
  [7, 'Creatinine',         3.8,   'mg/dL',  0.7, 1.3, 'Critical','2026-03-08'],
  [7, 'eGFR',               18,    'mL/min', 60,  120, 'Critical','2026-03-08'],
  [7, 'Phosphorus',         6.2,   'mg/dL',  2.5, 4.5, 'High',    '2026-03-08'],
  [7, 'Calcium',            8.0,   'mg/dL',  8.5, 10.5,'Low',     '2026-03-08'],
  // Lucas - heart failure
  [8, 'BNP',                890,   'pg/mL',  0,   100, 'Critical','2026-03-07'],
  [8, 'Sodium',             131,   'mEq/L',  136, 145, 'Low',     '2026-03-07'],
  [8, 'Troponin I',         0.08,  'ng/mL',  0,   0.04,'High',    '2026-03-07'],
  // James - lung cancer
  [10, 'Hemoglobin',        10.2,  'g/dL',   13.5,17.5,'Low',     '2026-03-05'],
  [10, 'Platelets',         98,    'K/uL',   150, 400, 'Low',     '2026-03-05'],
  [10, 'LDH',               340,   'U/L',    120, 246, 'High',    '2026-03-05'],
  [10, 'CEA',               18.5,  'ng/mL',  0,   3.0, 'Critical','2026-03-05'],
];

const insertLabs = db.transaction(() => {
  for (const l of labData) insertLab.run(...l);
});
insertLabs();

// --- Imaging / Radiology ---
const insertImaging = db.prepare(`
  INSERT INTO imaging (patient_id, modality, body_part, finding, impression, status, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const imagingData = [
  [1, 'Echocardiogram', 'Heart',     'EF 55%, mild mitral regurgitation',         'Preserved systolic function. Mild MR. No pericardial effusion.', 'Final', '2026-03-11'],
  [1, 'Chest X-Ray',    'Chest',     'Clear lung fields, normal cardiac silhouette','No acute cardiopulmonary process.', 'Final', '2026-03-09'],
  [2, 'CT Angiography', 'Chest',     'No pulmonary embolism, mild cardiomegaly',   'Negative for PE. Mild LVH noted.', 'Final', '2026-03-11'],
  [4, 'Retinal Scan',   'Eyes',      'Early diabetic retinopathy bilateral',       'Microaneurysms and dot hemorrhages noted. Refer ophthalmology.', 'Final', '2026-03-10'],
  [4, 'CT Abdomen',     'Abdomen',   'Fatty liver, normal kidneys',               'Hepatic steatosis. No renal calculi.', 'Final', '2026-03-08'],
  [5, 'Chest X-Ray',    'Chest',     'Hyperinflated lungs, flattened diaphragm',   'Findings consistent with COPD. No consolidation or effusion.', 'Final', '2026-03-10'],
  [5, 'CT Chest',       'Chest',     'Emphysematous changes bilateral upper lobes','Moderate emphysema. No mass or nodule.', 'Final', '2026-03-08'],
  [8, 'Chest X-Ray',    'Chest',     'Cardiomegaly, bilateral pleural effusions',  'Worsening heart failure. Consider diuresis optimization.', 'Final', '2026-03-07'],
  [8, 'Echocardiogram', 'Heart',     'EF 30%, severe MR, dilated LV',             'Reduced EF. Severe mitral regurgitation. Dilated cardiomyopathy.', 'Final', '2026-03-06'],
  [10, 'CT Chest',      'Chest',     'RUL mass 3.2cm, mediastinal lymphadenopathy','Progressing RUL tumor. Enlarged subcarinal and hilar nodes.', 'Final', '2026-03-05'],
  [10, 'PET/CT',        'Whole Body','FDG-avid RUL mass, FDG-avid mediastinal nodes','Metabolically active primary lung malignancy with nodal involvement.', 'Final', '2026-03-03'],
];

const insertImgs = db.transaction(() => {
  for (const im of imagingData) insertImaging.run(...im);
});
insertImgs();

// --- Patient Timeline ---
const insertTimeline = db.prepare(`
  INSERT INTO timeline (patient_id, event_type, title, detail, source, event_date)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const timelineData = [
  // Olivia
  [1, 'visit',     'Cardiology Follow-up',          'Stress test normal. Continue current medications.',         'EHR',      '2026-03-11'],
  [1, 'lab',       'Lipid Panel Results',            'LDL elevated at 158. Consider statin dose adjustment.',    'Lab',      '2026-03-11'],
  [1, 'imaging',   'Echocardiogram',                 'EF 55%, mild MR.',                                        'Radiology','2026-03-11'],
  [1, 'wearable',  'Home BP Trend',                  'Avg BP 120/78 last 7 days via wearable device.',           'Wearable', '2026-03-10'],
  [1, 'medication','Statin Dose Increased',          'Atorvastatin increased from 20mg to 40mg.',                'EHR',      '2026-02-15'],
  // Liam
  [4, 'lab',       'HbA1c Critical',                 'HbA1c 9.2% — uncontrolled diabetes.',                     'Lab',      '2026-03-11'],
  [4, 'visit',     'Endocrinology Consultation',     'Insulin dose adjusted. Diet counseling ordered.',          'EHR',      '2026-03-11'],
  [4, 'imaging',   'Diabetic Retinal Screening',     'Early diabetic retinopathy detected.',                     'Radiology','2026-03-10'],
  [4, 'wearable',  'Glucose Monitor Alert',          'Average glucose 210 mg/dL over 14 days via CGM.',         'Wearable', '2026-03-09'],
  [4, 'medication','Insulin Glargine Started',       'Basal insulin 20 units at bedtime added to regimen.',      'EHR',      '2026-03-01'],
  // Ava
  [5, 'visit',     'Pulmonology Visit',              'COPD exacerbation. Steroids initiated.',                   'EHR',      '2026-03-10'],
  [5, 'lab',       'Inflammatory Markers Elevated',  'CRP 28, WBC 12.4. ABG shows respiratory acidosis.',       'Lab',      '2026-03-10'],
  [5, 'imaging',   'Chest CT',                       'Emphysematous changes bilateral upper lobes.',             'Radiology','2026-03-08'],
  [5, 'wearable',  'SpO2 Dropping',                  'Home oximeter: SpO2 averaging 89-91% past 3 days.',       'Wearable', '2026-03-09'],
  // Lucas
  [8, 'visit',     'Heart Failure Admission',        'Admitted for acute decompensated heart failure.',          'EHR',      '2026-03-07'],
  [8, 'lab',       'BNP Critically Elevated',        'BNP 890 pg/mL. Troponin I marginally elevated.',         'Lab',      '2026-03-07'],
  [8, 'imaging',   'Echocardiogram',                 'EF 30%. Severe MR. Dilated LV.',                         'Radiology','2026-03-06'],
  [8, 'wearable',  'Weight Gain Alert',              '3kg weight gain in 5 days per smart scale.',              'Wearable', '2026-03-05'],
  // James
  [10, 'visit',    'Oncology Review',                'Pembrolizumab cycle 4. Partial response on imaging.',     'EHR',      '2026-03-05'],
  [10, 'imaging',  'PET/CT Scan',                    'FDG-avid RUL mass. Nodal involvement persists.',          'Radiology','2026-03-03'],
  [10, 'lab',      'Tumor Markers Elevated',         'CEA 18.5, LDH 340. Anemia and thrombocytopenia present.','Lab',      '2026-03-05'],
  [10, 'wearable', 'Activity Decline',               'Daily steps dropped from 4000 to 1200 over 2 weeks.',    'Wearable', '2026-03-04'],
];

const insertTimelineData = db.transaction(() => {
  for (const t of timelineData) insertTimeline.run(...t);
});
insertTimelineData();

// --- Wearable Trend Data (heart rate over 7 days for key patients) ---
const insertWearable = db.prepare(`
  INSERT INTO wearable_data (patient_id, metric, value, recorded_at)
  VALUES (?, ?, ?, ?)
`);

const wearableData = [];
// Olivia HR trend
[68, 72, 70, 74, 69, 71, 68].forEach((v, i) => {
  wearableData.push([1, 'heart_rate', v, `2026-03-${String(5 + i).padStart(2, '0')} 08:00`]);
});
// Olivia SpO2
[98.0, 97.8, 98.2, 97.5, 98.0, 97.8, 98.1].forEach((v, i) => {
  wearableData.push([1, 'spo2', v, `2026-03-${String(5 + i).padStart(2, '0')} 08:00`]);
});
// Liam glucose trend (CGM)
[195, 210, 230, 205, 245, 218, 200].forEach((v, i) => {
  wearableData.push([4, 'glucose', v, `2026-03-${String(5 + i).padStart(2, '0')} 08:00`]);
});
// Ava SpO2 trend
[93, 92, 91, 90, 89, 91, 90].forEach((v, i) => {
  wearableData.push([5, 'spo2', v, `2026-03-${String(5 + i).padStart(2, '0')} 08:00`]);
});
// Lucas weight (kg)
[84, 84.5, 85, 86, 86.5, 87, 87].forEach((v, i) => {
  wearableData.push([8, 'weight', v, `2026-03-${String(1 + i).padStart(2, '0')} 08:00`]);
});

const insertWearableData = db.transaction(() => {
  for (const w of wearableData) insertWearable.run(...w);
});
insertWearableData();

// --- Clinical Alerts ---
const insertAlert = db.prepare(`
  INSERT INTO alerts (patient_id, severity, message, source, resolved)
  VALUES (?, ?, ?, ?, ?)
`);

const alertsData = [
  [2, 'warning',  'Blood pressure 152/94 — above target',                     'EHR',      0],
  [4, 'critical', 'HbA1c 9.2% — uncontrolled diabetes, medication review needed','Lab',    0],
  [4, 'critical', 'Fasting glucose 218 mg/dL — hyperglycemia',                'Lab',      0],
  [4, 'warning',  'Early diabetic retinopathy — ophthalmology referral needed','Radiology',0],
  [5, 'critical', 'SpO2 89% — below safe threshold',                          'Wearable', 0],
  [5, 'warning',  'Respiratory acidosis — ABG pH 7.32, pCO2 52',             'Lab',      0],
  [7, 'critical', 'eGFR 18 mL/min — Stage 4 CKD, nephrology follow-up',      'Lab',      0],
  [8, 'critical', 'BNP 890 pg/mL — acute decompensation suspected',           'Lab',      0],
  [8, 'warning',  '3kg weight gain in 5 days — fluid retention',              'Wearable', 0],
  [8, 'critical', 'EF 30% — severely reduced systolic function',             'Radiology',0],
  [10,'critical', 'Platelets 98K — thrombocytopenia, bleeding risk',          'Lab',      0],
  [10,'warning',  'Activity decline 70% — functional status deteriorating',    'Wearable', 0],
  [1, 'info',     'LDL 158 mg/dL — consider statin dose adjustment',          'Lab',      0],
];

const insertAlerts = db.transaction(() => {
  for (const a of alertsData) insertAlert.run(...a);
});
insertAlerts();

// --- Appointments ---
const insertAppt = db.prepare(`
  INSERT INTO appointments (patient_id, time, purpose, room, priority, date)
  VALUES (?, ?, ?, ?, ?, '2026-03-11')
`);

const appts = [
  [1, '09:30', 'Cardiology Follow-up',       'Room 3',  0],
  [2, '10:15', 'Hypertension Review',         'Room 1',  0],
  [3, '11:00', 'Asthma Check-up',             'Room 2',  0],
  [4, '13:00', 'Diabetes Management',         'Room 4',  1],
  [5, '14:30', 'COPD Exacerbation Follow-up', 'Room 5',  1],
  [8, '15:45', 'Heart Failure Review',         'Room 3',  1],
];

const insertAppts = db.transaction(() => {
  for (const a of appts) insertAppt.run(...a);
});
insertAppts();

// --- Dashboard Stats ---
db.prepare(`
  INSERT INTO stats (id, total_patients, active_monitors, critical_alerts, data_sources)
  VALUES (1, 20, 342, 8, 4)
`).run();

console.log('Database seeded successfully.');

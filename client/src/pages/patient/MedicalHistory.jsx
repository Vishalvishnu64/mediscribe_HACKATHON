import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { FileText, Pill, CalendarDays, Loader2, X, PencilLine, Save, Plus, Trash2, FlaskConical, FolderOpen } from 'lucide-react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from 'recharts';

const MedicalHistory = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [historyMeds, setHistoryMeds] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [manualMetrics, setManualMetrics] = useState([]);
  const [allMeds, setAllMeds] = useState([]);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const [selectedTestResult, setSelectedTestResult] = useState(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [visitForm, setVisitForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedMetricKey, setSelectedMetricKey] = useState('blood_sugar');
  const [customMetricName, setCustomMetricName] = useState('');
  const [metricForm, setMetricForm] = useState({
    metricKey: 'blood_sugar',
    metricLabel: 'Blood Sugar',
    value: '',
    unit: 'mg/dL',
    recordedAt: ''
  });
  const [savingMetric, setSavingMetric] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imagingRecords, setImagingRecords] = useState([]);

  const formatForInputDateTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const buildVisitForm = (rx, fallbackMeds = []) => ({
    doctorName: rx?.doctorRecognizedName || '',
    regNo: rx?.doctorRegNo || rx?.rawOcrData?.doctor?.regNo || '',
    clinic: rx?.rawOcrData?.doctor?.clinic || '',
    visitDate: formatForInputDateTime(rx?.date || rx?.createdAt),
    type: rx?.type || 'OLD',
    instructions: rx?.rawOcrData?.instructions || '',
    medicines:
      rx?.rawOcrData?.medicines?.length > 0
        ? rx.rawOcrData.medicines.map((m) => ({
            name: m.name || '',
            dosage: m.dosage || '',
            frequency: m.frequency || '',
            duration: m.duration || '',
            route: m.route || ''
          }))
        : fallbackMeds.map((m) => ({
            name: m.name || '',
            dosage: m.dosage || '',
            frequency: m.frequency || '',
            duration: m.duration || '',
            route: m.route || ''
          }))
  });

  const metricDefs = [
    { key: 'blood_sugar', label: 'Blood Sugar', unit: 'mg/dL', keywords: ['sugar', 'glucose', 'fbs', 'rbs', 'hba1c'] },
    { key: 'cholesterol', label: 'Cholesterol', unit: 'mg/dL', keywords: ['cholesterol', 'ldl', 'hdl', 'triglyceride', 'triglycerides'] },
    { key: 'insulin', label: 'Insulin', unit: 'µIU/mL', keywords: ['insulin'] },
    { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', keywords: ['hemoglobin', 'hb'] },
    { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', keywords: ['creatinine'] },
    { key: 'thyroid_tsh', label: 'TSH', unit: 'mIU/L', keywords: ['tsh', 'thyroid'] },
    { key: 'wbc_count', label: 'WBC Count', unit: '10^3/µL', keywords: ['wbc', 'white blood cell'] },
  ];

  const findMetricDef = (testName = '') => {
    const name = String(testName || '').toLowerCase();
    return metricDefs.find((m) => m.keywords.some((kw) => name.includes(kw)));
  };

  const slugifyMetricKey = (value = '') =>
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'custom_metric';

  const toNumber = (v) => {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const match = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  };

  const getUploadUrl = (imagePath) => imagePath ? `http://localhost:5000/uploads/${imagePath}` : null;

  const formatDoctorName = (name) => {
    const clean = String(name || '').replace(/^\s*((dr|doctor)\.?\s*)+/i, '').trim();
    return clean ? `Dr. ${clean}` : 'Doctor';
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const [metricsRes, imagingRes] = await Promise.all([
          axios.get('/medications/metrics'),
          axios.get('/medications/doctor-imaging')
        ]);
        setManualMetrics(metricsRes.data || []);
        setImagingRecords(imagingRes.data || []);
      } catch {
        // silent refresh failure
      }
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const fetchHistory = async () => {
    try {
      const [prescRes, medsRes, allMedsRes, testRes, metricsRes, imagingRes] = await Promise.all([
        axios.get('/medications/prescriptions'),
        axios.get('/medications/history'),
        axios.get('/medications/all'),
        axios.get('/medications/test-results'),
        axios.get('/medications/metrics'),
        axios.get('/medications/doctor-imaging')
      ]);
      setPrescriptions(prescRes.data);
      setHistoryMeds(medsRes.data);
      setAllMeds(allMedsRes.data);
      setTestResults(testRes.data || []);
      setManualMetrics(metricsRes.data || []);
      setImagingRecords(imagingRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sortedPrescriptions = [...prescriptions].sort((a, b) => {
    const aTs = new Date(a.date || a.createdAt || 0).getTime();
    const bTs = new Date(b.date || b.createdAt || 0).getTime();
    return bTs - aTs;
  });

  const visitMeds = selectedPrescription
    ? allMeds.filter(
        (m) =>
          (m.prescriptionId?._id || m.prescriptionId)?.toString() === selectedPrescription._id
      )
    : [];

  const openVisitDetails = (rx) => {
    setSelectedPrescription(rx);
    const fallbackMeds = allMeds.filter(
      (m) => (m.prescriptionId?._id || m.prescriptionId)?.toString() === rx._id
    );
    setVisitForm(buildVisitForm(rx, fallbackMeds));
    setIsEditMode(false);
    setIsVisitModalOpen(true);
  };

  const closeVisitDetails = () => {
    setIsVisitModalOpen(false);
    setIsEditMode(false);
  };

  const openTestResultDetails = (testResult) => {
    setSelectedTestResult(testResult);
    setIsTestModalOpen(true);
  };

  const closeTestResultDetails = () => {
    setIsTestModalOpen(false);
    setSelectedTestResult(null);
  };

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      if (isVisitModalOpen) closeVisitDetails();
      if (isTestModalOpen) closeTestResultDetails();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isVisitModalOpen, isTestModalOpen]);

  const updateVisitField = (field, value) => {
    setVisitForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateMedicineField = (index, field, value) => {
    setVisitForm((prev) => {
      const updated = [...(prev?.medicines || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, medicines: updated };
    });
  };

  const addMedicine = () => {
    setVisitForm((prev) => ({
      ...prev,
      medicines: [...(prev?.medicines || []), { name: '', dosage: '', frequency: '', duration: '', route: '' }]
    }));
  };

  const removeMedicine = (index) => {
    setVisitForm((prev) => ({
      ...prev,
      medicines: (prev?.medicines || []).filter((_, i) => i !== index)
    }));
  };

  const saveVisitDetails = async () => {
    if (!selectedPrescription || !visitForm) return;
    try {
      setSaving(true);
      const payload = {
        doctorRecognizedName: visitForm.doctorName,
        doctorRegNo: visitForm.regNo,
        date: visitForm.visitDate ? new Date(visitForm.visitDate).toISOString() : null,
        type: visitForm.type,
        rawOcrData: {
          ...(selectedPrescription.rawOcrData || {}),
          doctor: {
            ...(selectedPrescription.rawOcrData?.doctor || {}),
            name: visitForm.doctorName || '',
            regNo: visitForm.regNo || '',
            clinic: visitForm.clinic || '',
            date: visitForm.visitDate ? new Date(visitForm.visitDate).toISOString().slice(0, 10) : ''
          },
          instructions: visitForm.instructions || '',
          medicines: (visitForm.medicines || []).map((m) => ({
            name: m.name || '',
            dosage: m.dosage || '',
            frequency: m.frequency || '',
            duration: m.duration || '',
            route: m.route || ''
          }))
        }
      };

      const res = await axios.patch(`/medications/prescriptions/${selectedPrescription._id}`, payload);
      const updated = res.data;

      setPrescriptions((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      setSelectedPrescription(updated);
      setVisitForm(buildVisitForm(updated, visitMeds));
      setIsEditMode(false);
    } catch (err) {
      console.error('Failed to save visit details', err);
      alert(err?.response?.data?.error || 'Failed to save visit details');
    } finally {
      setSaving(false);
    }
  };

  const displayOrMissing = (value) => (
    value ? value : <span className="text-amber-600 font-medium">Not specified</span>
  );

  const verificationBadge = (rx) => {
    const status = rx?.verificationStatus || 'UNVERIFIED';
    if (status === 'VERIFIED') return { label: '✓ Verified', cls: 'bg-emerald-100 text-emerald-700' };
    if (status === 'REJECTED') return { label: '✕ Rejected', cls: 'bg-rose-100 text-rose-700' };
    if (status === 'CORRECTED') return { label: '✎ Corrected', cls: 'bg-amber-100 text-amber-700' };
    if (status === 'PENDING_DOCTOR') return { label: '⌛ Pending', cls: 'bg-blue-100 text-blue-700' };
    return { label: 'Unverified', cls: 'bg-slate-200 text-slate-600' };
  };

  const chartSeriesMap = {};
  const metricMetaMap = metricDefs.reduce((acc, m) => {
    acc[m.key] = { key: m.key, label: m.label, unit: m.unit || '' };
    return acc;
  }, {});

  testResults.forEach((tr) => {
    const tests = tr?.rawOcrData?.tests || [];
    const date = new Date(tr.testDate || tr.createdAt || Date.now());
    tests.forEach((t) => {
      const testName = t?.name || 'Unknown Metric';
      const def = findMetricDef(testName);
      const key = def?.key || slugifyMetricKey(testName);
      if (!metricMetaMap[key]) {
        metricMetaMap[key] = {
          key,
          label: def?.label || testName,
          unit: t?.unit || def?.unit || ''
        };
      } else if (!metricMetaMap[key].unit && (t?.unit || def?.unit)) {
        metricMetaMap[key].unit = t?.unit || def?.unit || '';
      }

      const value = toNumber(t?.value);
      if (value == null) return;
      if (!chartSeriesMap[key]) chartSeriesMap[key] = [];
      chartSeriesMap[key].push({
        date,
        dateLabel: date.toLocaleDateString(),
        value,
        source: 'OCR'
      });
    });
  });

  manualMetrics.forEach((row) => {
    if (row.source === 'DOCTOR_RADIOLOGY') return;
    if (!metricMetaMap[row.metricKey]) {
      metricMetaMap[row.metricKey] = {
        key: row.metricKey,
        label: row.metricLabel || row.metricKey,
        unit: row.unit || ''
      };
    }
    if (!chartSeriesMap[row.metricKey]) chartSeriesMap[row.metricKey] = [];
    const date = new Date(row.recordedAt);
    chartSeriesMap[row.metricKey].push({
      date,
      dateLabel: date.toLocaleDateString(),
      value: Number(row.value),
      source: row.source || 'MANUAL'
    });
  });

  Object.keys(chartSeriesMap).forEach((k) => {
    chartSeriesMap[k] = chartSeriesMap[k]
      .filter((x) => Number.isFinite(x.value))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  });

  const metricOptions = Object.values(metricMetaMap).sort((a, b) => a.label.localeCompare(b.label));
  const selectedMetricMeta = metricOptions.find((m) => m.key === selectedMetricKey) || metricOptions[0] || null;
  const selectedMetricData = selectedMetricMeta ? (chartSeriesMap[selectedMetricMeta.key] || []) : [];

  useEffect(() => {
    const hasCurrent = metricOptions.some((m) => m.key === selectedMetricKey);
    if (!hasCurrent && metricOptions.length > 0) {
      setSelectedMetricKey(metricOptions[0].key);
    }
  }, [metricOptions, selectedMetricKey]);

  useEffect(() => {
    if (!selectedMetricMeta) return;
    setMetricForm((prev) => ({
      ...(prev.metricKey === selectedMetricMeta.key &&
      prev.metricLabel === selectedMetricMeta.label &&
      prev.unit === (selectedMetricMeta.unit || prev.unit || '')
        ? prev
        : {
            ...prev,
            metricKey: selectedMetricMeta.key,
            metricLabel: selectedMetricMeta.label,
            unit: selectedMetricMeta.unit || prev.unit || ''
          })
    }));
  }, [selectedMetricMeta?.key, selectedMetricMeta?.label, selectedMetricMeta?.unit]);

  const submitManualMetric = async () => {
    const customName = customMetricName.trim();
    const key = customName ? slugifyMetricKey(customName) : metricForm.metricKey;
    const label = customName ? customName : metricForm.metricLabel;
    if (!key || !label || !metricForm.value || !metricForm.recordedAt) return;
    try {
      setSavingMetric(true);
      const payload = {
        metricKey: key,
        metricLabel: label,
        value: Number(metricForm.value),
        unit: metricForm.unit,
        recordedAt: metricForm.recordedAt
      };
      const res = await axios.post('/medications/metrics', payload);
      setManualMetrics((prev) => [...prev, res.data]);
      setSelectedMetricKey(key);
      setMetricForm((prev) => ({ ...prev, value: '', recordedAt: '' }));
      setCustomMetricName('');
    } catch (err) {
      console.error('Failed to save metric point', err);
      alert(err?.response?.data?.error || 'Failed to save metric point');
    } finally {
      setSavingMetric(false);
    }
  };

  return (
    <Layout title="Medical History" subtitle="Your complete prescription and medication history.">
      
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading history...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Prescriptions Timeline */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-display font-bold text-slate-800 mb-6 flex items-center gap-2">
              <FileText size={22} className="text-primary" /> Prescriptions ({prescriptions.length})
            </h2>
            
            {prescriptions.length === 0 ? (
              <p className="text-slate-500 font-medium text-center py-8">No prescriptions uploaded yet.</p>
            ) : (
              <div className="flex flex-col gap-4 relative">
                {/* Timeline line */}
                <div className="absolute left-[17px] top-4 bottom-4 w-0.5 bg-slate-200"></div>
                
                {sortedPrescriptions.map((rx, i) => (
                  <div key={rx._id} className="flex gap-4 relative z-10">
                    <div className={`w-[36px] h-[36px] shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold ${rx.type === 'NEW' ? 'bg-primary' : 'bg-slate-400'}`}>
                      {i + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => openVisitDetails(rx)}
                      className={`bg-slate-50 border rounded-2xl p-4 flex-1 text-left transition hover:border-primary/40 hover:bg-white ${selectedPrescription?._id === rx._id && isVisitModalOpen ? 'border-primary/40 ring-1 ring-primary/20' : 'border-slate-100'}`}
                    >
                      {(() => {
                        const vb = verificationBadge(rx);
                        return (
                          <div className="mb-2">
                            <span className={`inline-flex text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${vb.cls}`}>
                              {vb.label}
                            </span>
                          </div>
                        );
                      })()}

                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-slate-800">{formatDoctorName(rx.doctorRecognizedName || 'Unknown')}</h4>
                        <div className="flex items-center gap-2">
                          {rx.imagePath && (
                            <a
                              href={getUploadUrl(rx.imagePath)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Open uploaded scan"
                            >
                              <FolderOpen size={12} />
                            </a>
                          )}
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${rx.type === 'NEW' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                            {rx.type}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 font-medium flex items-center gap-1">
                        <CalendarDays size={14} /> {new Date(rx.date || rx.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {rx.rawOcrData?.medicines?.length || 0} medicine(s) extracted
                      </p>
                      {rx.verificationStatus === 'CORRECTED' && (
                        <>
                          <p className="text-xs text-amber-700 mt-1 font-medium">
                            Corrected by doctor{rx.verificationNote ? `: ${rx.verificationNote}` : ''}
                          </p>
                          {rx.correctedOcrData && (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                              {JSON.stringify(rx.correctedOcrData)}
                            </p>
                          )}
                        </>
                      )}
                      {rx.verificationStatus === 'REJECTED' && (
                        <p className="text-xs text-rose-700 mt-1 font-medium">
                          Rejected by doctor{rx.verificationNote ? `: ${rx.verificationNote}` : ''}
                        </p>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Medications */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-display font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Pill size={22} className="text-secondary" /> Past Medications ({historyMeds.length})
            </h2>
            
            {historyMeds.length === 0 ? (
              <p className="text-slate-500 font-medium text-center py-8">No completed or past medications yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {historyMeds.map((med) => (
                  <div key={med._id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-700">{med.name}</h4>
                      <p className="text-sm text-slate-500">{med.dosage} · {med.frequency}</p>
                    </div>
                    <span className="bg-slate-200 text-slate-600 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md">
                      {med.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Test Results */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-display font-bold text-slate-800 mb-6 flex items-center gap-2">
              <FlaskConical size={22} className="text-indigo-500" /> Test Results ({testResults.length})
            </h2>

            {testResults.length === 0 ? (
              <p className="text-slate-500 font-medium text-center py-8">No lab/test reports uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {testResults.map((tr) => (
                  <div
                    key={tr._id}
                    onClick={() => openTestResultDetails(tr)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') openTestResultDetails(tr);
                    }}
                    className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left hover:bg-white hover:border-indigo-200 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <h4 className="font-bold text-slate-800 truncate">{tr.title || tr.rawOcrData?.report?.title || 'Lab Test Result'}</h4>
                      <div className="flex items-center gap-2">
                        {tr.imagePath && (
                          <a
                            href={getUploadUrl(tr.imagePath)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                            title="Open uploaded scan"
                          >
                            <FolderOpen size={14} />
                          </a>
                        )}
                        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                          Lab
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 font-medium flex items-center gap-1 mb-3">
                      <CalendarDays size={14} /> {new Date(tr.testDate || tr.createdAt).toLocaleString()}
                    </p>

                    <div className="space-y-1 text-sm">
                      <p className="text-slate-700 font-semibold truncate">
                        {(tr.rawOcrData?.tests?.[0]?.name) || 'No test name detected'}
                        {((tr.rawOcrData?.tests || []).length > 1) ? ` + ${(tr.rawOcrData?.tests || []).length - 1} more` : ''}
                      </p>
                      <p className="text-slate-500 truncate">{tr.rawOcrData?.report?.labName || 'Lab/Hospital not specified'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Health Stats Trends */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-display font-bold text-slate-800 mb-5">Health Stats Trends</h2>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
              <h3 className="font-bold text-slate-800 mb-3">Metric Selector</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <select
                  value={selectedMetricMeta?.key || ''}
                  onChange={(e) => setSelectedMetricKey(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 bg-white text-sm"
                >
                  {metricOptions.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Or new metric name (e.g., WBC Count)"
                  value={customMetricName}
                  onChange={(e) => setCustomMetricName(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Unit"
                  value={metricForm.unit}
                  onChange={(e) => setMetricForm((prev) => ({ ...prev, unit: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <h3 className="font-bold text-slate-800 mb-3">Add Data Point (manual)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="number"
                  step="any"
                  placeholder="Value"
                  value={metricForm.value}
                  onChange={(e) => setMetricForm((prev) => ({ ...prev, value: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={metricForm.recordedAt}
                  onChange={(e) => setMetricForm((prev) => ({ ...prev, recordedAt: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={submitManualMetric}
                  disabled={savingMetric || !metricForm.value || !metricForm.recordedAt}
                  className="rounded-lg border border-emerald-300 bg-emerald-100 text-emerald-700 font-semibold text-sm px-3 py-2 disabled:opacity-60"
                >
                  {savingMetric ? 'Saving...' : 'Add Point'}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-800">{selectedMetricMeta?.label || 'Metric'}</h4>
                <span className="text-xs text-slate-500">{selectedMetricMeta?.unit || metricForm.unit || '-'}</span>
              </div>

              {selectedMetricData.length === 0 ? (
                <p className="text-sm text-slate-500 py-10 text-center">No data yet. Add points above to start this graph from today.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedMetricData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                      <XAxis dataKey="dateLabel" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} width={42} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#0d8a7b" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <h4 className="font-bold text-slate-800 mb-3">Radiology / Imaging Records</h4>
              {imagingRecords.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No imaging records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3">Doctor</th>
                        <th className="py-2 pr-3">Modality</th>
                        <th className="py-2 pr-3">Body Part</th>
                        <th className="py-2 pr-3">Finding</th>
                        <th className="py-2 pr-3">Impression</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {imagingRecords.map((row) => (
                        <tr key={row.id || row._id} className="border-b border-slate-100 last:border-0 align-top">
                          <td className="py-2 pr-3 whitespace-nowrap">{row.recorded_at ? new Date(row.recorded_at).toLocaleDateString() : '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{row.doctorName || 'Doctor'}</td>
                          <td className="py-2 pr-3">{row.modality || '—'}</td>
                          <td className="py-2 pr-3">{row.body_part || '—'}</td>
                          <td className="py-2 pr-3 max-w-[220px] truncate" title={row.finding || ''}>{row.finding || '—'}</td>
                          <td className="py-2 pr-3 max-w-[220px] truncate" title={row.impression || ''}>{row.impression || '—'}</td>
                          <td className="py-2">{row.status || 'Final'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Visit Details Modal */}
      {isVisitModalOpen && selectedPrescription && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[3px] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeVisitDetails();
          }}
        >
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-slate-200 shadow-xl">
            <div className="sticky top-0 bg-gradient-to-r from-primary/10 via-white to-secondary/10 backdrop-blur border-b border-slate-200 p-5 flex items-center justify-between rounded-t-3xl">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-800">Visit Details</h2>
                <p className="text-sm text-slate-500">Complete consultation and prescription breakdown</p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditMode ? (
                  <button
                    type="button"
                    onClick={() => setIsEditMode(true)}
                    className="h-9 px-3 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/15 text-primary font-semibold text-sm flex items-center gap-2"
                  >
                    <PencilLine size={16} /> Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const fallbackMeds = allMeds.filter(
                          (m) => (m.prescriptionId?._id || m.prescriptionId)?.toString() === selectedPrescription._id
                        );
                        setVisitForm(buildVisitForm(selectedPrescription, fallbackMeds));
                        setIsEditMode(false);
                      }}
                      className="h-9 px-3 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveVisitDetails}
                      disabled={saving}
                      className="h-9 px-3 rounded-lg border border-emerald-300 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold text-sm flex items-center gap-2 disabled:opacity-60"
                    >
                      <Save size={16} /> {saving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={closeVisitDetails}
                  className="h-9 w-9 rounded-full border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center"
                  aria-label="Close visit details"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <h3 className="font-bold text-slate-800 mb-3">Consultation Information</h3>
                {isEditMode ? (
                  <div className="space-y-3 text-sm text-slate-700">
                    <input value={visitForm?.doctorName || ''} onChange={(e) => updateVisitField('doctorName', e.target.value)} placeholder="Doctor name" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    <input value={visitForm?.regNo || ''} onChange={(e) => updateVisitField('regNo', e.target.value)} placeholder="Registration number" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    <input value={visitForm?.clinic || ''} onChange={(e) => updateVisitField('clinic', e.target.value)} placeholder="Clinic / Hospital" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    <input type="datetime-local" value={visitForm?.visitDate || ''} onChange={(e) => updateVisitField('visitDate', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                    <select value={visitForm?.type || 'OLD'} onChange={(e) => updateVisitField('type', e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white">
                      <option value="NEW">NEW</option>
                      <option value="OLD">OLD</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm text-slate-700">
                    <p><span className="text-slate-500">Doctor:</span> {displayOrMissing(selectedPrescription.doctorRecognizedName)}</p>
                    <p><span className="text-slate-500">Reg. No:</span> {displayOrMissing(selectedPrescription.doctorRegNo || selectedPrescription.rawOcrData?.doctor?.regNo)}</p>
                    <p><span className="text-slate-500">Clinic:</span> {displayOrMissing(selectedPrescription.rawOcrData?.doctor?.clinic)}</p>
                    <p><span className="text-slate-500">Visit date:</span> {displayOrMissing(selectedPrescription.date ? new Date(selectedPrescription.date).toLocaleString() : null)}</p>
                    <p><span className="text-slate-500">Prescription type:</span> <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-bold bg-slate-200 text-slate-700">{selectedPrescription.type || 'OLD'}</span></p>
                    {selectedPrescription.imagePath && (
                      <p>
                        <span className="text-slate-500">Scan file:</span>{' '}
                        <a href={getUploadUrl(selectedPrescription.imagePath)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary font-semibold hover:underline">
                          <FolderOpen size={14} /> Open prescription image
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <h3 className="font-bold text-slate-800 mb-3">General Instructions</h3>
                {isEditMode ? (
                  <textarea
                    rows={8}
                    value={visitForm?.instructions || ''}
                    onChange={(e) => updateVisitField('instructions', e.target.value)}
                    placeholder="Add any instructions from this visit"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                ) : (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {displayOrMissing(selectedPrescription.rawOcrData?.instructions)}
                  </p>
                )}
              </div>

              <div className="lg:col-span-2 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800">Medicines Prescribed in this Visit</h3>
                  {isEditMode && (
                    <button type="button" onClick={addMedicine} className="px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm font-semibold flex items-center gap-2">
                      <Plus size={14} /> Add medicine
                    </button>
                  )}
                </div>

                {((isEditMode ? visitForm?.medicines?.length : selectedPrescription.rawOcrData?.medicines?.length) || visitMeds.length) === 0 ? (
                  <p className="text-sm text-slate-500">No medicine details found for this visit.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(isEditMode
                      ? (visitForm?.medicines || [])
                      : (selectedPrescription.rawOcrData?.medicines?.length
                        ? selectedPrescription.rawOcrData.medicines
                        : visitMeds)
                    ).map((med, idx) => (
                      <div key={`${med.name || 'med'}-${idx}`} className="bg-white border border-slate-200 rounded-xl p-3">
                        {isEditMode ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <input value={med.name || ''} onChange={(e) => updateMedicineField(idx, 'name', e.target.value)} placeholder="Medicine name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                              <button type="button" onClick={() => removeMedicine(idx)} className="h-9 w-9 shrink-0 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 flex items-center justify-center">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <input value={med.dosage || ''} onChange={(e) => updateMedicineField(idx, 'dosage', e.target.value)} placeholder="Dosage (e.g., 500mg)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            <input value={med.frequency || ''} onChange={(e) => updateMedicineField(idx, 'frequency', e.target.value)} placeholder="Frequency (e.g., twice daily)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            <input value={med.duration || ''} onChange={(e) => updateMedicineField(idx, 'duration', e.target.value)} placeholder="Duration (e.g., 5 days)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            <input value={med.route || ''} onChange={(e) => updateMedicineField(idx, 'route', e.target.value)} placeholder="Route (oral / topical)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                          </div>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-800">{displayOrMissing(med.name)}</p>
                            <p className="text-sm text-slate-600">Dosage: {displayOrMissing(med.dosage)}</p>
                            <p className="text-sm text-slate-600">Frequency: {displayOrMissing(med.frequency)}</p>
                            <p className="text-sm text-slate-600">Duration: {displayOrMissing(med.duration)}</p>
                            <p className="text-sm text-slate-600">Route: {displayOrMissing(med.route)}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Result Details Modal */}
      {isTestModalOpen && selectedTestResult && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[3px] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeTestResultDetails();
          }}
        >
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl border border-slate-200 shadow-xl">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-100 via-white to-cyan-100 backdrop-blur border-b border-slate-200 p-5 flex items-center justify-between rounded-t-3xl">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-800">{selectedTestResult.title || selectedTestResult.rawOcrData?.report?.title || 'Lab Test Report'}</h2>
                <p className="text-sm text-slate-500">Complete extracted test details</p>
              </div>
              <button
                type="button"
                onClick={closeTestResultDetails}
                className="h-9 w-9 rounded-full border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center"
                aria-label="Close test result details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 lg:col-span-1">
                <h3 className="font-bold text-slate-800 mb-3">Report Info</h3>
                <div className="space-y-2 text-sm text-slate-700">
                  <p><span className="text-slate-500">Date:</span> {new Date(selectedTestResult.testDate || selectedTestResult.createdAt).toLocaleString()}</p>
                  <p><span className="text-slate-500">Lab:</span> {selectedTestResult.rawOcrData?.report?.labName || 'Not specified'}</p>
                  <p><span className="text-slate-500">Patient:</span> {selectedTestResult.rawOcrData?.patient?.name || 'Not specified'}</p>
                  <p><span className="text-slate-500">Summary:</span> {selectedTestResult.rawOcrData?.summary || 'Not specified'}</p>
                  {selectedTestResult.imagePath && (
                    <p>
                      <span className="text-slate-500">Scan file:</span>{' '}
                      <a href={getUploadUrl(selectedTestResult.imagePath)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary font-semibold hover:underline">
                        <FolderOpen size={14} /> Open report image
                      </a>
                    </p>
                  )}
                </div>
                {selectedTestResult.imagePath && (
                  <img
                    src={getUploadUrl(selectedTestResult.imagePath)}
                    alt="Uploaded lab report"
                    className="mt-3 w-full h-44 object-cover rounded-xl border border-slate-200"
                  />
                )}
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 lg:col-span-2">
                <h3 className="font-bold text-slate-800 mb-3">All Test Values</h3>
                {(selectedTestResult.rawOcrData?.tests || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No test values extracted from this report.</p>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                    {(selectedTestResult.rawOcrData?.tests || []).map((test, idx) => (
                      <div key={`${selectedTestResult._id}-full-test-${idx}`} className="bg-white border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-800">{test.name || 'Unnamed test'}</p>
                          <p className="text-sm text-slate-600">{test.value || '-'} {test.unit || ''}</p>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                          <span>Range: {test.referenceRange || 'N/A'}</span>
                          <span>Flag: {test.flag || 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default MedicalHistory;

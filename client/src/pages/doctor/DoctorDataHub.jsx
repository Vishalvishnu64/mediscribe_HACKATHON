import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Loader2, Database, Plus, X } from 'lucide-react';

const DoctorDataHub = () => {
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [activeSource, setActiveSource] = useState('EHR');
  const [records, setRecords] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState([]);
  const [saveMessage, setSaveMessage] = useState('');
  const [form, setForm] = useState({
    patient_id: '',
    patient_name: '',
    heart_rate: '',
    systolic: '',
    diastolic: '',
    spo2: '',
    temperature: '',
    resp_rate: '',
    test_name: '',
    value: '',
    unit: '',
    ref_low: '',
    ref_high: '',
    flag: 'normal',
    modality: '',
    body_part: '',
    finding: '',
    impression: '',
    status: 'Final',
    metric: '',
    wvalue: '',
  });

  const sourceToPath = {
    EHR: 'ehr',
    Lab: 'lab',
    Radiology: 'radiology',
    Wearable: 'wearable',
  };

  const sourceOrder = ['EHR', 'Lab', 'Radiology', 'Wearable'];

  const labTestOptions = [
    'CBC',
    'Blood Glucose',
    'HbA1c',
    'Lipid Profile',
    'Liver Function Test',
    'Kidney Function Test',
    'TSH',
    'Vitamin D',
    'CRP',
    'Other',
  ];

  const radiologyModalityOptions = [
    'X-Ray',
    'CT',
    'MRI',
    'Ultrasound',
    'PET',
    'Mammography',
    'Fluoroscopy',
    'Other',
  ];

  const radiologyBodyPartOptions = [
    'Chest',
    'Abdomen',
    'Pelvis',
    'Head',
    'Neck',
    'Spine',
    'Upper Limb',
    'Lower Limb',
    'Heart',
    'Other',
  ];

  const wearableMetricOptions = [
    'Steps',
    'Heart Rate',
    'Blood Pressure',
    'SpO2',
    'Sleep Duration',
    'Calories Burned',
    'Distance',
    'Weight',
    'Other',
  ];

  const sortedSources = useMemo(() => {
    const map = new Map((sources || []).map((s) => [s.type, s]));
    return sourceOrder.map((k) => map.get(k)).filter(Boolean);
  }, [sources]);

  const loadSources = async () => {
    const res = await axios.get('/doctor-panel/sources');
    const list = res.data?.sources || [];
    setSources(list);
    if (!activeSource && list[0]?.type) setActiveSource(list[0].type);
  };

  const loadRecords = async (type) => {
    const key = sourceToPath[type];
    if (!key) return;
    try {
      setRecordsLoading(true);
      const res = await axios.get(`/doctor-panel/sources/${key}`);
      setRecords(res.data || []);
    } catch (err) {
      console.error(err);
      setRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await loadSources();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!activeSource) return;
    loadRecords(activeSource);
  }, [activeSource]);

  const openAddModal = async () => {
    try {
      if (!patients.length) {
        const res = await axios.get('/doctor-panel/patients');
        setPatients(res.data || []);
      }
      setAddOpen(true);
    } catch (err) {
      console.error(err);
      setAddOpen(true);
    }
  };

  const submitRecord = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveMessage('');

      const payloadBase = {
        patient_id: form.patient_id || undefined,
        patient_name: form.patient_name?.trim() || undefined,
      };

      if (activeSource === 'EHR') {
        const res = await axios.post('/doctor-panel/sources/ehr', {
          ...payloadBase,
          heart_rate: form.heart_rate || undefined,
          systolic: form.systolic || undefined,
          diastolic: form.diastolic || undefined,
          spo2: form.spo2 || undefined,
          temperature: form.temperature || undefined,
          resp_rate: form.resp_rate || undefined,
        });
        if (res.data?.unmatched) setSaveMessage(`${res.data.patient_name} tagged as not in db.`);
      } else if (activeSource === 'Lab') {
        const testName = form.test_name === 'Other' ? (form.custom_test_name || '').trim() : form.test_name;
        const res = await axios.post('/doctor-panel/sources/lab', {
          ...payloadBase,
          test_name: testName,
          value: form.value || undefined,
          unit: form.unit || undefined,
          ref_low: form.ref_low || undefined,
          ref_high: form.ref_high || undefined,
          flag: form.flag || 'normal',
        });
        if (res.data?.unmatched) setSaveMessage(`${res.data.patient_name} tagged as not in db.`);
      } else if (activeSource === 'Radiology') {
        const modality = form.modality === 'Other' ? (form.custom_modality || '').trim() : form.modality;
        const bodyPart = form.body_part === 'Other' ? (form.custom_body_part || '').trim() : form.body_part;
        const res = await axios.post('/doctor-panel/sources/radiology', {
          ...payloadBase,
          modality,
          body_part: bodyPart || undefined,
          finding: form.finding || undefined,
          impression: form.impression || undefined,
          status: form.status || 'Final',
        });
        if (res.data?.unmatched) setSaveMessage(`${res.data.patient_name} tagged as not in db.`);
      } else if (activeSource === 'Wearable') {
        const metric = form.metric === 'Other' ? (form.custom_metric || '').trim() : form.metric;
        const res = await axios.post('/doctor-panel/sources/wearable', {
          ...payloadBase,
          metric,
          value: form.wvalue,
        });
        if (res.data?.unmatched) setSaveMessage(`${res.data.patient_name} tagged as not in db.`);
      }

      setAddOpen(false);
      await Promise.all([loadSources(), loadRecords(activeSource)]);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Data Hub" subtitle="Connected source systems for your patient records.">
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading sources...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
            <h2 className="text-3xl font-display font-bold text-slate-800 mb-3">Connected Data Sources</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {sortedSources.map((s) => (
                <button
                  type="button"
                  key={s.type}
                  onClick={() => setActiveSource(s.type)}
                  className={`rounded-3xl border p-5 text-center transition ${activeSource === s.type ? 'border-secondary bg-orange-50/40 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="mx-auto w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                    <Database size={18} />
                  </div>
                  <h3 className="mt-3 font-display font-bold text-slate-800">{s.name}</h3>
                  <p className="text-3xl font-display font-bold text-slate-800 mt-1">{s.count}</p>
                  <p className="text-sm text-slate-500">records</p>
                  <span className="inline-flex mt-2 text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">• {s.status}</span>
                </button>
              ))}
            </div>
          </div>

          {!!activeSource && (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-2xl font-display font-bold text-slate-800">
                  {(sortedSources.find((s) => s.type === activeSource)?.name || activeSource)} — Records
                </h3>
                <div className="flex items-center gap-2">
                  <span className="inline-flex text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700">{records.length}</span>
                  <button type="button" onClick={openAddModal} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold">
                    <Plus size={16} /> Add Record
                  </button>
                </div>
              </div>

              {recordsLoading ? (
                <div className="flex items-center justify-center p-10 text-slate-500 gap-3">
                  <Loader2 className="animate-spin" size={20} /> Loading records...
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-10 text-slate-500 font-medium border border-dashed border-slate-200 rounded-2xl">
                  No records available.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {activeSource === 'EHR' && (
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">Patient</th><th className="py-2 pr-3">HR</th><th className="py-2 pr-3">BP</th><th className="py-2 pr-3">SPO2</th><th className="py-2 pr-3">Temp</th><th className="py-2 pr-3">Resp</th><th className="py-2">Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr key={r.id || r._id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-3 font-semibold text-slate-800">
                              {r.patient_name}
                              {r.notInDb && <span className="ml-2 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">not in db</span>}
                            </td>
                            <td className="py-2 pr-3">{r.heart_rate ?? '—'}{r.heart_rate != null ? ' bpm' : ''}</td>
                            <td className="py-2 pr-3">{(r.systolic != null && r.diastolic != null) ? `${r.systolic}/${r.diastolic}` : '—'}</td>
                            <td className="py-2 pr-3">{r.spo2 ?? '—'}{r.spo2 != null ? '%' : ''}</td>
                            <td className="py-2 pr-3">{r.temperature ?? '—'}{r.temperature != null ? '°F' : ''}</td>
                            <td className="py-2 pr-3">{r.resp_rate ?? '—'}{r.resp_rate != null ? '/min' : ''}</td>
                            <td className="py-2">{r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeSource === 'Lab' && (
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">Patient</th><th className="py-2 pr-3">Test</th><th className="py-2 pr-3">Value</th><th className="py-2 pr-3">Range</th><th className="py-2 pr-3">Flag</th><th className="py-2">Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr key={r.id || r._id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-3 font-semibold text-slate-800">
                              {r.patient_name}
                              {r.notInDb && <span className="ml-2 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">not in db</span>}
                            </td>
                            <td className="py-2 pr-3">{r.test_name || '—'}</td>
                            <td className="py-2 pr-3">{r.value ?? '—'} {r.unit || ''}</td>
                            <td className="py-2 pr-3">{(r.ref_low != null || r.ref_high != null) ? `${r.ref_low ?? '—'} - ${r.ref_high ?? '—'}` : '—'}</td>
                            <td className="py-2 pr-3">{r.flag || 'normal'}</td>
                            <td className="py-2">{r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeSource === 'Radiology' && (
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">Patient</th><th className="py-2 pr-3">Modality</th><th className="py-2 pr-3">Body Part</th><th className="py-2 pr-3">Status</th><th className="py-2">Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr key={r.id || r._id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-3 font-semibold text-slate-800">
                              {r.patient_name}
                              {r.notInDb && <span className="ml-2 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">not in db</span>}
                            </td>
                            <td className="py-2 pr-3">{r.modality || '—'}</td>
                            <td className="py-2 pr-3">{r.body_part || '—'}</td>
                            <td className="py-2 pr-3">{r.status || '—'}</td>
                            <td className="py-2">{r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {activeSource === 'Wearable' && (
                    <table className="w-full text-sm">
                      <thead className="text-left text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 pr-3">Patient</th><th className="py-2 pr-3">Metric</th><th className="py-2 pr-3">Value</th><th className="py-2">Recorded</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr key={r.id || r._id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-3 font-semibold text-slate-800">
                              {r.patient_name}
                              {r.notInDb && <span className="ml-2 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">not in db</span>}
                            </td>
                            <td className="py-2 pr-3">{r.metric || '—'}</td>
                            <td className="py-2 pr-3">{r.value ?? '—'}</td>
                            <td className="py-2">{r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-display font-bold text-slate-800">Add {activeSource} Record</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50"><X size={16} /></button>
            </div>

            <form onSubmit={submitRecord} className="space-y-3">
              <select value={form.patient_id} onChange={(e) => setForm((p) => ({ ...p, patient_id: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary">
                <option value="">Select patient (optional)</option>
                {patients.map((p) => (
                  <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>
                ))}
              </select>
              <input
                placeholder="Or type patient name (used for db match)"
                value={form.patient_name}
                onChange={(e) => setForm((p) => ({ ...p, patient_name: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
              <p className="text-xs text-slate-500">If name does not match any patient, it will be tagged as not in db.</p>

              {activeSource === 'EHR' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input placeholder="Heart Rate" value={form.heart_rate} onChange={(e) => setForm((p) => ({ ...p, heart_rate: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  <input placeholder="SPO2" value={form.spo2} onChange={(e) => setForm((p) => ({ ...p, spo2: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  <input placeholder="Systolic" value={form.systolic} onChange={(e) => setForm((p) => ({ ...p, systolic: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  <input placeholder="Diastolic" value={form.diastolic} onChange={(e) => setForm((p) => ({ ...p, diastolic: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  <input placeholder="Temperature" value={form.temperature} onChange={(e) => setForm((p) => ({ ...p, temperature: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  <input placeholder="Resp Rate" value={form.resp_rate} onChange={(e) => setForm((p) => ({ ...p, resp_rate: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                </div>
              )}

              {activeSource === 'Lab' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select required value={form.test_name} onChange={(e) => setForm((p) => ({ ...p, test_name: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary md:col-span-2 bg-white">
                    <option value="">Select Test</option>
                    {labTestOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {form.test_name === 'Other' && (
                    <input required placeholder="Custom Test Name" value={form.custom_test_name || ''} onChange={(e) => setForm((p) => ({ ...p, custom_test_name: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary md:col-span-2" />
                  )}
                  <input placeholder="Value" value={form.value} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  <input placeholder="Unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  <input placeholder="Ref Low" value={form.ref_low} onChange={(e) => setForm((p) => ({ ...p, ref_low: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  <input placeholder="Ref High" value={form.ref_high} onChange={(e) => setForm((p) => ({ ...p, ref_high: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  <select value={form.flag} onChange={(e) => setForm((p) => ({ ...p, flag: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary">
                    <option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option>
                  </select>
                </div>
              )}

              {activeSource === 'Radiology' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select required value={form.modality} onChange={(e) => setForm((p) => ({ ...p, modality: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary bg-white">
                    <option value="">Select Modality</option>
                    {radiologyModalityOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={form.body_part} onChange={(e) => setForm((p) => ({ ...p, body_part: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary bg-white">
                    <option value="">Select Body Part</option>
                    {radiologyBodyPartOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                  {form.modality === 'Other' && (
                    <input required placeholder="Custom Modality" value={form.custom_modality || ''} onChange={(e) => setForm((p) => ({ ...p, custom_modality: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary md:col-span-2" />
                  )}
                  {form.body_part === 'Other' && (
                    <input placeholder="Custom Body Part" value={form.custom_body_part || ''} onChange={(e) => setForm((p) => ({ ...p, custom_body_part: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary md:col-span-2" />
                  )}
                  <input placeholder="Finding" value={form.finding} onChange={(e) => setForm((p) => ({ ...p, finding: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary md:col-span-2" />
                  <input placeholder="Impression" value={form.impression} onChange={(e) => setForm((p) => ({ ...p, impression: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary md:col-span-2" />
                  <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary">
                    <option value="Final">Final</option><option value="Preliminary">Preliminary</option>
                  </select>
                </div>
              )}

              {activeSource === 'Wearable' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select required value={form.metric} onChange={(e) => setForm((p) => ({ ...p, metric: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary bg-white">
                    <option value="">Select Metric</option>
                    {wearableMetricOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {form.metric === 'Other' && (
                    <input required placeholder="Custom Metric" value={form.custom_metric || ''} onChange={(e) => setForm((p) => ({ ...p, custom_metric: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  )}
                  <input required placeholder="Value" value={form.wvalue} onChange={(e) => setForm((p) => ({ ...p, wvalue: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-60">{saving ? 'Saving...' : 'Save Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {saveMessage && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 shadow-lg">
          {saveMessage}
        </div>
      )}
    </Layout>
  );
};

export default DoctorDataHub;

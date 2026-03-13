import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Search, Loader2, ChevronRight, Plus, X } from 'lucide-react';

const DoctorPatients = () => {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState('');
  const [condition, setCondition] = useState('');
  const [status, setStatus] = useState('');
  const [risk, setRisk] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [activeTab, setActiveTab] = useState('all');

  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    age: '',
    gender: '',
    blood_type: '',
    primary_condition: '',
    status: 'Stable',
    smoking_status: '',
    allergies: '',
    medications: '',
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTab, setProfileTab] = useState('overview');
  const [profile, setProfile] = useState(null);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/doctor-panel/patients/enriched');
      setPatients(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const conditions = useMemo(
    () => [...new Set((patients || []).map((p) => p.primary_condition).filter(Boolean))].sort(),
    [patients]
  );

  const riskOrder = { High: 0, Medium: 1, Low: 2 };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...(patients || [])];

    if (activeTab === 'high-risk') list = list.filter((p) => p.risk === 'High');
    else if (activeTab === 'active-monitors') list = list.filter((p) => (p.active_monitors || 0) > 0);
    else if (activeTab === 'critical-alerts') list = list.filter((p) => (p.critical_alerts || 0) > 0);

    list = list.filter((p) => {
      if (condition && p.primary_condition !== condition) return false;
      if (status && p.status !== status) return false;
      if (risk && p.risk !== risk) return false;
      if (!q) return true;
      return String(p.name || '').toLowerCase().includes(q) || String(p.primary_condition || '').toLowerCase().includes(q);
    });

    list.sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sortBy === 'last_visit') return String(b.last_visit || '').localeCompare(String(a.last_visit || ''));
      if (sortBy === 'risk') return (riskOrder[a.risk] ?? 9) - (riskOrder[b.risk] ?? 9);
      if (sortBy === 'condition') return String(a.primary_condition || '').localeCompare(String(b.primary_condition || ''));
      return 0;
    });

    return list;
  }, [patients, query, condition, status, risk, sortBy, activeTab]);

  const openProfile = async (patientId) => {
    try {
      setProfileOpen(true);
      setProfileLoading(true);
      setProfileTab('overview');
      const res = await axios.get(`/doctor-panel/patients/${patientId}/profile`);
      setProfile(res.data || null);
    } catch (err) {
      console.error(err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setProfileOpen(false);
    setProfile(null);
  };

  const onAddPatient = async (e) => {
    e.preventDefault();
    try {
      setAddLoading(true);
      await axios.post('/doctor-panel/patients', {
        ...addForm,
        age: addForm.age ? Number(addForm.age) : undefined,
      });
      setAddOpen(false);
      setAddForm({
        name: '',
        age: '',
        gender: '',
        blood_type: '',
        primary_condition: '',
        status: 'Stable',
        smoking_status: '',
        allergies: '',
        medications: '',
      });
      await loadPatients();
    } catch (err) {
      console.error(err);
    } finally {
      setAddLoading(false);
    }
  };

  const patient = profile?.patient;
  const latestVital = profile?.vitals?.[0] || null;

  return (
    <Layout title="My Patients" subtitle="Search, filter, sort, and review detailed patient records.">
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or condition..."
                className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-primary"
              />
            </div>

            <select value={condition} onChange={(e) => setCondition(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-primary">
              <option value="">All Conditions</option>
              {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-primary">
              <option value="">All Statuses</option>
              <option value="Stable">Stable</option>
              <option value="Review">Review</option>
              <option value="Critical">Critical</option>
            </select>

            <select value={risk} onChange={(e) => setRisk(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-primary">
              <option value="">All Risk</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium outline-none focus:border-primary">
              <option value="name">Sort: Name</option>
              <option value="last_visit">Sort: Last Visit</option>
              <option value="risk">Sort: Risk</option>
              <option value="condition">Sort: Condition</option>
            </select>

            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold">
              <Plus size={16} /> Add Patient
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All Patients' },
              { key: 'high-risk', label: 'High Risk' },
              { key: 'active-monitors', label: 'Active Monitors' },
              { key: 'critical-alerts', label: 'Critical Alerts' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${activeTab === tab.key ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
            <Loader2 className="animate-spin" size={24} /> Loading patients...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 font-medium">
            No patients found.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <button key={p.id} type="button" onClick={() => openProfile(p.id)} className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm text-left hover:border-primary/30 hover:bg-slate-50 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xl font-display font-bold text-slate-800 truncate">{p.name}</h3>
                    <p className="text-sm text-slate-500 truncate">{p.age || '—'} • {p.gender || '—'} • {p.blood_type || '—'}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${p.risk === 'High' ? 'bg-red-100 text-red-700' : p.risk === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {p.risk || 'Low'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Condition</p>
                    <p className="font-semibold text-slate-700 truncate">{p.primary_condition || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Status</p>
                    <span className={`inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full ${p.status === 'Critical' ? 'bg-red-100 text-red-700' : p.status === 'Review' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{p.status || 'Stable'}</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Last Visit</p>
                    <p className="font-semibold text-slate-700">{p.last_visit ? new Date(`${p.last_visit}T00:00:00`).toLocaleDateString() : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Next Appt</p>
                    <p className="font-semibold text-slate-700 truncate">{p.next_appointment?.date ? `${new Date(`${p.next_appointment.date}T00:00:00`).toLocaleDateString()} ${p.next_appointment?.time || ''}` : 'None scheduled'}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Alerts: {p.total_alerts || 0}</span>
                    <span>•</span>
                    <span>Monitors: {p.active_monitors || 0}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">View <ChevronRight size={16} /></span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-display font-bold text-slate-800">Add New Patient</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50"><X size={16} /></button>
            </div>

            <form onSubmit={onAddPatient} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input required placeholder="Full Name" value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                <input required min="0" max="150" type="number" placeholder="Age" value={addForm.age} onChange={(e) => setAddForm((p) => ({ ...p, age: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
                <select value={addForm.gender} onChange={(e) => setAddForm((p) => ({ ...p, gender: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="">Gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select>
                <select value={addForm.blood_type} onChange={(e) => setAddForm((p) => ({ ...p, blood_type: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="">Blood Type</option>
                  <option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
                </select>
              </div>
              <input required placeholder="Primary Condition" value={addForm.primary_condition} onChange={(e) => setAddForm((p) => ({ ...p, primary_condition: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select value={addForm.status} onChange={(e) => setAddForm((p) => ({ ...p, status: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="Stable">Stable</option><option value="Review">Review</option><option value="Critical">Critical</option>
                </select>
                <select value={addForm.smoking_status} onChange={(e) => setAddForm((p) => ({ ...p, smoking_status: e.target.value }))} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="">Smoking Status</option><option value="Never">Never</option><option value="Former">Former</option><option value="Current">Current</option>
                </select>
              </div>
              <input placeholder="Allergies (comma separated)" value={addForm.allergies} onChange={(e) => setAddForm((p) => ({ ...p, allergies: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
              <input placeholder="Medications (comma separated)" value={addForm.medications} onChange={(e) => setAddForm((p) => ({ ...p, medications: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary" />
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold">Cancel</button>
                <button type="submit" disabled={addLoading} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-60">{addLoading ? 'Adding...' : 'Add Patient'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeProfile}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-3xl border border-slate-200 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h2 className="text-3xl font-display font-bold text-slate-800 truncate">{patient?.name || 'Patient'}</h2>
                <p className="text-sm text-slate-500 mt-1">{patient?.age || '—'} • {patient?.gender || '—'} • Blood: {patient?.blood_type || '—'}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-700">{patient?.status || '—'}</span>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">{patient?.primary_condition || 'No condition'}</span>
                </div>
              </div>
              <button type="button" onClick={closeProfile} className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50"><X size={16} /></button>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 mb-4">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'labs', label: 'Lab Results' },
                { key: 'imaging', label: 'Imaging' },
                { key: 'timeline', label: 'Timeline' },
                { key: 'wearable', label: 'Wearable' },
              ].map((t) => (
                <button key={t.key} type="button" onClick={() => setProfileTab(t.key)} className={`px-3 py-1.5 rounded-xl text-sm font-bold border ${profileTab === t.key ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {profileLoading ? (
              <div className="flex items-center justify-center p-10 text-slate-500 gap-3">
                <Loader2 className="animate-spin" size={22} /> Loading patient details...
              </div>
            ) : !profile ? (
              <p className="text-sm text-slate-500">Unable to load details.</p>
            ) : (
              <>
                {profileTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase font-bold text-slate-400">Heart Rate</p><p className="text-2xl font-display font-bold text-slate-800 mt-1">{latestVital?.heart_rate ?? '—'} bpm</p></div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase font-bold text-slate-400">Blood Pressure</p><p className="text-2xl font-display font-bold text-slate-800 mt-1">{latestVital?.systolic && latestVital?.diastolic ? `${latestVital.systolic}/${latestVital.diastolic}` : '—'}</p></div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs uppercase font-bold text-slate-400">SpO₂</p><p className="text-2xl font-display font-bold text-slate-800 mt-1">{latestVital?.spo2 ?? '—'}%</p></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-sm font-bold text-slate-700 mb-2">Allergies</p>
                        <div className="flex flex-wrap gap-2">
                          {(String(patient?.allergies || '').split(',').map((x) => x.trim()).filter(Boolean).length ? String(patient?.allergies || '').split(',').map((x) => x.trim()).filter(Boolean) : ['None']).map((a, idx) => <span key={`${a}-${idx}`} className="text-xs font-bold px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100">{a}</span>)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 p-4">
                        <p className="text-sm font-bold text-slate-700 mb-2">Medications</p>
                        <div className="flex flex-wrap gap-2">
                          {(String(patient?.medications || '').split(',').map((x) => x.trim()).filter(Boolean).length ? String(patient?.medications || '').split(',').map((x) => x.trim()).filter(Boolean) : ['None']).map((m, idx) => <span key={`${m}-${idx}`} className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">{m}</span>)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-bold text-slate-700 mb-2">Active Alerts</p>
                      {(profile.alerts || []).length === 0 ? (
                        <p className="text-sm text-slate-500">No active alerts.</p>
                      ) : (
                        <div className="space-y-2">
                          {(profile.alerts || []).map((a) => (
                            <div key={a._id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-sm font-semibold text-slate-800">{a.message}</p>
                              <p className="text-xs text-slate-500 mt-1">{a.source} • {a.severity}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {profileTab === 'labs' && (
                  <div className="space-y-2">
                    {(profile.labs || []).length === 0 ? <p className="text-sm text-slate-500">No lab results.</p> : (profile.labs || []).map((l) => (
                      <div key={l._id} className="rounded-2xl border border-slate-200 p-3">
                        <p className="font-semibold text-slate-800">{l.test_name || l.name || 'Lab Test'}</p>
                        <p className="text-sm text-slate-500">{l.value ?? '—'} {l.unit || ''} {l.status ? `• ${l.status}` : ''}</p>
                        <p className="text-xs text-slate-400 mt-1">{l.recorded_at ? new Date(l.recorded_at).toLocaleString() : ''}</p>
                      </div>
                    ))}
                  </div>
                )}

                {profileTab === 'imaging' && (
                  <div className="space-y-2">
                    {(profile.images || []).length === 0 ? <p className="text-sm text-slate-500">No imaging records.</p> : (profile.images || []).map((img) => (
                      <div key={img._id} className="rounded-2xl border border-slate-200 p-3">
                        <p className="font-semibold text-slate-800">{img.image_type || img.type || 'Imaging'}</p>
                        <p className="text-sm text-slate-500">{img.findings || img.impression || 'No findings provided'}</p>
                        <p className="text-xs text-slate-400 mt-1">{img.recorded_at ? new Date(img.recorded_at).toLocaleString() : ''}</p>
                      </div>
                    ))}
                  </div>
                )}

                {profileTab === 'timeline' && (
                  <div className="space-y-2">
                    {(profile.timeline || []).length === 0 ? <p className="text-sm text-slate-500">No timeline events.</p> : (profile.timeline || []).map((t) => (
                      <div key={t._id} className="rounded-2xl border border-slate-200 p-3">
                        <p className="font-semibold text-slate-800">{t.title || t.event || 'Event'}</p>
                        <p className="text-sm text-slate-500">{t.description || t.notes || 'No additional details'}</p>
                        <p className="text-xs text-slate-400 mt-1">{t.event_date ? new Date(t.event_date).toLocaleString() : ''}</p>
                      </div>
                    ))}
                  </div>
                )}

                {profileTab === 'wearable' && (
                  <div className="space-y-2">
                    {(profile.wearable || []).length === 0 ? <p className="text-sm text-slate-500">No wearable data.</p> : (profile.wearable || []).slice(-20).reverse().map((w) => (
                      <div key={w._id} className="rounded-2xl border border-slate-200 p-3 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800">{w.metric || 'Metric'}</p>
                          <p className="text-xs text-slate-400 mt-1">{w.recorded_at ? new Date(w.recorded_at).toLocaleString() : ''}</p>
                        </div>
                        <p className="text-lg font-display font-bold text-slate-800">{w.value ?? '—'} {w.unit || ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DoctorPatients;

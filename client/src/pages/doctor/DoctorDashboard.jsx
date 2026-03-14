import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { Users, Bell, CalendarClock, Database, CheckCircle2, XCircle, Loader2, ChevronRight, X } from 'lucide-react';

const DoctorDashboard = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [chatRequests, setChatRequests] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTab, setProfileTab] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [hospitalSet, setHospitalSet] = useState([]);
  const [primaryHospital, setPrimaryHospital] = useState('');
  const [hospitalSaving, setHospitalSaving] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [correctMode, setCorrectMode] = useState(false);
  const [correctedData, setCorrectedData] = useState({
    doctor: { name: '', regNo: '', clinic: '', date: '' },
    patient: { name: '' },
    medicines: [],
    instructions: '',
  });

  const formatDoctorName = (name) => {
    const clean = String(name || '').replace(/^\s*((dr|doctor)\.?\s*)+/i, '').trim();
    return clean ? `Dr. ${clean}` : 'Doctor';
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, requestsRes, chatReqRes, alertsRes, apptsRes] = await Promise.all([
        axios.get('/doctor-panel/stats'),
        axios.get('/doctors/requests'),
        axios.get('/chats/doctor/pending'),
        axios.get('/doctor-panel/alerts'),
        axios.get('/doctor-panel/appointments'),
      ]);

      setStats(statsRes.data || null);
      setRequests(requestsRes.data || []);
      setChatRequests(chatReqRes.data || []);
      setAlerts((alertsRes.data || []).slice(0, 5));
      setAppointments((apptsRes.data || []).slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const parseHospitals = () => {
      if (!user) return [];

      let list = [];
      if (Array.isArray(user.hospitalsVisited)) {
        list = user.hospitalsVisited;
      } else {
        const raw = String(user.hospitalsVisited || '').trim();
        if (raw) {
          const splitBy = raw.includes('||') ? '||' : raw.includes('\n') ? '\n' : ',';
          list = raw.split(splitBy);
        }
      }

      list = list.map((x) => String(x || '').trim()).filter(Boolean);
      if (user.hospital && !list.includes(user.hospital)) list.unshift(user.hospital);
      if (!list.length && user.hospital) list = [user.hospital];
      return list;
    };

    const hospitals = parseHospitals();
    setHospitalSet(hospitals);
    setPrimaryHospital(user?.hospital || hospitals[0] || '');
  }, [user]);

  const setPrimaryHospitalFromToggle = async (hospitalName) => {
    if (!hospitalName || hospitalName === primaryHospital) return;
    try {
      setHospitalSaving(true);
      setPrimaryHospital(hospitalName);
      await updateProfile({ hospital: hospitalName });
    } catch (err) {
      console.error(err);
    } finally {
      setHospitalSaving(false);
    }
  };

  const handleRequestAction = async (id, status) => {
    try {
      setRequestBusy(true);
      await axios.put(`/doctors/requests/${id}/status`, { status });
      setRequests((prev) => prev.filter((r) => r._id !== id));
      setRequestModalOpen(false);
      setSelectedRequest(null);
    } catch (err) {
      console.error(err);
    } finally {
      setRequestBusy(false);
    }
  };

  const handleChatRequestDecision = async (id, action) => {
    try {
      setRequestBusy(true);
      await axios.patch(`/chats/requests/${id}/decision`, { action });
      setChatRequests((prev) => prev.filter((r) => r._id !== id));
      if (action === 'ACCEPT') {
        navigate(`/doctor/chats/${id}`);
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || 'Failed to process chat request');
    } finally {
      setRequestBusy(false);
    }
  };

  const openRequestModal = (req) => {
    const raw = req?.prescriptionReference?.rawOcrData || {};
    const normalized = {
      doctor: {
        name: raw?.doctor?.name || req?.prescriptionReference?.doctorRecognizedName || '',
        regNo: raw?.doctor?.regNo || req?.prescriptionReference?.doctorRegNo || '',
        clinic: raw?.doctor?.clinic || '',
        date: raw?.doctor?.date || '',
      },
      patient: {
        name: raw?.patient?.name || req?.patientId?.name || '',
      },
      medicines: Array.isArray(raw?.medicines)
        ? raw.medicines.map((m) => ({
            name: m?.name || '',
            dosage: m?.dosage || '',
            frequency: m?.frequency || '',
            duration: m?.duration || '',
            route: m?.route || '',
          }))
        : [],
      instructions: raw?.instructions || '',
    };

    setSelectedRequest(req);
    setCorrectMode(false);
    setCorrectedData(normalized);
    setRequestModalOpen(true);
  };

  const submitCorrection = async () => {
    if (!selectedRequest?._id) return;
    try {
      setRequestBusy(true);
      await axios.put(`/doctors/requests/${selectedRequest._id}/status`, {
        status: 'CORRECTED',
        correctedData,
        note: 'Corrected by doctor'
      });
      setRequests((prev) => prev.filter((r) => r._id !== selectedRequest._id));
      setRequestModalOpen(false);
      setSelectedRequest(null);
      setCorrectMode(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save corrected prescription data');
    } finally {
      setRequestBusy(false);
    }
  };

  const updateCorrectedField = (section, field, value) => {
    setCorrectedData((prev) => ({
      ...prev,
      [section]: {
        ...(prev?.[section] || {}),
        [field]: value,
      },
    }));
  };

  const updateCorrectedMedicine = (index, field, value) => {
    setCorrectedData((prev) => {
      const meds = [...(prev?.medicines || [])];
      meds[index] = { ...(meds[index] || {}), [field]: value };
      return { ...prev, medicines: meds };
    });
  };

  const addCorrectedMedicine = () => {
    setCorrectedData((prev) => ({
      ...prev,
      medicines: [...(prev?.medicines || []), { name: '', dosage: '', frequency: '', duration: '', route: '' }],
    }));
  };

  const removeCorrectedMedicine = (index) => {
    setCorrectedData((prev) => ({
      ...prev,
      medicines: (prev?.medicines || []).filter((_, i) => i !== index),
    }));
  };

  const openPatientProfile = async (patientId) => {
    if (!patientId) return;
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

  const statCards = [
    {
      label: 'Total Patients',
      value: stats?.total_patients ?? '—',
      icon: <Users size={22} className="text-blue-600" />,
    },
    {
      label: 'Critical Alerts',
      value: stats?.critical_alerts ?? '—',
      icon: <Bell size={22} className="text-red-600" />,
    },
    {
      label: 'Today Appointments',
      value: appointments.length,
      icon: <CalendarClock size={22} className="text-amber-600" />,
    },
    {
      label: 'Connected Sources',
      value: stats?.data_sources ?? '—',
      icon: <Database size={22} className="text-emerald-600" />,
    },
  ];

  const patient = profile?.patient;
  const latestVital = profile?.vitals?.[0] || null;

  return (
    <Layout title={formatDoctorName(user?.name || 'Doctor')} subtitle="Overview of your panel, alerts, and pending requests.">
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading dashboard...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-semibold">{s.label}</p>
                  <h3 className="text-3xl font-display font-bold text-slate-800 mt-1">{s.value}</h3>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                  {s.icon}
                </div>
              </div>
            ))}
          </div>

          {hospitalSet.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500 font-semibold">Current practice location</p>
                  <h3 className="text-xl font-display font-bold text-slate-800">{primaryHospital || 'Select Hospital'}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {hospitalSet.map((h) => (
                    <button
                      key={h}
                      type="button"
                      disabled={hospitalSaving}
                      onClick={() => setPrimaryHospitalFromToggle(h)}
                      className={`px-3 py-2 rounded-xl border text-sm font-bold transition ${primaryHospital === h ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-display font-bold text-slate-800">Pending Connection Requests</h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{requests.length + chatRequests.length}</span>
              </div>

              {requests.length === 0 && chatRequests.length === 0 ? (
                <p className="text-sm text-slate-500">No pending requests.</p>
              ) : (
                <div className="space-y-3">
                  {chatRequests.map((req) => (
                    <div
                      key={`chat-${req._id}`}
                      className="w-full text-left rounded-2xl border border-blue-200 bg-blue-50 p-4"
                    >
                      <p className="font-bold text-slate-800">{req.patientId?.name || 'Patient'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Chat requested on {new Date(req.createdAt).toLocaleDateString()}</p>
                      <p className="text-xs text-blue-700 font-bold mt-2">Chat request notification</p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={requestBusy}
                          onClick={() => handleChatRequestDecision(req._id, 'ACCEPT')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-60"
                        >
                          <CheckCircle2 size={13} /> Accept
                        </button>
                        <button
                          type="button"
                          disabled={requestBusy}
                          onClick={() => handleChatRequestDecision(req._id, 'DENY')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold disabled:opacity-60"
                        >
                          <XCircle size={13} /> Deny
                        </button>
                      </div>
                    </div>
                  ))}

                  {requests.map((req) => (
                    <button
                      key={req._id}
                      type="button"
                      onClick={() => openRequestModal(req)}
                      className="w-full text-left rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition"
                    >
                      <p className="font-bold text-slate-800">{req.patientId?.name || 'Patient'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Requested on {new Date(req.createdAt).toLocaleDateString()} • {req.prescriptionReference?.doctorRecognizedName || 'Doctor name missing'}</p>
                      <p className="text-xs text-primary font-bold mt-2">Open to review and verify</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-display font-bold text-slate-800">Today Appointments</h2>
                <button onClick={() => navigate('/doctor/appointments')} className="text-sm font-bold text-primary inline-flex items-center gap-1">View all <ChevronRight size={16} /></button>
              </div>

              {appointments.length === 0 ? (
                <p className="text-sm text-slate-500">No appointments today.</p>
              ) : (
                <div className="space-y-3">
                  {appointments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => navigate('/doctor/patients')}
                      className="w-full text-left rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition"
                    >
                      <p className="font-bold text-slate-800">{a.time} · {a.patient_name}</p>
                      <p className="text-sm text-slate-500 mt-1">{a.purpose || 'Consultation'}{a.primary_condition ? ` • ${a.primary_condition}` : ''}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-display font-bold text-slate-800">Recent Alerts</h2>
              <button onClick={() => navigate('/doctor/alerts')} className="text-sm font-bold text-primary inline-flex items-center gap-1">Open alerts <ChevronRight size={16} /></button>
            </div>
            {alerts.length === 0 ? (
              <p className="text-sm text-slate-500">No active alerts.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openPatientProfile(a.patient_id)}
                    className="w-full text-left rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition"
                  >
                    <p className="font-semibold text-slate-800">{a.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{a.patient_name} • {a.source} • {a.severity}</p>
                  </button>
                ))}
              </div>
            )}
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

      {requestModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRequestModalOpen(false)}>
          <div className="w-full max-w-5xl max-h-[90vh] overflow-auto bg-white rounded-3xl border border-slate-200 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-display font-bold text-slate-800">Prescription Verification Request</h2>
                <p className="text-sm text-slate-500 mt-1">Patient: {selectedRequest.patientId?.name || 'Unknown'} • Requested on {new Date(selectedRequest.createdAt).toLocaleString()}</p>
              </div>
              <button type="button" onClick={() => setRequestModalOpen(false)} className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-700 mb-2">Prescription Image</h3>
                {selectedRequest.prescriptionReference?.imagePath ? (
                  <img
                    src={`http://localhost:5000/uploads/${selectedRequest.prescriptionReference.imagePath}`}
                    alt="Prescription"
                    className="w-full rounded-xl border border-slate-200"
                  />
                ) : (
                  <p className="text-sm text-slate-500">No image found.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Extracted Prescription Details</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Doctor Name</p>
                    {correctMode ? (
                      <input
                        value={correctedData?.doctor?.name || ''}
                        onChange={(e) => updateCorrectedField('doctor', 'name', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-700">{correctedData?.doctor?.name || '—'}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Registration No</p>
                    {correctMode ? (
                      <input
                        value={correctedData?.doctor?.regNo || ''}
                        onChange={(e) => updateCorrectedField('doctor', 'regNo', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-700">{correctedData?.doctor?.regNo || '—'}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Clinic</p>
                    {correctMode ? (
                      <input
                        value={correctedData?.doctor?.clinic || ''}
                        onChange={(e) => updateCorrectedField('doctor', 'clinic', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-700">{correctedData?.doctor?.clinic || '—'}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Patient Name</p>
                    {correctMode ? (
                      <input
                        value={correctedData?.patient?.name || ''}
                        onChange={(e) => updateCorrectedField('patient', 'name', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-700">{correctedData?.patient?.name || '—'}</p>
                    )}
                  </div>
                </div>

                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-700">Medications</h4>
                  {correctMode && (
                    <button
                      type="button"
                      onClick={addCorrectedMedicine}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 text-primary"
                    >
                      + Add Medication
                    </button>
                  )}
                </div>

                {(correctedData?.medicines || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No medicines detected.</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                    {(correctedData?.medicines || []).map((m, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {[
                            ['name', 'Name'],
                            ['dosage', 'Dosage / Quantity'],
                            ['frequency', 'Frequency'],
                            ['duration', 'Duration'],
                            ['route', 'Route'],
                          ].map(([field, label]) => (
                            <div key={field} className={field === 'route' ? 'md:col-span-2' : ''}>
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
                              {correctMode ? (
                                <input
                                  value={m?.[field] || ''}
                                  onChange={(e) => updateCorrectedMedicine(idx, field, e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
                                />
                              ) : (
                                <p className="text-sm font-semibold text-slate-700">{m?.[field] || '—'}</p>
                              )}
                            </div>
                          ))}
                        </div>

                        {correctMode && (
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeCorrectedMedicine(idx)}
                              className="text-xs font-bold px-2.5 py-1 rounded-lg border border-rose-300 bg-rose-50 text-rose-700"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">General Instructions</p>
                  {correctMode ? (
                    <textarea
                      value={correctedData?.instructions || ''}
                      onChange={(e) => setCorrectedData((prev) => ({ ...prev, instructions: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  ) : (
                    <p className="text-sm text-slate-700">{correctedData?.instructions || '—'}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                disabled={requestBusy}
                onClick={() => handleRequestAction(selectedRequest._id, 'APPROVED')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-60"
              >
                <CheckCircle2 size={16} /> Verify
              </button>

              <button
                type="button"
                disabled={requestBusy}
                onClick={() => handleRequestAction(selectedRequest._id, 'REJECTED')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-60"
              >
                <XCircle size={16} /> Reject
              </button>

              {!correctMode ? (
                <button
                  type="button"
                  disabled={requestBusy}
                  onClick={() => setCorrectMode(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-700 font-bold disabled:opacity-60"
                >
                  Correct
                </button>
              ) : (
                <button
                  type="button"
                  disabled={requestBusy}
                  onClick={submitCorrection}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white font-bold disabled:opacity-60"
                >
                  Send Corrected Data
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DoctorDashboard;

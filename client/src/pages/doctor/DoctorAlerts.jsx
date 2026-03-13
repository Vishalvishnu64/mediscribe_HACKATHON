import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Loader2, TriangleAlert, X } from 'lucide-react';

const DoctorAlerts = () => {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTab, setProfileTab] = useState('overview');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get('/doctor-panel/alerts');
        setAlerts(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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

  const patient = profile?.patient;
  const latestVital = profile?.vitals?.[0] || null;

  return (
    <Layout title="Patient Alerts" subtitle="All active alerts from your patient panel.">
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading alerts...
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 font-medium">
          No active alerts.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => openPatientProfile(a.patient_id)}
              className="w-full text-left bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:bg-slate-50 hover:border-primary/30 transition"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.severity === 'critical' ? 'bg-red-100 text-red-600' : a.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                  <TriangleAlert size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{a.message}</p>
                  <p className="text-sm text-slate-500 mt-1">{a.patient_name} • {a.source} • {a.severity}</p>
                </div>
              </div>
            </button>
          ))}
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

export default DoctorAlerts;

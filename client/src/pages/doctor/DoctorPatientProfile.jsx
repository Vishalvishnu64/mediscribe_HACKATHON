import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Loader2 } from 'lucide-react';

const DoctorPatientProfile = () => {
  const { patientId } = useParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/doctor-panel/patients/${patientId}/profile`);
        setProfile(res.data || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [patientId]);

  const p = profile?.patient;

  return (
    <Layout title={p?.name || 'Patient Profile'} subtitle="Vitals, labs, imaging, timeline, and alerts.">
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading patient profile...
        </div>
      ) : !profile ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 font-medium">
          Patient profile not available.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-display font-bold text-slate-800">Overview</h2>
            <p className="text-sm text-slate-600 mt-2">{p?.age || '—'} • {p?.gender || '—'} • {p?.blood_type || '—'}</p>
            <p className="text-sm text-slate-600 mt-1">Condition: {p?.primary_condition || '—'} • Status: {p?.status || '—'}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <h3 className="font-display font-bold text-slate-800">Active Alerts ({profile.alerts?.length || 0})</h3>
              <div className="mt-3 space-y-2">
                {(profile.alerts || []).slice(0, 8).map((a) => (
                  <div key={a._id} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-sm font-semibold text-slate-800">{a.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{a.source} • {a.severity}</p>
                  </div>
                ))}
                {(!profile.alerts || profile.alerts.length === 0) && <p className="text-sm text-slate-500">No active alerts.</p>}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <h3 className="font-display font-bold text-slate-800">Timeline ({profile.timeline?.length || 0})</h3>
              <div className="mt-3 space-y-2">
                {(profile.timeline || []).slice(0, 8).map((t) => (
                  <div key={t._id} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-sm font-semibold text-slate-800">{t.title || t.event || 'Event'}</p>
                    <p className="text-xs text-slate-500 mt-1">{t.event_date ? new Date(t.event_date).toLocaleDateString() : ''}</p>
                  </div>
                ))}
                {(!profile.timeline || profile.timeline.length === 0) && <p className="text-sm text-slate-500">No timeline records.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DoctorPatientProfile;

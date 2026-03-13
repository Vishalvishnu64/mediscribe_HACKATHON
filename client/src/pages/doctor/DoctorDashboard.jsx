import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { Users, Bell, CalendarClock, Database, CheckCircle2, XCircle, Loader2, ChevronRight } from 'lucide-react';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, requestsRes, alertsRes, apptsRes] = await Promise.all([
        axios.get('/doctor-panel/stats'),
        axios.get('/doctors/requests'),
        axios.get('/doctor-panel/alerts'),
        axios.get('/doctor-panel/appointments'),
      ]);

      setStats(statsRes.data || null);
      setRequests(requestsRes.data || []);
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

  const handleRequestAction = async (id, status) => {
    try {
      await axios.put(`/doctors/requests/${id}/status`, { status });
      setRequests((prev) => prev.filter((r) => r._id !== id));
    } catch (err) {
      console.error(err);
    }
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

  return (
    <Layout title={`Dr. ${user?.name || 'Doctor'}`} subtitle="Overview of your panel, alerts, and pending requests.">
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-display font-bold text-slate-800">Pending Connection Requests</h2>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{requests.length}</span>
              </div>

              {requests.length === 0 ? (
                <p className="text-sm text-slate-500">No pending requests.</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div key={req._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-bold text-slate-800">{req.patientId?.name || 'Patient'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Requested on {new Date(req.createdAt).toLocaleDateString()}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRequestAction(req._id, 'APPROVED')}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-bold"
                        >
                          <CheckCircle2 size={16} /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestAction(req._id, 'REJECTED')}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    </div>
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
                  <div key={a.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-800">{a.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{a.patient_name} • {a.source} • {a.severity}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default DoctorDashboard;

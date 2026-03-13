import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Loader2, Check } from 'lucide-react';

const DoctorAppointments = () => {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/doctor-panel/appointments');
      setAppointments(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleDone = async (id) => {
    try {
      await axios.patch(`/doctor-panel/appointments/${id}/done`);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a)));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Layout title="Appointments" subtitle="Manage today's appointments.">
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading appointments...
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-500 font-medium">
          No appointments today.
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between gap-4">
              <div>
                <p className="font-bold text-slate-800">{a.time} • {a.patient_name}</p>
                <p className="text-sm text-slate-500 mt-1">{a.purpose || 'Consultation'}{a.primary_condition ? ` • ${a.primary_condition}` : ''}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleDone(a.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border ${a.completed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              >
                <Check size={16} /> {a.completed ? 'Completed' : 'Mark done'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default DoctorAppointments;

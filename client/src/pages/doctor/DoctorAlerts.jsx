import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Loader2, TriangleAlert } from 'lucide-react';

const DoctorAlerts = () => {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);

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
            <div key={a.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.severity === 'critical' ? 'bg-red-100 text-red-600' : a.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                  <TriangleAlert size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{a.message}</p>
                  <p className="text-sm text-slate-500 mt-1">{a.patient_name} • {a.source} • {a.severity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default DoctorAlerts;

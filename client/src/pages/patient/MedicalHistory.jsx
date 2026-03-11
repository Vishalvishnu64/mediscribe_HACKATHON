import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { FileText, Pill, CalendarDays, Loader2 } from 'lucide-react';

const MedicalHistory = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [historyMeds, setHistoryMeds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const [prescRes, medsRes] = await Promise.all([
        axios.get('/medications/prescriptions'),
        axios.get('/medications/history')
      ]);
      setPrescriptions(prescRes.data);
      setHistoryMeds(medsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
                
                {prescriptions.map((rx, i) => (
                  <div key={rx._id} className="flex gap-4 relative z-10">
                    <div className={`w-[36px] h-[36px] shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold ${rx.type === 'NEW' ? 'bg-primary' : 'bg-slate-400'}`}>
                      {i + 1}
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-slate-800">Dr. {rx.doctorRecognizedName || 'Unknown'}</h4>
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${rx.type === 'NEW' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {rx.type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 font-medium flex items-center gap-1">
                        <CalendarDays size={14} /> {new Date(rx.date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {rx.rawOcrData?.medicines?.length || 0} medicine(s) extracted
                      </p>
                    </div>
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

        </div>
      )}
    </Layout>
  );
};

export default MedicalHistory;

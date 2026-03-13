import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { 
  ArrowUpRight, 
  Pill, 
  Clock, 
  UploadCloud, 
  CheckCircle2,
  Loader2,
  ChevronRight
} from 'lucide-react';

const PatientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeMeds, setActiveMeds] = useState([]);
  const [allMeds, setAllMeds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [activeRes, allRes] = await Promise.all([
        axios.get('/medications/active'),
        axios.get('/medications/all')
      ]);
      setActiveMeds(activeRes.data);
      setAllMeds(allRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compute live stats
  const totalActive = activeMeds.length;
  const totalReminders = activeMeds.reduce((sum, m) => sum + (m.reminderTimes?.length || 0), 0);
  const completedCount = allMeds.filter(m => m.status === 'COMPLETED').length;
  const adherenceRate = allMeds.length > 0 ? Math.round((completedCount / allMeds.length) * 100) : 0;

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const upcomingReminders = activeMeds
    .flatMap((med) => (med.reminderTimes || []).map((t) => ({
      medName: med.name,
      time: t,
      dosage: med.dosage || ''
    })))
    .map((item) => {
      const [h, m] = item.time.split(':').map(Number);
      const mins = h * 60 + m;
      return { ...item, mins, isPast: mins < nowMinutes };
    })
    .sort((a, b) => a.mins - b.mins);

  const nextReminder = upcomingReminders.find((r) => !r.isPast) || null;

  const stats = [
    { label: 'Active Medications', value: totalActive, trend: `${totalActive} active`, icon: <Pill size={24} className="text-secondary" /> },
    { label: 'Daily Reminders', value: totalReminders, trend: 'Today', icon: <Clock size={24} className="text-blue-500" /> },
    { label: 'Adherence Rate', value: `${adherenceRate}%`, trend: completedCount + ' completed', icon: <ArrowUpRight size={24} className="text-primary" /> }
  ];

  if (loading) {
    return (
      <Layout title="Dashboard" subtitle="Loading...">
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading your dashboard...
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title={`Hello, ${user?.name}`} 
      subtitle="Here's a quick overview of your health plan."
    >
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start justify-between group hover:border-primary/20 transition-colors">
            <div>
              <p className="text-sm font-semibold text-slate-500 mb-1">{stat.label}</p>
              <h3 className="text-3xl font-display font-bold text-slate-800">{stat.value}</h3>
              <p className="text-xs font-bold text-emerald-600 mt-2 bg-emerald-50 w-max px-2 py-1 rounded-md">{stat.trend}</p>
            </div>
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Active Medications */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-slate-800">Current Medications</h2>
              <button onClick={() => navigate('/patient/medications')} className="text-sm font-bold text-primary hover:underline">View All</button>
            </div>

            {activeMeds.length === 0 ? (
              <div className="text-center py-8 text-slate-500 font-medium border-2 border-dashed border-slate-200 rounded-2xl">
                No active medications. Upload a prescription to get started!
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {activeMeds.slice(0, 5).map((med) => (
                  <div key={med._id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-emerald-50/50 hover:border-emerald-100 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-primary">
                        <Pill size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg leading-tight">{med.name}</h4>
                        <p className="text-sm font-medium text-slate-500 mt-0.5">{med.frequency} {med.dosage ? `· ${med.dosage}` : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-bold text-slate-800">
                         {med.reminderTimes?.join(', ') || 'No reminders'}
                       </p>
                       <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md mt-1 bg-emerald-100 text-emerald-700">
                          <CheckCircle2 size={12} /> Active
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today Reminder Timeline */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-display font-bold text-slate-800">Today's Timeline</h2>
              <button onClick={() => navigate('/patient/reminders')} className="text-sm font-bold text-primary hover:underline">Manage</button>
            </div>

            {upcomingReminders.length === 0 ? (
              <p className="text-slate-500 font-medium text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                No reminders scheduled yet.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingReminders.slice(0, 6).map((r, idx) => (
                  <div key={`${r.medName}-${r.time}-${idx}`} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${r.isPast ? 'bg-slate-300' : 'bg-primary'}`}></div>
                    <p className="text-sm font-semibold text-slate-700 w-14 shrink-0">{r.time}</p>
                    <p className={`text-sm ${r.isPast ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {r.medName} {r.dosage ? `(${r.dosage})` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Actions */}
        <div className="flex flex-col gap-6">
          
          {/* Upload Card */}
          <div className="bg-gradient-to-br from-primary to-emerald-600 rounded-3xl p-6 shadow-lg shadow-primary/20 text-white relative overflow-hidden group cursor-pointer"
               onClick={() => navigate('/patient/prescriptions')}>
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4">
              <UploadCloud size={24} />
            </div>
            <h3 className="text-xl font-display font-bold mb-2">Upload Prescription</h3>
            <p className="text-sm text-emerald-50 mb-6 font-medium">Scan a new or old prescription to automatically extract medicines and set up reminders.</p>
            
            <button className="w-full bg-white text-primary font-bold py-3 rounded-xl hover:bg-emerald-50 transition-colors shadow-sm">
              Scan Document
            </button>
          </div>

          {/* Next Reminder Snapshot */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-lg text-slate-800 mb-3">Next Reminder</h3>
            {nextReminder ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
                  <p className="text-xs uppercase font-bold text-amber-700 mb-1">Coming up</p>
                  <p className="text-lg font-bold text-slate-800">{nextReminder.time}</p>
                  <p className="text-sm text-slate-600 mt-1">{nextReminder.medName} {nextReminder.dosage ? `• ${nextReminder.dosage}` : ''}</p>
                </div>
                <button
                  onClick={() => navigate('/patient/reminders')}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl hover:bg-slate-200 transition"
                >
                  Open Reminders <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-500 font-medium">No upcoming reminders today.</p>
            )}
          </div>

        </div>

      </div>
    </Layout>
  );
};

export default PatientDashboard;

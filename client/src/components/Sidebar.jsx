import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  HeartPulse, 
  LayoutDashboard, 
  FileText, 
  Users, 
  CalendarCheck, 
  Bell,
  Database,
  Settings,
  Pill,
  Clock,
  LogOut
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const isDoctor = user?.role === 'DOCTOR';
  const [doctorGlance, setDoctorGlance] = useState({ today_patients: 0, critical_alerts: 0 });

  useEffect(() => {
    const loadDoctorGlance = async () => {
      if (!isDoctor) return;
      try {
        const res = await axios.get('/doctor-panel/glance');
        setDoctorGlance({
          today_patients: Number(res.data?.today_patients || 0),
          critical_alerts: Number(res.data?.critical_alerts || 0),
        });
      } catch (err) {
        console.error(err);
      }
    };

    loadDoctorGlance();
  }, [isDoctor]);

  const patientLinks = [
    { to: '/patient/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { to: '/patient/prescriptions', label: 'Upload Rx', icon: <FileText size={20} /> },
    { to: '/patient/doctors', label: 'Doctors', icon: <Users size={20} /> },
    { to: '/patient/medications', label: 'Active Meds', icon: <Pill size={20} /> },
    { to: '/patient/reminders', label: 'Reminders', icon: <Clock size={20} /> },
    { to: '/patient/history', label: 'Medical History', icon: <CalendarCheck size={20} /> },
    { to: '/patient/settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const doctorLinks = [
    { to: '/doctor/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { to: '/doctor/patients', label: 'My Patients', icon: <Users size={20} /> },
    { to: '/doctor/alerts', label: 'Alerts', icon: <Bell size={20} /> },
    { to: '/doctor/appointments', label: 'Appointments', icon: <CalendarCheck size={20} /> },
    { to: '/doctor/data-hub', label: 'Data Hub', icon: <Database size={20} /> },
    { to: '/doctor/settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const links = isDoctor ? doctorLinks : patientLinks;

  return (
    <aside className="fixed left-6 top-6 bottom-6 w-64 bg-white/95 backdrop-blur-md border border-slate-200 rounded-3xl p-6 shadow-[0_22px_42px_rgba(14,67,77,0.05)] flex flex-col gap-6 z-40">
      
      {/* Brand */}
      <div className="flex items-center gap-3 mb-2 px-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold bg-gradient-to-br ${isDoctor ? 'from-blue-500 to-blue-600' : 'from-primary to-emerald-400'}`}>
          <HeartPulse size={24} />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg leading-tight text-slate-800">MediScribe</h2>
          <p className="text-xs text-slate-500 font-medium">{isDoctor ? 'Doctor Portal' : 'Patient Portal'}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {links.map((link) => (
          <NavLink
            key={link.label}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-semibold ${
                isActive 
                  ? isDoctor 
                    ? 'bg-blue-50 text-blue-700 translate-x-1' 
                    : 'bg-emerald-50 text-primary translate-x-1'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>

      {isDoctor && (
        <div className="mt-auto bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-xs text-slate-500 font-semibold">Today at a glance</p>
          <p className="text-4xl leading-none font-display font-bold text-slate-800 mt-2">{doctorGlance.today_patients}</p>
          <p className="text-sm font-semibold text-slate-700">Patients Today</p>
          <p className="text-sm text-slate-500 mt-2">{doctorGlance.critical_alerts} critical alerts active</p>
        </div>
      )}

      {/* Logout Card */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
            <img src={user?.profilePic || "https://api.dicebear.com/7.x/notionists/svg?seed="+user?.name} alt="avatar" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold truncate text-slate-800">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="w-full flex justify-center items-center gap-2 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>

    </aside>
  );
};

export default Sidebar;

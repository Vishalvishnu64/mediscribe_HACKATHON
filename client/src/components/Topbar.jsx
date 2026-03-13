import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Search, Bell } from 'lucide-react';

const Topbar = ({ title, subtitle }) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const res = await axios.get('/medications/active');
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        const items = [];
        (res.data || []).forEach((med) => {
          (med.reminderTimes || []).forEach((t) => {
            const [h, m] = t.split(':').map(Number);
            if (Number.isNaN(h) || Number.isNaN(m)) return;
            const mins = h * 60 + m;
            if (mins >= nowMinutes) {
              items.push({
                id: `${med._id}-${t}`,
                title: med.name,
                time: t,
                dosage: med.dosage || '',
                delta: mins - nowMinutes
              });
            }
          });
        });

        items.sort((a, b) => a.delta - b.delta);
        setNotifications(items.slice(0, 8));
      } catch (err) {
        console.error('Failed loading notifications', err);
      }
    };

    loadNotifications();
  }, [title]);

  const unreadCount = useMemo(() => notifications.length, [notifications]);

  return (
    <header className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-3xl p-5 px-6 shadow-[0_22px_42px_rgba(14,67,77,0.05)] flex items-center justify-between gap-6 relative z-30">
      
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 font-medium mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="search" 
            placeholder="Search..." 
            className="bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-primary focus:bg-white transition-colors w-64 text-sm font-medium"
          />
        </div>

        {/* Notification */}
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className="w-11 h-11 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:text-primary hover:border-primary/30 transition-colors shadow-sm relative"
        >
          <Bell size={20} />
          {unreadCount > 0 && <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-alert rounded-full border border-white"></span>}
        </button>

        {notifOpen && (
          <div className="absolute top-[88px] right-6 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3">
            <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100 mb-2">
              <p className="font-bold text-slate-800 text-sm">Upcoming reminders</p>
              <span className="text-xs text-slate-500">{unreadCount}</span>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500 p-2">No pending reminders for today.</p>
            ) : (
              <div className="max-h-72 overflow-auto flex flex-col gap-1">
                {notifications.map((n) => (
                  <div key={n.id} className="p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200">
                    <p className="text-sm font-semibold text-slate-700">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.time}{n.dosage ? ` • ${n.dosage}` : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </header>
  );
};

export default Topbar;

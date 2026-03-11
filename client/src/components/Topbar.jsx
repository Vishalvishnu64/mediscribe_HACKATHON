import React from 'react';
import { Search, Bell } from 'lucide-react';

const Topbar = ({ title, subtitle }) => {
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
        <button className="w-11 h-11 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:text-primary hover:border-primary/30 transition-colors shadow-sm relative">
          <Bell size={20} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-alert rounded-full border border-white"></span>
        </button>
      </div>

    </header>
  );
};

export default Topbar;

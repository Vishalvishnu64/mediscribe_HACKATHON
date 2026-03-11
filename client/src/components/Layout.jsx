import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const Layout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden text-slate-800">
      
      {/* Background Orbs */}
      <div className="fixed top-[60%] left-[-100px] w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="fixed top-[20%] right-[-100px] w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none"></div>

      <Sidebar />
      
      <main className="ml-[300px] p-6 pr-8 flex flex-col gap-6 min-h-screen">
        <Topbar title={title} subtitle={subtitle} />
        <div className="flex-1">
          {children}
        </div>
      </main>

    </div>
  );
};

export default Layout;

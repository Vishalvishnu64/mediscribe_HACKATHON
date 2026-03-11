import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartPulse, Stethoscope, UserCircle } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-6 relative overflow-hidden">
      
      {/* Decorative Blob */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-secondary/10 rounded-full blur-3xl"></div>

      <div className="z-10 text-center max-w-2xl mx-auto mb-12">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="bg-primary text-white p-3 rounded-2xl shadow-lg">
            <HeartPulse size={40} />
          </div>
          <h1 className="text-5xl font-display font-bold text-slate-800">MedTrack<span className="text-primary">AI</span></h1>
        </div>
        <p className="text-xl text-slate-600 font-medium">
          The smart healthcare management system that bridges the gap between doctors and patients through AI-powered insights.
        </p>
      </div>

      <div className="z-10 flex flex-col sm:flex-row gap-6 w-full max-w-3xl">
        {/* Doctor Card */}
        <button 
          onClick={() => navigate('/login?role=DOCTOR')}
          className="flex-1 group bg-white p-8 border border-slate-200 rounded-3xl shadow-xl hover:shadow-2xl hover:border-primary/30 transition-all text-left flex flex-col hover:-translate-y-1"
        >
          <div className="h-14 w-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Stethoscope size={28} />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">I am a Doctor</h2>
          <p className="text-slate-500 font-medium">Manage patients, review AI-parsed prescriptions, and monitor medical histories.</p>
        </button>

        {/* Patient Card */}
        <button 
          onClick={() => navigate('/login?role=PATIENT')}
          className="flex-1 group bg-white p-8 border border-slate-200 rounded-3xl shadow-xl hover:shadow-2xl hover:border-secondary/30 transition-all text-left flex flex-col hover:-translate-y-1"
        >
          <div className="h-14 w-14 bg-orange-50 text-secondary rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <UserCircle size={28} />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">I am a Patient</h2>
          <p className="text-slate-500 font-medium">Upload prescriptions, track medications, and get automated smart reminders.</p>
        </button>
      </div>
    </div>
  );
};

export default Landing;

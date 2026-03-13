import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { ArrowLeft, Hospital, Stethoscope, BadgeCheck, Mail, MapPin, CalendarClock, Wallet, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DoctorProfile = () => {
  const { user } = useAuth();
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        const res = await axios.get(`/doctors/profile/${doctorId}`);
        setDoctor(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctor();
  }, [doctorId]);

  useEffect(() => {
    if (!doctor) return;
    const key = `mediscribe-recent-doctors-${user?.id || 'anon'}`;
    const payload = {
      _id: doctor._id,
      name: doctor.name,
      profilePic: doctor.profilePic || null,
      specialization: doctor.specialization || '',
      hospital: doctor.hospital || ''
    };

    try {
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const next = [payload, ...existing.filter((x) => x._id !== payload._id)].slice(0, 4);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore localStorage errors
    }
  }, [doctor, user?.id]);

  const schedule = doctor?.schedule?.length
    ? doctor.schedule
    : [
        { day: 'Monday - Friday', start: '09:00', end: '17:00', mode: 'In-person' },
        { day: 'Saturday', start: '10:00', end: '13:00', mode: 'Online' }
      ];

  const displayName = String(doctor?.name || '').replace(/^\s*(dr\.?\s*)+/i, '').trim();

  const parseHospitals = (value, fallback) => {
    if (Array.isArray(value)) return value.map((x) => String(x || '').trim()).filter(Boolean);
    const raw = String(value || '').trim();
    if (!raw) return fallback ? [fallback] : [];
    const splitBy = raw.includes('||') ? '||' : raw.includes('\n') ? '\n' : ',';
    return raw.split(splitBy).map((x) => x.trim()).filter(Boolean);
  };

  const hospitals = parseHospitals(doctor?.hospitalsVisited, doctor?.hospital);

  if (loading) {
    return (
      <Layout title="Doctor Profile" subtitle="Loading doctor details...">
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading profile...
        </div>
      </Layout>
    );
  }

  if (!doctor) {
    return (
      <Layout title="Doctor Profile" subtitle="Unable to load doctor details.">
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
          <p className="text-slate-600 font-medium">Doctor profile not found.</p>
          <button onClick={() => navigate('/patient/doctors')} className="mt-4 px-4 py-2 rounded-xl bg-primary text-white font-semibold">Back to Doctors</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Dr. ${displayName || doctor.name}`} subtitle="Doctor profile and schedules">
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => navigate('/patient/doctors')}
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <ArrowLeft size={16} /> Back to doctor search
        </button>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-6">
            <img
              src={doctor.profilePic || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(doctor.name || 'doctor')}`}
              alt={doctor.name}
              className="w-28 h-28 rounded-2xl object-cover border border-slate-200 bg-white"
            />

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h2 className="text-2xl font-display font-bold text-slate-800 mb-1">Dr. {displayName || doctor.name}</h2>
                <p className="text-slate-500 flex items-center gap-1 text-sm"><Stethoscope size={14} /> {doctor.specialization || 'General Practice'}</p>
                {doctor.bio && <p className="text-sm text-slate-600 mt-3">{doctor.bio}</p>}
              </div>

              <div className="space-y-2 text-sm text-slate-600">
                <p className="flex items-center gap-2"><Hospital size={14} /> {doctor.hospital || 'Hospital not specified'}</p>
                <p className="flex items-center gap-2"><BadgeCheck size={14} /> Reg: {doctor.registrationNumber || 'N/A'}</p>
                <p className="flex items-center gap-2"><Mail size={14} /> {doctor.email || 'N/A'}</p>
                <p className="flex items-center gap-2"><span className="font-semibold">Phone:</span> {doctor.phone || 'N/A'}</p>
                <p className="flex items-center gap-2"><MapPin size={14} /> {doctor.clinicAddress || 'Address not available'}</p>
                <p className="flex items-center gap-2"><Wallet size={14} /> Consultation Fee: {doctor.consultationFee ? `₹${doctor.consultationFee}` : 'Not specified'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-xl font-display font-bold text-slate-800 mb-4">Professional Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Primary Specialization</p>
              <p className="mt-1 font-semibold text-slate-700">{doctor.specialization || 'Not specified'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">State Medical Council</p>
              <p className="mt-1 font-semibold text-slate-700">{doctor.stateMedicalCouncil || 'Not specified'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Highest Qualification</p>
              <p className="mt-1 font-semibold text-slate-700">{doctor.qualifications || 'Not specified'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500 font-bold uppercase">Qualification Institution</p>
              <p className="mt-1 font-semibold text-slate-700">{doctor.qualificationInstitution || 'Not specified'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
              <p className="text-xs text-slate-500 font-bold uppercase">Experience</p>
              <p className="mt-1 font-semibold text-slate-700">{doctor.experienceYears != null ? `${doctor.experienceYears} years` : 'Not specified'}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800 mb-2">Set of Hospitals</p>
            {hospitals.length === 0 ? (
              <p className="text-sm text-slate-500">No hospitals listed.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {hospitals.map((h, idx) => (
                  <span key={`${h}-${idx}`} className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-xl font-display font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CalendarClock size={20} className="text-primary" /> Doctor Schedules
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {schedule.map((slot, idx) => (
              <div key={`${slot.day}-${idx}`} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <p className="font-bold text-slate-800">{slot.day || 'Day not specified'}</p>
                <p className="text-sm text-slate-600 mt-1">{slot.start || '--:--'} - {slot.end || '--:--'}</p>
                <span className="inline-flex mt-2 text-xs font-bold px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">
                  {slot.mode || 'In-person'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DoctorProfile;

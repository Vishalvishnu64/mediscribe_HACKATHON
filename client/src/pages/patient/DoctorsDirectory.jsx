import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Search, Hospital, Stethoscope, ChevronRight, Loader2, Clock3, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DoctorsDirectory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [myDoctors, setMyDoctors] = useState([]);
  const [recentViewed, setRecentViewed] = useState([]);
  const [activeSection, setActiveSection] = useState('search'); // 'search' | 'my'
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchWrapRef = useRef(null);

  const recentKey = `mediscribe-recent-doctors-${user?.id || 'anon'}`;

  const formatDoctorName = (name) => {
    const clean = String(name || '').replace(/^\s*((dr|doctor)\.?\s*)+/i, '').trim();
    return clean ? `Dr. ${clean}` : 'Doctor';
  };

  const loadRecentViewed = () => {
    try {
      const raw = localStorage.getItem(recentKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setRecentViewed(Array.isArray(parsed) ? parsed.slice(0, 4) : []);
    } catch {
      setRecentViewed([]);
    }
  };

  useEffect(() => {
    const next = params.get('q') || '';
    setQuery(next);
  }, [params]);

  useEffect(() => {
    loadRecentViewed();
  }, [recentKey]);

  useEffect(() => {
    const loadMyDoctors = async () => {
      try {
        const res = await axios.get('/doctors/my');
        setMyDoctors(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadMyDoctors();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const q = query.trim();
        if (!q || q.length < 2) {
          setDoctors([]);
          return;
        }
        const res = await axios.get('/doctors/list', { params: { q } });
        setDoctors(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [query]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!searchWrapRef.current?.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    setParams(q ? { q } : {});
  };

  const openDoctorProfile = (doc) => {
    const payload = {
      _id: doc._id,
      name: doc.name,
      profilePic: doc.profilePic || null,
      specialization: doc.specialization || '',
      hospital: doc.hospital || '',
    };

    try {
      const current = JSON.parse(localStorage.getItem(recentKey) || '[]');
      const next = [payload, ...current.filter((x) => x._id !== payload._id)].slice(0, 4);
      localStorage.setItem(recentKey, JSON.stringify(next));
      setRecentViewed(next);
    } catch {
      // ignore storage errors
    }

    navigate(`/patient/doctors/${doc._id}`);
  };

  const removeRecentDoctor = (doctorId) => {
    const next = recentViewed.filter((d) => d._id !== doctorId);
    setRecentViewed(next);
    localStorage.setItem(recentKey, JSON.stringify(next));
  };

  const showSearchDropdown = activeSection === 'search' && isSearchFocused && query.trim().length >= 2;

  const DoctorCard = ({ doc, clickable = true, redFlag = false, onClick }) => (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={`bg-white border rounded-2xl p-4 text-left transition ${clickable ? 'border-slate-200 hover:border-primary/30 hover:bg-slate-50 cursor-pointer' : 'border-slate-200 cursor-default'}`}
    >
      <div className="flex items-start gap-3">
        <img
          src={doc.profilePic || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(doc.name || 'doctor')}`}
          alt={doc.name}
          className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-white"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 truncate">{formatDoctorName(doc.name)}</h3>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1 truncate"><Stethoscope size={14} /> {doc.specialization || 'General Practice'}</p>
          <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1 truncate"><Hospital size={14} /> {doc.hospital || 'Hospital not specified'}</p>
          {redFlag && <p className="text-xs font-bold text-red-600 mt-1">Not in database</p>}
        </div>
        {clickable && <ChevronRight size={16} className="text-slate-400 mt-1" />}
      </div>
    </button>
  );

  return (
    <Layout title="Find Doctors" subtitle="Search registered doctors and view their profiles.">
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-2 shadow-sm inline-flex gap-2 w-max">
          <button
            type="button"
            onClick={() => setActiveSection('search')}
            className={`px-4 py-2 rounded-2xl text-sm font-bold transition ${activeSection === 'search' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Search Doctors
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('my')}
            className={`px-4 py-2 rounded-2xl text-sm font-bold transition ${activeSection === 'my' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            My Doctors
          </button>
        </div>

        {activeSection === 'search' ? (
          <>
            <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="relative" ref={searchWrapRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder="Search by doctor name, specialization, hospital, registration no..."
                  className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-primary"
                />

                {showSearchDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-20 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                    {loading ? (
                      <div className="px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> Searching doctors...
                      </div>
                    ) : doctors.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">No doctors found.</div>
                    ) : (
                      <div className="max-h-72 overflow-auto">
                        {doctors.map((d) => (
                          <button
                            key={d._id}
                            type="button"
                            onClick={() => {
                              setIsSearchFocused(false);
                              openDoctorProfile(d);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                          >
                            <p className="text-sm font-semibold text-slate-700 truncate">{formatDoctorName(d.name)}</p>
                            <p className="text-xs text-slate-500 truncate">{d.specialization || 'General'} • {d.hospital || 'Hospital not set'}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-bold text-lg text-slate-800 flex items-center gap-2"><Clock3 size={18} className="text-primary" /> Recently Viewed</h3>
              </div>

              {recentViewed.length === 0 ? (
                <p className="text-sm text-slate-500">No recently viewed doctors.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recentViewed.map((doc) => (
                    <div key={doc._id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-3">
                      <img
                        src={doc.profilePic || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(doc.name || 'doctor')}`}
                        alt={doc.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => openDoctorProfile(doc)}
                        className="flex-1 text-left"
                      >
                        <p className="text-sm font-bold text-slate-800 truncate">{formatDoctorName(doc.name)}</p>
                        <p className="text-xs text-slate-500 truncate">{doc.specialization || 'General'} • {doc.hospital || 'Hospital not set'}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecentDoctor(doc._id)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="Remove from recent"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <h3 className="font-display font-bold text-lg text-slate-800 mb-3">My Doctors</h3>
            {myDoctors.length === 0 ? (
              <p className="text-sm text-slate-500">No doctors found from your scanned prescriptions yet.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {myDoctors.map((doc, idx) => (
                  <DoctorCard
                    key={`${doc.doctorId || doc.name}-${idx}`}
                    doc={doc}
                    clickable={!!doc.canOpenProfile}
                    redFlag={!doc.inDatabase}
                    onClick={doc.canOpenProfile ? () => openDoctorProfile({ _id: doc.doctorId, ...doc }) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DoctorsDirectory;

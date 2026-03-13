import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Pill, CheckCircle2, Clock, Loader2, Calendar, Pencil, X, Save, User, Plus, Trash2, Camera } from 'lucide-react';

const ActiveMeds = () => {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [doctorNameInput, setDoctorNameInput] = useState('');
  const [editingTimesId, setEditingTimesId] = useState(null);
  const [timesInput, setTimesInput] = useState([]);
  const [newTime, setNewTime] = useState('08:00');
  const [editingEndDateId, setEditingEndDateId] = useState(null);
  const [endDateInput, setEndDateInput] = useState('');

  useEffect(() => {
    fetchMeds();
  }, []);

  const fetchMeds = async () => {
    try {
      const res = await axios.get('/medications/active');
      setMedications(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markComplete = async (id) => {
    try {
      await axios.put(`/medications/${id}/complete`);
      setMedications(medications.filter(m => m._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const startEditing = (med) => {
    setEditingId(med._id);
    setDoctorNameInput(med.doctorName || med.prescriptionId?.doctorRecognizedName || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDoctorNameInput('');
  };

  const saveDoctorName = async (id) => {
    try {
      const res = await axios.put(`/medications/${id}`, { doctorName: doctorNameInput });
      setMedications(prev => prev.map(m => m._id === id ? res.data : m));
      setEditingId(null);
      setDoctorNameInput('');
    } catch (err) {
      console.error('Save doctor name error:', err.response?.data || err.message);
      alert('Failed to save doctor name: ' + (err.response?.data?.error || err.message));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getDoctorDisplay = (med) => {
    return med.doctorName || med.prescriptionId?.doctorRecognizedName || null;
  };

  const isTimeToTake = (med) => {
    if (!med.reminderTimes || med.reminderTimes.length === 0) return true;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return med.reminderTimes.some(t => {
      const [h, m] = t.split(':').map(Number);
      return currentMinutes >= h * 60 + m;
    });
  };

  const startEditingTimes = (med) => {
    setEditingTimesId(med._id);
    setTimesInput([...(med.reminderTimes || [])]);
    setNewTime('08:00');
  };

  const cancelEditingTimes = () => {
    setEditingTimesId(null);
    setTimesInput([]);
  };

  const addTime = () => {
    if (newTime && !timesInput.includes(newTime)) {
      setTimesInput([...timesInput, newTime].sort());
    }
  };

  const removeTime = (t) => {
    setTimesInput(timesInput.filter(x => x !== t));
  };

  const saveReminderTimes = async (id) => {
    try {
      // Auto-include the current time picker value if not already added
      let finalTimes = [...timesInput];
      if (newTime && !finalTimes.includes(newTime)) {
        finalTimes.push(newTime);
        finalTimes.sort();
      }
      const res = await axios.put(`/medications/${id}`, { reminderTimes: finalTimes });
      setMedications(prev => prev.map(m => m._id === id ? res.data : m));
      setEditingTimesId(null);
      setTimesInput([]);
    } catch (err) {
      console.error('Save reminder times error:', err.response?.data || err.message);
      alert('Failed to save: ' + (err.response?.data?.error || err.message));
    }
  };

  const toDateInputValue = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const startEditingEndDate = (med) => {
    setEditingEndDateId(med._id);
    setEndDateInput(toDateInputValue(med.endDate));
  };

  const cancelEditingEndDate = () => {
    setEditingEndDateId(null);
    setEndDateInput('');
  };

  const saveEndDate = async (id) => {
    try {
      const payload = { endDate: endDateInput || null };
      const res = await axios.put(`/medications/${id}`, payload);
      if (res.data.status === 'HISTORY') {
        setMedications(prev => prev.filter(m => m._id !== id));
      } else {
        setMedications(prev => prev.map(m => m._id === id ? res.data : m));
      }
      setEditingEndDateId(null);
      setEndDateInput('');
    } catch (err) {
      console.error('Save end date error:', err.response?.data || err.message);
      alert('Failed to save end date: ' + (err.response?.data?.error || err.message));
    }
  };

  const uploadLocationImage = async (id, file) => {
    if (!file) return;
    const compressImage = (inputFile) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 1200;
          const scale = Math.min(1, maxWidth / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas not supported'));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const out = canvas.toDataURL('image/jpeg', 0.75);
          resolve(out);
        };
        img.onerror = reject;
        img.src = String(reader.result || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(inputFile);
    });

    try {
      const compressedDataUrl = await compressImage(file);
      const res = await axios.put(`/medications/${id}`, { locationImage: compressedDataUrl });
      setMedications(prev => prev.map(m => m._id === id ? res.data : m));
    } catch (err) {
      console.error('Upload location image error:', err.response?.data || err.message);
      alert('Failed to upload image: ' + (err.response?.data?.error || err.message));
    }
  };

  const removeLocationImage = async (id) => {
    try {
      const res = await axios.put(`/medications/${id}`, { locationImage: '' });
      setMedications(prev => prev.map(m => m._id === id ? res.data : m));
    } catch (err) {
      console.error('Remove location image error:', err.response?.data || err.message);
      alert('Failed to remove image: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <Layout title="Active Medications" subtitle="Medications you are currently taking based on your prescriptions.">
      
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading medications...
        </div>
      ) : medications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Pill size={32} />
          </div>
          <h3 className="text-xl font-display font-bold text-slate-800 mb-2">No Active Medications</h3>
          <p className="text-slate-500 font-medium">Upload a new prescription to automatically add active medications here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {medications.map((med) => (
            <div key={med._id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-emerald-200 transition-colors">
              {/* Top row: Name + Action buttons */}
              <div className="flex flex-col lg:flex-row items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 bg-emerald-50 text-primary rounded-xl flex items-center justify-center shrink-0">
                    <Pill size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-800 truncate">{med.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {med.dosage && (
                        <span className="bg-slate-100 text-slate-600 font-semibold text-[11px] px-2 py-0.5 rounded-md">
                          {med.dosage}
                        </span>
                      )}
                      {med.frequency && (
                        <span className="bg-blue-50 text-blue-600 font-semibold text-[11px] px-2 py-0.5 rounded-md">
                          {med.frequency}
                        </span>
                      )}
                      {med.duration && (
                        <span className="bg-orange-50 text-orange-600 font-semibold text-[11px] px-2 py-0.5 rounded-md">
                          {med.duration}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-full lg:w-auto flex items-start gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 w-[132px] shrink-0">
                    {med.locationImage ? (
                      <img
                        src={med.locationImage}
                        alt={`Storage for ${med.name}`}
                        className="w-full h-20 object-cover rounded-md border border-slate-200"
                      />
                    ) : (
                      <div className="w-full h-20 rounded-md border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[11px] font-semibold text-center px-2">
                        No location photo
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <label className="cursor-pointer flex-1 inline-flex items-center justify-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md px-1.5 py-1 text-[11px] font-bold hover:bg-blue-100">
                        <Camera size={12} /> {med.locationImage ? 'Change' : 'Add'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => uploadLocationImage(med._id, e.target.files?.[0])}
                        />
                      </label>
                      {med.locationImage && (
                        <button
                          onClick={() => removeLocationImage(med._id)}
                          className="inline-flex items-center justify-center bg-rose-50 text-rose-700 border border-rose-200 rounded-md p-1.5 hover:bg-rose-100"
                          title="Remove photo"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    {isTimeToTake(med) ? (
                      <button
                        onClick={() => markComplete(med._id)}
                        className="flex items-center gap-1 bg-emerald-50 text-emerald-700 font-bold text-xs px-3 py-2 rounded-lg hover:bg-emerald-100 transition-colors border border-emerald-200"
                      >
                        <CheckCircle2 size={14} /> Done
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 bg-slate-50 text-slate-400 font-bold text-xs px-3 py-2 rounded-lg border border-slate-200 cursor-not-allowed">
                        <Clock size={14} /> Not yet
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Details row */}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Reminder Times - editable */}
                <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    Reminder Times
                    {editingTimesId !== med._id && (
                      <button onClick={() => startEditingTimes(med)} className="text-slate-400 hover:text-violet-600 p-0.5" title="Edit reminder times">
                        <Pencil size={12} />
                      </button>
                    )}
                  </span>
                  {editingTimesId === med._id ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {timesInput.map((t, i) => (
                          <span key={i} className="flex items-center gap-1 bg-violet-50 border border-violet-200 text-violet-700 font-bold text-xs px-2 py-1 rounded-lg">
                            <Clock size={12} /> {t}
                            <button onClick={() => removeTime(t)} className="text-violet-400 hover:text-red-500 ml-1" title="Remove">
                              <Trash2 size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="time"
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                          className="text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
                        />
                        <button onClick={addTime} className="text-violet-600 hover:text-violet-700 bg-violet-50 border border-violet-200 p-1.5 rounded-md" title="Add time">
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveReminderTimes(med._id)} className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-semibold">
                          <Save size={12} /> Save
                        </button>
                        <button onClick={cancelEditingTimes} className="flex items-center gap-1 text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs font-semibold">
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : med.reminderTimes?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {med.reminderTimes.map((t, i) => (
                        <span key={i} className="flex items-center gap-1 bg-violet-50 border border-violet-200 text-violet-700 font-bold text-xs px-2 py-1 rounded-lg">
                          <Clock size={12} /> {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">No times set</span>
                  )}
                </div>

                {/* Start Date */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Started</span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    <Calendar size={14} className="text-slate-400" />
                    {formatDate(med.startDate) || 'N/A'}
                  </span>
                </div>

                {/* End Date */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    Ends
                    {editingEndDateId !== med._id && (
                      <button onClick={() => startEditingEndDate(med)} className="text-slate-400 hover:text-orange-600 p-0.5" title="Edit end date">
                        <Pencil size={12} />
                      </button>
                    )}
                  </span>
                  {editingEndDateId === med._id ? (
                    <div className="flex flex-col gap-2">
                      <input
                        type="date"
                        value={endDateInput}
                        onChange={(e) => setEndDateInput(e.target.value)}
                        className="text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveEndDate(med._id)} className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-semibold">
                          <Save size={12} /> Save
                        </button>
                        <button onClick={cancelEditingEndDate} className="flex items-center gap-1 text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-xs font-semibold">
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <Calendar size={14} className="text-slate-400" />
                      {formatDate(med.endDate) || 'Ongoing'}
                    </span>
                  )}
                </div>

                {/* Doctor Name - editable */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prescribed By</span>
                  {editingId === med._id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={doctorNameInput}
                        onChange={(e) => setDoctorNameInput(e.target.value)}
                        placeholder="Doctor's name"
                        className="text-xs border border-slate-300 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveDoctorName(med._id);
                          if (e.key === 'Escape') cancelEditing();
                        }}
                      />
                      <button onClick={() => saveDoctorName(med._id)} className="text-emerald-600 hover:text-emerald-700 p-1" title="Save">
                        <Save size={16} />
                      </button>
                      <button onClick={cancelEditing} className="text-slate-400 hover:text-slate-600 p-1" title="Cancel">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                        <User size={14} className="text-slate-400" />
                        {getDoctorDisplay(med) ? `Dr. ${getDoctorDisplay(med)}` : <span className="text-slate-400 italic">Not set</span>}
                      </span>
                      <button onClick={() => startEditing(med)} className="text-slate-400 hover:text-emerald-600 p-1" title="Edit doctor name">
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default ActiveMeds;

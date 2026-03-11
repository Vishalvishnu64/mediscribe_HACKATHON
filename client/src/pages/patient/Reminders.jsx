import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { Pill, BellRing, Info, ShieldCheck, Clock, Bell, BellOff, UserPlus, Trash2, Copy, CheckCircle } from 'lucide-react';

const Reminders = () => {
    const { user } = useAuth();
    const [medications, setMedications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [browserReminders, setBrowserReminders] = useState(false);
    const intervalRef = useRef(null);
    const notifiedRef = useRef(new Set());

    // Nominee state
    const [nominee, setNominee] = useState(null);
    const [showNomineeForm, setShowNomineeForm] = useState(false);
    const [nomineeForm, setNomineeForm] = useState({ name: '', email: '', phone: '' });
    const [nomineeSaving, setNomineeSaving] = useState(false);
    const [nomineeLinkCopied, setNomineeLinkCopied] = useState(false);
    
    useEffect(() => {
        fetchMedications();
        fetchNominee();
        
        // Check push subscription
        if ('serviceWorker' in navigator && 'PushManager' in window) {
           navigator.serviceWorker.ready.then(reg => {
              reg.pushManager.getSubscription().then(sub => {
                 if (sub) setPushEnabled(true);
              });
           });
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const fetchMedications = async () => {
        try {
            const res = await axios.get('/medications/active');
            setMedications(res.data.filter(m => m.reminderTimes && m.reminderTimes.length > 0));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchNominee = async () => {
        try {
            const res = await axios.get('/notifications/nominee');
            if (res.data.nominee && res.data.nominee.name) {
                setNominee(res.data.nominee);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const saveNominee = async () => {
        if (!nomineeForm.name || !nomineeForm.email) return;
        setNomineeSaving(true);
        try {
            const res = await axios.put('/notifications/nominee', nomineeForm);
            setNominee(res.data.nominee);
            setShowNomineeForm(false);
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to save nominee');
        } finally {
            setNomineeSaving(false);
        }
    };

    const removeNominee = async () => {
        if (!confirm('Remove nominee? They will no longer receive reminders.')) return;
        try {
            await axios.delete('/notifications/nominee');
            setNominee(null);
            setNomineeForm({ name: '', email: '', phone: '' });
        } catch (err) {
            console.error(err);
        }
    };

    const copyNomineeLink = () => {
        const link = `${window.location.origin}/nominee-subscribe?patient=${encodeURIComponent(user.email)}`;
        navigator.clipboard.writeText(link);
        setNomineeLinkCopied(true);
        setTimeout(() => setNomineeLinkCopied(false), 2000);
    };

    const enablePushNotifications = async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                // Fallback to browser reminders
                enableBrowserReminders();
                return;
            }

            const res = await axios.get('/notifications/vapid-key');
            const publicVapidKey = res.data.publicKey;

            const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });

            await axios.post('/notifications/subscribe', subscription);
            setPushEnabled(true);
            alert('Push notifications enabled!');

        } catch (err) {
            console.error(err);
            enableBrowserReminders();
        }
    };

    const enableBrowserReminders = () => {
        if (browserReminders) return;
        setBrowserReminders(true);
        notifiedRef.current = new Set();

        intervalRef.current = setInterval(() => {
            const now = new Date();
            const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

            medications.forEach(med => {
                if (med.reminderTimes?.includes(currentTime)) {
                    const key = `${med._id}-${currentTime}`;
                    if (!notifiedRef.current.has(key)) {
                        notifiedRef.current.add(key);
                        // Try browser Notification API
                        if (Notification.permission === 'granted') {
                            new Notification('MedTrack AI Reminder', {
                                body: `Time to take: ${med.name} (${med.dosage || ''})`,
                                icon: '/vite.svg'
                            });
                        } else {
                            // Fallback: in-page alert
                            alert(`⏰ Reminder: Time to take ${med.name} ${med.dosage ? '(' + med.dosage + ')' : ''}`);
                        }
                    }
                }
            });
        }, 30000); // Check every 30 seconds

        alert('Browser reminders enabled! You will get alerts when it\'s time to take your medication.');
    };

    const disableBrowserReminders = () => {
        setBrowserReminders(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    // Helper
    function urlBase64ToUint8Array(base64String) {
      const padding = "=".repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
      return outputArray;
    }

    const getNextReminder = () => {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        let closest = null;
        let closestMed = null;

        medications.forEach(med => {
            med.reminderTimes?.forEach(t => {
                const [h, m] = t.split(':').map(Number);
                const mins = h * 60 + m;
                if (mins > currentMinutes) {
                    if (!closest || mins < closest) {
                        closest = mins;
                        closestMed = { name: med.name, time: t };
                    }
                }
            });
        });
        return closestMed;
    };

    const nextReminder = getNextReminder();

    return (
        <Layout title="Reminders & Notifications" subtitle="Configure alerts for your medication schedule.">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               
               {/* Push / Browser Notifications Card */}
               <div className="bg-gradient-to-br from-indigo-500 to-primary rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
                   <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 blur-3xl rounded-full"></div>
                   <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/30">
                      <BellRing size={32} />
                   </div>
                   <h2 className="text-2xl font-display font-bold mb-3">Medication Alerts</h2>
                   <p className="text-indigo-50 font-medium mb-8">Get reminders when it's time to take your pills. We'll alert you via push notifications or browser alerts.</p>
                   
                   {pushEnabled ? (
                      <div className="bg-white/20 backdrop-blur-md border border-white/40 p-4 rounded-xl flex items-center gap-3">
                         <ShieldCheck className="text-emerald-300" /> 
                         <span className="font-bold">Push Notifications Active</span>
                      </div>
                   ) : browserReminders ? (
                      <div className="flex flex-col gap-3">
                        <div className="bg-white/20 backdrop-blur-md border border-white/40 p-4 rounded-xl flex items-center gap-3">
                           <Bell className="text-yellow-300" /> 
                           <span className="font-bold">Browser Reminders Active</span>
                        </div>
                        <button onClick={disableBrowserReminders} className="bg-white/10 text-white font-bold py-2 px-4 rounded-xl hover:bg-white/20 transition text-sm border border-white/20">
                           <BellOff size={14} className="inline mr-1" /> Disable Reminders
                        </button>
                      </div>
                   ) : (
                      <div className="flex flex-col gap-3">
                        <button onClick={enablePushNotifications} className="bg-white text-indigo-600 font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-slate-50 transition w-full">
                           Enable Push Notifications
                        </button>
                        <button onClick={enableBrowserReminders} className="bg-white/10 text-white font-bold py-3 px-6 rounded-xl hover:bg-white/20 transition w-full border border-white/20">
                           <Bell size={16} className="inline mr-2" /> Enable Browser Reminders
                        </button>
                      </div>
                   )}
               </div>

               {/* Daily Schedule Card */}
               <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-8">
                  <h3 className="font-display font-bold text-xl text-slate-800 mb-4 flex items-center gap-2"><Pill className="text-primary"/> Daily Schedule</h3>
                  
                  {nextReminder && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                      <Clock size={20} className="text-amber-500" />
                      <div>
                        <span className="text-xs font-semibold text-amber-500 uppercase">Next Reminder</span>
                        <p className="font-bold text-slate-800">{nextReminder.name} at {nextReminder.time}</p>
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <p className="text-slate-500 font-medium text-center py-6">Loading...</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                     {medications.map((m, i) => (
                         <div key={m._id || i} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2">
                             <div className="flex justify-between items-center">
                                <h4 className="font-bold text-slate-800">{m.name}</h4>
                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-lg">Active</span>
                             </div>
                             {m.dosage && <span className="text-sm text-slate-500">{m.dosage}</span>}
                             <div className="flex gap-2 flex-wrap mt-1">
                                {m.reminderTimes.map(t => (
                                    <span key={t} className="bg-white border border-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg text-sm shadow-sm flex items-center gap-1">
                                       <BellRing size={14} className="text-slate-400" /> {t}
                                    </span>
                                ))}
                             </div>
                         </div>
                     ))}
                    </div>
                  )}

                  {!loading && medications.length === 0 && (
                      <p className="text-slate-500 font-medium text-center py-6 flex flex-col items-center gap-2">
                          <Info size={24} /> No medications with reminder times set. Go to Active Meds to add times.
                      </p>
                  )}
               </div>
           </div>

           {/* Nominee Section */}
           <div className="mt-8 bg-white border border-slate-200 shadow-sm rounded-3xl p-8">
              <h3 className="font-display font-bold text-xl text-slate-800 mb-2 flex items-center gap-2">
                <UserPlus className="text-primary" /> Nominee / Caregiver Alerts
              </h3>
              <p className="text-slate-500 text-sm mb-6">Add a family member or caregiver who will also receive medication reminders for you.</p>

              {nominee ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 uppercase mb-1">Active Nominee</p>
                      <p className="font-bold text-slate-800 text-lg">{nominee.name}</p>
                      <p className="text-slate-500 text-sm">{nominee.email}{nominee.phone ? ` • ${nominee.phone}` : ''}</p>
                      {nominee.pushSubscription ? (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg">
                          <CheckCircle size={12} /> Push notifications active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg">
                          <Bell size={12} /> Pending — share the link below
                        </span>
                      )}
                    </div>
                    <button onClick={removeNominee} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-xl transition" title="Remove nominee">
                      <Trash2 size={20} />
                    </button>
                  </div>

                  {!nominee.pushSubscription && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <p className="text-sm text-slate-600 mb-3">Share this link with <strong>{nominee.name}</strong> so they can enable push notifications on their device:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 break-all">
                          {`${window.location.origin}/nominee-subscribe?patient=${encodeURIComponent(user.email)}`}
                        </code>
                        <button onClick={copyNomineeLink} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition flex items-center gap-1 shrink-0">
                          {nomineeLinkCopied ? <><CheckCircle size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                        </button>
                      </div>
                    </div>
                  )}

                  <button onClick={() => { setNomineeForm({ name: nominee.name, email: nominee.email, phone: nominee.phone || '' }); setShowNomineeForm(true); }} className="text-sm text-primary hover:underline font-medium">
                    Edit nominee details
                  </button>
                </div>
              ) : !showNomineeForm ? (
                <button onClick={() => setShowNomineeForm(true)} className="bg-primary text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-indigo-700 transition flex items-center gap-2">
                  <UserPlus size={18} /> Add a Nominee
                </button>
              ) : null}

              {showNomineeForm && (
                <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nominee Name *</label>
                    <input type="text" value={nomineeForm.name} onChange={e => setNomineeForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Doe" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nominee Email *</label>
                    <input type="email" value={nomineeForm.email} onChange={e => setNomineeForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. john@example.com" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nominee Phone (optional)</label>
                    <input type="tel" value={nomineeForm.phone} onChange={e => setNomineeForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. +91 9876543210" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={saveNominee} disabled={nomineeSaving || !nomineeForm.name || !nomineeForm.email} className="bg-primary text-white font-bold py-2.5 px-6 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                      {nomineeSaving ? 'Saving...' : 'Save Nominee'}
                    </button>
                    <button onClick={() => setShowNomineeForm(false)} className="bg-slate-200 text-slate-700 font-bold py-2.5 px-6 rounded-xl hover:bg-slate-300 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
           </div>
        </Layout>
    );
};

export default Reminders;

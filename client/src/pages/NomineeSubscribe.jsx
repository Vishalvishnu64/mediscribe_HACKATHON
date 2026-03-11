import React, { useState } from 'react';
import axios from 'axios';
import { BellRing, CheckCircle, XCircle } from 'lucide-react';

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

const NomineeSubscribe = () => {
  const params = new URLSearchParams(window.location.search);
  const patientEmail = params.get('patient') || '';

  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const enableNotifications = async () => {
    if (!patientEmail) {
      setErrorMsg('Invalid link — no patient specified.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setErrorMsg('Notification permission denied. Please allow notifications and try again.');
        setStatus('error');
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

      await axios.post('/notifications/nominee/subscribe', {
        patientEmail,
        subscription
      });

      setStatus('success');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Failed to enable notifications. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BellRing size={32} className="text-indigo-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">Nominee Reminder Setup</h1>
        <p className="text-slate-500 mb-6">
          You've been added as a nominee/caregiver. Enable push notifications to receive medication reminders for your loved one.
        </p>

        {patientEmail && (
          <p className="text-sm text-slate-400 mb-6">Patient: <strong className="text-slate-600">{patientEmail}</strong></p>
        )}

        {status === 'idle' && (
          <button onClick={enableNotifications} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:bg-indigo-700 transition w-full">
            Enable Push Notifications
          </button>
        )}

        {status === 'loading' && (
          <div className="text-indigo-600 font-semibold py-4">Setting up notifications...</div>
        )}

        {status === 'success' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3 text-left">
            <CheckCircle className="text-emerald-600 shrink-0" size={24} />
            <div>
              <p className="font-bold text-emerald-800">Notifications enabled!</p>
              <p className="text-sm text-emerald-600">You'll now receive medication reminders. You can close this page.</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-left">
              <XCircle className="text-red-500 shrink-0" size={20} />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
            <button onClick={() => { setStatus('idle'); setErrorMsg(''); }} className="text-indigo-600 font-medium hover:underline text-sm">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NomineeSubscribe;

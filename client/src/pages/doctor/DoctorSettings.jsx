import React, { useState } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';

const DoctorSettings = () => {
  const { user, updateProfile, uiPrefs, updateUiPrefs } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [hospital, setHospital] = useState(user?.hospital || '');
  const [specialization, setSpecialization] = useState(user?.specialization || '');
  const [saving, setSaving] = useState(false);

  const onSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProfile({ name, hospital, specialization, settings: uiPrefs });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Settings" subtitle="Manage doctor profile and appearance settings.">
      <div className="space-y-6">
        <form onSubmit={onSave} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-display font-bold text-slate-800">Profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-primary" />
            <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Specialization" className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-primary" />
            <input value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="Hospital" className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-primary md:col-span-2" />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-xl bg-primary text-white font-bold disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-display font-bold text-slate-800">Appearance</h2>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={!!uiPrefs.darkMode}
                onChange={(e) => updateUiPrefs({ darkMode: e.target.checked })}
              />
              Dark mode
            </label>
            <select
              value={uiPrefs.fontSize || 'medium'}
              onChange={(e) => updateUiPrefs({ fontSize: e.target.value })}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-primary"
            >
              <option value="small">Small font</option>
              <option value="medium">Medium font</option>
              <option value="large">Large font</option>
            </select>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DoctorSettings;

import React, { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { Camera, MoonStar, Sun, Type, Save, Plus, Trash2 } from 'lucide-react';

const DoctorSettings = () => {
  const { user, updateProfile, uiPrefs, updateUiPrefs } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    registrationNumber: '',
    stateMedicalCouncil: '',
    specialization: '',
    qualifications: '',
    qualificationInstitution: '',
    hospitalsVisited: [''],
    profilePic: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const parsedHospitals = (() => {
      if (Array.isArray(user.hospitalsVisited)) {
        return user.hospitalsVisited.filter(Boolean);
      }

      const raw = String(user.hospitalsVisited || '').trim();
      if (!raw) return user.hospital ? [user.hospital] : [''];

      const splitBy = raw.includes('||') ? '||' : raw.includes('\n') ? '\n' : ',';
      const list = raw.split(splitBy).map((x) => x.trim()).filter(Boolean);
      return list.length ? list : (user.hospital ? [user.hospital] : ['']);
    })();

    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      registrationNumber: user.registrationNumber || '',
      stateMedicalCouncil: user.stateMedicalCouncil || '',
      specialization: user.specialization || '',
      qualifications: user.qualifications || '',
      qualificationInstitution: user.qualificationInstitution || '',
      hospitalsVisited: parsedHospitals,
      profilePic: user.profilePic || ''
    });
  }, [user]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, profilePic: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const onSave = async () => {
    try {
      setSaving(true);

      const cleanedHospitals = (form.hospitalsVisited || [])
        .map((h) => String(h || '').trim())
        .filter(Boolean);

      const nextPrimaryHospital = user?.hospital && cleanedHospitals.includes(user.hospital)
        ? user.hospital
        : (cleanedHospitals[0] || '');

      await updateProfile({
        name: form.name,
        email: form.email,
        phone: form.phone,
        registrationNumber: form.registrationNumber,
        stateMedicalCouncil: form.stateMedicalCouncil,
        specialization: form.specialization,
        qualifications: form.qualifications,
        qualificationInstitution: form.qualificationInstitution,
        hospital: nextPrimaryHospital || undefined,
        hospitalsVisited: cleanedHospitals.join('||'),
        profilePic: form.profilePic,
        settings: {
          darkMode: !!uiPrefs.darkMode,
          fontSize: uiPrefs.fontSize || 'medium'
        }
      });
      alert('Settings saved successfully');
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addHospitalField = () => {
    setForm((prev) => ({ ...prev, hospitalsVisited: [...(prev.hospitalsVisited || []), ''] }));
  };

  const updateHospitalField = (idx, value) => {
    setForm((prev) => {
      const next = [...(prev.hospitalsVisited || [])];
      next[idx] = value;
      return { ...prev, hospitalsVisited: next };
    });
  };

  const removeHospitalField = (idx) => {
    setForm((prev) => {
      const next = [...(prev.hospitalsVisited || [])];
      next.splice(idx, 1);
      return { ...prev, hospitalsVisited: next.length ? next : [''] };
    });
  };

  return (
    <Layout title="Settings" subtitle="Manage your profile, accessibility and appearance.">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Profile Picture */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm xl:col-span-1">
          <h3 className="text-lg font-display font-bold text-slate-800 mb-4">Profile Picture</h3>

          <div className="flex flex-col items-center gap-4">
            <div className="w-28 h-28 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
              <img
                src={form.profilePic || `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.name || 'doctor'}`}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>

            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/15">
              <Camera size={16} /> Upload picture
              <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </label>
          </div>
        </div>

        {/* Professional Info */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm xl:col-span-2">
          <h3 className="text-lg font-display font-bold text-slate-800 mb-4">Professional Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="name" value={form.name} onChange={onChange} placeholder="Full Name" className="rounded-xl border border-slate-300 px-4 py-2.5" />
            <input name="email" type="email" value={form.email} onChange={onChange} placeholder="Email" className="rounded-xl border border-slate-300 px-4 py-2.5" />

            <input name="phone" value={form.phone} onChange={onChange} placeholder="Phone Number" className="rounded-xl border border-slate-300 px-4 py-2.5" />
            <input name="registrationNumber" value={form.registrationNumber} onChange={onChange} placeholder="Medical Registration Number" className="rounded-xl border border-slate-300 px-4 py-2.5" />

            <input name="stateMedicalCouncil" value={form.stateMedicalCouncil} onChange={onChange} placeholder="State Medical Council" className="rounded-xl border border-slate-300 px-4 py-2.5" />
            <input name="specialization" value={form.specialization} onChange={onChange} placeholder="Primary Specialization" className="rounded-xl border border-slate-300 px-4 py-2.5" />

            <input name="qualifications" value={form.qualifications} onChange={onChange} placeholder="Highest Qualification" className="rounded-xl border border-slate-300 px-4 py-2.5" />
            <input name="qualificationInstitution" value={form.qualificationInstitution} onChange={onChange} placeholder="Qualification Institution" className="rounded-xl border border-slate-300 px-4 py-2.5" />

            <div className="md:col-span-2 rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-slate-800">Set of Hospitals</p>
                <button
                  type="button"
                  onClick={addHospitalField}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-bold"
                >
                  <Plus size={14} /> Add hospital
                </button>
              </div>

              <div className="space-y-2">
                {(form.hospitalsVisited || ['']).map((h, idx) => (
                  <div key={`hospital-${idx}`} className="flex items-center gap-2">
                    <input
                      value={h}
                      onChange={(e) => updateHospitalField(idx, e.target.value)}
                      placeholder={`Hospital ${idx + 1}`}
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5"
                    />
                    <button
                      type="button"
                      onClick={() => removeHospitalField(idx)}
                      className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      title="Remove hospital"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500 mt-2">
                Primary hospital is selected from this list on dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* Accessibility */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm xl:col-span-3">
          <h3 className="text-lg font-display font-bold text-slate-800 mb-4">Accessibility & Appearance</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><Type size={16} /> Font Size</p>
              <div className="flex gap-2">
                {['small', 'medium', 'large'].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => updateUiPrefs({ fontSize: size })}
                    className={`px-3 py-2 rounded-xl border text-sm font-semibold capitalize ${uiPrefs.fontSize === size ? 'border-primary bg-primary/10 text-primary' : 'border-slate-300 bg-white text-slate-700'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <p className="font-semibold text-slate-800 mb-3">Theme</p>
              <button
                type="button"
                onClick={() => updateUiPrefs({ darkMode: !uiPrefs.darkMode })}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-semibold text-sm ${uiPrefs.darkMode ? 'border-indigo-300 bg-indigo-100 text-indigo-700' : 'border-amber-300 bg-amber-100 text-amber-700'}`}
              >
                {uiPrefs.darkMode ? <MoonStar size={16} /> : <Sun size={16} />}
                {uiPrefs.darkMode ? 'Dark Mode On' : 'Light Mode On'}
              </button>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-100 text-emerald-700 font-bold disabled:opacity-60"
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DoctorSettings;

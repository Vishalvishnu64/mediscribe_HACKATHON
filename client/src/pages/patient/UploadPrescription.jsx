import React, { useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { UploadCloud, FileType, CheckCircle, Loader2 } from 'lucide-react';

const UploadPrescription = () => {
  const [file, setFile] = useState(null);
  const [type, setType] = useState('NEW'); // 'NEW' or 'OLD'
  const [status, setStatus] = useState('IDLE'); // IDLE, UPLOADING, DONE, ERROR
  const [errorStr, setErrorStr] = useState('');
  const [result, setResult] = useState(null);

  const [matchedDoctor, setMatchedDoctor] = useState(null);
  const [connectionRequested, setConnectionRequested] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus('UPLOADING');
    setErrorStr('');
    setMatchedDoctor(null);
    setConnectionRequested(false);

    const formData = new FormData();
    formData.append('prescription', file);
    formData.append('type', type);

    try {
      const res = await axios.post('/prescriptions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
      setStatus('DONE');
      
      // Step 2: Try to match the doctor
      const regNo = res.data.extractedData?.doctor?.regNo;
      if (regNo) {
        const matchRes = await axios.get(`/doctors/match/${encodeURIComponent(regNo)}`);
        if (matchRes.data.match) {
          setMatchedDoctor(matchRes.data.doctor);
        }
      }
    } catch (err) {
      console.error(err);
      setStatus('ERROR');
      setErrorStr(err.response?.data?.error || 'Failed to analyze the image');
    }
  };

  const requestConnection = async () => {
     try {
       await axios.post('/doctors/request-connection', { 
         doctorId: matchedDoctor.id, 
         prescriptionId: result.prescriptionId 
       });
       setConnectionRequested(true);
     } catch (err) {
       console.error("Failed connection request", err);
     }
  };

  return (
    <Layout title="Upload Prescription" subtitle="Digitize your medical records securely with MedTrack AI.">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        
        {status === 'DONE' && result ? (
          <div className="text-center">
            
            {/* Doctor Match Modal/Banner */}
            {matchedDoctor && !connectionRequested && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-8 mt-4 text-left shadow-md transform animate-bounce-short">
                <h3 className="text-blue-800 font-bold text-lg mb-2 flex items-center gap-2"><CheckCircle size={20} /> Is this your doctor?</h3>
                <p className="text-blue-600 mb-1"><strong>Name:</strong> {matchedDoctor.name}</p>
                <p className="text-blue-600 mb-1"><strong>Hospital:</strong> {matchedDoctor.hospital || 'Unknown'}</p>
                <p className="text-blue-600 mb-4"><strong>Specialty:</strong> {matchedDoctor.spec || 'General'}</p>
                <div className="flex gap-3">
                   <button onClick={requestConnection} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 shadow-sm transition">Confirm & Connect</button>
                   <button onClick={() => setMatchedDoctor(null)} className="bg-white text-slate-500 font-bold py-2 px-6 rounded-lg hover:bg-slate-100 border border-slate-200 transition">Reject</button>
                </div>
              </div>
            )}
            {connectionRequested && (
              <div className="bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 p-4 rounded-xl mb-6">
                Connection request sent! Awaiting Doctor's approval.
              </div>
            )}

            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-display font-bold text-slate-800 mb-2">Prescription Analyzed!</h2>
            <p className="text-slate-500 mb-8 font-medium">We identified {result.medicinesAdded} medications from Dr. {result.extractedData.doctor?.name}.</p>
            
            <div className="bg-slate-50 rounded-2xl p-6 text-left border border-slate-100 mb-6">
              <h3 className="font-bold text-slate-800 mb-4">Extracted Medications:</h3>
              <ul className="flex flex-col gap-3">
                {result.extractedData.medicines?.map((m, i) => (
                   <li key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                     <span className="font-semibold text-slate-700">{m.name}</span>
                     <span className="text-sm text-slate-500">{m.frequency}</span>
                   </li>
                ))}
              </ul>
            </div>
            
            <button 
              onClick={() => { setFile(null); setStatus('IDLE'); setResult(null); }}
              className="bg-primary text-white font-bold py-3 px-8 rounded-xl shadow-md hover:bg-emerald-700 transition"
            >
              Upload Another
            </button>
          </div>

        ) : (

          <>
            <div className="flex gap-4 mb-8 p-1 bg-slate-50 rounded-2xl border border-slate-200 w-max">
              <button 
                onClick={() => setType('NEW')}
                className={`px-6 py-2.5 rounded-xl font-bold transition-all ${type === 'NEW' ? 'bg-white shadow-sm text-primary ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
              >
                New Prescription
              </button>
              <button 
                onClick={() => setType('OLD')}
                className={`px-6 py-2.5 rounded-xl font-bold transition-all ${type === 'OLD' ? 'bg-white shadow-sm text-primary ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Past Record (History)
              </button>
            </div>

            <p className="text-sm text-slate-500 font-medium mb-4">
              {type === 'NEW' ? 'Medicines in this prescription will become Active Reminders.' : 'Medicines will be saved to your History for doctor reference.'}
            </p>

            <div 
              className={`border-2 border-dashed rounded-3xl p-12 text-center transition-colors
                ${file ? 'border-primary bg-emerald-50/50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}`}
            >
              <input 
                type="file" 
                id="file-upload" 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileChange}
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-white border border-slate-200 shadow-sm text-primary rounded-2xl flex items-center justify-center mb-4">
                  {file ? <FileType size={32} /> : <UploadCloud size={32} />}
                </div>
                <h3 className="font-display font-bold text-xl text-slate-800 mb-2">
                  {file ? file.name : 'Click to Browse or Drag Image Here'}
                </h3>
                <p className="text-slate-500 font-medium text-sm">
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Ready to analyze` : 'Supports JPG, PNG, WEBP up to 10MB'}
                </p>
              </label>
            </div>

            {status === 'ERROR' && (
              <p className="text-red-500 text-sm font-bold mt-4 text-center">{errorStr}</p>
            )}

            <button 
              onClick={handleUpload}
              disabled={!file || status === 'UPLOADING'}
              className={`w-full mt-6 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-lg transition-all shadow-md
                ${!file ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-primary text-white hover:bg-emerald-700 shadow-primary/20'}
              `}
            >
              {status === 'UPLOADING' ? <><Loader2 size={24} className="animate-spin" /> Analyzing Image with AI...</> : 'Process Prescription'}
            </button>
          </>

        )}

      </div>
    </Layout>
  );
};

export default UploadPrescription;

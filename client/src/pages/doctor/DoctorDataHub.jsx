import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Loader2, Database } from 'lucide-react';

const DoctorDataHub = () => {
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get('/doctor-panel/sources');
        setSources(res.data?.sources || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <Layout title="Data Hub" subtitle="Connected source systems for your patient records.">
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-500 gap-3">
          <Loader2 className="animate-spin" size={24} /> Loading sources...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {sources.map((s) => (
            <div key={s.type} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                <Database size={18} />
              </div>
              <h3 className="mt-3 font-display font-bold text-slate-800">{s.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{s.count} records</p>
              <span className="inline-flex mt-3 text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default DoctorDataHub;

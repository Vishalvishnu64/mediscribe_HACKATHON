import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { UserPlus, CheckCircle, XCircle } from 'lucide-react';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axios.get('/doctors/requests');
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, status) => {
    try {
      await axios.put(`/doctors/requests/${id}/status`, { status });
      setRequests(requests.filter(req => req._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Layout title={`Dr. ${user?.name}`} subtitle="Manage your patients and review pending connections.">
      
      <div className="grid grid-cols-1 gap-6">
        
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <h2 className="text-xl font-display font-bold text-slate-800">Pending Patient Requests</h2>
            <span className="ml-auto bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full text-sm">{requests.length}</span>
          </div>

          {loading ? (
             <div className="text-center p-8 text-slate-500 font-medium">Loading requests...</div>
          ) : requests.length === 0 ? (
             <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-3xl text-slate-500 font-medium bg-slate-50">
                No pending connection requests at the moment.
             </div>
          ) : (
             <div className="flex flex-col gap-4">
                {requests.map(req => (
                  <div key={req._id} className="flex flex-col md:flex-row items-center justify-between p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-blue-50/30 transition-colors">
                    <div className="mb-4 md:mb-0">
                      <h4 className="font-bold text-slate-800 text-lg">{req.patientId?.name}</h4>
                      <p className="text-sm font-medium text-slate-500">
                        Requested connection on {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                      <div className="mt-2 text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-lg max-w-sm cursor-pointer hover:border-blue-300">
                        📎 Parsed Prescription attached
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleAction(req._id, 'APPROVED')}
                        className="flex items-center gap-2 bg-primary text-white font-bold py-2 px-6 rounded-xl shadow-md shadow-primary/20 hover:bg-emerald-700 transition"
                      >
                         <CheckCircle size={18} /> Approve
                      </button>
                      <button 
                        onClick={() => handleAction(req._id, 'REJECTED')}
                        className="flex items-center gap-2 bg-white text-slate-600 border border-slate-200 font-bold py-2 px-6 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                      >
                         <XCircle size={18} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
             </div>
          )}
        </div>

      </div>

    </Layout>
  );
};

export default DoctorDashboard;

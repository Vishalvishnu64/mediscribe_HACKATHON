import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Cookies from 'js-cookie';
import { LogIn, ArrowLeft, Mail, Lock, User as UserIcon, HeartPulse } from 'lucide-react';

const Login = () => {
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') || 'PATIENT'; // default fallback
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      let loggedInUser;
      if (isLogin) {
        loggedInUser = await login(formData.email, formData.password, role);
      } else {
        loggedInUser = await signup({ ...formData, role });
      }
      
      // Navigate on success
      if (role === 'DOCTOR') {
        const token = Cookies.get('token');
        window.location.href = `http://localhost:5000/doctor-panel/dashboard.html?token=${encodeURIComponent(token)}`;
        return;
      }
      navigate('/patient/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 relative">
      <button 
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-semibold"
      >
        <ArrowLeft size={20} /> Back
      </button>

      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100">
        <div className="flex flex-col items-center mb-8">
          <div className={`p-4 rounded-2xl mb-4 ${role === 'DOCTOR' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-secondary'}`}>
             <HeartPulse size={32} />
          </div>
          <h2 className="text-3xl font-display font-bold text-slate-800">
            {role.charAt(0) + role.slice(1).toLowerCase()} Portal
          </h2>
          <p className="text-slate-500 font-medium">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-sm font-semibold border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {!isLogin && (
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" name="name" placeholder="Full Name" required 
                value={formData.name} onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3 outline-none focus:border-primary focus:bg-white transition-colors font-medium" 
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="email" name="email" placeholder="Email Address" required 
              value={formData.email} onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3 outline-none focus:border-primary focus:bg-white transition-colors font-medium" 
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="password" name="password" placeholder="Password" required 
              value={formData.password} onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-12 py-3 outline-none focus:border-primary focus:bg-white transition-colors font-medium" 
            />
          </div>

          <button 
            type="submit" 
            className="mt-4 bg-primary text-white font-bold text-lg py-3 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            {isLogin ? <><LogIn size={20} /> Login</> : 'Create Account'}
          </button>

        </form>

        <p className="mt-8 text-center text-slate-500 font-medium">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-primary font-bold hover:underline"
          >
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;

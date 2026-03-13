import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uiPrefs, setUiPrefs] = useState(() => {
    const stored = localStorage.getItem('mediscribe-ui-prefs');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { darkMode: false, fontSize: 'medium' };
      }
    }
    return { darkMode: false, fontSize: 'medium' };
  });

  // Set default axios base URL to our node server
  axios.defaults.baseURL = 'http://localhost:5000/api';

  useEffect(() => {
    const checkLoggedIn = async () => {
      let token = Cookies.get('token');
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const res = await axios.get('/auth/me');
          setUser(res.data);
          if (res.data?.settings) {
            setUiPrefs((prev) => ({
              darkMode: res.data.settings.darkMode ?? prev.darkMode,
              fontSize: res.data.settings.fontSize || prev.fontSize,
            }));
          }
        } catch (error) {
          console.error('Session expired or invalid');
          Cookies.remove('token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };
    checkLoggedIn();
  }, []);

  useEffect(() => {
    localStorage.setItem('mediscribe-ui-prefs', JSON.stringify(uiPrefs));
    document.documentElement.classList.toggle('dark-mode', !!uiPrefs.darkMode);

    const sizeMap = {
      small: '14px',
      medium: '16px',
      large: '18px',
    };
    document.documentElement.style.fontSize = sizeMap[uiPrefs.fontSize] || '16px';
  }, [uiPrefs]);

  const login = async (email, password, role) => {
    const res = await axios.post('/auth/login', { email, password, role });
    Cookies.set('token', res.data.token, { expires: 7 }); // 7 Days
    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    if (res.data.user?.settings) {
      setUiPrefs((prev) => ({
        darkMode: res.data.user.settings.darkMode ?? prev.darkMode,
        fontSize: res.data.user.settings.fontSize || prev.fontSize,
      }));
    }
    return res.data.user;
  };

  const signup = async (userData) => {
    const res = await axios.post('/auth/signup', userData);
    Cookies.set('token', res.data.token, { expires: 7 });
    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    if (res.data.user?.settings) {
      setUiPrefs((prev) => ({
        darkMode: res.data.user.settings.darkMode ?? prev.darkMode,
        fontSize: res.data.user.settings.fontSize || prev.fontSize,
      }));
    }
    return res.data.user;
  };

  const updateProfile = async (payload) => {
    const res = await axios.patch('/auth/me', payload);
    setUser(res.data.user);
    if (res.data.user?.settings) {
      setUiPrefs((prev) => ({
        darkMode: res.data.user.settings.darkMode ?? prev.darkMode,
        fontSize: res.data.user.settings.fontSize || prev.fontSize,
      }));
    }
    return res.data.user;
  };

  const updateUiPrefs = (partial) => {
    setUiPrefs((prev) => ({ ...prev, ...partial }));
  };

  const logout = () => {
    Cookies.remove('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = { user, login, signup, logout, loading, updateProfile, uiPrefs, updateUiPrefs };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

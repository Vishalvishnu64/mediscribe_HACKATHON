import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const login = async (email, password, role) => {
    const res = await axios.post('/auth/login', { email, password, role });
    Cookies.set('token', res.data.token, { expires: 7 }); // 7 Days
    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    return res.data.user;
  };

  const signup = async (userData) => {
    const res = await axios.post('/auth/signup', userData);
    Cookies.set('token', res.data.token, { expires: 7 });
    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    Cookies.remove('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const value = { user, login, signup, logout, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

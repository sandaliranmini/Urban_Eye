import axios from 'axios';

const SESSION_KEY = 'urban_eye_session'; // written by AuthApp.jsx on login

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

const readToken = () => {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s?.token) return s.token;
  } catch {
    /* no saved login */
  }
  return localStorage.getItem('accessToken'); // older code path, kept as a fallback
};

// Attach the JWT to every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = readToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// A 401 means the token is missing, invalid or expired: clear it and go to login
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('role');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
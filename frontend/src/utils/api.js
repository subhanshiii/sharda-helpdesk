import axios from 'axios';

// ── Axios instance ─────────────────────────────────────
const API = axios.create({
  baseURL:          process.env.REACT_APP_API_URL || '/api',
  timeout:          15000,
  withCredentials:  true, // CRITICAL: sends httpOnly cookies with every request
});

// ── Request interceptor ────────────────────────────────
// Still attach Bearer token for backward compat + mobile clients
// The server accepts BOTH cookie and Bearer token
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ───────────────────────────────
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const message = error.response?.data?.message || '';

    // Session expired or invalid token
    if (status === 401 && message.includes('expired')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login?reason=session_expired';
      return Promise.reject(error);
    }

    // Unauthorized (not logged in)
    if (status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Rate limited
    if (status === 429) {
      console.warn('Rate limited by server');
    }

    return Promise.reject(error);
  }
);

export default API;

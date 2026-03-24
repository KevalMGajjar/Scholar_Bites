import axios from 'axios';

// In production (served from Express), API is on the same origin.
// In dev (Vite proxy), API is proxied to localhost:3000.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401/403 — but NOT for auth-related endpoints
// (login, verify-otp, google login return 401/403 for invalid credentials,
//  which should be handled by the calling component, not trigger a redirect)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthEndpoint = url.includes('/login') || url.includes('/verify-otp');

    if (
      (err.response?.status === 401 || err.response?.status === 403) &&
      !isAuthEndpoint
    ) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export default api;

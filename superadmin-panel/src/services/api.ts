import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('superadmin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthEndpoint = url.includes('/login') || url.includes('/verify-otp');

    if ((err.response?.status === 401 || err.response?.status === 403) && !isAuthEndpoint) {
      localStorage.removeItem('superadmin_token');
      window.location.href = '/superadmin/';
    }
    return Promise.reject(err);
  }
);

export default api;

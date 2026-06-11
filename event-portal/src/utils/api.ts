import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dean_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('dean_token');
      localStorage.removeItem('dean_user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/dean/login') {
        window.location.href = '/dean/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

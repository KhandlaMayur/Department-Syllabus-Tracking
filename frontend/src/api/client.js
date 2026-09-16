import axios from 'axios';

/**
 * Single configured Axios instance used by every API module.
 * - Base URL comes from Vite env so it can differ per environment.
 * - Automatically attaches the JWT (if present) to every request.
 * - Centralizes 401 handling so a single log-out flow works everywhere.
 */
const apiClient = axios.create({
  // Use relative URL so Vite dev proxy forwards /api/* to http://localhost:5000
  // In production, set VITE_API_BASE_URL to the deployed backend URL
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('st_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token missing/expired/invalid — clear local session.
      // The AuthContext listens for this event to redirect to /login.
      localStorage.removeItem('st_token');
      localStorage.removeItem('st_user');
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;

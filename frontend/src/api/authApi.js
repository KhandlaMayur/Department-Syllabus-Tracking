import apiClient from './client';

const authApi = {
  loginWithAuth0: (token) => apiClient.post('/auth/auth0', { token }),
  loginWithGoogle: (idToken) => apiClient.post('/auth/google', { idToken }),
  devLogin: (email) => apiClient.post('/auth/dev-login', { email }),
  getCurrentUser: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
};

export default authApi;
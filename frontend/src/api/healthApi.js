import apiClient from './client';

/** Used by the app shell to show an API-connectivity indicator if needed. */
const healthApi = {
  check: () => apiClient.get('/health'),
};

export default healthApi;

import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor: auto-handle 401 with token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = JSON.parse(localStorage.getItem('onlyfeets-auth') || '{}')?.state?.refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refreshToken }
        );

        api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;

        // Update stored tokens
        const stored = JSON.parse(localStorage.getItem('onlyfeets-auth') || '{}');
        if (stored.state) {
          stored.state.accessToken = data.accessToken;
          stored.state.refreshToken = data.refreshToken;
          localStorage.setItem('onlyfeets-auth', JSON.stringify(stored));
        }

        return api(originalRequest);
      } catch {
        // Force logout
        localStorage.removeItem('onlyfeets-auth');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  role: 'FAN' | 'CREATOR' | 'ADMIN';
  isVerified: boolean;
  isEmailVerified: boolean;
  creatorProfile?: any;
  wallet?: any;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken });
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      },

      updateUser: (userData) => {
        const { user } = get();
        if (user) set({ user: { ...user, ...userData } });
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          if (refreshToken) {
            await api.post('/auth/logout', { refreshToken });
          }
        } catch {}
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, accessToken: null, refreshToken: null });
      },

      restoreSession: async () => {
        const { accessToken, refreshToken } = get();
        if (!accessToken) return;

        set({ isLoading: true });
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          const { data } = await api.get('/auth/me');
          set({ user: data });
        } catch (error: any) {
          if (error.response?.status === 401 && refreshToken) {
            try {
              const { data } = await api.post('/auth/refresh', { refreshToken });
              api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
              const meResponse = await api.get('/auth/me');
              set({
                user: meResponse.data,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
              });
            } catch {
              get().logout();
            }
          } else {
            get().logout();
          }
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'onlyfeets-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);

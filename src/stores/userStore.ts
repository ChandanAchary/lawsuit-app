import { create } from 'zustand';
import { usersApi } from '../services/api';
import { useAuthStore } from './authStore';
import { User } from '../types';

interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
  getUser: () => Promise<void>;
  updateUser: (payload: Record<string, unknown>) => Promise<void>;
  requestVerification: (identifier: string) => Promise<void>;
  verifyCode: (identifier: string, code: string) => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  loading: false,
  error: null,

  getUser: async () => {
    set({ loading: true });
    try {
      const { data } = await usersApi.getMe();
      const user = data.user || data;
      set({ user, loading: false });
      useAuthStore.getState().setUser(user);
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  updateUser: async (payload) => {
    set({ loading: true });
    try {
      const { data } = await usersApi.updateMe(payload);
      const user = data.user || data;
      set({ user, loading: false });
      useAuthStore.getState().setUser(user);
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  requestVerification: async (identifier) => {
    const { requestOtp } = useAuthStore.getState();
    await requestOtp(identifier);
  },

  verifyCode: async (identifier, code) => {
    const { verifyOtp } = useAuthStore.getState();
    await verifyOtp(identifier, code);
  },
}));

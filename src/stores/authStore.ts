import { create } from 'zustand';
import { authApi } from '../services/api';
import { storage } from '../services/storage';
import { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; phone: string; password: string; role: string }) => Promise<void>;
  verifyOtp: (identifier: string, otp: string) => Promise<void>;
  requestOtp: (identifier: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authApi.login(email, password);
      const user = data.user;
      const token = data.accessToken || data.token;
      await storage.setToken(token);
      if (data.refreshToken) await storage.setRefreshToken(data.refreshToken);
      await storage.setUser(user);
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Login failed', isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.register(data);
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Registration failed', isLoading: false });
      throw err;
    }
  },

  verifyOtp: async (identifier, otp) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authApi.verifyOtp(identifier, otp);
      if (data.accessToken || data.token) {
        const token = data.accessToken || data.token;
        const user = data.user;
        await storage.setToken(token);
        if (data.refreshToken) await storage.setRefreshToken(data.refreshToken);
        if (user) await storage.setUser(user);
        set({ user, token, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'OTP verification failed', isLoading: false });
      throw err;
    }
  },

  requestOtp: async (identifier) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.requestOtp(identifier);
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.message || 'Failed to send OTP', isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {}
    await storage.clear();
    set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const token = await storage.getToken();
      const userData = await storage.getUser();
      if (token && userData) {
        set({
          user: userData as unknown as User,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setUser: (user) => {
    set({ user });
    storage.setUser(user as unknown as Record<string, unknown>);
  },

  clearError: () => set({ error: null }),
}));

import { create } from 'zustand';
import { authApi, referralApi } from '../services/api';
import { storage } from '../services/storage';
import { User, UserRole } from '../types';
import { registerPushToken, unregisterPushToken } from '../utils/pushNotifications';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; phone: string; password: string; role: string }) => Promise<void>;
  verifyOtp: (identifier: string, code: string) => Promise<void>;
  requestOtp: (identifier: string) => Promise<void>;
  resetPassword: (identifier: string, code: string, password: string) => Promise<void>;
  applyReferral: (code: string) => Promise<void>;
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
      // Register push token (non-blocking)
      void registerPushToken();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.register(data);
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || err.response?.data?.message || 'Registration failed', isLoading: false });
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
        // Register push token (non-blocking)
        void registerPushToken();
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.response?.data?.error || err.response?.data?.message || 'OTP verification failed', isLoading: false });
      throw err;
    }
  },

  requestOtp: async (identifier) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.requestOtp(identifier);
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || err.response?.data?.message || 'Failed to send OTP', isLoading: false });
      throw err;
    }
  },

  resetPassword: async (identifier, code, password) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.restorePassword(identifier, code, password);
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || err.response?.data?.message || 'Password reset failed', isLoading: false });
      throw err;
    }
  },

  applyReferral: async (code) => {
    set({ isLoading: true, error: null });
    try {
      await referralApi.apply(code);
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || err.response?.data?.message || 'Failed to apply referral', isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {}
    // Unregister push token (non-blocking)
    void unregisterPushToken();
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
        // Re-register push token in case it changed
        void registerPushToken();
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

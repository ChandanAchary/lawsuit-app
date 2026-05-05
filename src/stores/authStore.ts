import { create } from 'zustand';
import { authApi, referralApi, usersApi } from '../services/api';
import { storage } from '../services/storage';
import { User, UserRole } from '../types';
import { registerPushToken, unregisterPushToken } from '../utils/pushNotifications';

const isAuthFailure = (error: any): boolean => {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return true;

  const message = String(
    error?.response?.data?.error || error?.response?.data?.message || error?.message || ''
  ).toLowerCase();

  // Some backends return 400 for invalid/expired refresh/session tokens.
  if (status === 400 && /(token|refresh|jwt|session|expired|invalid)/.test(message)) {
    return true;
  }

  return false;
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: string;
    courtId?: string;
    courtDetails?: {
      name: string;
      type: string;
      address: string;
      pincode: string;
      state: string;
      district: string;
      city?: string;
    };
    registrationNumber?: string;
  }) => Promise<void>;
  verifyOtp: (identifier: string, code: string) => Promise<void>;
  requestOtp: (identifier: string) => Promise<void>;
  resetPassword: (identifier: string, code: string, password: string) => Promise<void>;
  applyReferral: (code: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
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

  deleteAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      await usersApi.deleteMe();
      // Unregister push token (non-blocking)
      void unregisterPushToken();
      await storage.clear();
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to delete account';
      set({ error: msg, isLoading: false });
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
      const [token, userData] = await Promise.all([
        storage.getToken(),
        storage.getUser(),
      ]);
      if (token && userData) {
        // Restore immediately so startup is not blocked by a slow network call.
        set({
          user: userData as unknown as User,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
        void registerPushToken();

        // Validate persisted session in background and reconcile user/token silently.
        void (async () => {
          try {
            const { data } = await authApi.getMe();
            const freshToken = await storage.getToken();
            const fresh = (data?.user || data) as Record<string, unknown> | null;

            // Defensive merge: never replace a rich persisted user with a thin
            // /auth/me response. Empty / null / undefined values from the
            // server are skipped so previously-good fields (name, email,
            // phone, createdAt) survive an incomplete reconcile.
            const base = (userData || {}) as Record<string, unknown>;
            const merged: Record<string, unknown> = { ...base };
            if (fresh && typeof fresh === 'object') {
              for (const [k, v] of Object.entries(fresh)) {
                if (v === undefined || v === null) continue;
                if (typeof v === 'string' && v.trim() === '') continue;
                merged[k] = v;
              }
            }

            set({
              user: merged as unknown as User,
              token: freshToken || token,
              isAuthenticated: true,
              isLoading: false,
            });
            await storage.setUser(merged);
          } catch (error: any) {
            if (isAuthFailure(error)) {
              await storage.clear();
              set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
              return;
            }

            // Keep restored session on transient failures (offline/timeout/5xx).
            set((state) => ({
              ...state,
              isLoading: false,
            }));
          }
        })();
      } else {
        set({ isLoading: false });
      }
    } catch {
      await storage.clear();
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  setUser: (user) => {
    set({ user });
    storage.setUser(user as unknown as Record<string, unknown>);
  },

  clearError: () => set({ error: null }),
}));

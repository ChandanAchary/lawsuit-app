import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { COLORS } from '../constants';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeStore {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  init: () => Promise<void>;
}

const resolveIsDark = (mode: ThemeMode): boolean => {
  if (mode === 'system') return Appearance.getColorScheme() === 'dark';
  return mode === 'dark';
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: 'system',
  isDark: Appearance.getColorScheme() === 'dark',
  setMode: async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem('theme_mode', mode);
      const isDark = resolveIsDark(mode);
      set({ mode, isDark });
    } catch (error) {
      console.error('Failed to set theme mode:', error);
    }
  },
  init: async () => {
    try {
      const stored = await AsyncStorage.getItem('theme_mode');
      const mode = (stored as ThemeMode) || 'system';
      const isDark = resolveIsDark(mode);
      set({ mode, isDark });
      
      // Handle system theme changes
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        const current = get().mode;
        if (current === 'system') {
          set({ isDark: colorScheme === 'dark' });
        }
      });
      
      return () => subscription.remove();
    } catch (error) {
      console.error('Failed to initialize theme:', error);
    }
  },
}));

// Dark theme colors
export const DARK_COLORS = {
  primary: '#0E6B8C',
  primaryLight: '#1A8BB0',
  primaryDark: '#083D50',
  accent: '#F59E0B',
  accentLight: '#FCD34D',
  midnight: '#002873',
  midnightLight: '#003A9E',
  white: '#1E1E2E',
  black: '#FFFFFF',
  background: '#0F0F1A',
  surface: '#1E1E2E',
  surfaceAlt: '#2A2A3C',
  border: '#3A3A4C',
  borderLight: '#2A2A3C',
  text: '#E2E8F0',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textLight: '#475569',
  success: '#10B981',
  successLight: '#064E3B',
  error: '#EF4444',
  errorLight: '#7F1D1D',
  warning: '#F59E0B',
  warningLight: '#78350F',
  info: '#3B82F6',
  infoLight: '#1E3A5F',
  pending: '#8B5CF6',
  pendingLight: '#3B1F7E',
  overlay: 'rgba(0,0,0,0.7)',
};

// ─── Theme-aware colors hook ──────────────────────────────
export const useColors = () => {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? DARK_COLORS : COLORS;
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://lawsuit-server.onrender.com';
export const API_URL = `${API_BASE_URL}/api/v1`;

export const COLORS = {
  primary: '#0B4D64',
  primaryLight: '#0E6B8C',
  primaryDark: '#083D50',
  accent: '#F59E0B',
  accentLight: '#FCD34D',
  midnight: '#002873',
  midnightLight: '#003A9E',
  white: '#FFFFFF',
  black: '#000000',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textLight: '#CBD5E1',
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  pending: '#8B5CF6',
  pendingLight: '#EDE9FE',
  overlay: 'rgba(0,0,0,0.5)',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  hero: 34,
};

export const BORDER_RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  full: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

export const APPOINTMENT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: COLORS.pendingLight, text: COLORS.pending },
  CONFIRMED: { bg: COLORS.infoLight, text: COLORS.info },
  ATTENDED: { bg: COLORS.successLight, text: COLORS.success },
  COMPLETED: { bg: COLORS.successLight, text: COLORS.success },
  CANCELLED: { bg: COLORS.errorLight, text: COLORS.error },
  MISSED: { bg: COLORS.warningLight, text: COLORS.warning },
  RESCHEDULED: { bg: COLORS.infoLight, text: COLORS.info },
};

export const CASE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: COLORS.infoLight, text: COLORS.info },
  IN_PROGRESS: { bg: COLORS.warningLight, text: COLORS.warning },
  CLOSED: { bg: COLORS.surfaceAlt, text: COLORS.textSecondary },
  RESOLVED: { bg: COLORS.successLight, text: COLORS.success },
  DISMISSED: { bg: COLORS.errorLight, text: COLORS.error },
};

export const LEGAL_CATEGORIES = [
  'Criminal', 'Divorce', 'Property', 'Civil', 'Cheque Bounce',
  'Consumer', 'Labour', 'Corporate', 'Tax', 'General',
];

export const TEMPLATE_CATEGORIES = [
  'Retainer', 'NDA', 'Service Agreement', 'Employment',
  'Partnership', 'Lease', 'Other',
];

export const LEX_RATES = [
  { category: 'Criminal Law', min: 5000, max: 50000, avg: 15000 },
  { category: 'Divorce / Family', min: 3000, max: 30000, avg: 10000 },
  { category: 'Property Law', min: 5000, max: 40000, avg: 12000 },
  { category: 'Civil Litigation', min: 3000, max: 25000, avg: 8000 },
  { category: 'Cheque Bounce', min: 2000, max: 15000, avg: 5000 },
  { category: 'Consumer Protection', min: 2000, max: 20000, avg: 7000 },
  { category: 'Labour Law', min: 3000, max: 25000, avg: 8000 },
  { category: 'Corporate Law', min: 10000, max: 100000, avg: 30000 },
  { category: 'General Consultation', min: 500, max: 5000, avg: 1500 },
];

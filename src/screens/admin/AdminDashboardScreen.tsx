import { useThemeStore } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await adminApi.getDashboard();
      setStats(data);
    } catch {
      setStats({ users: 0, lawyers: 0, cases: 0, appointments: 0 });
    }
  }, []);

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchStats().finally(() => setRefreshing(false)); };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <LinearGradient colors={[COLORS.midnight, COLORS.primary]} style={styles.hero}>
        <Ionicons name="shield-checkmark" size={28} color={COLORS.accent} />
        <Text style={styles.heroTitle}>Admin Panel</Text>
        <Text style={styles.heroSub}>Welcome, {user?.name || 'Administrator'}</Text>
      </LinearGradient>

      <View style={styles.statsGrid}>
        <StatCard icon="people" color="#3B82F6" label="Total Users" value={stats?.users ?? stats?.totalUsers ?? '—'} COLORS={COLORS} styles={styles} />
        <StatCard icon="briefcase" color={COLORS.accent} label="Lawyers" value={stats?.lawyers ?? stats?.totalLawyers ?? '—'} COLORS={COLORS} styles={styles} />
        <StatCard icon="folder-open" color={COLORS.success} label="Cases" value={stats?.cases ?? stats?.totalCases ?? '—'} COLORS={COLORS} styles={styles} />
        <StatCard icon="calendar" color="#8B5CF6" label="Appointments" value={stats?.appointments ?? stats?.totalAppointments ?? '—'} COLORS={COLORS} styles={styles} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Management</Text>
        <MenuItem icon="people-outline" label="User Management" desc="Verify and manage users" onPress={() => navigation.navigate('AdminUsers')} COLORS={COLORS} styles={styles} />
        <MenuItem icon="card-outline" label="Payment Monitoring" desc="View all platform payments" onPress={() => navigation.navigate('AdminPayments')} COLORS={COLORS} styles={styles} />
        <MenuItem icon="wallet-outline" label="Wallet Management" desc="Credit, debit & withdrawals" onPress={() => navigation.navigate('AdminWallets')} COLORS={COLORS} styles={styles} />
        <MenuItem icon="business-outline" label="Court Management" desc="Manage courts" onPress={() => navigation.navigate('CourtManagement')} COLORS={COLORS} styles={styles} />
        <MenuItem icon="shield-outline" label="Court Admins" desc="Manage court administrators" onPress={() => navigation.navigate('CourtAdminManagement')} COLORS={COLORS} styles={styles} />
        <MenuItem icon="notifications-outline" label="Notifications" desc="System notifications" onPress={() => navigation.navigate('Notifications')} COLORS={COLORS} styles={styles} />
      </View>
    </ScrollView>
  );
};

const StatCard = ({ icon, color, label, value, COLORS, styles }: any) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const MenuItem = ({ icon, label, desc, onPress, COLORS, styles }: any) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuIcon}>
      <Ionicons name={icon} size={22} color={COLORS.primary} />
    </View>
    <View style={styles.menuInfo}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuDesc}>{desc}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 100 },
  hero: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge + SPACING.md, paddingBottom: SPACING.xxxl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl, borderBottomRightRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
  },
  heroTitle: { fontSize: FONT_SIZE.hero, fontWeight: '900', color: COLORS.white, marginTop: SPACING.sm },
  heroSub: { fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.xs },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md,
    marginHorizontal: SPACING.xl, marginTop: -SPACING.xxl,
  },
  statCard: {
    width: '47%', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.md,
  },
  statIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  statValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4 },
  section: { paddingHorizontal: SPACING.xl, marginTop: SPACING.xxl },
  sectionTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.lg },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  menuIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primaryLight + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  menuInfo: { flex: 1, marginLeft: SPACING.md },
  menuLabel: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  menuDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
});

import { useThemeStore } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export const CourtAdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const user = useAuthStore((s) => s.user);
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      const { data } = await courtAdminApi.getPendingVerifications();
      const lawyers = data.lawyers || data || [];
      setPendingCount(Array.isArray(lawyers) ? lawyers.length : 0);
    } catch { setPendingCount(0); }
  }, []);

  useEffect(() => { fetchPending(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchPending().finally(() => setRefreshing(false)); };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <LinearGradient colors={[COLORS.midnight, COLORS.primary]} style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark" size={32} color={COLORS.accent} />
        </View>
        <Text style={styles.heroTitle}>Court Admin</Text>
        <Text style={styles.heroSub}>Welcome, {user?.name || 'Admin'}</Text>
      </LinearGradient>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="hourglass" size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending Verifications</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <MenuItem
          icon="time-outline"
          label="Pending Verifications"
          desc="Review and verify lawyers"
          badge={pendingCount > 0 ? String(pendingCount) : undefined}
          onPress={() => navigation.navigate('LawyerVerification', { tab: 'pending' })}
          COLORS={COLORS}
          styles={styles}
        />
        <MenuItem
          icon="checkmark-done-outline"
          label="My Verifications"
          desc="View your verification history"
          onPress={() => navigation.navigate('LawyerVerification', { tab: 'history' })}
          COLORS={COLORS}
          styles={styles}
        />
        <MenuItem
          icon="notifications-outline"
          label="Notifications"
          desc="View alerts"
          onPress={() => navigation.navigate('Notifications')}
          COLORS={COLORS}
          styles={styles}
        />
      </View>
    </ScrollView>
  );
};

const MenuItem = ({ icon, label, desc, badge, onPress, COLORS, styles }: any) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuIcon}>
      <Ionicons name={icon} size={22} color={COLORS.primary} />
    </View>
    <View style={styles.menuInfo}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuDesc}>{desc}</Text>
    </View>
    {badge && (
      <View style={styles.menuBadge}>
        <Text style={styles.menuBadgeText}>{badge}</Text>
      </View>
    )}
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
  heroIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  heroTitle: { fontSize: FONT_SIZE.hero, fontWeight: '900', color: COLORS.white },
  heroSub: { fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.xs },
  statsRow: {
    flexDirection: 'row', justifyContent: 'center',
    marginHorizontal: SPACING.xl, marginTop: -SPACING.xxl,
  },
  statCard: {
    width: '60%', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.md,
  },
  statIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  statValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
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
  menuBadge: {
    backgroundColor: COLORS.error, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm, paddingVertical: 2, marginRight: SPACING.sm,
  },
  menuBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: COLORS.white },
});

import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export const OrgDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const user = useAuthStore((s) => s.user);
  const [org, setOrg] = useState<any>(null);
  const [lawyerCount, setLawyerCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [orgRes, lawyersRes, requestsRes] = await Promise.all([
        organizationsApi.getMine(),
        organizationsApi.listLawyers(),
        organizationsApi.listOrgAppointmentRequests(),
      ]);

      setOrg(orgRes.data.organization || orgRes.data);
      const lawyers = lawyersRes.data.lawyers || lawyersRes.data.items || lawyersRes.data || [];
      setLawyerCount(lawyers.length);
      const requests = requestsRes.data.requests || requestsRes.data.items || requestsRes.data || [];
      const pendingReqs = requests.filter((r: any) => r.status === 'PENDING');
      setRequestCount(pendingReqs.length);
    } catch (err) {
      // Ignore
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchDashboardData().finally(() => setRefreshing(false)); };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <LinearGradient colors={[COLORS.midnight, COLORS.primary]} style={styles.hero}>
        <TouchableOpacity style={styles.notificationBtn} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.heroIcon}>
          <Ionicons name="business" size={32} color={COLORS.accent} />
        </View>
        <Text style={styles.heroTitle}>{org?.name || 'Organization'}</Text>
        <Text style={styles.heroSub}>{org?.status === 'APPROVED' ? 'Verified' : 'Verification Pending'}</Text>
      </LinearGradient>

      <View style={styles.statsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.statCard}
          onPress={() => navigation.navigate('OrgRequests')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="calendar" size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>{requestCount}</Text>
          <Text style={styles.statLabel}>Pending Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.statCard}
          onPress={() => navigation.navigate('OrgLawyers')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#E0E7FF' }]}>
            <Ionicons name="people" size={24} color="#6366F1" />
          </View>
          <Text style={styles.statValue}>{lawyerCount}</Text>
          <Text style={styles.statLabel}>Team Lawyers</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Management Tools</Text>

        <MenuItem
          icon="calendar-outline"
          label="Appointment Requests"
          desc="Assign clients to lawyers"
          COLORS={COLORS}
          styles={styles}
          onPress={() => navigation.navigate('OrgRequests')}
          badge={requestCount > 0 ? requestCount.toString() : undefined}
        />

        <MenuItem
          icon="people-outline"
          label="Team Lawyers"
          desc="Manage firm lawyers"
          COLORS={COLORS}
          styles={styles}
          onPress={() => navigation.navigate('OrgLawyers')}
        />

        <MenuItem
          icon="document-text-outline"
          label="Verification Status"
          desc="Check your firm's verification"
          COLORS={COLORS}
          styles={styles}
          onPress={() => navigation.navigate('OrgProfile')}
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
  notificationBtn: {
    position: 'absolute',
    top: SPACING.huge,
    right: SPACING.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  heroTitle: { fontSize: FONT_SIZE.hero, fontWeight: '900', color: COLORS.white },
  heroSub: { fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.xs },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.xl, marginTop: -SPACING.xxl,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.white,
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

import {  useThemeStore , useColors } from '../../stores/themeStore';
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
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const user = useAuthStore((s) => s.user);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardStats = useCallback(async () => {
    try {
      const [pendingRes, historyRes] = await Promise.all([
        courtAdminApi.getPendingVerifications(),
        courtAdminApi.getMyVerifications({ page: 1, limit: 500 }),
      ]);

      const pendingItemsRaw = pendingRes.data.items || pendingRes.data.lawyers || pendingRes.data || [];
      const pendingArr = Array.isArray(pendingItemsRaw) ? pendingItemsRaw : [];
      setPendingItems(pendingArr);
      setPendingCount(pendingArr.length);

      const historyRows = historyRes.data.verifications || historyRes.data.items || historyRes.data || [];
      const historyArr = Array.isArray(historyRows) ? historyRows : [];
      const approved = historyArr.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'APPROVED').length;
      const rejected = historyArr.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'REJECTED').length;

      setApprovedCount(approved);
      setRejectedCount(rejected);
    } catch {
      setPendingItems([]);
      setPendingCount(0);
      setApprovedCount(0);
      setRejectedCount(0);
    }
  }, []);

  useEffect(() => { fetchDashboardStats(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchDashboardStats().finally(() => setRefreshing(false)); };

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
          <Ionicons name="shield-checkmark" size={32} color={COLORS.accent} />
        </View>
        <Text style={styles.heroTitle}>Court Admin</Text>
        <Text style={styles.heroSub}>Welcome, {user?.name || 'Admin'}</Text>
      </LinearGradient>

      <View style={styles.statsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.statCard}
          onPress={() => navigation.navigate('LawyerVerification', { tab: 'pending', statusFilter: 'ALL' })}
        >
          <View style={[styles.statIcon, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="hourglass" size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.statCard}
          onPress={() => navigation.navigate('LawyerVerification', { tab: 'history', statusFilter: 'APPROVED' })}
        >
          <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
          <Text style={styles.statValue}>{approvedCount}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.statCard}
          onPress={() => navigation.navigate('LawyerVerification', { tab: 'history', statusFilter: 'REJECTED' })}
        >
          <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="close-circle" size={24} color="#EF4444" />
          </View>
          <Text style={styles.statValue}>{rejectedCount}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>New Pending Requests</Text>

        {pendingItems.slice(0, 5).map((item: any, index: number) => (
          <TouchableOpacity
            key={item?.id || `${item?.lawyer?.id || 'lawyer'}-${index}`}
            style={styles.requestItem}
            onPress={() => navigation.navigate('LawyerVerification', { tab: 'pending' })}
          >
            <View style={styles.requestAvatar}>
              <Ionicons name="person-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.requestInfo}>
              <Text style={styles.requestName}>{item?.lawyer?.name || 'Lawyer'}</Text>
              <Text style={styles.requestMeta}>
                {[item?.lawyer?.city, item?.lawyer?.state].filter(Boolean).join(', ') || 'Location unavailable'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        ))}

        {pendingCount === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-done-circle-outline" size={24} color={COLORS.success} />
            <Text style={styles.emptyText}>No new pending requests</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verification Tools</Text>
        <MenuItem
          icon="business-outline"
          label="Organization Verifications"
          desc="Verify law firms and legal organizations"
          COLORS={COLORS}
          styles={styles}
          onPress={() => navigation.navigate('OrgVerification')}
        />
        <MenuItem
          icon="person-outline"
          label="Lawyer Verifications"
          desc="Verify individual lawyer registrations"
          COLORS={COLORS}
          styles={styles}
          onPress={() => navigation.navigate('LawyerVerification', { tab: 'pending', statusFilter: 'ALL' })}
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
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  requestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: { flex: 1, marginLeft: SPACING.md },
  requestName: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  requestMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZE.sm, fontWeight: '600' },
});

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { AdminAttentionWidget } from '../../components/AdminAttentionWidget';

// Action-oriented home for the admin section. Surfaces "needs your
// attention" (pending court-admin approvals, payouts ready, disputes,
// unverified users) before any navigation menus, then platform stats, then
// grouped category cards. Money-flow surfaces (Payments, Wallets, Payouts,
// Audit Log) live under the Operations bottom tab; this screen drills into
// people / courts / compliance / configuration.
export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const user = useAuthStore((s) => s.user);
  const isSuper = user?.level === 'SUPER_ADMIN';

  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Bumping this key forces the AttentionWidget to re-mount and re-fetch.
  // Cheaper than a callback-based refresh API.
  const [attentionKey, setAttentionKey] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await adminApi.getDashboard();
      setStats(data);
    } catch {
      setStats({ users: 0, lawyers: 0, cases: 0, appointments: 0 });
    }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    setAttentionKey((k) => k + 1);
    await fetchStats();
    setRefreshing(false);
  };

  const totalUsers = stats?.users?.total ?? stats?.users ?? stats?.totalUsers ?? '—';
  const totalLawyers = stats?.users?.lawyers ?? stats?.lawyers ?? stats?.totalLawyers ?? '—';
  const totalCases = stats?.cases?.total ?? stats?.cases ?? stats?.totalCases ?? '—';
  const totalAppointments = stats?.appointments?.total ?? stats?.appointments ?? stats?.totalAppointments ?? '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <LinearGradient colors={[COLORS.midnight, COLORS.primary]} style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <Ionicons name="shield-checkmark" size={28} color={COLORS.accent} />
        </View>
        <Text style={styles.heroGreeting}>Welcome back</Text>
        <Text style={styles.heroName}>{user?.name || 'Administrator'}</Text>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>{isSuper ? 'SUPER ADMIN' : 'ADMIN'}</Text>
        </View>
      </LinearGradient>

      {/* Needs Your Attention */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>NEEDS YOUR ATTENTION</Text>
        </View>
        <AdminAttentionWidget key={attentionKey} isSuper={!!isSuper} navigation={navigation} />
      </View>

      {/* Platform stats */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>PLATFORM STATS</Text>
        </View>
        <View style={styles.statsGrid}>
          <StatCard icon="people" color="#3B82F6" label="Users" value={totalUsers} styles={styles} />
          <StatCard icon="briefcase" color={COLORS.accent} label="Lawyers" value={totalLawyers} styles={styles} />
          <StatCard icon="folder-open" color={COLORS.success} label="Cases" value={totalCases} styles={styles} />
          <StatCard icon="calendar" color="#8B5CF6" label="Appointments" value={totalAppointments} styles={styles} />
        </View>
      </View>

      {/* People */}
      <Section label="PEOPLE" styles={styles}>
        <MenuItem
          icon="people-outline"
          label="All users"
          desc={isSuper
            ? 'Browse all roles · ban, KYC override, verify from each user'
            : 'Verify and inspect clients & lawyers'}
          onPress={() => navigation.navigate('AdminUsers')}
          styles={styles} COLORS={COLORS}
        />
      </Section>

      {/* Courts */}
      <Section label="COURTS" styles={styles}>
        {isSuper && (
          <MenuItem
            icon="checkmark-done-outline"
            label="Court admin approvals"
            desc="Review and approve self-onboarded court admins"
            onPress={() => navigation.navigate('SuperAdminCourtAdminApprovals')}
            styles={styles} COLORS={COLORS}
          />
        )}
        <MenuItem
          icon="business-outline"
          label="Courts directory"
          desc="Manage courts in the platform"
          onPress={() => navigation.navigate('CourtManagement')}
          styles={styles} COLORS={COLORS}
        />
        <MenuItem
          icon="shield-outline"
          label="Court admin team"
          desc="Manage court admins"
          onPress={() => navigation.navigate('CourtAdminManagement')}
          styles={styles} COLORS={COLORS}
        />
        {isSuper && (
          <MenuItem
            icon="ribbon-outline"
            label="Performance & salary"
            desc="Court admin metrics, salary cycle and payouts"
            onPress={() => navigation.navigate('SuperAdminCourtAdminOps')}
            styles={styles} COLORS={COLORS}
          />
        )}
      </Section>

      {/* Content & moderation */}
      <Section label="CONTENT" styles={styles}>
        <MenuItem
          icon="alert-circle-outline"
          label="User reports"
          desc="Triage bug reports and issues from users"
          onPress={() => navigation.navigate('AdminReports')}
          styles={styles} COLORS={COLORS}
        />
        <MenuItem
          icon="newspaper-outline"
          label="Legal updates"
          desc="Publish and edit legal news entries"
          onPress={() => navigation.navigate('AdminLegalUpdates')}
          styles={styles} COLORS={COLORS}
        />
        {isSuper && (
          <MenuItem
            icon="megaphone-outline"
            label="Announcements"
            desc="Broadcast a message to every user on the platform"
            onPress={() => navigation.navigate('AdminAnnouncements')}
            styles={styles} COLORS={COLORS}
          />
        )}
      </Section>

      {/* Platform — super-admin only */}
      {isSuper && (
        <Section label="PLATFORM" styles={styles}>
          <MenuItem
            icon="people-circle-outline"
            label="Admin team"
            desc="Invite, edit, and deactivate platform admins"
            onPress={() => navigation.navigate('AdminTeam')}
            styles={styles} COLORS={COLORS}
          />
          <MenuItem
            icon="settings-outline"
            label="Platform config"
            desc="Commission, GST, TDS and feature flags"
            onPress={() => navigation.navigate('SuperAdminPlatformConfig')}
            styles={styles} COLORS={COLORS}
          />
        </Section>
      )}
    </ScrollView>
  );
};

const Section = ({ label, styles, children }: any) => {
  // Strip the divider on the last menu item so the rounded card doesn't
  // leave a stray hairline against its bottom edge.
  const items = React.Children.toArray(children).filter(Boolean);
  const cloned = items.map((child: any, idx: number) =>
    React.isValidElement(child) && idx === items.length - 1
      ? React.cloneElement(child, { isLast: true } as any)
      : child,
  );
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      <View style={styles.menuCard}>{cloned}</View>
    </View>
  );
};

const StatCard = ({ icon, color, label, value, styles }: any) => (
  <View style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const MenuItem = ({ icon, label, desc, onPress, isLast, styles, COLORS }: any) => (
  <TouchableOpacity
    style={[styles.menuItem, isLast && styles.menuItemLast]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.menuIcon}>
      <Ionicons name={icon} size={20} color={COLORS.primary} />
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
  scrollContent: { paddingBottom: 120 },

  hero: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge + SPACING.md,
    paddingBottom: SPACING.xxxl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl, borderBottomRightRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroGreeting: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)' },
  heroName: { fontSize: FONT_SIZE.xxxl, fontWeight: '900', color: COLORS.white, marginTop: 2 },
  heroBadge: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: BORDER_RADIUS.full,
  },
  heroBadgeText: { color: COLORS.white, fontSize: FONT_SIZE.xs, fontWeight: '800', letterSpacing: 1 },

  section: { paddingHorizontal: SPACING.xl, marginTop: SPACING.xl },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.sm, paddingHorizontal: SPACING.xs,
  },
  sectionLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1 },

  // Stats — first section sits half-overlapping the gradient hero.
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statCard: {
    flex: 1, minWidth: '47%', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, ...SHADOWS.sm,
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  statValue: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  menuCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, ...SHADOWS.sm, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primaryLight + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  menuInfo: { flex: 1 },
  menuLabel: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  menuDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
});

export const AdminDashboardScreenDefault = AdminDashboardScreen;
export default AdminDashboardScreen;

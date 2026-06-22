import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Text as SvgText, Line, Circle, Path } from 'react-native-svg';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminApi, notificationsApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { AdminAttentionWidget } from '../../components/AdminAttentionWidget';

// =============================================================================
// AdminDashboardScreen — stats-first home for the admin section.
//
// What lives here (per the latest restructure):
//   1. Top-right header actions: notifications bell + profile avatar.
//      Both are reachable from any other admin screen too, but the
//      dashboard is where the user lands so the entry points sit here.
//   2. Hero greeting strip with role badge.
//   3. "Needs your attention" widget — pending court-admin approvals,
//      payouts ready, disputes, unverified users. Tap-throughs route to
//      the right detail screen.
//   4. Platform stats — four tappable stat cards + a comparative bar
//      chart so the super admin can read the platform shape at a glance.
//      Each card drills into the relevant management surface.
//
// Navigation menus (People / Courts / Content / Platform sections)
// previously lived here — they've moved to the new Platform tab
// (AdminPlatformScreen) so this screen stays a focused dashboard.
// =============================================================================

export const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const user = useAuthStore((s) => s.user);
  const isSuper = user?.level === 'SUPER_ADMIN';

  const [stats, setStats] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Bumping this key forces the AttentionWidget to re-mount and re-fetch.
  const [attentionKey, setAttentionKey] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await adminApi.getDashboard();
      setStats(data);
    } catch {
      setStats({ users: 0, lawyers: 0, cases: 0, appointments: 0 });
    }
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await notificationsApi.getUnreadCount();
      setUnread(Number(data?.count ?? data?.unreadCount ?? 0));
    } catch {
      // Non-fatal — the bell still navigates; the badge just won't show.
    }
  }, []);

  useEffect(() => { void fetchStats(); void fetchUnread(); }, [fetchStats, fetchUnread]);

  const onRefresh = async () => {
    setRefreshing(true);
    setAttentionKey((k) => k + 1);
    await Promise.all([fetchStats(), fetchUnread()]);
    setRefreshing(false);
  };

  // Numeric stat extraction with fallbacks for the various server response
  // shapes seen in the wild. The bar chart renders only when at least one
  // value parses to a finite number; otherwise we render dashes.
  const num = (v: any): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const totalUsers = num(stats?.users?.total ?? stats?.users ?? stats?.totalUsers);
  const totalLawyers = num(stats?.users?.lawyers ?? stats?.lawyers ?? stats?.totalLawyers);
  const totalCases = num(stats?.cases?.total ?? stats?.cases ?? stats?.totalCases);
  const totalAppointments = num(stats?.appointments?.total ?? stats?.appointments ?? stats?.totalAppointments);
  const haveAnyStats = totalUsers + totalLawyers + totalCases + totalAppointments > 0;

  const chartData = useMemo(
    () => [
      { label: 'Users', value: totalUsers, color: '#3B82F6' },
      { label: 'Lawyers', value: totalLawyers, color: COLORS.accent },
      { label: 'Cases', value: totalCases, color: COLORS.success },
      { label: 'Appts', value: totalAppointments, color: '#8B5CF6' },
    ],
    [totalUsers, totalLawyers, totalCases, totalAppointments, COLORS.accent, COLORS.success],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <LinearGradient colors={[COLORS.midnight, COLORS.primary]} style={styles.hero}>
        {/* Profile avatar — top-left. Renders the user's avatarUrl when
            present and falls back to the generic person icon otherwise so
            users without a profile photo still see something. */}
        <TouchableOpacity
          style={[styles.headerBtn, styles.headerBtnLeft]}
          onPress={() => navigation.navigate('AdminProfile')}
          accessibilityLabel="Profile"
          activeOpacity={0.85}
        >
          {(user as any)?.avatarUrl || (user as any)?.avatar ? (
            <Image
              source={{ uri: (user as any).avatarUrl || (user as any).avatar }}
              style={styles.headerAvatar}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={34} color={COLORS.white} />
          )}
        </TouchableOpacity>

        {/* Notifications bell — top-right with unread badge. */}
        <TouchableOpacity
          style={[styles.headerBtn, styles.headerBtnRight]}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel="Notifications"
          activeOpacity={0.85}
        >
          <Ionicons name="notifications-outline" size={24} color={COLORS.white} />
          {unread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </TouchableOpacity>

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

      {/* Platform stats — tappable cards drill into the relevant surface. */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>PLATFORM STATS</Text>
        </View>
        <View style={styles.statsGrid}>
          <StatCard
            icon="people"
            color="#3B82F6"
            label="Users"
            value={stats ? totalUsers : '—'}
            onPress={() => navigation.navigate('AdminUsers')}
            styles={styles}
          />
          <StatCard
            icon="briefcase"
            color={COLORS.accent}
            label="Lawyers"
            value={stats ? totalLawyers : '—'}
            onPress={() => navigation.navigate('AdminUsers')}
            styles={styles}
          />
          <StatCard
            icon="folder-open"
            color={COLORS.success}
            label="Cases"
            value={stats ? totalCases : '—'}
            onPress={() => navigation.navigate('AdminUsers')}
            styles={styles}
          />
          <StatCard
            icon="calendar"
            color="#8B5CF6"
            label="Appointments"
            value={stats ? totalAppointments : '—'}
            onPress={() => navigation.navigate('AdminUsers')}
            styles={styles}
          />
        </View>
      </View>

      {/* Comparative bar chart — quick visual read of the platform shape.
          SVG-rendered (react-native-svg) so it stays light and crisp at
          any device density. */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>AT A GLANCE</Text>
        </View>
        <View style={styles.chartCard}>
          {haveAnyStats ? (
            <BarChart data={chartData} COLORS={COLORS} />
          ) : (
            <Text style={styles.chartEmpty}>No stats available yet.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatCard = ({ icon, color, label, value, onPress, styles }: any) => (
  <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.85}>
    <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </TouchableOpacity>
);

// Inline bar chart. Width is responsive — caller wraps it in a flex card
// so the SVG sizes to the available width on first render. We render with
// a fixed viewBox and let the parent View clip; this avoids a measurement
// round-trip and keeps the chart crisp at any density.
const CHART_W = 320;
const CHART_H = 180;
const CHART_PAD_X = 32;
const CHART_PAD_TOP = 16;
const CHART_PAD_BOTTOM = 32;

const BarChart: React.FC<{ data: { label: string; value: number; color: string }[]; COLORS: any }> = ({ data, COLORS }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  const innerW = CHART_W - CHART_PAD_X * 2;
  const innerH = CHART_H - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  const barW = innerW / (data.length * 2);
  const gap = barW;

  return (
    <Svg
      width="100%"
      height={CHART_H}
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Y-axis baseline */}
      <Line
        x1={CHART_PAD_X}
        y1={CHART_PAD_TOP + innerH}
        x2={CHART_PAD_X + innerW}
        y2={CHART_PAD_TOP + innerH}
        stroke={COLORS.borderLight}
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const h = max > 0 ? (d.value / max) * innerH : 0;
        const x = CHART_PAD_X + i * (barW + gap) + gap / 2;
        const y = CHART_PAD_TOP + (innerH - h);
        return (
          <React.Fragment key={d.label}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={d.color}
              rx={4}
              ry={4}
            />
            {/* Value label above each bar */}
            <SvgText
              x={x + barW / 2}
              y={Math.max(y - 6, CHART_PAD_TOP + 10)}
              fontSize="11"
              fontWeight="700"
              fill={COLORS.text}
              textAnchor="middle"
            >
              {d.value.toLocaleString('en-IN')}
            </SvgText>
            {/* X-axis category label */}
            <SvgText
              x={x + barW / 2}
              y={CHART_PAD_TOP + innerH + 18}
              fontSize="10"
              fontWeight="600"
              fill={COLORS.textMuted}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 120 },

  hero: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge + SPACING.md,
    paddingBottom: SPACING.xxxl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl, borderBottomRightRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
  },
  headerBtn: {
    position: 'absolute',
    // Pushed further down from the status bar so the buttons don't fight
    // with the safe-area inset on notched devices, and sized up to 48x48
    // for an easier tap target + a more balanced look against the larger
    // gradient hero. Border + slight white background tint keeps the
    // avatar legible on the dark gradient.
    top: SPACING.huge + SPACING.lg,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Left button (profile) clips its child image to the circle, so the
  // avatar fills the button cleanly. We can't apply this to the right
  // button because it would also clip the unread-count badge that pokes
  // outside the bell.
  headerBtnLeft: { left: SPACING.xl, overflow: 'hidden' },
  headerBtnRight: { right: SPACING.xl },
  headerAvatar: {
    width: '100%', height: '100%',
  },
  headerBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2, borderColor: COLORS.midnight,
  },
  headerBadgeText: {
    fontSize: 11, fontWeight: '800', color: COLORS.white,
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

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  statCard: {
    flex: 1, minWidth: '47%', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, ...SHADOWS.sm,
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs },
  statValue: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  chartCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  chartEmpty: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
    fontStyle: 'italic',
  },
});

export const AdminDashboardScreenDefault = AdminDashboardScreen;
export default AdminDashboardScreen;

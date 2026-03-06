import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { useWalletStore } from '../../stores/walletStore';
import { dashboardApi, referralApi, subscriptionApi } from '../../services/api';
import { Appointment } from '../../types';
import { format } from 'date-fns';

interface DashboardStats {
  rating: number;
  totalReviews: number;
  responseRate: number;
  activeCases: number;
  activeCasesChange: number;
  thisWeekConsultations: number;
  consultationsChange: number;
  upcomingAppointments: Appointment[];
  thisMonthEarnings: number;
  lastMonthEarnings: number;
}

interface ReferralInfo {
  totalReferred: number;
  rewardsPaid: number;
  totalEarnings: number;
}

export const LawyerDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const { balance, fetchBalance } = useWalletStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, refRes, subRes] = await Promise.all([
        dashboardApi.lawyerDashboard(),
        referralApi.getInfo(),
        subscriptionApi.get().catch(() => ({ data: { data: null } })),
      ]);
      fetchBalance();

      const d = dashRes.data?.data || dashRes.data || {};
      setStats({
        rating: d.rating || 0,
        totalReviews: d.totalReviews || 0,
        responseRate: d.responseRate || 0,
        activeCases: d.activeCases || 0,
        activeCasesChange: d.activeCasesChange || 0,
        thisWeekConsultations: d.thisWeekConsultations || 0,
        consultationsChange: d.consultationsChange || 0,
        upcomingAppointments: d.upcomingAppointments || [],
        thisMonthEarnings: d.thisMonthEarnings || 0,
        lastMonthEarnings: d.lastMonthEarnings || 0,
      });

      const r = refRes.data?.data || refRes.data || {};
      setReferral({
        totalReferred: r.totalReferred || 0,
        rewardsPaid: r.rewardsPaid || 0,
        totalEarnings: r.totalEarnings ? r.totalEarnings / 100 : 0,
      });

      setSubscription(subRes.data?.data || null);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData().finally(() => setRefreshing(false));
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const earningsChange = stats
    ? (stats.lastMonthEarnings > 0
        ? Math.round(((stats.thisMonthEarnings - stats.lastMonthEarnings) / stats.lastMonthEarnings) * 100)
        : stats.thisMonthEarnings > 0 ? 100 : 0)
    : 0;

  const isPro = subscription?.plan === 'PRO' && subscription?.status === 'ACTIVE';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      {/* Hero */}
      <LinearGradient colors={[COLORS.primary, COLORS.midnight]} style={styles.hero}>
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{user?.name || 'Advocate'} ⚖️</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity style={styles.alertBtn} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.profileIconBtn} onPress={() => navigation.navigate('LawyerProfile')}>
              {(user as any)?.avatarUrl || user?.avatar ? (
                <Image source={{ uri: (user as any)?.avatarUrl || user?.avatar }} style={styles.profileIconImg} />
              ) : (
                <Ionicons name="person-circle-outline" size={36} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.date}>{format(new Date(), 'EEEE, dd MMMM yyyy')}</Text>

        {/* Rating badge */}
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={16} color={COLORS.accent} />
          <Text style={styles.ratingText}>{(stats?.rating || 0).toFixed(1)}</Text>
          <Text style={styles.ratingCount}>({stats?.totalReviews || 0} reviews)</Text>
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="pulse" iconBg="#e6f3ff" iconColor={COLORS.primary}
          value={`${stats?.responseRate || 0}%`}
          label="Response Rate"
          change={null}
          onPress={() => {}}
        />
        <StatCard
          icon="briefcase" iconBg="#fef5e6" iconColor={COLORS.accent}
          value={String(stats?.activeCases || 0)}
          label="Active Cases"
          change={stats?.activeCasesChange || 0}
          onPress={() => navigation.navigate('LawyerCases')}
        />
        <StatCard
          icon="calendar" iconBg="#e6f9f0" iconColor={COLORS.success}
          value={String(stats?.thisWeekConsultations || 0)}
          label="This Week"
          change={stats?.consultationsChange || 0}
          onPress={() => navigation.navigate('LawyerAppointments')}
        />
        <StatCard
          icon="cash" iconBg="#fef1f1" iconColor={COLORS.error}
          value={`₹${((stats?.thisMonthEarnings || 0) / 100).toLocaleString('en-IN')}`}
          label="This Month"
          change={earningsChange}
          onPress={() => navigation.navigate('Wallet')}
        />
      </View>

      {/* Wallet Card */}
      <TouchableOpacity style={styles.walletCard} activeOpacity={0.7} onPress={() => navigation.navigate('Wallet')}>
        <View>
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={styles.walletAmount}>₹{balance.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.walletBtn}>
          <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
        </View>
      </TouchableOpacity>

      {/* Pro Subscription */}
      {!isPro && (
        <TouchableOpacity style={styles.proCard} activeOpacity={0.8} onPress={() => navigation.navigate('ProSubscription')}>
          <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.proGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.proRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="diamond" size={18} color="#FCD34D" />
                  <Text style={styles.proTitle}>Upgrade to Pro</Text>
                </View>
                <Text style={styles.proDesc}>Get priority listing, analytics, and more clients</Text>
              </View>
              <View style={styles.proArrow}>
                <Ionicons name="arrow-forward" size={18} color="#7C3AED" />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {isPro && (
        <View style={styles.proActiveCard}>
          <Ionicons name="diamond" size={20} color="#7C3AED" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.proActiveTitle}>Pro Member</Text>
            <Text style={styles.proActiveSub}>Expires {subscription?.expiresAt ? format(new Date(subscription.expiresAt), 'dd MMM yyyy') : '—'}</Text>
          </View>
          <View style={styles.proBadge}><Text style={styles.proBadgeText}>ACTIVE</Text></View>
        </View>
      )}

      {/* Upcoming Consultations */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Consultations</Text>
          <TouchableOpacity onPress={() => navigation.navigate('LawyerAppointments')}>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {(!stats?.upcomingAppointments || stats.upcomingAppointments.length === 0) ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={36} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No upcoming consultations</Text>
          </View>
        ) : (
          stats.upcomingAppointments.map((appt) => (
            <TouchableOpacity
              key={appt.id}
              style={styles.apptCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ChatScreen', { appointmentId: appt.id, name: appt.client?.name })}
            >
              <View style={styles.apptAvatar}>
                {appt.client?.avatar ? (
                  <Image source={{ uri: appt.client.avatar }} style={styles.apptAvatarImg} />
                ) : (
                  <Ionicons name="person" size={20} color={COLORS.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.apptName}>{appt.client?.name || 'Client'}</Text>
                <Text style={styles.apptTime}>
                  {format(new Date(appt.scheduledAt), 'dd MMM, hh:mm a')} · {appt.durationMins}min
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: appt.status === 'CONFIRMED' ? COLORS.successLight : COLORS.warningLight }]}>
                <Text style={[styles.statusText, { color: appt.status === 'CONFIRMED' ? COLORS.success : COLORS.warning }]}>
                  {appt.status === 'CONFIRMED' ? 'Confirmed' : appt.status === 'PENDING' ? 'Pending' : appt.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickRow}>
          <QuickAction icon="person" label="Profile" color={COLORS.primary} onPress={() => navigation.navigate('LawyerProfile')} />
          <QuickAction icon="wallet" label="Wallet" color={COLORS.success} onPress={() => navigation.navigate('Wallet')} />
          <QuickAction icon="people" label="Referral" color={COLORS.accent} onPress={() => navigation.navigate('ReferralProgram')} />
          <QuickAction icon="sparkles" label="AI Chat" color="#8B5CF6" onPress={() => navigation.navigate('AiChat')} />
        </View>
      </View>

      {/* Referral Earnings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Referral Earnings</Text>
        <TouchableOpacity style={styles.referralCard} activeOpacity={0.7} onPress={() => navigation.navigate('ReferralProgram')}>
          <View style={styles.referralStatsRow}>
            <View style={styles.referralStat}>
              <Text style={styles.referralValue}>{referral?.totalReferred || 0}</Text>
              <Text style={styles.referralLabel}>Referrals</Text>
            </View>
            <View style={styles.referralDivider} />
            <View style={styles.referralStat}>
              <Text style={styles.referralValue}>{referral?.rewardsPaid || 0}</Text>
              <Text style={styles.referralLabel}>Rewards</Text>
            </View>
            <View style={styles.referralDivider} />
            <View style={styles.referralStat}>
              <Text style={[styles.referralValue, { color: COLORS.success }]}>₹{referral?.totalEarnings || 0}</Text>
              <Text style={styles.referralLabel}>Earned</Text>
            </View>
          </View>
          <View style={styles.referralCta}>
            <Text style={styles.referralCtaText}>Earn ₹5,000 per successful referral</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

/* ── Stat Card ── */
const StatCard: React.FC<{
  icon: string; iconBg: string; iconColor: string;
  value: string; label: string; change: number | null;
  onPress: () => void;
}> = ({ icon, iconBg, iconColor, value, label, change, onPress }) => (
  <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={icon as any} size={20} color={iconColor} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {change !== null && change !== undefined && (
      <View style={[styles.changeBadge, { backgroundColor: change >= 0 ? COLORS.successLight : COLORS.errorLight }]}>
        <Ionicons name={change >= 0 ? 'trending-up' : 'trending-down'} size={10} color={change >= 0 ? COLORS.success : COLORS.error} />
        <Text style={[styles.changeText, { color: change >= 0 ? COLORS.success : COLORS.error }]}>
          {change >= 0 ? '+' : ''}{change}%
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

/* ── Quick Action ── */
const QuickAction = ({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.quickItem} onPress={onPress}>
    <View style={[styles.quickIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon as any} size={22} color={color} />
    </View>
    <Text style={styles.quickLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  hero: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge + SPACING.md,
    paddingBottom: SPACING.xxxl + SPACING.md,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  alertBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  profileIconBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  profileIconImg: { width: 40, height: 40, borderRadius: 20 },
  greeting: { fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.7)' },
  name: { fontSize: FONT_SIZE.hero, fontWeight: '900', color: COLORS.white, marginTop: 4 },
  date: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.6)', marginTop: SPACING.sm },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md },
  ratingText: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.white },
  ratingCount: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.6)' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md,
    marginHorizontal: SPACING.xl, marginTop: -SPACING.xxl,
  },
  statCard: {
    width: '47.5%' as any, alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, ...SHADOWS.md,
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  statValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm, marginTop: SPACING.xs,
  },
  changeText: { fontSize: 9, fontWeight: '700' },

  // Wallet
  walletCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, ...SHADOWS.md,
  },
  walletLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  walletAmount: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text, marginTop: 2 },
  walletBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center',
  },

  // Pro subscription
  proCard: { marginHorizontal: SPACING.xl, marginTop: SPACING.xl, borderRadius: BORDER_RADIUS.xl, overflow: 'hidden' },
  proGradient: { padding: SPACING.xl, borderRadius: BORDER_RADIUS.xl },
  proRow: { flexDirection: 'row', alignItems: 'center' },
  proTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.white },
  proDesc: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  proArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  proActiveCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    backgroundColor: '#EDE9FE', borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
  },
  proActiveTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#7C3AED' },
  proActiveSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  proBadge: { backgroundColor: '#7C3AED', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  proBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.white },

  // Section
  section: { paddingHorizontal: SPACING.xl, marginTop: SPACING.xxl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  seeAll: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary },

  // Appointment cards
  apptCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  apptAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  apptAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  apptName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  apptTime: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },

  emptyBox: {
    alignItems: 'center', padding: SPACING.xxl, backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, ...SHADOWS.sm,
  },
  emptyText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.sm },

  // Quick actions
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { alignItems: 'center', width: '22%' as any },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  quickLabel: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textSecondary },

  // Referral
  referralCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, ...SHADOWS.md,
  },
  referralStatsRow: { flexDirection: 'row', alignItems: 'center' },
  referralStat: { flex: 1, alignItems: 'center' },
  referralDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  referralValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  referralLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  referralCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: SPACING.lg, paddingTop: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  referralCtaText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary },
});

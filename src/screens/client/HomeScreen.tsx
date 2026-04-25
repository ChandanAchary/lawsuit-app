import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Dimensions, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import {  useThemeStore , useColors } from '../../stores/themeStore';
import { useWalletStore } from '../../stores/walletStore';
import { useUserStore } from '../../stores/userStore';
import { dashboardApi } from '../../services/api';

const { width } = Dimensions.get('window');

const FEATURES = [
  { icon: 'bar-chart', title: 'Lex Rates', desc: 'View consultation fees', route: 'LexRates', color: '#6366F1' },
  { icon: 'chatbubble-ellipses', title: 'Legal Eagle', desc: 'AI legal assistant', route: 'AiChat', color: '#10B981' },
  { icon: 'briefcase', title: 'Track Cases', desc: 'Monitor your legal matters', route: 'Cases', color: '#F59E0B' },
  { icon: 'calendar', title: 'Appointments', desc: 'Manage consultations', route: 'Appointments', color: '#EF4444' },
  { icon: 'scale', title: 'Tele-Law', desc: 'Free legal aid eligibility', route: 'TeleLaw', color: '#8B5CF6' },
];

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const getUser = useUserStore((s) => s.getUser);
  const balance = useWalletStore((s) => s.balance);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const isDark = useThemeStore((s) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const isProfileHydrated = Boolean(user?.name && (((user as any)?.avatarUrl || user?.avatar || '').trim().length > 0));

  const [stats, setStats] = useState<{ upcoming: number; activeCases: number; completed: number; spentInr: number } | null>(null);

  const loadStats = React.useCallback(async () => {
    try {
      const { data } = await dashboardApi.clientDashboard();
      const d = data?.data || data || {};
      setStats({
        upcoming: Array.isArray(d.upcomingAppointments) ? d.upcomingAppointments.length : (d.upcomingAppointments ?? d.upcoming ?? 0),
        activeCases: d.activeCases ?? d.openCases ?? 0,
        completed: d.completedAppointments ?? d.completed ?? 0,
        spentInr: Math.round((d.totalSpent ?? d.amountSpent ?? 0) / 100),
      });
    } catch { /* keep prior */ }
  }, []);

  useEffect(() => {
    if (!isProfileHydrated) {
      void getUser();
    }
  }, [getUser, isProfileHydrated]);

  useFocusEffect(
    React.useCallback(() => {
      void fetchBalance();
      void loadStats();
      if (!isProfileHydrated) {
        void getUser();
      }
    }, [fetchBalance, getUser, isProfileHydrated, loadStats]),
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" />
      
      {/* Hero */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.midnight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        
        <View style={styles.heroContent}>
          <View style={styles.greetingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'} 👋</Text>
              <Text style={styles.heroSubtitle}>Find the best legal assistance</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={styles.alertIconBtn}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileIconBtn}
              onPress={() => navigation.navigate('Profile')}
            >
              {(user as any)?.avatarUrl || user?.avatar ? (
                <Image
                  source={{ uri: (user as any)?.avatarUrl || user?.avatar }}
                  style={styles.profileIconImg}
                />
              ) : (
                <Ionicons name="person" size={22} color={COLORS.primary} />
              )}
            </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.searchBar}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Search')}
          >
            <Ionicons name="search" size={20} color={COLORS.textMuted} />
            <Text style={styles.searchPlaceholder}>Search lawyers by name or specialization</Text>
          </TouchableOpacity>
        </View>

        {/* Wallet Card */}
        <TouchableOpacity
          style={styles.walletCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Wallet')}
        >
          <View style={styles.walletLeft}>
            <Text style={styles.walletLabel}>Wallet Balance</Text>
            <Text style={styles.walletAmount}>₹{balance.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.walletBtn}>
            <Ionicons name="add" size={20} color={COLORS.primary} />
          </View>
        </TouchableOpacity>
      </LinearGradient>

      {/* Overview Stats */}
      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Activity</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statTile, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="calendar-outline" size={20} color="#4F46E5" />
              <Text style={styles.statVal}>{stats.upcoming}</Text>
              <Text style={styles.statLbl}>Upcoming</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="briefcase-outline" size={20} color="#B45309" />
              <Text style={styles.statVal}>{stats.activeCases}</Text>
              <Text style={styles.statLbl}>Active Cases</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="checkmark-done-outline" size={20} color="#047857" />
              <Text style={styles.statVal}>{stats.completed}</Text>
              <Text style={styles.statLbl}>Completed</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="cash-outline" size={20} color="#B91C1C" />
              <Text style={styles.statVal}>₹{stats.spentInr.toLocaleString('en-IN')}</Text>
              <Text style={styles.statLbl}>Spent</Text>
            </View>
          </View>
        </View>
      )}

      {/* Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.featureGrid}>
          {FEATURES.map((f, i) => (
            <TouchableOpacity
              key={i}
              style={styles.featureCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(f.route)}
            >
              <View style={[styles.featureIcon, { backgroundColor: f.color + '15' }]}>
                <Ionicons name={f.icon as any} size={24} color={f.color} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Benefits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Why Choose NyayaX?</Text>
        {[
          { icon: 'shield-checkmark', title: 'Verified Lawyers', desc: 'All lawyers are thoroughly verified' },
          { icon: 'flash', title: 'Instant Booking', desc: 'Book appointments in seconds' },
          { icon: 'lock-closed', title: 'Secure Payments', desc: 'Your transactions are fully protected' },
        ].map((b, i) => (
          <View key={i} style={styles.benefitRow}>
            <View style={styles.benefitIcon}>
              <Ionicons name={b.icon as any} size={22} color={COLORS.primary} />
            </View>
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitDesc}>{b.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  hero: {
    paddingTop: SPACING.huge + 20,
    paddingBottom: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl + 4,
    borderBottomRightRadius: BORDER_RADIUS.xxl + 4,
    overflow: 'hidden',
  },
  heroDecor1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -40,
    right: -40,
  },
  heroDecor2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: 30,
    left: -30,
  },
  heroContent: {},
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  alertIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  profileIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  profileIconImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  greeting: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: FONT_SIZE.lg,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  searchPlaceholder: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  walletLeft: {},
  walletLabel: {
    fontSize: FONT_SIZE.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  walletAmount: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 2,
  },
  walletBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statTile: {
    width: (width - SPACING.xl * 2 - SPACING.md) / 2,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    gap: 4,
  },
  statVal: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text, marginTop: 4 },
  statLbl: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: '700' },
  featureCard: {
    width: (width - SPACING.xl * 2 - SPACING.md) / 2,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.md,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  featureTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  featureDesc: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    marginLeft: SPACING.lg,
    flex: 1,
  },
  benefitTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  benefitDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

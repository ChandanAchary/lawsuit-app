import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { appointmentsApi, casesApi } from '../../services/api';
import { Appointment, Case, AppointmentStatus } from '../../types';
import { AppointmentCard } from '../../components/AppointmentCard';
import { format } from 'date-fns';

export const LawyerDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const user = useAuthStore((s) => s.user);
  const [upcomingAppts, setUpcomingAppts] = useState<Appointment[]>([]);
  const [casesCount, setCasesCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [apptRes, casesRes] = await Promise.all([
        appointmentsApi.getAll({ status: AppointmentStatus.CONFIRMED }),
        casesApi.getAll({}),
      ]);
      setUpcomingAppts((apptRes.data.appointments || apptRes.data || []).slice(0, 3));
      const cases = casesRes.data.cases || casesRes.data || [];
      setCasesCount(Array.isArray(cases) ? cases.length : 0);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchData().finally(() => setRefreshing(false)); };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <LinearGradient colors={[COLORS.primary, COLORS.midnight]} style={styles.hero}>
        <Text style={styles.greeting}>{greeting()},</Text>
        <Text style={styles.name}>{user?.name || 'Advocate'} ⚖️</Text>
        <Text style={styles.date}>{format(new Date(), 'EEEE, dd MMMM yyyy')}</Text>
      </LinearGradient>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('LawyerAppointments')}>
          <View style={[styles.statIcon, { backgroundColor: '#e6f3ff' }]}>
            <Ionicons name="calendar" size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.statValue}>{upcomingAppts.length}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('LawyerCases')}>
          <View style={[styles.statIcon, { backgroundColor: '#fef5e6' }]}>
            <Ionicons name="briefcase" size={22} color={COLORS.accent} />
          </View>
          <Text style={styles.statValue}>{casesCount}</Text>
          <Text style={styles.statLabel}>Cases</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('LawyerTemplates')}>
          <View style={[styles.statIcon, { backgroundColor: '#e6f9f0' }]}>
            <Ionicons name="document-text" size={22} color={COLORS.success} />
          </View>
          <Text style={styles.statValue}>—</Text>
          <Text style={styles.statLabel}>Templates</Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickRow}>
          <QuickAction icon="person" label="Profile" color={COLORS.primary} onPress={() => navigation.navigate('LawyerProfile')} />
          <QuickAction icon="notifications" label="Alerts" color={COLORS.accent} onPress={() => navigation.navigate('Notifications')} />
          <QuickAction icon="wallet" label="Wallet" color={COLORS.success} onPress={() => navigation.navigate('Wallet')} />
          <QuickAction icon="sparkles" label="AI Chat" color="#8B5CF6" onPress={() => navigation.navigate('AiChat')} />
        </View>
      </View>

      {/* Upcoming appointments */}
      {upcomingAppts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            <TouchableOpacity onPress={() => navigation.navigate('LawyerAppointments')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {upcomingAppts.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              role="LAWYER"
              onChat={() => navigation.navigate('ChatScreen', { appointmentId: appt.id, name: appt.client?.name })}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
};

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
  hero: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge + SPACING.md,
    paddingBottom: SPACING.xxxl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
  },
  greeting: { fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.7)' },
  name: { fontSize: FONT_SIZE.hero, fontWeight: '900', color: COLORS.white, marginTop: 4 },
  date: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.6)', marginTop: SPACING.sm },
  statsRow: {
    flexDirection: 'row', gap: SPACING.md,
    marginHorizontal: SPACING.xl, marginTop: -SPACING.xxl,
  },
  statCard: {
    flex: 1, alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, ...SHADOWS.md,
  },
  statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  statValue: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  section: { paddingHorizontal: SPACING.xl, marginTop: SPACING.xxl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  sectionTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  seeAll: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { alignItems: 'center', width: (SPACING.xl * 2 + 300) / 4 },
  quickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm },
  quickLabel: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textSecondary },
});

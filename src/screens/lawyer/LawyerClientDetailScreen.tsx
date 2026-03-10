import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { appointmentsApi, usersApi, casesApi } from '../../services/api';
import { Appointment, AppointmentStatus, Case, User } from '../../types';

interface Props {
  navigation: any;
  route: { params: { clientId: string; name?: string } };
}

interface Stats {
  total: number;
  attended: number;
  upcoming: number;
  pending: number;
  cancelled: number;
}

export const LawyerClientDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { clientId, name } = route.params;

  const [client, setClient] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [userRes, apptRes, caseRes] = await Promise.all([
        usersApi.getUserById(clientId),
        appointmentsApi.getAll(),
        casesApi.getAll().catch(() => ({ data: { items: [] } })),
      ]);

      const userData = userRes.data?.data || userRes.data || {};
      setClient(userData);

      const allAppts: Appointment[] = apptRes.data?.items || apptRes.data?.appointments || apptRes.data || [];
      setAppointments(allAppts.filter((a) => a.clientId === clientId));

      const allCases: Case[] = caseRes.data?.items || caseRes.data?.cases || caseRes.data || [];
      setCases(allCases.filter((c) => c.clientId === clientId));
    } catch {
      // silently fail; UI shows empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId]);

  useEffect(() => { fetchData(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleChat = () => {
    navigation.navigate('ChatScreen', { otherUserId: clientId, name: client?.name || name });
  };

  const handleOpenCase = (caseItem: Case) => {
    navigation.navigate('LawyerCaseDetail', { caseId: caseItem.id });
  };

  const stats: Stats = {
    total: appointments.length,
    attended: appointments.filter((a) => a.status === AppointmentStatus.ATTENDED || a.status === 'COMPLETED' as any).length,
    upcoming: appointments.filter((a) => a.status === AppointmentStatus.CONFIRMED && new Date(a.scheduledAt) > new Date()).length,
    pending: appointments.filter((a) => a.status === AppointmentStatus.PENDING).length,
    cancelled: appointments.filter((a) => a.status === AppointmentStatus.CANCELLED).length,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const displayName = client?.name || name || 'Client';

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Client Profile</Text>
        <TouchableOpacity style={styles.chatHeaderBtn} onPress={handleChat}>
          <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            {(client?.avatar || (client as any)?.avatarUrl) ? (
              <Image source={{ uri: client?.avatar || (client as any)?.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {client?.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={10} color={COLORS.white} />
              </View>
            )}
          </View>

          <Text style={styles.clientName}>{displayName}</Text>

          {client?.email && (
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={15} color={COLORS.textMuted} />
              <Text style={styles.infoText}>{client.email}</Text>
            </View>
          )}
          {client?.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={15} color={COLORS.textMuted} />
              <Text style={styles.infoText}>{client.phone}</Text>
            </View>
          )}
          {client?.createdAt && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={15} color={COLORS.textMuted} />
              <Text style={styles.infoText}>
                Joined {format(new Date(client.createdAt), 'MMMM yyyy')}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.chatBtn} onPress={handleChat} activeOpacity={0.8}>
            <Ionicons name="chatbubble-ellipses" size={16} color={COLORS.white} />
            <Text style={styles.chatBtnText}>Send Message</Text>
          </TouchableOpacity>
        </View>

        {/* Appointment Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appointment Overview</Text>
          <View style={styles.statsGrid}>
            <StatBox value={stats.total} label="Total" color={COLORS.primary} />
            <StatBox value={stats.attended} label="Attended" color={COLORS.success} />
            <StatBox value={stats.upcoming} label="Upcoming" color={COLORS.accent} />
            <StatBox value={stats.pending} label="Pending" color="#F59E0B" />
          </View>
        </View>

        {/* Recent Appointments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appointment History</Text>
          {appointments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No appointments yet</Text>
            </View>
          ) : (
            appointments
              .slice()
              .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
              .map((appt) => (
                <AppointmentRow key={appt.id} appointment={appt} />
              ))
          )}
        </View>

        {/* Cases */}
        {cases.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cases Together</Text>
            {cases.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.caseRow}
                onPress={() => handleOpenCase(c)}
                activeOpacity={0.7}
              >
                <View style={[styles.caseIcon, { backgroundColor: COLORS.primary + '15' }]}>
                  <Ionicons name="briefcase" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.caseName} numberOfLines={1}>{c.title}</Text>
                  <Text style={styles.caseCategory}>{c.category || 'General'} · {c.status}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

/* ── Stat Box ── */
const StatBox: React.FC<{ value: number; label: string; color: string }> = ({ value, label, color }) => (
  <View style={styles.statBox}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

/* ── Appointment Row ── */
const AppointmentRow: React.FC<{ appointment: Appointment }> = ({ appointment }) => {
  const statusColors: Record<string, string> = {
    CONFIRMED: COLORS.success,
    ATTENDED: '#7C3AED',
    PENDING: '#F59E0B',
    CANCELLED: COLORS.error,
    MISSED: COLORS.error,
    COMPLETED: '#7C3AED',
    RESCHEDULED: COLORS.accent,
  };
  const color = statusColors[appointment.status] || COLORS.textMuted;

  return (
    <View style={styles.apptRow}>
      <View style={[styles.apptDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.apptDate}>
          {format(new Date(appointment.scheduledAt), 'dd MMM yyyy, hh:mm a')}
        </Text>
        {appointment.notes ? (
          <Text style={styles.apptNotes} numberOfLines={1}>{appointment.notes}</Text>
        ) : null}
      </View>
      <View style={[styles.apptBadge, { backgroundColor: color + '20' }]}>
        <Text style={[styles.apptStatus, { color }]}>
          {appointment.status.charAt(0) + appointment.status.slice(1).toLowerCase()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  backBtn: { marginRight: SPACING.md },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.white },
  chatHeaderBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Profile Card
  profileCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xxl,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  avatarWrapper: { position: 'relative', marginBottom: SPACING.md },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: {
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: FONT_SIZE.hero, fontWeight: '900', color: COLORS.primary },
  verifiedBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  clientName: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text, marginBottom: SPACING.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  infoText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  chatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginTop: SPACING.lg, backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  chatBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.white },

  // Section
  section: { paddingHorizontal: SPACING.xl, marginTop: SPACING.xxl },
  sectionTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.lg },

  // Stats grid
  statsGrid: { flexDirection: 'row', gap: SPACING.md },
  statBox: {
    flex: 1, alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, paddingVertical: SPACING.lg, ...SHADOWS.sm,
  },
  statValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900' },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  // Appointment rows
  apptRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  apptDot: { width: 10, height: 10, borderRadius: 5, marginRight: SPACING.md },
  apptDate: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  apptNotes: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  apptBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, marginLeft: SPACING.sm },
  apptStatus: { fontSize: FONT_SIZE.xs, fontWeight: '700' },

  // Case rows
  caseRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  caseIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  caseName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  caseCategory: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },

  // Empty state
  emptyBox: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.sm },
});

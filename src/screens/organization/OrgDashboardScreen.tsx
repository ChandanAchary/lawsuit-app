import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, StatusBar,
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
  // Two extra stats so the org head gets a fuller picture of routing
  // performance — assignments made this calendar month, and assignments
  // that the lawyer is still working through (not yet attended). Both
  // derived from the same listOrgAppointmentRequests() response so we
  // don't fan out to a second endpoint.
  const [assignedThisMonth, setAssignedThisMonth] = useState(0);
  const [activeAssignments, setActiveAssignments] = useState(0);
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
      setLawyerCount(Array.isArray(lawyers) ? lawyers.length : 0);
      const requests: any[] = requestsRes.data.requests || requestsRes.data.items || requestsRes.data || [];
      const list = Array.isArray(requests) ? requests : [];
      setRequestCount(list.filter((r) => r.status === 'PENDING').length);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      setAssignedThisMonth(
        list.filter(
          (r) =>
            r.status === 'ASSIGNED' &&
            r.updatedAt &&
            new Date(r.updatedAt).getTime() >= monthStart.getTime(),
        ).length,
      );
      // "Active" = assigned but the appointment hasn't been completed yet.
      // We rely on the embedded appointment status when present; fall back
      // to ASSIGNED state otherwise (org request hasn't progressed past it).
      setActiveAssignments(
        list.filter((r) => {
          if (r.status !== 'ASSIGNED') return false;
          const apptStatus = r.appointment?.status;
          return !apptStatus || (apptStatus !== 'COMPLETED' && apptStatus !== 'CANCELLED');
        }).length,
      );
    } catch (err) {
      // Ignore
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchDashboardData().finally(() => setRefreshing(false)); };

  const isVerified = org?.isVerified === true;
  const status = org?.verificationStatus || (isVerified ? 'APPROVED' : 'UNVERIFIED');

  let badgeColor = '#FBBF24'; // Pending
  let badgeText = 'Verification Pending';
  let badgeIcon = 'time-outline';
  let textColor = '#FDE68A';

  if (status === 'APPROVED' || isVerified) {
    badgeColor = '#10B981';
    badgeText = 'Verified Organization';
    badgeIcon = 'checkmark-circle';
    textColor = '#A7F3D0';
  } else if (status === 'REJECTED') {
    badgeColor = '#EF4444';
    badgeText = 'Verification Rejected';
    badgeIcon = 'close-circle';
    textColor = '#FECACA';
  } else if (status === 'UNVERIFIED') {
    badgeColor = '#9CA3AF';
    badgeText = 'Not Verified';
    badgeIcon = 'alert-circle-outline';
    textColor = '#E5E7EB';
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      {/* Dark hero header → light status-bar icons (readable on the gradient). */}
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[COLORS.midnight, COLORS.primary]} style={styles.hero}>
        <TouchableOpacity style={styles.notificationBtn} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.heroIcon}>
          <Ionicons name="business" size={32} color={COLORS.accent} />
        </View>
        <Text style={styles.heroTitle}>{org?.name || 'Organization'}</Text>
        <View style={styles.verificationBadge}>
          <Ionicons name={badgeIcon as any} size={16} color={badgeColor} />
          <Text style={[styles.heroSub, { color: textColor }]}>
            {badgeText}
          </Text>
        </View>
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

      {/* Second row — assignment-flow telemetry. Distinguishes routing
          throughput (Assigned this month) from the lawyers' current
          workload (Active consultations). Both derived from the same
          requests list so this adds no new network calls. */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.statCard}
          onPress={() => navigation.navigate('OrgRequests')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-done" size={24} color="#10B981" />
          </View>
          <Text style={styles.statValue}>{assignedThisMonth}</Text>
          <Text style={styles.statLabel}>Assigned this month</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.statCard}
          onPress={() => navigation.navigate('OrgRequests')}
        >
          <View style={[styles.statIcon, { backgroundColor: '#FCE7F3' }]}>
            <Ionicons name="time" size={24} color="#DB2777" />
          </View>
          <Text style={styles.statValue}>{activeAssignments}</Text>
          <Text style={styles.statLabel}>Active consultations</Text>
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
          icon="create-outline"
          label="Edit Profile"
          desc="Update organization details"
          COLORS={COLORS}
          styles={styles}
          onPress={() => navigation.navigate('EditOrgProfile')}
        />

        {status !== 'APPROVED' && status !== 'PENDING' && (
          <MenuItem
            icon="shield-checkmark-outline"
            label="Request Verification"
            desc="Get verified by a court admin"
            COLORS={COLORS}
            styles={styles}
            onPress={() => navigation.navigate('OrgVerificationRequest')}
            highlight
          />
        )}

        <MenuItem
          icon="person-outline"
          label="Organization Profile"
          desc="View your complete profile"
          COLORS={COLORS}
          styles={styles}
          onPress={() => navigation.navigate('OrgProfile')}
        />

        <MenuItem
          icon="calendar-outline"
          label="Calendar"
          desc="Month view of appointment requests"
          COLORS={COLORS}
          styles={styles}
          onPress={() => navigation.navigate('Calendar')}
        />

        <MenuItem
          icon="notifications-outline"
          label="Notifications"
          desc="View all notifications"
          COLORS={COLORS}
          styles={styles}
          onPress={() => navigation.navigate('Notifications')}
        />
      </View>
    </ScrollView>
  );
};

const MenuItem = ({ icon, label, desc, badge, onPress, COLORS, styles, highlight }: any) => (
  <TouchableOpacity style={[styles.menuItem, highlight && styles.menuItemHighlight]} onPress={onPress}>
    <View style={[styles.menuIcon, highlight && { backgroundColor: COLORS.primary + '15' }]}>
      <Ionicons name={icon} size={22} color={highlight ? COLORS.primary : COLORS.primary} />
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
  heroSub: { fontSize: FONT_SIZE.md, marginTop: SPACING.xs },
  verificationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    marginTop: SPACING.sm, backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full,
  },
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
  menuItemHighlight: {
    borderWidth: 1, borderColor: COLORS.primary + '30', backgroundColor: COLORS.primary + '04',
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

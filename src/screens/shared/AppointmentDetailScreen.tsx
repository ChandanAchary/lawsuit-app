import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  Image, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, APPOINTMENT_STATUS_COLORS } from '../../constants';
import { appointmentsApi } from '../../services/api';
import { Appointment, AppointmentStatus } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/Button';

interface Props {
  navigation: any;
  route: { params: { appointmentId: string; appointment?: Appointment } };
}

export const AppointmentDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const { appointmentId, appointment: passedAppt } = route.params;
  const role = useAuthStore((s) => s.user?.role);

  const [appointment, setAppointment] = useState<Appointment | null>(passedAppt || null);
  const [loading, setLoading] = useState(!passedAppt);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAppointment = useCallback(async () => {
    try {
      const { data } = await appointmentsApi.getById(appointmentId);
      setAppointment(data?.appointment || data?.data || data || null);
    } catch {
      if (!appointment) Alert.alert('Error', 'Could not load appointment');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appointmentId]);

  useEffect(() => { fetchAppointment(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchAppointment(); };

  const handleChat = () => {
    if (!appointment) return;
    const isClient = role === 'CLIENT';
    const otherId = isClient ? appointment.lawyerId : appointment.clientId;
    const otherName = isClient ? appointment.lawyer?.name : appointment.client?.name;
    navigation.navigate('ChatScreen', { otherUserId: otherId, name: otherName, appointmentId: appointment.id });
  };

  const handleCancel = () => {
    if (!appointment) return;
    Alert.alert('Cancel Appointment', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: async () => {
        try {
          await appointmentsApi.cancel(appointment.id);
          Alert.alert('Cancelled', 'Appointment has been cancelled.');
          fetchAppointment();
        } catch { Alert.alert('Error', 'Failed to cancel'); }
      }},
    ]);
  };

  const handleAccept = async () => {
    if (!appointment) return;
    try {
      await appointmentsApi.accept(appointment.id);
      Alert.alert('Accepted', 'Appointment confirmed.');
      fetchAppointment();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed');
    }
  };

  const handleReject = () => {
    if (!appointment) return;
    Alert.alert('Reject', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: async () => {
        try {
          await appointmentsApi.reject(appointment.id);
          Alert.alert('Rejected', 'Appointment rejected. Payment refunded.');
          fetchAppointment();
        } catch (err: any) {
          Alert.alert('Error', err.response?.data?.error || 'Failed');
        }
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: COLORS.textMuted }}>Appointment not found</Text>
      </View>
    );
  }

  const isClient = role === 'CLIENT';
  const person = isClient ? appointment.lawyer : appointment.client;
  const personLabel = isClient ? 'Lawyer' : 'Client';
  const statusColor = APPOINTMENT_STATUS_COLORS[appointment.status] || APPOINTMENT_STATUS_COLORS.PENDING;
  const canChat = appointment.status === AppointmentStatus.CONFIRMED ||
    appointment.status === AppointmentStatus.ATTENDED ||
    appointment.status === 'COMPLETED' as any;
  const canCancel = appointment.status === AppointmentStatus.PENDING || appointment.status === AppointmentStatus.CONFIRMED;
  const canAcceptReject = !isClient && appointment.status === AppointmentStatus.PENDING;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusText, { color: statusColor.text }]}>
            {appointment.status.charAt(0) + appointment.status.slice(1).toLowerCase()}
          </Text>
        </View>

        {/* Person Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{personLabel} Details</Text>
          <View style={styles.personRow}>
            <View style={styles.avatarBlock}>
              {(person?.avatar || (person as any)?.avatarUrl) ? (
                <Image source={{ uri: person?.avatar || (person as any)?.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={22} color={COLORS.textMuted} />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.personName}>{person?.name || 'Unknown'}</Text>
              {(person as any)?.email && <Text style={styles.personSub}>{(person as any).email}</Text>}
              {(person as any)?.phone && <Text style={styles.personSub}>{(person as any).phone}</Text>}
              {isClient && appointment.lawyer?.specialization?.[0] && (
                <Text style={styles.personSub}>{appointment.lawyer.specialization.join(', ')}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Schedule Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schedule</Text>
          <InfoRow icon="calendar" label="Date" value={format(new Date(appointment.scheduledAt), 'EEEE, dd MMMM yyyy')} />
          <InfoRow icon="time" label="Time" value={format(new Date(appointment.scheduledAt), 'hh:mm a')} />
          <InfoRow icon="timer" label="Duration" value={`${appointment.durationMins} minutes`} />
          {appointment.notes ? (
            <InfoRow icon="document-text" label="Notes" value={appointment.notes} />
          ) : null}
          {appointment.meetLink ? (
            <TouchableOpacity onPress={() => Linking.openURL(appointment.meetLink!)}>
              <InfoRow icon="videocam" label="Meet Link" value="Join Video Call" isLink />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Payment Card */}
        {appointment.payment && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment Details</Text>
            <InfoRow icon="cash" label="Amount" value={`₹${(appointment.payment.amount / 100).toLocaleString('en-IN')}`} />
            <InfoRow
              icon="checkmark-circle"
              label="Payment Status"
              value={appointment.payment.status.charAt(0) + appointment.payment.status.slice(1).toLowerCase()}
            />
            {appointment.paymentId && (
              <InfoRow icon="receipt" label="Payment ID" value={appointment.paymentId} />
            )}
          </View>
        )}

        {/* Agreement */}
        {appointment.agreementUrl && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Agreement</Text>
            <TouchableOpacity
              style={styles.agreementBtn}
              onPress={() => Linking.openURL(appointment.agreementUrl!).catch(() => Alert.alert('Error', 'Could not open'))}
            >
              <Ionicons name="document-text" size={18} color={COLORS.primary} />
              <Text style={styles.agreementText}>View Agreement Document</Text>
              <Ionicons name="open-outline" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsCard}>
          {canAcceptReject && (
            <View style={styles.actionsRow}>
              <Button title="Accept" onPress={handleAccept} size="lg" style={{ flex: 1, marginRight: 8 }} />
              <Button title="Reject" variant="outline" onPress={handleReject} size="lg" style={{ flex: 1, marginLeft: 8 }} />
            </View>
          )}
          {canChat && (
            <Button
              title="Chat"
              variant="outline"
              onPress={handleChat}
              size="lg"
              icon={<Ionicons name="chatbubble-ellipses" size={16} color={COLORS.primary} />}
            />
          )}
          {canCancel && isClient && (
            <Button
              title="Cancel Appointment"
              variant="outline"
              onPress={handleCancel}
              size="lg"
              style={{ marginTop: 10, borderColor: COLORS.error }}
            />
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

/* ── Info Row helper ── */
const InfoRow: React.FC<{ icon: string; label: string; value: string; isLink?: boolean }> = ({ icon, label, value, isLink }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={16} color={COLORS.textMuted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, marginLeft: SPACING.md }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, isLink && { color: COLORS.primary }]}>{value}</Text>
      </View>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  backBtn: { width: 22 },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.white },

  statusBanner: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl, alignItems: 'center',
  },
  statusText: { fontSize: FONT_SIZE.lg, fontWeight: '800' },

  card: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.lg },

  personRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBlock: { marginRight: SPACING.lg },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  personSub: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },

  infoRow: { flexDirection: 'row', marginBottom: SPACING.md },
  infoLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  infoValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginTop: 1 },

  agreementBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary + '10', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  agreementText: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },

  actionsCard: { marginHorizontal: SPACING.xl, marginTop: SPACING.lg },
  actionsRow: { flexDirection: 'row', marginBottom: 10 },
});

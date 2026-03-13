import { useThemeStore } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity, Linking, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { formatErrorMessage } from '../../utils/formatError';
import { appointmentsApi, casesApi } from '../../services/api';
import { Appointment, AppointmentStatus } from '../../types';
import { AppointmentCard } from '../../components/AppointmentCard';
import { Loading, EmptyState } from '../../components/Common';
import { TabBar } from '../../components/TabBar';
import { BottomSheet } from '../../components/Modals';
import { Button } from '../../components/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Pending' },
  { key: 'attended', label: 'Attended' },
  { key: 'completed', label: 'Completed' },
  { key: 'missed', label: 'Missed' },
  { key: 'cancelled', label: 'Cancelled' },
];


const statusMap: Record<string, AppointmentStatus | undefined> = {
  upcoming: AppointmentStatus.CONFIRMED,
  pending: AppointmentStatus.PENDING,
  attended: AppointmentStatus.ATTENDED,
  missed: AppointmentStatus.MISSED,
  cancelled: AppointmentStatus.CANCELLED,
}; // unused, now client-side filtering


export const LawyerAppointmentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState('all');
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string>('');
  const [rescheduleDate, setRescheduleDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  // Fetch all appointments once
  const fetchAppointments = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await appointmentsApi.getAll();
      setAllAppointments(data.items || data.appointments || data || []);
    } catch {
      setAllAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAppointments(); }, []);

  useEffect(() => {
    const now = new Date();
    let filtered: Appointment[] = [];
    switch (tab) {
      case 'all':
        filtered = allAppointments;
        break;
      case 'upcoming':
        filtered = allAppointments.filter(a =>
          a.status === AppointmentStatus.CONFIRMED &&
          new Date(a.scheduledAt) > now
        );
        break;
      case 'pending':
        filtered = allAppointments.filter(a => a.status === AppointmentStatus.PENDING);
        break;
      case 'attended':
        filtered = allAppointments.filter(a => a.status === AppointmentStatus.ATTENDED);
        break;
      case 'completed':
        filtered = allAppointments.filter(a => a.status === AppointmentStatus.COMPLETED);
        break;
      case 'missed':
        filtered = allAppointments.filter(a => a.status === AppointmentStatus.MISSED);
        break;
      case 'cancelled':
        filtered = allAppointments.filter(a => a.status === AppointmentStatus.CANCELLED);
        break;
      default:
        filtered = allAppointments;
    }
    setAppointments(filtered);
  }, [tab, allAppointments]);

  const handleCancel = async (id: string) => {
    Alert.alert('Cancel Appointment', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: async () => {
        try { await appointmentsApi.cancel(id); fetchAppointments(false); } catch { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  const handleAttend = async (id: string) => {
    try {
      await appointmentsApi.attend(id);
      Alert.alert('Success', 'Marked as attended');
      fetchAppointments(false);
    } catch { Alert.alert('Error', 'Failed to mark as attended'); }
  };

  const handleCreateCase = async (appointment: Appointment) => {
    try {
      await casesApi.create({
        title: `Case from appointment with ${appointment.client?.name || 'Client'}`,
        clientId: appointment.clientId,
        appointmentId: appointment.id,
        category: 'General',
      });
      Alert.alert('Success', 'Case created');
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err.response?.data || err));
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await appointmentsApi.accept(id);
      Alert.alert('Success', 'Appointment accepted');
      fetchAppointments(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err.response?.data || err) || 'Failed to accept');
    }
  };

  const handleReject = async (id: string) => {
    Alert.alert('Reject Appointment', 'Are you sure you want to reject this appointment?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: async () => {
        try {
          await appointmentsApi.reject(id);
          Alert.alert('Success', 'Appointment rejected');
          fetchAppointments(false);
        } catch (err: any) {
          Alert.alert('Error', formatErrorMessage(err.response?.data || err) || 'Failed to reject');
        }
      } },
    ]);
  };

  const openReschedule = (id: string) => {
    setRescheduleId(id);
    setRescheduleDate(new Date());
    setShowReschedule(true);
  };

  const handleReschedule = async () => {
    setRescheduling(true);
    try {
      await appointmentsApi.reschedule(rescheduleId, rescheduleDate.toISOString());
      Alert.alert('Success', 'Appointment rescheduled');
      setShowReschedule(false);
      fetchAppointments(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err.response?.data || err) || 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const handleViewAgreement = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open agreement'));
  };

  const renderItem = ({ item }: { item: Appointment }) => (
    <AppointmentCard
      appointment={item}
      role="LAWYER"
      onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.id, appointment: item })}
      onCancel={item.status === AppointmentStatus.CONFIRMED ? () => handleCancel(item.id) : undefined}
      onAttend={item.status === AppointmentStatus.CONFIRMED ? () => handleAttend(item.id) : undefined}
      onAccept={item.status === AppointmentStatus.PENDING ? () => handleAccept(item.id) : undefined}
      onReject={item.status === AppointmentStatus.PENDING ? () => handleReject(item.id) : undefined}
      onChat={
        item.status === AppointmentStatus.CONFIRMED || item.status === AppointmentStatus.ATTENDED || item.status === 'COMPLETED' as any
          ? () => navigation.navigate('ChatScreen', { otherUserId: item.clientId, name: item.client?.name, appointmentId: item.id })
          : undefined
      }
      onCreateCase={item.status === AppointmentStatus.ATTENDED ? () => handleCreateCase(item) : undefined}
      onReschedule={
        item.status === AppointmentStatus.CONFIRMED || item.status === AppointmentStatus.MISSED
          ? () => openReschedule(item.id) : undefined
      }
      onViewAgreement={item.agreementUrl ? () => handleViewAgreement(item.agreementUrl!) : undefined}
      onJoinVideo={
        item.status === AppointmentStatus.CONFIRMED
          ? () => navigation.navigate('VideoCall', { appointmentId: item.id }) : undefined
      }
      onViewClient={() => navigation.navigate('LawyerClientDetail', { clientId: item.clientId, name: item.client?.name })}
    />
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Appointments</Text>
        <TabBar tabs={TABS} active={tab} onSelect={setTab} variant="filter" onDarkBg />
      </View>
      {loading ? <Loading /> : (
        <FlatList
          data={appointments}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAppointments(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="📅" title={`No ${tab} appointments`} message="Check back later" />}
        />
      )}

      {/* Reschedule Modal */}
      <BottomSheet visible={showReschedule} onClose={() => setShowReschedule(false)} title="Reschedule Appointment">
        <View style={styles.rescheduleContent}>
          <Text style={styles.rescheduleLabel}>Select new date & time</Text>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.datePickerText}>{format(rescheduleDate, 'dd MMM yyyy')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowTimePicker(true)}>
            <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            <Text style={styles.datePickerText}>{format(rescheduleDate, 'hh:mm a')}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={rescheduleDate}
              mode="date"
              minimumDate={new Date()}
              onChange={(_, date) => { setShowDatePicker(false); if (date) setRescheduleDate(date); }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={rescheduleDate}
              mode="time"
              minuteInterval={30}
              onChange={(_, date) => { setShowTimePicker(false); if (date) setRescheduleDate(date); }}
            />
          )}
          <Button title="Confirm Reschedule" onPress={handleReschedule} loading={rescheduling} size="lg" />
        </View>
      </BottomSheet>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.sm,
    backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.white },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  rescheduleContent: { paddingBottom: SPACING.xl },
  rescheduleLabel: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.lg },
  datePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
  },
  datePickerText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
});

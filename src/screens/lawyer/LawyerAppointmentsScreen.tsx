import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, Alert,
} from 'react-native';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { formatErrorMessage } from '../../utils/formatError';
import { appointmentsApi, casesApi } from '../../services/api';
import { Appointment, AppointmentStatus } from '../../types';
import { AppointmentCard } from '../../components/AppointmentCard';
import { Loading, EmptyState } from '../../components/Common';
import { TabBar } from '../../components/TabBar';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Pending' },
  { key: 'attended', label: 'Attended' },
  { key: 'missed', label: 'Missed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusMap: Record<string, AppointmentStatus | undefined> = {
  upcoming: AppointmentStatus.CONFIRMED,
  pending: AppointmentStatus.PENDING,
  attended: AppointmentStatus.ATTENDED,
  missed: AppointmentStatus.MISSED,
  cancelled: AppointmentStatus.CANCELLED,
};

export const LawyerAppointmentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [tab, setTab] = useState('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAppointments = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await appointmentsApi.getAll({ status: statusMap[tab] });
      setAppointments(data.items || data.appointments || data || []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

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

  const renderItem = ({ item }: { item: Appointment }) => (
    <AppointmentCard
      appointment={item}
      role="LAWYER"
      onCancel={item.status === AppointmentStatus.CONFIRMED ? () => handleCancel(item.id) : undefined}
      onAttend={item.status === AppointmentStatus.CONFIRMED ? () => handleAttend(item.id) : undefined}
      onAccept={item.status === AppointmentStatus.PENDING ? () => handleAccept(item.id) : undefined}
      onReject={item.status === AppointmentStatus.PENDING ? () => handleReject(item.id) : undefined}
      onChat={() => navigation.navigate('ChatScreen', { otherUserId: item.clientId, name: item.client?.name })}
      onCreateCase={item.status === AppointmentStatus.ATTENDED ? () => handleCreateCase(item) : undefined}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Appointments</Text>
      </View>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
});

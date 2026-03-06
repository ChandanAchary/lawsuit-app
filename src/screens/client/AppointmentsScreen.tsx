import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { appointmentsApi } from '../../services/api';
import { Appointment, AppointmentStatus } from '../../types';
import { AppointmentCard } from '../../components/AppointmentCard';
import { Loading, EmptyState } from '../../components/Common';
import { TabBar } from '../../components/TabBar';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'attended', label: 'Attended' },
  { key: 'missed', label: 'Missed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusMap: Record<string, AppointmentStatus | undefined> = {
  upcoming: AppointmentStatus.CONFIRMED,
  attended: AppointmentStatus.ATTENDED,
  missed: AppointmentStatus.MISSED,
  cancelled: AppointmentStatus.CANCELLED,
};

export const AppointmentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
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
    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            await appointmentsApi.cancel(id);
            fetchAppointments(false);
          } catch {
            Alert.alert('Error', 'Failed to cancel appointment');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Appointment }) => (
    <AppointmentCard
      appointment={item}
      role="CLIENT"
      onCancel={() => handleCancel(item.id)}
      onChat={() => navigation.navigate('ChatScreen', { otherUserId: item.lawyerId, name: item.lawyer?.name })}
      onViewAgreement={item.agreementUrl ? () => {} : undefined}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Appointments</Text>
      </View>
      <TabBar
        tabs={TABS}
        active={tab}
        onSelect={setTab}
      />
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAppointments(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="📅" title="No Appointments" message={`You don't have any ${tab} appointments yet.`} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
});

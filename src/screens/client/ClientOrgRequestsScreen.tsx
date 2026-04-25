import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { formatDate } from '../../utils/date';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  PENDING: { label: 'Pending', color: '#D97706', bg: '#FEF3C7', icon: 'time' },
  ASSIGNED: { label: 'Assigned', color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-circle' },
  REJECTED: { label: 'Rejected', color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle' },
  CANCELLED: { label: 'Cancelled', color: '#6B7280', bg: '#F3F4F6', icon: 'ban' },
};

export const ClientOrgRequestsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const { data } = await organizationsApi.listClientAppointmentRequests();
      setRequests(data.requests || data.items || data || []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleCancel = (requestId: string) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await organizationsApi.cancelClientAppointmentRequest(requestId);
            Alert.alert('Cancelled', 'Request has been cancelled');
            fetchRequests();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Failed to cancel request');
          }
        },
      },
    ]);
  };

  const renderRequest = ({ item }: { item: any }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    const org = item.organization || {};
    const lawyer = item.assignedLawyer || {};

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.orgIcon}>
            <Ionicons name="business" size={18} color={COLORS.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.orgName}>{org.name || 'Organization'}</Text>
            <Text style={styles.dateText}>{formatDate(item.scheduledAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon as any} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.detailText}>{item.durationMins} minutes</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name={item.meetingType === 'VIDEO_CALL' ? 'videocam-outline' : item.meetingType === 'OFFICE_VISIT' ? 'business-outline' : 'call-outline'} size={14} color={COLORS.textMuted} />
            <Text style={styles.detailText}>{(item.meetingType || '').replace(/_/g, ' ')}</Text>
          </View>
        </View>

        {/* Assigned Lawyer */}
        {item.status === 'ASSIGNED' && lawyer.name && (
          <View style={styles.assignedSection}>
            <Ionicons name="person-circle-outline" size={16} color="#10B981" />
            <Text style={styles.assignedText}>Assigned to: <Text style={{ fontWeight: '700' }}>{lawyer.name}</Text></Text>
          </View>
        )}

        {/* Rejection Reason */}
        {item.status === 'REJECTED' && item.rejectionReason && (
          <View style={styles.rejectionSection}>
            <Text style={styles.rejectionText}>Reason: {item.rejectionReason}</Text>
          </View>
        )}

        {/* Notes */}
        {item.notes && (
          <Text style={styles.notesText} numberOfLines={2}>📝 {item.notes}</Text>
        )}

        {/* Actions */}
        {item.status === 'PENDING' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id)}>
            <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
            <Text style={styles.cancelText}>Cancel Request</Text>
          </TouchableOpacity>
        )}

        {item.status === 'ASSIGNED' && item.appointmentId && (
          <TouchableOpacity
            style={styles.viewAppBtn}
            onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: item.appointmentId })}
          >
            <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
            <Text style={styles.viewAppText}>View Appointment</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Org Requests</Text>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No Requests"
              message="You haven't made any organization appointment requests yet"
            />
          }
        />
      )}
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm, zIndex: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  orgIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  orgName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  dateText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full,
  },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  detailsSection: {
    flexDirection: 'row', gap: SPACING.lg, marginTop: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  detailText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textTransform: 'capitalize' },
  assignedSection: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md,
    backgroundColor: '#D1FAE5', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
  },
  assignedText: { fontSize: FONT_SIZE.sm, color: '#065F46' },
  rejectionSection: {
    marginTop: SPACING.md, backgroundColor: '#FEE2E2', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
  },
  rejectionText: { fontSize: FONT_SIZE.sm, color: '#991B1B', fontStyle: 'italic' },
  notesText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    marginTop: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.error + '10',
  },
  cancelText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.error },
  viewAppBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    marginTop: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary + '10',
  },
  viewAppText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.primary },
});

import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { formatDate } from '../../utils/date';

export const OrgRequestsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [requests, setRequests] = useState<any[]>([]);
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Assign Modal
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [actionType, setActionType] = useState<'ASSIGN' | 'REJECT' | null>(null);
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'wallet'>('razorpay');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [reqRes, lawRes] = await Promise.all([
        organizationsApi.listOrgAppointmentRequests(),
        organizationsApi.listLawyers(),
      ]);
      setRequests(reqRes.data.requests || reqRes.data.items || reqRes.data || []);
      setLawyers(lawRes.data.lawyers || lawRes.data.items || lawRes.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async () => {
    if (!selectedReq || !actionType) return;
    if (actionType === 'ASSIGN' && !selectedLawyerId) return Alert.alert('Required', 'Please select a lawyer');
    setSubmitting(true);
    try {
      if (actionType === 'ASSIGN') {
        await organizationsApi.assignAppointmentRequest(selectedReq.id, {
          lawyerId: selectedLawyerId,
          paymentMethod,
        });
        Alert.alert(
          'Success',
          paymentMethod === 'wallet'
            ? 'Lawyer assigned and client wallet has been charged.'
            : 'Lawyer assigned. The client has been asked to pay online to confirm.',
        );
      } else {
        await organizationsApi.rejectAppointmentRequest(selectedReq.id, { reason });
        Alert.alert('Success', 'Request rejected');
      }
      setSelectedReq(null); setActionType(null); setReason(''); setSelectedLawyerId(''); setPaymentMethod('razorpay');
      fetchData(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to process request');
    } finally { setSubmitting(false); }
  };

  const renderRequest = ({ item }: { item: any }) => {
    const scheduled = item.scheduledAt ? new Date(item.scheduledAt) : null;
    const assignedLawyerName = item.assignedLawyer?.name || null;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.client?.name || 'Client'}</Text>
            <Text style={styles.cardMeta}>Submitted {formatDate(item.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'PENDING' ? '#FEF3C7' : COLORS.surfaceAlt }]}>
            <Text style={[styles.statusText, { color: item.status === 'PENDING' ? '#D97706' : COLORS.text }]}>{item.status}</Text>
          </View>
        </View>

        {/* Schedule & meeting type at-a-glance */}
        <View style={styles.metaRow}>
          {scheduled && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{formatDate(item.scheduledAt)}</Text>
            </View>
          )}
          {!!item.durationMins && (
            <View style={styles.metaItem}>
              <Ionicons name="timer-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{item.durationMins} min</Text>
            </View>
          )}
          {!!item.meetingType && (
            <View style={styles.metaItem}>
              <Ionicons name="videocam-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.metaText}>{String(item.meetingType).replace('_', ' ')}</Text>
            </View>
          )}
        </View>

        {/* Case description — what the client wrote on the booking sheet.
            Surfaced before the Assign / Reject buttons so the org head reads
            the issue before picking a lawyer. */}
        {!!item.notes && (
          <View style={styles.notesBlock}>
            <View style={styles.notesHeader}>
              <Ionicons name="document-text-outline" size={14} color={COLORS.primary} />
              <Text style={styles.notesLabel}>Case description</Text>
            </View>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        {/* If already assigned, show which lawyer handled it. The server
            keeps the request row even after assignment so the org has an
            audit trail of routing decisions. */}
        {assignedLawyerName && (
          <View style={styles.assignedRow}>
            <Ionicons name="person-add" size={14} color={COLORS.success} />
            <Text style={styles.assignedText}>Assigned to {assignedLawyerName}</Text>
          </View>
        )}

        {item.rejectionReason && (
          <Text style={styles.reasonText}>Rejection reason: {item.rejectionReason}</Text>
        )}

        {item.status === 'PENDING' && (
          <View style={styles.cardActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]} onPress={() => { setSelectedReq(item); setActionType('ASSIGN'); }}>
              <Ionicons name="person-add" size={18} color="#10B981" />
              <Text style={[styles.actionText, { color: '#10B981' }]}>Assign Lawyer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => { setSelectedReq(item); setActionType('REJECT'); }}>
              <Ionicons name="close" size={18} color="#EF4444" />
              <Text style={[styles.actionText, { color: '#EF4444' }]}>Reject</Text>
            </TouchableOpacity>
          </View>
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
        <Text style={styles.headerTitle}>Appointment Requests</Text>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="calendar" title="No Requests" message="You have no appointment requests" />}
        />
      )}

      <Modal visible={!!actionType} transparent animationType="slide" onRequestClose={() => { setActionType(null); setSelectedReq(null); setSelectedLawyerId(''); setReason(''); setPaymentMethod('razorpay'); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{actionType === 'ASSIGN' ? 'Assign Lawyer' : 'Reject Request'}</Text>
              <TouchableOpacity onPress={() => { setActionType(null); setSelectedReq(null); setSelectedLawyerId(''); setReason(''); setPaymentMethod('razorpay'); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {actionType === 'ASSIGN' ? (
                <>
                  <Text style={styles.label}>Select a lawyer to handle this request:</Text>
                  {lawyers.length === 0 ? <Text style={styles.errorText}>No lawyers available. Add lawyers to your team first.</Text> : (
                    <View style={styles.lawyerList}>
                      {lawyers.map((l) => (
                        <TouchableOpacity
                          key={l.id}
                          style={[styles.lawyerChip, selectedLawyerId === l.id && styles.lawyerChipActive]}
                          onPress={() => setSelectedLawyerId(l.id)}
                        >
                          <Text style={[styles.lawyerChipText, selectedLawyerId === l.id && styles.lawyerChipTextActive]}>{l.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.label}>How should the client pay?</Text>
                  <View style={styles.paymentRow}>
                    <TouchableOpacity
                      style={[styles.paymentChip, paymentMethod === 'razorpay' && styles.paymentChipActive]}
                      onPress={() => setPaymentMethod('razorpay')}
                    >
                      <Ionicons name="card-outline" size={16} color={paymentMethod === 'razorpay' ? COLORS.white : COLORS.textSecondary} />
                      <Text style={[styles.paymentChipText, paymentMethod === 'razorpay' && styles.paymentChipTextActive]}>Online (Razorpay)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.paymentChip, paymentMethod === 'wallet' && styles.paymentChipActive]}
                      onPress={() => setPaymentMethod('wallet')}
                    >
                      <Ionicons name="wallet-outline" size={16} color={paymentMethod === 'wallet' ? COLORS.white : COLORS.textSecondary} />
                      <Text style={[styles.paymentChipText, paymentMethod === 'wallet' && styles.paymentChipTextActive]}>From client wallet</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.helpText}>
                    {paymentMethod === 'wallet'
                      ? 'The client’s wallet will be charged immediately. Fails if their balance is insufficient.'
                      : 'The client will be notified to pay online before the appointment is confirmed.'}
                  </Text>
                </>
              ) : (
                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Reason for rejection (optional)" value={reason} onChangeText={setReason} multiline placeholderTextColor={COLORS.textMuted} />
              )}
              <Button title="Confirm" onPress={handleAction} loading={submitting} size="lg" disabled={actionType === 'ASSIGN' && !selectedLawyerId} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { marginLeft: SPACING.md, fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight + '20', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  cardMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  reasonText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.md, fontStyle: 'italic' },

  metaRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg,
    marginTop: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },

  notesBlock: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.primary + '08',
    borderRadius: BORDER_RADIUS.lg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  notesLabel: {
    fontSize: FONT_SIZE.xs - 1, fontWeight: '700',
    color: COLORS.primary, letterSpacing: 0.5, textTransform: 'uppercase',
  },
  notesText: { fontSize: FONT_SIZE.sm, color: COLORS.text, lineHeight: 19 },

  assignedRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  assignedText: { fontSize: FONT_SIZE.sm, color: COLORS.success, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg },
  actionText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: SPACING.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.xl, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  modalBody: { padding: SPACING.xl },
  label: { fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md },
  errorText: { color: COLORS.error, fontSize: FONT_SIZE.sm, marginBottom: SPACING.lg },
  lawyerList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl },
  lawyerChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  lawyerChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  lawyerChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  lawyerChipTextActive: { color: COLORS.white },
  paymentRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  paymentChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  paymentChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  paymentChipText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.textSecondary },
  paymentChipTextActive: { color: COLORS.white },
  helpText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.xl, lineHeight: 16 },
  input: { backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md },
});

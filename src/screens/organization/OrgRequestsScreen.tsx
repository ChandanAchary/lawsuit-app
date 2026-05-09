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
  // Docs per request — fetched alongside the requests list. Map by id so
  // each card pulls its own (small) array without re-rendering the world.
  const [docsByRequest, setDocsByRequest] = useState<Record<string, any[]>>({});

  // Assign Modal
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [actionType, setActionType] = useState<'ASSIGN' | 'REJECT' | null>(null);
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [reqRes, lawRes] = await Promise.all([
        organizationsApi.listOrgAppointmentRequests(),
        organizationsApi.listLawyers(),
      ]);
      const reqs = reqRes.data.requests || reqRes.data.items || reqRes.data || [];
      setRequests(reqs);
      setLawyers(lawRes.data.lawyers || lawRes.data.items || lawRes.data || []);

      // Fan-out doc fetches in parallel. Errors are swallowed per-request so
      // a single 4xx doesn't break the whole screen.
      const arr = Array.isArray(reqs) ? reqs : [];
      const docResults = await Promise.all(
        arr.map((r: any) =>
          organizationsApi
            .listOrgRequestDocuments(r.id)
            .then((d) => ({ id: r.id, items: d.data?.items || [] }))
            .catch(() => ({ id: r.id, items: [] })),
        ),
      );
      const map: Record<string, any[]> = {};
      for (const r of docResults) map[r.id] = r.items;
      setDocsByRequest(map);
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
        // Pure task assignment — the client paid at booking time. The
        // lawyer gets the appointment dropped on their queue; the org head
        // will receive notifications as the lawyer accepts / rejects /
        // completes.
        await organizationsApi.assignAppointmentRequest(selectedReq.id, {
          lawyerId: selectedLawyerId,
        });
        Alert.alert(
          'Lawyer Assigned',
          'The lawyer has been notified. You\'ll get an update when they accept or decline.',
        );
      } else {
        await organizationsApi.rejectAppointmentRequest(selectedReq.id, { reason });
        Alert.alert('Success', 'Request rejected');
      }
      setSelectedReq(null); setActionType(null); setReason(''); setSelectedLawyerId('');
      fetchData(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to process request');
    } finally { setSubmitting(false); }
  };

  const renderRequest = ({ item }: { item: any }) => {
    const scheduled = item.scheduledAt ? new Date(item.scheduledAt) : null;
    const assignedLawyerName = item.assignedLawyer?.name || null;
    const docs = docsByRequest[item.id] || [];
    return (
      // Tap-through opens the full lifecycle view (assignment trail,
      // appointment status, payment status, activity timeline).
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('OrgRequestDetail', { requestId: item.id, request: item })}
      >
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

        {/* Supporting documents the client attached at booking. Each row
            taps through to DocumentAiScreen for OCR / summary / Q&A — the
            org head's primary triage tool when picking which lawyer to
            assign. */}
        {docs.length > 0 && (
          <View style={styles.docsBlock}>
            <View style={styles.docsHeader}>
              <Ionicons name="folder-open-outline" size={14} color={COLORS.primary} />
              <Text style={styles.docsLabel}>{docs.length} supporting document{docs.length === 1 ? '' : 's'}</Text>
            </View>
            {docs.map((d: any) => (
              <TouchableOpacity
                key={d.id}
                style={styles.docRow}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('DocumentAi', {
                    documentId: d.id,
                    document: d,
                    contextLabel: 'Booking doc',
                  })
                }
              >
                <Ionicons
                  name={d.mimeType?.startsWith('image/') ? 'image-outline' : 'document-outline'}
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.docRowName} numberOfLines={1}>{d.filename}</Text>
                <Ionicons name="flash-outline" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            ))}
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

        {/* "View details" affordance — visible on every card so the org
            head sees that tapping it opens the lifecycle screen. */}
        <View style={styles.viewDetailRow}>
          <Text style={styles.viewDetailText}>View full details</Text>
          <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
        </View>
      </TouchableOpacity>
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

      <Modal
        visible={!!actionType}
        transparent
        animationType="slide"
        onRequestClose={() => { setActionType(null); setSelectedReq(null); setSelectedLawyerId(''); setReason(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{actionType === 'ASSIGN' ? 'Assign Lawyer' : 'Reject Request'}</Text>
              <TouchableOpacity onPress={() => { setActionType(null); setSelectedReq(null); setSelectedLawyerId(''); setReason(''); }}>
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

                  {/* Payment-method picker removed by request — the
                      assignment immediately becomes a task on the lawyer's
                      queue, and the client is notified separately to pay
                      online. The org head doesn't pick payment. */}
                  <Text style={styles.helpText}>
                    The lawyer will be notified about this assignment and the case will appear in their
                    appointments queue. The client will be asked to pay online to confirm the booking.
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

  docsBlock: { marginTop: SPACING.md, gap: 6 },
  docsHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  docsLabel: {
    fontSize: FONT_SIZE.xs - 1, fontWeight: '700',
    color: COLORS.primary, letterSpacing: 0.5, textTransform: 'uppercase',
  },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  docRowName: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600' },

  viewDetailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, marginTop: SPACING.md,
    paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  viewDetailText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.primary },
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
  helpText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.xl, lineHeight: 16 },
  input: { backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md },
});

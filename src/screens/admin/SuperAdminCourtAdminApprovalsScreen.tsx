import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
  ScrollView, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminApprovalApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate } from '../../utils/date';

// Section 4A — review the queue of self-onboarded court admins. Each entry
// stays locked behind requireCourtAdminAuthorized middleware until approved
// here. Rejection requires a reason; the rejected admin can re-apply.
export const SuperAdminCourtAdminApprovalsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await courtAdminApprovalApi.listPending({ limit: 50 });
      setItems(data?.items || data?.courtAdmins || []);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load pending court admins');
      setItems([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const { data } = await courtAdminApprovalApi.getDetail(id);
      setDetail(data?.courtAdmin || data);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const submit = async () => {
    if (!detail || !actionType) return;
    if (actionType === 'REJECT' && !reason.trim()) {
      return Alert.alert('Required', 'A rejection reason is required.');
    }
    setSubmitting(true);
    try {
      if (actionType === 'APPROVE') {
        await courtAdminApprovalApi.approve(detail.id, reason.trim() ? { notes: reason.trim() } : undefined);
        Alert.alert('Approved', `${detail.name} can now access all court-admin features.`);
      } else {
        await courtAdminApprovalApi.reject(detail.id, { reason: reason.trim() });
        Alert.alert('Rejected', 'The applicant has been notified and may re-apply.');
      }
      setActionType(null); setReason(''); setDetail(null);
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item.id)}>
      <View style={styles.avatarBox}>
        {item.avatarUrl
          ? <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} />
          : <Ionicons name="person" size={20} color={COLORS.primary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>{item.email}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {item.court?.name || 'Court'} · Reg #{item.registrationNumber || '—'}
        </Text>
      </View>
      <View style={styles.pendingBadge}>
        <Text style={styles.pendingText}>PENDING</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Court Admin Approvals</Text>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="✅" title="All caught up" message="No pending court admin applications." />}
        />
      )}

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Application</Text>
              <TouchableOpacity onPress={() => { setDetail(null); setActionType(null); setReason(''); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {detailLoading ? <Loading /> : detail ? (
              <ScrollView contentContainerStyle={styles.modalBody}>
                <Field label="Name" value={detail.name} styles={styles} />
                <Field label="Email" value={detail.email} styles={styles} />
                <Field label="Phone" value={detail.phone || '—'} styles={styles} />
                <Field label="Registration #" value={detail.registrationNumber || '—'} styles={styles} />
                <Field label="Court" value={detail.court?.name || '—'} styles={styles} />
                <Field label="Court address" value={[detail.court?.city, detail.court?.district, detail.court?.state].filter(Boolean).join(', ') || '—'} styles={styles} />
                <Field label="Applied on" value={detail.createdAt ? formatDate(detail.createdAt) : '—'} styles={styles} />
                {detail.rejectionReason ? (
                  <Field label="Prior rejection" value={detail.rejectionReason} styles={styles} />
                ) : null}

                <Text style={styles.sectionLabel}>UPLOADED PROOFS</Text>
                <View style={styles.proofRow}>
                  {detail.idProofUrl ? (
                    <TouchableOpacity style={styles.proofChip} onPress={() => Linking.openURL(detail.idProofUrl)}>
                      <Ionicons name="card-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.proofText}>ID proof</Text>
                    </TouchableOpacity>
                  ) : <Text style={styles.proofMissing}>ID proof not uploaded</Text>}
                  {detail.authorizationProofUrl ? (
                    <TouchableOpacity style={styles.proofChip} onPress={() => Linking.openURL(detail.authorizationProofUrl)}>
                      <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.proofText}>Authorization</Text>
                    </TouchableOpacity>
                  ) : <Text style={styles.proofMissing}>Authorization proof not uploaded</Text>}
                </View>

                {actionType ? (
                  <>
                    <Text style={styles.sectionLabel}>
                      {actionType === 'APPROVE' ? 'APPROVAL NOTE (OPTIONAL)' : 'REJECTION REASON (REQUIRED)'}
                    </Text>
                    <TextInput
                      style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                      value={reason}
                      onChangeText={setReason}
                      placeholder={actionType === 'APPROVE' ? 'Optional note for the audit log' : 'Tell the applicant why'}
                      placeholderTextColor={COLORS.textMuted}
                      multiline
                    />
                    <Button
                      title={actionType === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
                      onPress={submit}
                      loading={submitting}
                      variant={actionType === 'APPROVE' ? 'primary' : 'danger'}
                      size="lg"
                    />
                    <TouchableOpacity onPress={() => { setActionType(null); setReason(''); }} style={styles.cancelBtn}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={styles.actionRow}>
                    <Button title="Approve" onPress={() => setActionType('APPROVE')} variant="primary" size="lg" style={{ flex: 1 }} />
                    <Button title="Reject" onPress={() => setActionType('REJECT')} variant="danger" size="lg" style={{ flex: 1 }} />
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const Field = ({ label, value, styles }: any) => (
  <View style={styles.fieldRow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldValue}>{value}</Text>
  </View>
);

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  avatarBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.primaryLight + '22',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  name: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  sub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  pendingBadge: {
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    backgroundColor: '#FEF3C7', borderRadius: BORDER_RADIUS.full,
  },
  pendingText: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: '#B45309' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '90%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text },
  modalBody: { padding: SPACING.xl, paddingBottom: SPACING.huge },
  fieldRow: { marginBottom: SPACING.md },
  fieldLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5 },
  fieldValue: { fontSize: FONT_SIZE.md, color: C.text, marginTop: 2 },
  sectionLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted,
    letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  proofRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  proofChip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: C.primaryLight + '18', borderRadius: BORDER_RADIUS.full,
  },
  proofText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.primary },
  proofMissing: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontStyle: 'italic' },
  input: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text, marginBottom: SPACING.md,
  },
  actionRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  cancelBtn: { alignItems: 'center', marginTop: SPACING.md },
  cancelText: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontWeight: '600' },
});

export default SuperAdminCourtAdminApprovalsScreen;

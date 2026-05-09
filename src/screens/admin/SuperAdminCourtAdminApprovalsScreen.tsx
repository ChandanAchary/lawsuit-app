import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
  ScrollView, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminApprovalApi, CourtAdminApprovalStatus } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate } from '../../utils/date';

// Section 4A — review the queue of self-onboarded court admins. Each entry
// stays locked behind requireCourtAdminAuthorized middleware until approved
// here. Rejection requires a reason; the rejected admin can re-apply.
//
// The screen now hosts three tabs — Pending / Approved / Rejected — backed by
// the same /admin/court-admins/pending endpoint with a verificationStatus
// query param so super admins can audit history and see prior decisions
// alongside the live queue. Approve/Reject actions are still only meaningful
// from the Pending tab; the history tabs render the same detail modal in
// read-only form.

type TabKey = 'PENDING' | 'APPROVED' | 'REJECTED';

const TAB_TO_STATUS: Record<TabKey, CourtAdminApprovalStatus> = {
  PENDING: 'PENDING_SUPER_ADMIN_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

const TABS: { key: TabKey; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

export const SuperAdminCourtAdminApprovalsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState<TabKey>('PENDING');
  // Per-tab cache so flipping back to a tab doesn't re-trigger the spinner
  // each time. The fetch still runs in the background to keep counts fresh.
  const [itemsByTab, setItemsByTab] = useState<Record<TabKey, any[]>>({
    PENDING: [], APPROVED: [], REJECTED: [],
  });
  const [countsByTab, setCountsByTab] = useState<Record<TabKey, number>>({
    PENDING: 0, APPROVED: 0, REJECTED: 0,
  });
  const [loadingByTab, setLoadingByTab] = useState<Record<TabKey, boolean>>({
    PENDING: true, APPROVED: false, REJECTED: false,
  });
  const [refreshing, setRefreshing] = useState(false);

  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTab = useCallback(async (which: TabKey, showLoader = true) => {
    if (showLoader) {
      setLoadingByTab((m) => ({ ...m, [which]: true }));
    }
    try {
      const { data } = await courtAdminApprovalApi.listPending({
        limit: 50,
        verificationStatus: TAB_TO_STATUS[which],
      });
      const list = data?.items || data?.courtAdmins || [];
      const total = typeof data?.total === 'number' ? data.total : list.length;
      setItemsByTab((m) => ({ ...m, [which]: list }));
      setCountsByTab((m) => ({ ...m, [which]: total }));
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load court admins');
      setItemsByTab((m) => ({ ...m, [which]: [] }));
    } finally {
      setLoadingByTab((m) => ({ ...m, [which]: false }));
    }
  }, []);

  // Initial load — fetch all three tabs up-front so the badge counts are
  // accurate the first time the screen opens. The active tab gets a real
  // spinner; the others quietly fill in behind the scenes.
  useEffect(() => {
    void loadTab('PENDING', true);
    void loadTab('APPROVED', false);
    void loadTab('REJECTED', false);
  }, [loadTab]);

  // Switching tabs: only show the spinner if we don't have a cached list
  // for that tab yet (rare after the initial fan-out, but covers the case
  // where one of the parallel fetches errored).
  const onTabPress = (next: TabKey) => {
    setTab(next);
    if (itemsByTab[next].length === 0 && !loadingByTab[next]) {
      void loadTab(next, true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadTab('PENDING', false),
      loadTab('APPROVED', false),
      loadTab('REJECTED', false),
    ]);
    setRefreshing(false);
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail({ id }); // open the modal immediately with a placeholder so
                      // the user gets feedback while the network request runs
    try {
      const { data } = await courtAdminApprovalApi.getDetail(id);
      setDetail(data?.courtAdmin || data);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load detail');
      setDetail(null);
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
      // After a decision, refresh both Pending (the row leaves) and the
      // destination tab (so it appears in the history immediately).
      void loadTab('PENDING', false);
      void loadTab(actionType === 'APPROVE' ? 'APPROVED' : 'REJECTED', false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    // Each row's badge mirrors the column it lives in. When a re-application
    // bumps a previously-rejected row back into Pending we still show
    // "PENDING" here — the prior rejection metadata surfaces inside the
    // detail modal as "Prior rejection" instead.
    const status: TabKey = tab;
    const subline = status === 'APPROVED' && item.authorizedAt
      ? `Approved · ${formatDate(item.authorizedAt)}`
      : status === 'REJECTED' && item.rejectedAt
        ? `Rejected · ${formatDate(item.rejectedAt)}`
        : `Applied · ${item.createdAt ? formatDate(item.createdAt) : '—'}`;
    return (
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
          <Text style={[styles.sub, styles.subEm]} numberOfLines={1}>{subline}</Text>
        </View>
        <StatusBadge status={status} />
      </TouchableOpacity>
    );
  };

  const data = itemsByTab[tab];
  const isLoading = loadingByTab[tab] && data.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Court Admin Approvals</Text>
      </View>

      {/* Pending / Approved / Rejected tabs. Counts on each pill come from
          the /pending response total field so the super admin sees backlog
          size at a glance. */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = t.key === tab;
          const count = countsByTab[t.key];
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => onTabPress(t.key)}
              style={[styles.tab, active && styles.tabActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              <View style={[styles.tabCount, active && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? <Loading /> : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'PENDING' ? '✅' : tab === 'APPROVED' ? '🎉' : '🗒️'}
              title={
                tab === 'PENDING'
                  ? 'All caught up'
                  : tab === 'APPROVED'
                    ? 'No approvals yet'
                    : 'No rejections yet'
              }
              message={
                tab === 'PENDING'
                  ? 'No pending court admin applications.'
                  : tab === 'APPROVED'
                    ? 'Approved applications will show up here.'
                    : 'Rejected applications will show up here.'
              }
            />
          }
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
            {detailLoading || !detail?.name ? <Loading /> : detail ? (
              <ScrollView contentContainerStyle={styles.modalBody}>
                <View style={styles.detailStatusRow}>
                  <StatusBadge status={statusFromVerification(detail.verificationStatus)} />
                </View>
                <Field label="Name" value={detail.name} styles={styles} />
                <Field label="Email" value={detail.email} styles={styles} />
                <Field label="Phone" value={detail.phone || '—'} styles={styles} />
                <Field label="Registration #" value={detail.registrationNumber || '—'} styles={styles} />
                <Field label="Court" value={detail.court?.name || '—'} styles={styles} />
                <Field label="Court address" value={[detail.court?.city, detail.court?.district, detail.court?.state].filter(Boolean).join(', ') || '—'} styles={styles} />
                <Field label="Applied on" value={detail.createdAt ? formatDate(detail.createdAt) : '—'} styles={styles} />
                {detail.authorizedAt ? (
                  <Field label="Approved on" value={formatDate(detail.authorizedAt)} styles={styles} />
                ) : null}
                {detail.rejectedAt ? (
                  <Field label="Rejected on" value={formatDate(detail.rejectedAt)} styles={styles} />
                ) : null}
                {detail.rejectionReason ? (
                  <Field
                    label={detail.verificationStatus === 'REJECTED' ? 'Rejection reason' : 'Prior rejection'}
                    value={detail.rejectionReason}
                    styles={styles}
                  />
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

                {/* Approve/Reject actions only make sense on a still-pending
                    application. For Approved/Rejected rows the modal stays
                    read-only — the audit log already captures the decision. */}
                {detail.verificationStatus === 'PENDING_SUPER_ADMIN_APPROVAL' ? (
                  actionType ? (
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
                  )
                ) : (
                  <View style={styles.readonlyHint}>
                    <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.readonlyText}>
                      {detail.verificationStatus === 'APPROVED'
                        ? 'This application has already been approved.'
                        : 'This application has been rejected. The applicant may re-apply.'}
                    </Text>
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

// Server's verificationStatus → tab key. Keeps the badge consistent inside
// the detail modal even when it's opened from a tab whose row count was
// stale (e.g. the row was approved on another super-admin's session).
function statusFromVerification(v?: string): TabKey {
  if (v === 'APPROVED') return 'APPROVED';
  if (v === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

const StatusBadge = ({ status }: { status: TabKey }) => {
  const palette: Record<TabKey, { bg: string; fg: string; label: string }> = {
    PENDING: { bg: '#FEF3C7', fg: '#B45309', label: 'PENDING' },
    APPROVED: { bg: '#D1FAE5', fg: '#047857', label: 'APPROVED' },
    REJECTED: { bg: '#FEE2E2', fg: '#B91C1C', label: 'REJECTED' },
  };
  const p = palette[status];
  return (
    <View style={[localBadge.badge, { backgroundColor: p.bg }]}>
      <Text style={[localBadge.text, { color: p.fg }]}>{p.label}</Text>
    </View>
  );
};

const localBadge = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  text: { fontSize: FONT_SIZE.xs, fontWeight: '800' },
});

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

  tabBar: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full, backgroundColor: C.surfaceAlt,
  },
  tabActive: { backgroundColor: C.primary },
  tabLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.textSecondary },
  tabLabelActive: { color: C.white },
  tabCount: {
    minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10,
    backgroundColor: C.white, alignItems: 'center', justifyContent: 'center',
  },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  tabCountText: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textSecondary },
  tabCountTextActive: { color: C.white },

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
  subEm: { fontWeight: '700', color: C.textSecondary },

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
  detailStatusRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: SPACING.md },
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
  readonlyHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    marginTop: SPACING.lg, padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: C.surfaceAlt,
  },
  readonlyText: { flex: 1, fontSize: FONT_SIZE.sm, color: C.textSecondary, lineHeight: 18 },
});

export default SuperAdminCourtAdminApprovalsScreen;

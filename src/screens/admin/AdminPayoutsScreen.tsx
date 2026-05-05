import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal, TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { payoutsApi, PayoutStatus } from '../../services/api';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate, formatTime } from '../../utils/date';
import { useAuthStore } from '../../stores/authStore';

const STATUS_TABS: { key: PayoutStatus | 'all'; label: string }[] = [
  { key: 'PAYABLE', label: 'Ready to pay' },
  { key: 'HELD_BY_PLATFORM', label: 'Held' },
  { key: 'PAID_OUT', label: 'Paid' },
  { key: 'REFUNDED', label: 'Refunded' },
];

const STATUS_COLORS: Record<PayoutStatus, { bg: string; fg: string; label: string }> = {
  HELD_BY_PLATFORM: { bg: '#FEF3C7', fg: '#B45309', label: 'Held' },
  PAYABLE:           { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Ready' },
  PAID_OUT:          { bg: '#D1FAE5', fg: '#047857', label: 'Paid out' },
  REFUNDED:          { bg: '#FEE2E2', fg: '#B91C1C', label: 'Refunded' },
};

type PayoutItem = {
  id: string;
  amount: number;
  currency?: string;
  provider?: string;
  status?: string;
  payoutStatus?: PayoutStatus | null;
  beneficiaryUserId?: string | null;
  beneficiaryType?: 'LAWYER' | 'ORGANIZATION' | null;
  beneficiary?: { id: string; name?: string; email?: string; avatarUrl?: string | null } | null;
  paidOutAt?: string | null;
  createdAt: string;
  appointment?: {
    id: string;
    scheduledAt: string;
    status?: string;
    client?: { id: string; name?: string; email?: string };
    lawyer?: { id: string; name?: string; email?: string };
  } | null;
};

export const AdminPayoutsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const me = useAuthStore((s) => s.user);
  const isSuper = me?.level === 'SUPER_ADMIN';

  const [tab, setTab] = useState<PayoutStatus | 'all'>('PAYABLE');
  const [items, setItems] = useState<PayoutItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [disbursingId, setDisbursingId] = useState<string | null>(null);

  // Dispute / refund modal state. Only Super Admins reach here.
  const [actionTarget, setActionTarget] = useState<PayoutItem | null>(null);
  const [actionType, setActionType] = useState<'REFUND' | 'OPEN_DISPUTE' | 'RESOLVE_DISPUTE' | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [partialAmountInput, setPartialAmountInput] = useState('');
  const [resolutionInput, setResolutionInput] = useState('');
  const [outcomeInput, setOutcomeInput] = useState<'release' | 'refund' | 'split'>('release');
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await payoutsApi.summary();
      setSummary(data?.summary || null);
    } catch {
      setSummary(null);
    }
  }, []);

  const fetchPayouts = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (tab !== 'all') params.payoutStatus = tab;
      const { data } = await payoutsApi.list(params);
      setItems((data?.items as PayoutItem[]) || []);
    } catch (err: any) {
      setItems([]);
      if (err?.response?.status === 403) {
        Alert.alert('Forbidden', 'Only super admins can view booking payouts.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchPayouts();
    fetchSummary();
  }, [fetchPayouts, fetchSummary]);

  const confirmDisburse = (item: PayoutItem) => {
    const beneficiaryLabel = item.beneficiary?.name
      ? `${item.beneficiary.name} (${item.beneficiaryType?.toLowerCase() || 'beneficiary'})`
      : item.beneficiaryType?.toLowerCase() || 'beneficiary';
    Alert.alert(
      'Disburse payment?',
      `₹${item.amount.toLocaleString('en-IN')} will be transferred from the platform wallet to ${beneficiaryLabel}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disburse',
          style: 'default',
          onPress: async () => {
            setDisbursingId(item.id);
            try {
              await payoutsApi.disburse(item.id);
              Alert.alert('Disbursed', 'Funds released to the beneficiary wallet.');
              fetchPayouts(false);
              fetchSummary();
            } catch (err: any) {
              Alert.alert('Error', formatErrorMessage(err) || 'Failed to disburse payment');
            } finally {
              setDisbursingId(null);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: PayoutItem }) => {
    const status = (item.payoutStatus || 'HELD_BY_PLATFORM') as PayoutStatus;
    const colors = STATUS_COLORS[status] || STATUS_COLORS.HELD_BY_PLATFORM;
    const benefName = item.beneficiary?.name
      || (item.beneficiaryType === 'ORGANIZATION' ? 'Organization' : 'Lawyer');
    const benefEmail = item.beneficiary?.email;
    const isOrg = item.beneficiaryType === 'ORGANIZATION';
    const clientName = item.appointment?.client?.name;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.iconBg, { backgroundColor: colors.bg }]}>
            <Ionicons name={isOrg ? 'business-outline' : 'briefcase-outline'} size={20} color={colors.fg} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardAmount}>₹{Number(item.amount).toLocaleString('en-IN')}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              For: {benefName}{benefEmail ? `  ·  ${benefEmail}` : ''}
            </Text>
            {clientName && (
              <Text style={styles.cardMetaSecondary} numberOfLines={1}>
                Paid by: {clientName}
              </Text>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.fg }]}>{colors.label}</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.dateText}>
            {item.paidOutAt
              ? `Paid out ${formatDate(item.paidOutAt)} · ${formatTime(item.paidOutAt)}`
              : `Received ${formatDate(item.createdAt)} · ${formatTime(item.createdAt)}`}
          </Text>
          <Text style={styles.providerText}>
            {(item.provider || 'unknown').toUpperCase()}
          </Text>
        </View>

        {status === 'PAYABLE' && isSuper && (
          <TouchableOpacity
            style={[styles.disburseBtn, disbursingId === item.id && styles.disburseBtnDisabled]}
            disabled={disbursingId === item.id}
            onPress={() => confirmDisburse(item)}
          >
            <Ionicons name="cash-outline" size={16} color={COLORS.white} />
            <Text style={styles.disburseBtnText}>
              {disbursingId === item.id ? 'Disbursing…' : 'Disburse to beneficiary'}
            </Text>
          </TouchableOpacity>
        )}

        {status === 'HELD_BY_PLATFORM' && (
          <Text style={styles.holdNote}>
            Awaiting consultation completion before payout can be released.
          </Text>
        )}

        {isSuper && (status === 'HELD_BY_PLATFORM' || status === 'PAYABLE') && (
          <View style={styles.altActionRow}>
            <TouchableOpacity
              style={styles.altActionBtn}
              onPress={() => openAction(item, 'REFUND')}
            >
              <Ionicons name="arrow-undo-outline" size={14} color="#B45309" />
              <Text style={[styles.altActionText, { color: '#B45309' }]}>Refund</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.altActionBtn}
              onPress={() => openAction(item, 'OPEN_DISPUTE')}
            >
              <Ionicons name="warning-outline" size={14} color="#B91C1C" />
              <Text style={[styles.altActionText, { color: '#B91C1C' }]}>Dispute</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSuper && (item as any).disputeStatus === 'OPEN' && (
          <View style={styles.altActionRow}>
            <TouchableOpacity
              style={[styles.altActionBtn, { backgroundColor: '#DBEAFE' }]}
              onPress={() => openAction(item, 'RESOLVE_DISPUTE')}
            >
              <Ionicons name="hammer-outline" size={14} color="#1D4ED8" />
              <Text style={[styles.altActionText, { color: '#1D4ED8' }]}>Resolve dispute</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const openAction = (item: PayoutItem, type: 'REFUND' | 'OPEN_DISPUTE' | 'RESOLVE_DISPUTE') => {
    setActionTarget(item);
    setActionType(type);
    setReasonInput('');
    setPartialAmountInput('');
    setResolutionInput('');
    setOutcomeInput('release');
    setRefundAmountInput('');
  };

  const closeAction = () => {
    setActionTarget(null);
    setActionType(null);
  };

  const submitAction = async () => {
    if (!actionTarget || !actionType) return;
    try {
      if (actionType === 'REFUND') {
        if (!reasonInput.trim()) return Alert.alert('Required', 'A refund reason is required.');
        const partial = partialAmountInput.trim() ? Number(partialAmountInput) : undefined;
        if (partial !== undefined && (!Number.isFinite(partial) || partial <= 0)) {
          return Alert.alert('Invalid', 'Partial amount must be a positive number.');
        }
        setSubmittingAction(true);
        await payoutsApi.refund(actionTarget.id, { reason: reasonInput.trim(), partialAmount: partial });
        Alert.alert('Refunded', 'The payment has been refunded to the client.');
      } else if (actionType === 'OPEN_DISPUTE') {
        if (!reasonInput.trim()) return Alert.alert('Required', 'A dispute reason is required.');
        setSubmittingAction(true);
        await payoutsApi.openDispute(actionTarget.id, { reason: reasonInput.trim() });
        Alert.alert('Dispute opened', 'This payment is now flagged as disputed.');
      } else {
        if (!resolutionInput.trim()) return Alert.alert('Required', 'A resolution summary is required.');
        const refundAmt = refundAmountInput.trim() ? Number(refundAmountInput) : undefined;
        if (outcomeInput === 'split' && (refundAmt === undefined || !Number.isFinite(refundAmt) || refundAmt <= 0)) {
          return Alert.alert('Invalid', 'Split outcome requires a refund amount.');
        }
        setSubmittingAction(true);
        await payoutsApi.resolveDispute(actionTarget.id, {
          outcome: outcomeInput,
          resolution: resolutionInput.trim(),
          refundAmount: refundAmt,
        });
        Alert.alert('Resolved', 'Dispute resolved.');
      }
      closeAction();
      fetchPayouts(false);
      fetchSummary();
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Action failed');
    } finally {
      setSubmittingAction(false);
    }
  };

  if (!isSuper) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Payouts</Text>
        </View>
        <EmptyState
          icon="🔒"
          title="Super Admins Only"
          message="Only super admins can manage booking payouts."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Payouts</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AdminEscrowLedger')}
          style={styles.ledgerBtn}
          accessibilityLabel="Open ledger and history"
        >
          <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
          <Text style={styles.ledgerBtnText}>Ledger</Text>
        </TouchableOpacity>
      </View>

      {summary && (
        <View style={styles.summaryRow}>
          <SummaryTile
            label="Held"
            color={STATUS_COLORS.HELD_BY_PLATFORM}
            amount={summary.heldByPlatform?.amount}
            count={summary.heldByPlatform?.count}
            styles={styles}
          />
          <SummaryTile
            label="Ready"
            color={STATUS_COLORS.PAYABLE}
            amount={summary.payable?.amount}
            count={summary.payable?.count}
            styles={styles}
          />
          <SummaryTile
            label="Paid"
            color={STATUS_COLORS.PAID_OUT}
            amount={summary.paidOut?.amount}
            count={summary.paidOut?.count}
            styles={styles}
          />
        </View>
      )}

      <TabBar tabs={STATUS_TABS as any} active={tab} onSelect={setTab as any} />

      {loading ? <Loading /> : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchPayouts(false); fetchSummary(); }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="💰"
              title={tab === 'PAYABLE' ? 'No pending payouts' : 'Nothing here'}
              message={
                tab === 'PAYABLE'
                  ? 'Bookings that are completed but not yet disbursed will appear here.'
                  : 'No payments match this filter.'
              }
            />
          }
        />
      )}

      {/* Refund / dispute / resolve modal */}
      <Modal visible={!!actionType} transparent animationType="slide" onRequestClose={closeAction}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {actionType === 'REFUND' ? 'Refund payment'
                  : actionType === 'OPEN_DISPUTE' ? 'Open dispute'
                  : 'Resolve dispute'}
              </Text>
              <TouchableOpacity onPress={closeAction}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.modalSummary}>
                ₹{Number(actionTarget?.amount || 0).toLocaleString('en-IN')} · {actionTarget?.beneficiary?.name || actionTarget?.beneficiaryType || ''}
              </Text>

              {actionType === 'REFUND' && (
                <>
                  <Text style={styles.modalLabel}>REASON (REQUIRED)</Text>
                  <TextInput
                    style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]}
                    value={reasonInput} onChangeText={setReasonInput}
                    placeholder="Why is this payment being refunded?" placeholderTextColor={COLORS.textMuted}
                    multiline
                  />
                  <Text style={styles.modalLabel}>PARTIAL AMOUNT (₹, OPTIONAL — DEFAULTS TO FULL)</Text>
                  <TextInput
                    style={styles.modalInput} value={partialAmountInput}
                    onChangeText={setPartialAmountInput} keyboardType="number-pad"
                    placeholder="e.g. 500" placeholderTextColor={COLORS.textMuted}
                  />
                </>
              )}

              {actionType === 'OPEN_DISPUTE' && (
                <>
                  <Text style={styles.modalLabel}>DISPUTE REASON (REQUIRED)</Text>
                  <TextInput
                    style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                    value={reasonInput} onChangeText={setReasonInput}
                    placeholder="What's the dispute? Goes to the audit log." placeholderTextColor={COLORS.textMuted}
                    multiline
                  />
                </>
              )}

              {actionType === 'RESOLVE_DISPUTE' && (
                <>
                  <Text style={styles.modalLabel}>OUTCOME</Text>
                  <View style={styles.outcomeRow}>
                    {(['release', 'refund', 'split'] as const).map((o) => (
                      <TouchableOpacity
                        key={o}
                        style={[styles.outcomeChip, outcomeInput === o && styles.outcomeChipActive]}
                        onPress={() => setOutcomeInput(o)}
                      >
                        <Text style={[styles.outcomeChipText, outcomeInput === o && { color: '#FFFFFF' }]}>
                          {o.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {outcomeInput === 'split' && (
                    <>
                      <Text style={styles.modalLabel}>REFUND AMOUNT (₹)</Text>
                      <TextInput
                        style={styles.modalInput} value={refundAmountInput}
                        onChangeText={setRefundAmountInput} keyboardType="number-pad"
                        placeholder="Amount to refund — remainder goes to beneficiary"
                        placeholderTextColor={COLORS.textMuted}
                      />
                    </>
                  )}
                  <Text style={styles.modalLabel}>RESOLUTION SUMMARY (REQUIRED)</Text>
                  <TextInput
                    style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                    value={resolutionInput} onChangeText={setResolutionInput}
                    placeholder="Audit-trail explanation of the resolution"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                  />
                </>
              )}

              <Button
                title={actionType === 'REFUND' ? 'Confirm refund'
                  : actionType === 'OPEN_DISPUTE' ? 'Open dispute'
                  : 'Resolve dispute'}
                onPress={submitAction}
                loading={submittingAction}
                variant={actionType === 'OPEN_DISPUTE' ? 'danger' : 'primary'}
                size="lg"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const SummaryTile = ({ label, color, amount, count, styles }: any) => (
  <View style={[styles.summaryTile, { borderColor: color.fg + '30' }]}>
    <Text style={[styles.summaryLabel, { color: color.fg }]}>{label}</Text>
    <Text style={styles.summaryAmount}>
      ₹{Number(amount || 0).toLocaleString('en-IN')}
    </Text>
    <Text style={styles.summaryCount}>{count || 0} payment{(count || 0) === 1 ? '' : 's'}</Text>
  </View>
);

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  ledgerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primaryLight + '20',
    borderRadius: BORDER_RADIUS.full,
  },
  ledgerBtnText: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '800' },

  summaryRow: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  summaryLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  summaryAmount: { fontSize: FONT_SIZE.lg, fontWeight: '900', color: COLORS.text, marginTop: 2 },
  summaryCount: { fontSize: FONT_SIZE.xs - 1, color: COLORS.textMuted, marginTop: 2 },

  list: { padding: SPACING.xl, paddingBottom: 100 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconBg: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardAmount: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  cardMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  cardMetaSecondary: { fontSize: FONT_SIZE.xs - 1, color: COLORS.textMuted, marginTop: 1 },
  badge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '800' },

  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  dateText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  providerText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textSecondary },

  disburseBtn: {
    marginTop: SPACING.md, alignSelf: 'stretch',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  disburseBtnDisabled: { opacity: 0.5 },
  disburseBtnText: { color: COLORS.white, fontWeight: '800', fontSize: FONT_SIZE.sm },

  holdNote: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },

  altActionRow: {
    flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md,
  },
  altActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
  },
  altActionText: { fontSize: FONT_SIZE.xs, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl,
    maxHeight: '92%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  modalBody: { padding: SPACING.xl },
  modalSummary: { fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '700' },
  modalLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: SPACING.xs,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md,
  },
  outcomeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  outcomeChip: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: COLORS.border,
  },
  outcomeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  outcomeChipText: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: COLORS.text },
});

export default AdminPayoutsScreen;

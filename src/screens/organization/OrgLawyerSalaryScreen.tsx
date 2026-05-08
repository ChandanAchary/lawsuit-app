import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { orgLawyerSalaryApi, EntitySalaryConfig, EntitySalaryPreview } from '../../services/api';
import { Loading } from '../../components/Common';
import { Button } from '../../components/Button';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate, formatTime } from '../../utils/date';

// =============================================================================
// OrgLawyerSalaryScreen — performance-based salary control for one lawyer
// in the calling org. Reachable from OrgLawyersScreen via the "Salary" tile.
//
// Mirrors SuperAdminEntitySalaryScreen but swaps the API set:
//   entitySalaryApi   → orgLawyerSalaryApi
// And drops the org-affiliation banner (irrelevant in this surface — every
// lawyer reachable from this screen is by definition in the org).
//
// The platform-admin SuperAdminEntitySalaryScreen now refuses writes for
// lawyers that have an organizationId, so org-affiliated lawyers are
// edited exclusively from here.
// =============================================================================

type RouteParams = {
  lawyerId: string;
  name?: string;
};

type ActionPanel = 'CONFIG' | 'HOLD' | 'RELEASE' | 'PAY' | null;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const monthName = (m: number) => MONTH_NAMES[Math.max(1, Math.min(12, m)) - 1] || '—';

const actionTitle = (a: Exclude<ActionPanel, null>) => ({
  CONFIG: 'Salary configuration',
  HOLD: 'Hold payouts',
  RELEASE: 'Release hold',
  PAY: 'Record this month’s payout',
}[a]);

const actionHelp = (a: Exclude<ActionPanel, null>) => ({
  CONFIG: 'Set the monthly base and the bonus paid per consultation, per case closed, and per case won.',
  HOLD: 'Pauses future payouts. Base salary and bonus rates stay set. Reason is required.',
  RELEASE: 'Resumes payouts. The lawyer reappears in the next payable cycle.',
  PAY: 'Records this cycle’s payout. Idempotent — running it twice in the same month fails server-side.',
}[a]);

export const OrgLawyerSalaryScreen: React.FC<{ navigation: any; route: { params: RouteParams } }>
  = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const lawyerId = route.params?.lawyerId;
  const name = route.params?.name || 'Lawyer';

  const [preview, setPreview] = useState<EntitySalaryPreview | null>(null);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Action modal state
  const [panel, setPanel] = useState<ActionPanel>(null);
  const [submitting, setSubmitting] = useState(false);

  // Config form
  const [baseInput, setBaseInput] = useState('');
  const [bonusConsultInput, setBonusConsultInput] = useState('');
  const [bonusClosedInput, setBonusClosedInput] = useState('');
  const [bonusWonInput, setBonusWonInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  // Pay form
  const [payBonusInput, setPayBonusInput] = useState('');
  const [payDeductInput, setPayDeductInput] = useState('');
  const [payNotesInput, setPayNotesInput] = useState('');

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [previewRes, adjRes, payoutsRes, banksRes] = await Promise.all([
        orgLawyerSalaryApi.preview(lawyerId),
        orgLawyerSalaryApi.adjustmentHistory(lawyerId, 25),
        orgLawyerSalaryApi.payoutHistory(lawyerId, 12),
        orgLawyerSalaryApi.bankAccounts(lawyerId).catch(() => ({ data: { items: [] } })),
      ]);
      setPreview(previewRes.data || null);
      setAdjustments(adjRes.data?.items || []);
      setPayouts(payoutsRes.data?.items || []);
      setBankAccounts(banksRes.data?.items || []);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load salary data');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [lawyerId]);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const openConfig = () => {
    const c = preview?.config;
    setBaseInput(c?.baseSalary != null ? String(c.baseSalary) : '');
    setBonusConsultInput(c?.bonusPerConsultation != null ? String(c.bonusPerConsultation) : '');
    setBonusClosedInput(c?.bonusPerCaseClosed != null ? String(c.bonusPerCaseClosed) : '');
    setBonusWonInput(c?.bonusPerWonCase != null ? String(c.bonusPerWonCase) : '');
    setReasonInput('');
    setPanel('CONFIG');
  };
  const openHold = () => { setReasonInput(''); setPanel('HOLD'); };
  const openRelease = () => { setReasonInput(''); setPanel('RELEASE'); };
  const openPay = () => { setPayBonusInput(''); setPayDeductInput(''); setPayNotesInput(''); setPanel('PAY'); };
  const closePanel = () => {
    setPanel(null);
    setReasonInput(''); setPayBonusInput(''); setPayDeductInput(''); setPayNotesInput('');
  };

  const submit = async () => {
    if (!panel) return;
    setSubmitting(true);
    try {
      if (panel === 'CONFIG') {
        const data: any = { reason: reasonInput.trim() || undefined };
        const numeric = (raw: string) => (raw.trim() === '' ? undefined : Number(raw));
        const base = numeric(baseInput);
        const bc = numeric(bonusConsultInput);
        const bcl = numeric(bonusClosedInput);
        const bw = numeric(bonusWonInput);
        for (const [n, v] of Object.entries({ baseSalary: base, bonusPerConsultation: bc, bonusPerCaseClosed: bcl, bonusPerWonCase: bw })) {
          if (v != null && (!Number.isFinite(v) || (v as number) < 0)) {
            throw new Error(`${n} must be a non-negative number`);
          }
        }
        if (base != null) data.baseSalary = base;
        if (bc != null) data.bonusPerConsultation = bc;
        if (bcl != null) data.bonusPerCaseClosed = bcl;
        if (bw != null) data.bonusPerWonCase = bw;
        await orgLawyerSalaryApi.setConfig(lawyerId, data);
        Alert.alert('Saved', 'Salary configuration updated.');
      } else if (panel === 'HOLD') {
        if (!reasonInput.trim()) throw new Error('A hold reason is required');
        await orgLawyerSalaryApi.hold(lawyerId, { reason: reasonInput.trim() });
        Alert.alert('Held', 'Payouts are now on hold.');
      } else if (panel === 'RELEASE') {
        await orgLawyerSalaryApi.release(lawyerId, reasonInput.trim() ? { reason: reasonInput.trim() } : undefined);
        Alert.alert('Released', 'Payouts resumed.');
      } else if (panel === 'PAY') {
        const bonus = payBonusInput.trim() ? Number(payBonusInput) : undefined;
        const deduct = payDeductInput.trim() ? Number(payDeductInput) : undefined;
        if (bonus != null && (!Number.isFinite(bonus) || bonus < 0)) throw new Error('Bonus must be a non-negative number');
        if (deduct != null && (!Number.isFinite(deduct) || deduct < 0)) throw new Error('Deduction must be a non-negative number');
        await orgLawyerSalaryApi.pay(lawyerId, {
          bonusAmount: bonus,
          deductionAmount: deduct,
          notes: payNotesInput.trim() || undefined,
        });
        Alert.alert('Paid', 'Salary payout recorded.');
      }
      closePanel();
      await load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const config = preview?.config ?? null;
  const cycle = preview?.cycle ?? null;
  const breakdown = preview?.breakdown ?? null;
  const performance = preview?.performance ?? null;
  const isOnHold = !!config?.isOnHold;

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Salary & Payouts</Text>
          <Text style={styles.headerSub}>{name}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
      >
        <View style={styles.explainer}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.explainerText}>
            Salary = monthly base + per-occurrence bonuses for the current cycle.
            Paid from your organisation's wallet.
          </Text>
        </View>

        {/* Status pill */}
        <View style={[styles.statusPill, { backgroundColor: isOnHold ? '#FEE2E2' : '#D1FAE5' }]}>
          <Ionicons
            name={isOnHold ? 'pause-circle' : 'checkmark-circle'}
            size={14}
            color={isOnHold ? '#B91C1C' : '#047857'}
          />
          <Text style={[styles.statusPillText, { color: isOnHold ? '#B91C1C' : '#047857' }]}>
            {isOnHold ? 'PAYOUTS ON HOLD' : 'PAYOUTS ACTIVE'}
          </Text>
        </View>
        {isOnHold && config?.holdReason ? (
          <View style={styles.holdNote}>
            <Text style={styles.holdNoteLabel}>HOLD REASON</Text>
            <Text style={styles.holdNoteText}>{config.holdReason}</Text>
          </View>
        ) : null}

        {/* Cycle preview */}
        {!config ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: SPACING.huge }]}>
            <Ionicons name="cash-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No salary set yet</Text>
            <Text style={styles.emptySub}>Set a base + bonus rates so this lawyer becomes payable.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cycleLabel}>{monthName(cycle?.cycleMonth || 0)} {cycle?.cycleYear} cycle</Text>
            <Text style={styles.amountBig}>
              ₹{(breakdown?.netPayable ?? 0).toLocaleString('en-IN')}
            </Text>
            <Text style={styles.amountSub}>net payable this cycle</Text>

            <View style={styles.breakRow}>
              <BreakRow label="Base" value={config.baseSalary} styles={styles} />
              <BreakRow label="Consult bonus" value={breakdown?.consultationBonus} styles={styles} />
              <BreakRow label="Case-closed bonus" value={breakdown?.caseClosedBonus} styles={styles} />
              <BreakRow label="Case-won bonus" value={breakdown?.caseWonBonus} styles={styles} />
              {breakdown?.adminBonus ? <BreakRow label="Adjustments (+)" value={breakdown.adminBonus} styles={styles} /> : null}
              {breakdown?.adminDeduction ? <BreakRow label="Deductions (−)" value={breakdown.adminDeduction} styles={styles} /> : null}
            </View>

            {performance ? (
              <Text style={styles.perfLine}>
                {performance.consultationCount} consults · {performance.caseClosedCount} closed · {performance.caseWonCount} won
              </Text>
            ) : null}

            {preview?.alreadyPaid ? (
              <View style={styles.paidBanner}>
                <Ionicons name="checkmark-done" size={14} color="#047857" />
                <Text style={styles.paidBannerText}>
                  Already paid for {monthName(cycle?.cycleMonth || 0)} {cycle?.cycleYear}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Bank accounts */}
        <Text style={styles.sectionLabel}>BANK / UPI ACCOUNTS ON FILE</Text>
        <View style={styles.card}>
          {bankAccounts.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: SPACING.lg }}>
              <Ionicons name="warning-outline" size={20} color="#B45309" />
              <Text style={styles.emptyTitle}>No bank account on file</Text>
              <Text style={styles.emptySub}>
                The lawyer hasn't added a bank account or UPI ID yet. Salary credits go to their
                in-app wallet for now.
              </Text>
            </View>
          ) : (
            bankAccounts.map((b: any, idx: number) => (
              <View
                key={b.id}
                style={[styles.bankRow, idx === bankAccounts.length - 1 && { borderBottomWidth: 0 }]}
              >
                <Ionicons
                  name={b.type === 'UPI' ? 'qr-code-outline' : 'card-outline'}
                  size={20}
                  color={COLORS.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bankHolder} numberOfLines={1}>
                    {b.accountHolderName || b.label || (b.type === 'UPI' ? 'UPI' : 'Bank')}
                  </Text>
                  <Text style={styles.bankSub} numberOfLines={1}>
                    {b.type === 'UPI'
                      ? b.upiId || '—'
                      : `${b.bankName || 'Bank'} · ${b.maskedAccountNumber || '—'}`}
                  </Text>
                </View>
                {b.isDefault && (
                  <View style={styles.bankDefaultBadge}>
                    <Text style={styles.bankDefaultText}>DEFAULT</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Actions */}
        <Text style={styles.sectionLabel}>ACTIONS</Text>
        <View style={styles.actionsCard}>
          <ActionTile
            icon="cash-outline"
            label={config ? 'Edit base + bonus rates' : 'Set base + bonus rates'}
            hint={config
              ? `Currently base ₹${(config.baseSalary ?? 0).toLocaleString('en-IN')} + per-occurrence bonuses`
              : 'Initialise the salary so this lawyer becomes payable'}
            onPress={openConfig}
            styles={styles} COLORS={COLORS}
          />
          {isOnHold ? (
            <ActionTile
              icon="play-circle-outline"
              label="Release hold"
              hint="Resume payouts — the lawyer reappears in the next payable cycle"
              onPress={openRelease}
              styles={styles} COLORS={COLORS}
            />
          ) : (
            <ActionTile
              icon="pause-circle-outline"
              label="Hold payouts"
              hint="Pause future payouts without losing the salary configuration"
              onPress={openHold}
              styles={styles} COLORS={COLORS}
              tone="danger"
              disabled={!config}
            />
          )}
          <ActionTile
            icon="checkmark-done-outline"
            label="Record payout"
            hint={preview?.alreadyPaid
              ? 'Already paid for this cycle'
              : 'Pay this month’s salary — idempotent per cycle'}
            onPress={openPay}
            styles={styles} COLORS={COLORS}
            disabled={!config || isOnHold || preview?.alreadyPaid}
            isLast
          />
        </View>

        {/* Recent payouts */}
        <Text style={styles.sectionLabel}>RECENT PAYOUTS</Text>
        {payouts.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Text style={styles.emptyMuted}>No payouts yet.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {payouts.map((p: any, idx: number) => (
              <View key={p.id} style={[styles.payoutRow, idx === payouts.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutTitle}>
                    {monthName(p.cycleMonth)} {p.cycleYear}
                  </Text>
                  <Text style={styles.payoutSub}>{formatDate(p.paidAt)} · {formatTime(p.paidAt)}</Text>
                </View>
                <Text style={styles.payoutAmount}>
                  ₹{Number(p.totalPaid ?? p.netAmount ?? 0).toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent edits */}
        <Text style={styles.sectionLabel}>RECENT CONFIG CHANGES</Text>
        {adjustments.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Text style={styles.emptyMuted}>No adjustments yet.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {adjustments.slice(0, 8).map((a: any, idx: number) => (
              <View key={a.id} style={[styles.adjRow, idx === Math.min(adjustments.length, 8) - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adjTitle}>
                    {a.oldOnHold !== a.newOnHold ? (a.newOnHold ? 'Held' : 'Released') : 'Updated'}
                  </Text>
                  {a.reason ? <Text style={styles.adjSub}>{a.reason}</Text> : null}
                </View>
                <Text style={styles.adjDate}>{formatDate(a.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action modal */}
      <Modal visible={!!panel} transparent animationType="slide" onRequestClose={closePanel}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{panel ? actionTitle(panel) : ''}</Text>
              <TouchableOpacity onPress={closePanel}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalHelp}>{panel ? actionHelp(panel) : ''}</Text>

              {panel === 'CONFIG' && (
                <>
                  <Field label="Monthly base (₹)" value={baseInput} onChangeText={setBaseInput} placeholder="e.g. 50000" styles={styles} COLORS={COLORS} />
                  <Field label="Bonus per consultation (₹)" value={bonusConsultInput} onChangeText={setBonusConsultInput} placeholder="e.g. 250" styles={styles} COLORS={COLORS} />
                  <Field label="Bonus per case closed (₹)" value={bonusClosedInput} onChangeText={setBonusClosedInput} placeholder="e.g. 500" styles={styles} COLORS={COLORS} />
                  <Field label="Bonus per case won (₹)" value={bonusWonInput} onChangeText={setBonusWonInput} placeholder="e.g. 1000" styles={styles} COLORS={COLORS} />
                  <Field label="Reason (optional, audit-logged)" value={reasonInput} onChangeText={setReasonInput} placeholder="e.g. Q3 raise" styles={styles} COLORS={COLORS} multiline />
                </>
              )}
              {panel === 'HOLD' && (
                <Field label="Hold reason (required)" value={reasonInput} onChangeText={setReasonInput} placeholder="e.g. Pending performance review" styles={styles} COLORS={COLORS} multiline />
              )}
              {panel === 'RELEASE' && (
                <Field label="Reason (optional)" value={reasonInput} onChangeText={setReasonInput} placeholder="e.g. Review cleared" styles={styles} COLORS={COLORS} multiline />
              )}
              {panel === 'PAY' && (
                <>
                  <Field label="One-time bonus (₹, optional)" value={payBonusInput} onChangeText={setPayBonusInput} placeholder="e.g. 5000" styles={styles} COLORS={COLORS} />
                  <Field label="One-time deduction (₹, optional)" value={payDeductInput} onChangeText={setPayDeductInput} placeholder="e.g. 1000" styles={styles} COLORS={COLORS} />
                  <Field label="Notes (optional)" value={payNotesInput} onChangeText={setPayNotesInput} placeholder="" styles={styles} COLORS={COLORS} multiline />
                </>
              )}

              <Button title="Confirm" onPress={submit} loading={submitting} size="lg" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Sub-components ------------------------------------------------------------

const BreakRow = ({ label, value, styles }: any) => (
  <View style={styles.breakRowItem}>
    <Text style={styles.breakLabel}>{label}</Text>
    <Text style={styles.breakValue}>₹{Number(value ?? 0).toLocaleString('en-IN')}</Text>
  </View>
);

const ActionTile = ({ icon, label, hint, onPress, styles, COLORS, isLast, tone, disabled }: any) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.actionTile,
      !isLast && styles.actionTileDivider,
      disabled && styles.actionTileDisabled,
    ]}
  >
    <View
      style={[
        styles.actionIcon,
        { backgroundColor: tone === 'danger' ? '#FEE2E2' : COLORS.primary + '20' },
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={tone === 'danger' ? '#B91C1C' : COLORS.primary}
      />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionHint} numberOfLines={2}>{hint}</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const Field = ({ label, value, onChangeText, placeholder, styles, COLORS, multiline }: any) => (
  <View style={{ marginBottom: SPACING.md }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.fieldInput, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textMuted}
      keyboardType={multiline ? 'default' : 'numeric'}
      multiline={multiline}
    />
  </View>
);

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { padding: SPACING.xl, paddingBottom: 120 },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: C.text },
  headerSub: { fontSize: FONT_SIZE.sm, color: C.textMuted, marginTop: 2 },

  explainer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: C.primary + '10', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  explainerText: { flex: 1, fontSize: FONT_SIZE.xs, color: C.textSecondary, lineHeight: 17 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md, paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.lg, marginHorizontal: SPACING.xs,
  },
  statusPillText: { fontSize: FONT_SIZE.xs - 1, fontWeight: '800', letterSpacing: 0.5 },

  holdNote: {
    backgroundColor: '#FEF3C7', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md, marginTop: SPACING.sm,
  },
  holdNoteLabel: { fontSize: FONT_SIZE.xs - 1, fontWeight: '800', color: '#92400E', letterSpacing: 0.5 },
  holdNoteText: { fontSize: FONT_SIZE.sm, color: '#92400E', marginTop: 4 },

  card: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, marginTop: SPACING.sm, ...SHADOWS.sm,
  },
  cycleLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5 },
  amountBig: { fontSize: FONT_SIZE.xxxl, fontWeight: '900', color: C.text, marginTop: 4 },
  amountSub: { fontSize: FONT_SIZE.xs, color: C.textMuted },

  breakRow: { marginTop: SPACING.lg, gap: 6 },
  breakRowItem: { flexDirection: 'row', justifyContent: 'space-between' },
  breakLabel: { fontSize: FONT_SIZE.sm, color: C.textSecondary },
  breakValue: { fontSize: FONT_SIZE.sm, color: C.text, fontWeight: '700' },

  perfLine: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: SPACING.md },

  paidBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md, paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#D1FAE5',
    marginTop: SPACING.md,
  },
  paidBannerText: { fontSize: FONT_SIZE.xs - 1, color: '#047857', fontWeight: '700' },

  sectionLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: '800',
    color: C.textMuted, letterSpacing: 0.5,
    marginTop: SPACING.lg, marginHorizontal: SPACING.xs,
  },

  bankRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  bankHolder: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
  bankSub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  bankDefaultBadge: { backgroundColor: C.primary + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  bankDefaultText: { fontSize: FONT_SIZE.xs - 2, color: C.primary, fontWeight: '800' },

  emptyTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: C.text, marginTop: SPACING.sm },
  emptySub: { fontSize: FONT_SIZE.sm, color: C.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  emptyMuted: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontStyle: 'italic' },

  actionsCard: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    marginTop: SPACING.sm, ...SHADOWS.sm, overflow: 'hidden',
  },
  actionTile: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  actionTileDivider: { borderBottomWidth: 1, borderBottomColor: C.borderLight },
  actionTileDisabled: { opacity: 0.45 },
  actionIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
  actionHint: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2, lineHeight: 16 },

  payoutRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  payoutTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
  payoutSub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  payoutAmount: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.success },

  adjRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  adjTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
  adjSub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  adjDate: { fontSize: FONT_SIZE.xs, color: C.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.white,
    borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl,
    maxHeight: '90%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text },
  modalBody: { padding: SPACING.xl },
  modalHelp: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginBottom: SPACING.lg, lineHeight: 19 },

  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: C.text, marginBottom: 6 },
  fieldInput: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text,
  },
});

export default OrgLawyerSalaryScreen;

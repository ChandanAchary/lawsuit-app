import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import {
  entitySalaryApi,
  EntitySalarySubject,
  EntitySalaryConfig,
  EntitySalaryPreview,
} from '../../services/api';
import { Loading } from '../../components/Common';
import { Button } from '../../components/Button';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate, formatTime } from '../../utils/date';

// =============================================================================
// SuperAdminEntitySalaryScreen — performance-based salary control for one
// lawyer or organisation. Reachable from AdminUserDetail via the
// "Salary & performance" action tile (super-admin only).
//
// What the super admin sees here:
//   1. A live cycle preview — base + per-occurrence bonus breakdown +
//      net payable RIGHT NOW for this calendar month.
//   2. Status pill — PAYOUTS ACTIVE / ON HOLD (with the hold reason).
//   3. Action tiles — set base + bonus rates, hold/release, record payout.
//   4. Recent payouts (snapshot per cycle) and recent config edits.
//
// Org subjects aggregate every lawyer where lawyer.organizationId === id.
// Lawyer subjects use just that one lawyer's appointments + cases.
// =============================================================================

type RouteParams = {
  subject: EntitySalarySubject;
  subjectId: string;
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
  CONFIG: 'Set the monthly base and the bonus paid per consultation, per case closed, and per case won. Each bonus is added once per occurrence within the cycle.',
  HOLD: 'Pauses future payouts. The base salary and bonus rates stay set. The subject won’t appear in the cycle queue until released. Reason is required and goes into the audit log.',
  RELEASE: 'Resumes payouts. The subject reappears in the next payable cycle.',
  PAY: 'Records this cycle’s payout from the platform wallet. Idempotent — running it twice in the same month fails server-side.',
}[a]);

export const SuperAdminEntitySalaryScreen: React.FC<{ navigation: any; route: { params: RouteParams } }>
  = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const subject: EntitySalarySubject = route.params?.subject;
  const subjectId = route.params?.subjectId;
  const name = route.params?.name || (subject === 'LAWYER' ? 'Lawyer' : 'Organization');

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
      // Fire all four reads in parallel — bank accounts is a separate
      // endpoint so the super admin sees where to wire money alongside
      // the cycle preview without a chained-call delay.
      const [previewRes, adjRes, payoutsRes, banksRes] = await Promise.all([
        entitySalaryApi.preview(subject, subjectId),
        entitySalaryApi.adjustmentHistory(subject, subjectId, 25),
        entitySalaryApi.payoutHistory(subject, subjectId, 12),
        entitySalaryApi.bankAccounts(subject, subjectId).catch(() => ({ data: { items: [] } })),
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
  }, [subject, subjectId]);

  useEffect(() => { void load(); }, [load]);

  // Refresh on focus so coming back from actions / other screens reflects
  // the latest cycle state immediately.
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
  const openPay = () => {
    setPayBonusInput(''); setPayDeductInput(''); setPayNotesInput('');
    setPanel('PAY');
  };
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
        for (const [name, v] of Object.entries({ baseSalary: base, bonusPerConsultation: bc, bonusPerCaseClosed: bcl, bonusPerWonCase: bw })) {
          if (v != null && (!Number.isFinite(v) || (v as number) < 0)) {
            throw new Error(`${name} must be a non-negative number`);
          }
        }
        if (base != null) data.baseSalary = base;
        if (bc != null) data.bonusPerConsultation = bc;
        if (bcl != null) data.bonusPerCaseClosed = bcl;
        if (bw != null) data.bonusPerWonCase = bw;
        await entitySalaryApi.setConfig(subject, subjectId, data);
        Alert.alert('Saved', 'Salary configuration updated.');
      } else if (panel === 'HOLD') {
        if (!reasonInput.trim()) throw new Error('A hold reason is required');
        await entitySalaryApi.hold(subject, subjectId, { reason: reasonInput.trim() });
        Alert.alert('Held', 'Payouts are now on hold.');
      } else if (panel === 'RELEASE') {
        await entitySalaryApi.release(subject, subjectId, reasonInput.trim() ? { reason: reasonInput.trim() } : undefined);
        Alert.alert('Released', 'Payouts resumed.');
      } else if (panel === 'PAY') {
        const bonus = payBonusInput.trim() ? Number(payBonusInput) : undefined;
        const deduct = payDeductInput.trim() ? Number(payDeductInput) : undefined;
        if (bonus != null && (!Number.isFinite(bonus) || bonus < 0)) throw new Error('Bonus must be a non-negative number');
        if (deduct != null && (!Number.isFinite(deduct) || deduct < 0)) throw new Error('Deduction must be a non-negative number');
        await entitySalaryApi.pay(subject, subjectId, {
          bonusAmount: bonus,
          deductionAmount: deduct,
          notes: payNotesInput.trim() || undefined,
        });
        Alert.alert('Paid', 'Salary payout recorded.');
      }
      closePanel();
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || err?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header name={name} subject={subject} onBack={() => navigation.goBack()} styles={styles} COLORS={COLORS} />
        <Loading />
      </View>
    );
  }

  const config = preview?.config;
  const cycle = preview?.cycle;
  const breakdown = preview?.breakdown;
  const performance = preview?.performance;
  const isOnHold = !!config?.isOnHold;
  const livePreviewNet = previewNetWithOverrides(preview, payBonusInput, payDeductInput);

  return (
    <View style={styles.container}>
      <Header name={name} subject={subject} onBack={() => navigation.goBack()} styles={styles} COLORS={COLORS} />

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
      >
        {/* Explainer */}
        <View style={styles.explainer}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.explainerText}>
            Salary = monthly base + per-occurrence bonuses for the current cycle.
            {subject === 'ORGANIZATION'
              ? ' Counts aggregate every lawyer in this organization — they don’t double-pay individually.'
              : ' Org-affiliated lawyers are paid through their organization, not individually here.'}
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

        {/* Cycle preview card */}
        {!config ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: SPACING.huge }]}>
            <Ionicons name="cash-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No salary set yet</Text>
            <Text style={styles.emptySub}>
              Set a base salary and bonus rates below to make this {subject.toLowerCase()} payable.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>
              CYCLE — {cycle ? `${monthName(cycle.cycleMonth)} ${cycle.cycleYear}` : '—'}
            </Text>

            <View style={styles.netRow}>
              <Text style={styles.netLabel}>Net payable now</Text>
              <Text style={styles.netValue}>
                ₹{(breakdown?.netPayable ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>

            <View style={styles.divider} />

            <BreakdownLine
              label="Base salary"
              value={`₹${(config.baseSalary ?? 0).toLocaleString('en-IN')}`}
              styles={styles}
            />
            <BreakdownLine
              label={`Consultations · ${performance?.consultationCount ?? 0} × ₹${(config.bonusPerConsultation ?? 0).toLocaleString('en-IN')}`}
              value={`₹${(breakdown?.consultationBonus ?? 0).toLocaleString('en-IN')}`}
              styles={styles}
            />
            <BreakdownLine
              label={`Cases closed · ${performance?.caseClosedCount ?? 0} × ₹${(config.bonusPerCaseClosed ?? 0).toLocaleString('en-IN')}`}
              value={`₹${(breakdown?.caseClosedBonus ?? 0).toLocaleString('en-IN')}`}
              styles={styles}
            />
            <BreakdownLine
              label={`Cases won · ${performance?.caseWonCount ?? 0} × ₹${(config.bonusPerWonCase ?? 0).toLocaleString('en-IN')}`}
              value={`₹${(breakdown?.caseWonBonus ?? 0).toLocaleString('en-IN')}`}
              styles={styles}
            />

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

        {/* Bank accounts — where this subject's salary will be wired.
            Shown right under the cycle preview so the super admin can
            confirm destination at a glance before tapping Record payout. */}
        <Text style={[styles.sectionLabel, { marginHorizontal: SPACING.xs, marginTop: SPACING.lg }]}>
          BANK / UPI ACCOUNTS ON FILE
        </Text>
        <View style={styles.card}>
          {bankAccounts.length === 0 ? (
            <View style={styles.bankEmpty}>
              <Ionicons name="warning-outline" size={20} color="#B45309" />
              <Text style={styles.bankEmptyTitle}>No bank account on file</Text>
              <Text style={styles.bankEmptySub}>
                The {subject.toLowerCase()} hasn’t added a bank account or UPI ID yet.
                Salary credits go to their in-app wallet for now; for off-platform settlements
                ask them to add an account from their Salary analysis screen.
              </Text>
            </View>
          ) : (
            bankAccounts.map((b: any, idx: number) => (
              <View
                key={b.id}
                style={[styles.bankRow, idx === bankAccounts.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={styles.bankIcon}>
                  <Ionicons
                    name={b.type === 'UPI' ? 'qr-code-outline' : 'card-outline'}
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.bankRowTop}>
                    <Text style={styles.bankHolder} numberOfLines={1}>
                      {b.accountHolderName || b.label || (b.type === 'UPI' ? 'UPI account' : 'Bank account')}
                    </Text>
                    {b.isDefault && (
                      <View style={styles.bankDefaultBadge}>
                        <Text style={styles.bankDefaultText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  {b.type === 'UPI' ? (
                    <Text style={styles.bankLine}>UPI · {b.upiId}</Text>
                  ) : (
                    <>
                      <Text style={styles.bankLine}>
                        {b.bankName || 'Bank'} · {b.accountNumber ? `••••${String(b.accountNumber).slice(-4)}` : 'no account number'}
                      </Text>
                      {b.ifscCode ? <Text style={styles.bankSub}>IFSC {b.ifscCode}</Text> : null}
                    </>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Actions — hidden for org-affiliated lawyers. The platform admin
            can still inspect every stat above (config, breakdown, history,
            payouts), but writes are routed through the org head's surface
            (orgLawyerSalaryApi). The server enforces the same guard, so
            this is purely a UX nudge — the admin sees the right context
            instead of getting a 403 mid-flow. */}
        {preview?.lawyerOrganization ? (
          <View style={styles.managedBanner}>
            <Ionicons name="business" size={20} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.managedTitle}>
                Managed by {preview.lawyerOrganization.name}
              </Text>
              <Text style={styles.managedBody}>
                This lawyer is part of an organisation. Their salary is set, held, and paid by their
                organisation — not from the platform wallet. You can still view the cycle preview,
                history, and payouts here, but cannot edit them.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionLabel, { marginHorizontal: SPACING.xs, marginTop: SPACING.lg }]}>ACTIONS</Text>
            <View style={styles.actionsCard}>
              <ActionTile
                icon="cash-outline"
                label={config ? 'Edit base + bonus rates' : 'Set base + bonus rates'}
                hint={config
                  ? `Currently base ₹${(config.baseSalary ?? 0).toLocaleString('en-IN')} + per-occurrence bonuses`
                  : 'Initialise the salary so this subject becomes payable'}
                onPress={openConfig}
                styles={styles} COLORS={COLORS}
              />
              {isOnHold ? (
                <ActionTile
                  icon="play-circle-outline"
                  label="Release hold"
                  hint="Resume payouts — the subject reappears in the next payable cycle"
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
                  : 'Pay this month’s salary from the platform wallet — idempotent per cycle'}
                onPress={openPay}
                styles={styles} COLORS={COLORS}
                disabled={!config || isOnHold || preview?.alreadyPaid}
                isLast
              />
            </View>
          </>
        )}

        {/* Recent payouts */}
        <Text style={[styles.sectionLabel, { marginHorizontal: SPACING.xs, marginTop: SPACING.lg }]}>RECENT PAYOUTS</Text>
        {payouts.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Text style={styles.emptyMuted}>No payouts yet.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {payouts.map((p, idx) => (
              <View key={p.id} style={[styles.histRow, idx === payouts.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histPrimary}>
                    ₹{Number(p.netPaid || 0).toLocaleString('en-IN')} · {monthName(p.cycleMonth)} {p.cycleYear}
                  </Text>
                  <Text style={styles.histSecondary}>
                    Base ₹{Number(p.baseAmount || 0).toLocaleString('en-IN')} · Bonus ₹{(
                      Number(p.consultationBonus || 0) + Number(p.caseClosedBonus || 0) + Number(p.caseWonBonus || 0) + Number(p.bonusAmount || 0)
                    ).toLocaleString('en-IN')}
                    {p.deductionAmount ? ` · −₹${Number(p.deductionAmount).toLocaleString('en-IN')}` : ''}
                  </Text>
                  <Text style={styles.histMuted}>
                    {p.createdAt ? `Paid ${formatDate(p.createdAt)} · ${formatTime(p.createdAt)}` : ''}
                    {p.providerPayoutId ? ` · UTR ${p.providerPayoutId}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent adjustments */}
        <Text style={[styles.sectionLabel, { marginHorizontal: SPACING.xs, marginTop: SPACING.lg }]}>RECENT ADJUSTMENTS</Text>
        {adjustments.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center' }]}>
            <Text style={styles.emptyMuted}>No config edits yet.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {adjustments.map((a, idx) => (
              <View key={a.id} style={[styles.histRow, idx === adjustments.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histPrimary}>{adjustmentSummary(a)}</Text>
                  {a.reason ? <Text style={styles.histSecondary}>{a.reason}</Text> : null}
                  <Text style={styles.histMuted}>
                    {a.createdAt ? `${formatDate(a.createdAt)} · ${formatTime(a.createdAt)}` : ''}
                  </Text>
                </View>
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
            <ScrollView contentContainerStyle={styles.modalBody}>
              {panel ? <Text style={styles.actionHelp}>{actionHelp(panel)}</Text> : null}

              {panel === 'CONFIG' && (
                <>
                  <Text style={styles.label}>BASE SALARY (₹ / MONTH)</Text>
                  <TextInput
                    style={styles.input} value={baseInput} onChangeText={setBaseInput}
                    keyboardType="number-pad" placeholder="e.g. 25000"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={styles.label}>BONUS PER CONSULTATION (₹)</Text>
                  <TextInput
                    style={styles.input} value={bonusConsultInput} onChangeText={setBonusConsultInput}
                    keyboardType="number-pad" placeholder="e.g. 500"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={styles.helpInline}>Added once per Appointment with status COMPLETED in the cycle.</Text>

                  <Text style={styles.label}>BONUS PER CASE CLOSED (₹)</Text>
                  <TextInput
                    style={styles.input} value={bonusClosedInput} onChangeText={setBonusClosedInput}
                    keyboardType="number-pad" placeholder="e.g. 1000"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={styles.helpInline}>Added per Case that hit a terminal status (CLOSED / WON / LOST / SETTLED) in the cycle.</Text>

                  <Text style={styles.label}>EXTRA BONUS PER WON CASE (₹)</Text>
                  <TextInput
                    style={styles.input} value={bonusWonInput} onChangeText={setBonusWonInput}
                    keyboardType="number-pad" placeholder="e.g. 2000"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={styles.helpInline}>Added on TOP of "case closed" for cases that ended in WON or SETTLED.</Text>

                  <Text style={styles.label}>NOTE / REASON (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                    value={reasonInput} onChangeText={setReasonInput}
                    placeholder="Goes into the audit log"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                  />
                </>
              )}

              {panel === 'HOLD' && (
                <>
                  <Text style={styles.label}>HOLD REASON (REQUIRED)</Text>
                  <TextInput
                    style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                    value={reasonInput} onChangeText={setReasonInput}
                    placeholder="Why are payouts being paused?"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                  />
                </>
              )}

              {panel === 'RELEASE' && (
                <>
                  <Text style={styles.label}>NOTE (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                    value={reasonInput} onChangeText={setReasonInput}
                    placeholder="Optional note for the audit log"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                  />
                </>
              )}

              {panel === 'PAY' && (
                <>
                  <Text style={styles.label}>ONE-OFF BONUS (₹, OPTIONAL)</Text>
                  <TextInput
                    style={styles.input} value={payBonusInput} onChangeText={setPayBonusInput}
                    keyboardType="number-pad" placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={styles.label}>DEDUCTION (₹, OPTIONAL)</Text>
                  <TextInput
                    style={styles.input} value={payDeductInput} onChangeText={setPayDeductInput}
                    keyboardType="number-pad" placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>Net payout</Text>
                    <Text style={styles.previewValue}>₹{livePreviewNet.toLocaleString('en-IN')}</Text>
                  </View>
                  <Text style={styles.label}>NOTE (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                    value={payNotesInput} onChangeText={setPayNotesInput}
                    placeholder="Goes onto the payout row"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                  />
                </>
              )}

              <Button
                title={panel === 'CONFIG' ? 'Save configuration'
                  : panel === 'HOLD' ? 'Hold payouts'
                  : panel === 'RELEASE' ? 'Release hold'
                  : 'Record payout'}
                onPress={submit}
                loading={submitting}
                variant={panel === 'HOLD' ? 'danger' : 'primary'}
                size="lg"
              />
              <TouchableOpacity onPress={closePanel} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function previewNetWithOverrides(preview: EntitySalaryPreview | null, bonusStr: string, deductStr: string): number {
  if (!preview?.config) return 0;
  const baseN = preview.breakdown?.netPayable ?? 0; // this already includes consult+closed+won bonuses
  // breakdown.netPayable from the server preview is computed WITHOUT
  // adminBonus/adminDeduction (we don't pass them on preview). Add them on
  // the client so the preview line in the Pay modal updates as the super
  // admin types overrides.
  const bonusN = Number(bonusStr) || 0;
  const deductN = Number(deductStr) || 0;
  return Math.max(0, baseN + Math.max(0, bonusN) - Math.max(0, deductN));
}

function adjustmentSummary(a: any): string {
  const parts: string[] = [];
  if (a.oldOnHold !== a.newOnHold) {
    parts.push(a.newOnHold ? 'Held' : 'Released');
  }
  if (a.oldBaseSalary !== a.newBaseSalary) {
    parts.push(`Base ₹${Number(a.oldBaseSalary || 0).toLocaleString('en-IN')} → ₹${Number(a.newBaseSalary || 0).toLocaleString('en-IN')}`);
  }
  if (a.oldRates && a.newRates) {
    const before = a.oldRates as any, after = a.newRates as any;
    const dimensions: Array<{ key: keyof typeof before; label: string }> = [
      { key: 'bonusPerConsultation', label: 'Consult' },
      { key: 'bonusPerCaseClosed',   label: 'Closed'  },
      { key: 'bonusPerWonCase',      label: 'Won'     },
    ];
    for (const d of dimensions) {
      const b = Number(before[d.key] ?? 0);
      const af = Number(after[d.key] ?? 0);
      if (b !== af) parts.push(`${d.label} ₹${b}→₹${af}`);
    }
  } else if (a.newRates) {
    parts.push('Rates set');
  }
  return parts.length ? parts.join(' · ') : 'Configuration updated';
}

// ============================================================================
// Sub-components
// ============================================================================

const Header = ({ name, subject, onBack, styles, COLORS }: any) => (
  <View style={styles.headerBar}>
    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
      <Ionicons name="arrow-back" size={22} color={COLORS.text} />
    </TouchableOpacity>
    <View style={{ flex: 1 }}>
      <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
      <Text style={styles.headerSub}>{subject === 'LAWYER' ? 'Lawyer' : 'Organization'} · Salary & performance</Text>
    </View>
  </View>
);

const BreakdownLine = ({ label, value, styles }: any) => (
  <View style={styles.breakdownLine}>
    <Text style={styles.breakdownLabel} numberOfLines={1}>{label}</Text>
    <Text style={styles.breakdownValue}>{value}</Text>
  </View>
);

const ActionTile = ({ icon, label, hint, onPress, styles, COLORS, tone, disabled, isLast }: any) => {
  const color = disabled ? COLORS.textMuted : (tone === 'danger' ? '#B91C1C' : COLORS.primary);
  return (
    <TouchableOpacity
      style={[styles.actionTile, !isLast && styles.actionTileDivider, disabled && styles.actionTileDisabled]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <Ionicons name={icon} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTileText, { color }]}>{label}</Text>
        {hint ? <Text style={styles.actionTileHint}>{hint}</Text> : null}
      </View>
      {!disabled && <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />}
    </TouchableOpacity>
  );
};

// ============================================================================
// Styles
// ============================================================================

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: C.text },
  headerSub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  body: { padding: SPACING.xl, paddingBottom: 120 },

  explainer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: C.primaryLight + '15', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  explainerText: { flex: 1, fontSize: FONT_SIZE.xs, color: C.textSecondary, lineHeight: 16 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  holdNote: {
    backgroundColor: '#FEE2E2', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md, marginTop: SPACING.sm,
  },
  holdNoteLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: '#B91C1C', letterSpacing: 0.5 },
  holdNoteText: { fontSize: FONT_SIZE.sm, color: '#991B1B', marginTop: 2 },

  card: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginTop: SPACING.md, ...SHADOWS.sm,
  },
  sectionLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5 },

  netRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: SPACING.sm,
  },
  netLabel: { fontSize: FONT_SIZE.sm, color: C.textSecondary },
  netValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },

  divider: { height: 1, backgroundColor: C.borderLight, marginVertical: SPACING.md },

  breakdownLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, gap: SPACING.sm,
  },
  breakdownLabel: { flex: 1, fontSize: FONT_SIZE.sm, color: C.textSecondary },
  breakdownValue: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },

  paidBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#D1FAE5', borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginTop: SPACING.md,
  },
  paidBannerText: { fontSize: FONT_SIZE.xs, color: '#047857', fontWeight: '700' },

  emptyTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text, marginTop: SPACING.sm },
  emptySub: { fontSize: FONT_SIZE.sm, color: C.textMuted, marginTop: 4, textAlign: 'center', paddingHorizontal: SPACING.md },
  emptyMuted: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontStyle: 'italic' },

  managedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    backgroundColor: C.primary + '0E', borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginTop: SPACING.lg,
    borderLeftWidth: 4, borderLeftColor: C.primary,
  },
  managedTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  managedBody: {
    fontSize: FONT_SIZE.sm, color: C.textSecondary,
    lineHeight: 19, marginTop: 4,
  },

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
  actionTileText: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  actionTileHint: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  bankEmpty: { alignItems: 'center', paddingVertical: SPACING.md, gap: SPACING.xs },
  bankEmptyTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text, marginTop: SPACING.xs },
  bankEmptySub: { fontSize: FONT_SIZE.xs, color: C.textMuted, textAlign: 'center', paddingHorizontal: SPACING.sm, lineHeight: 16 },

  bankRow: {
    flexDirection: 'row', gap: SPACING.md,
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  bankIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.primaryLight + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  bankRowTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  bankHolder: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  bankDefaultBadge: {
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    backgroundColor: C.primary, borderRadius: BORDER_RADIUS.full,
  },
  bankDefaultText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  bankLine: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: 2 },
  bankSub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  histRow: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  histPrimary: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  histSecondary: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: 2 },
  histMuted: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '92%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text },
  modalBody: { padding: SPACING.xl },
  actionHelp: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginBottom: SPACING.md, lineHeight: 18 },

  label: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: SPACING.xs },
  input: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text,
  },
  helpInline: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 4, marginBottom: SPACING.sm },

  previewBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.primaryLight + '12', borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    marginTop: SPACING.md, marginBottom: SPACING.sm,
  },
  previewLabel: { fontSize: FONT_SIZE.sm, color: C.textSecondary, fontWeight: '700' },
  previewValue: { fontSize: FONT_SIZE.lg, fontWeight: '900', color: C.primary },

  cancelBtn: { alignItems: 'center', marginTop: SPACING.md },
  cancelText: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontWeight: '600' },
});

export default SuperAdminEntitySalaryScreen;

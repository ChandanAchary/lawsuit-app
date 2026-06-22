import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { selfSalaryApi, courtAdminApi } from '../../services/api';
import { Loading } from '../../components/Common';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { UserRole } from '../../types';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate, formatTime } from '../../utils/date';

// =============================================================================
// MySalaryScreen — shared "Salary analysis" surface for the LAWYER and
// ORGANIZATION roles. Reachable from each role's profile screen.
//
// Shows the same bundle the super admin sees in the admin salary screen:
//   1. Live cycle preview — base + per-occurrence bonuses + net payable.
//   2. Performance breakdown for the current calendar month.
//   3. Recent payouts (last 12 cycles).
//   4. Bank accounts the salary will be routed to. Tapping "Manage" opens
//      the existing BankAccountsScreen — no duplicate forms.
// =============================================================================

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const monthName = (m: number) => MONTH_NAMES[Math.max(1, Math.min(12, m)) - 1] || '—';

const maskAccountNumber = (acc?: string | null) => {
  if (!acc) return '—';
  const s = String(acc);
  if (s.length <= 4) return s;
  return `••••${s.slice(-4)}`;
};

export const MySalaryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const user = useAuthStore((s) => s.user);
  const isOrg = user?.role === UserRole.ORGANIZATION;
  const isCourtAdmin = user?.role === UserRole.COURT_ADMIN;
  const subjectLabel = isCourtAdmin ? 'Court Admin' : isOrg ? 'Organization' : 'Lawyer';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = isCourtAdmin
        ? await courtAdminApi.getMySalary()
        : isOrg
          ? await selfSalaryApi.getMyOrganizationSalary()
          : await selfSalaryApi.getMyLawyerSalary();
      // Court-admin endpoint wraps in { data }, lawyer/org return flat.
      setData((res.data?.data ?? res.data) || null);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load salary');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [isOrg, isCourtAdmin]);

  useEffect(() => { void load(); }, [load]);

  // Pull fresh data on focus so adding a new bank account in the bank
  // accounts screen reflects on return without a manual refresh.
  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  if (loading) return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} subtitle={`${subjectLabel} · Salary analysis`} styles={styles} COLORS={COLORS} />
      <Loading />
    </View>
  );

  // ── Court-admin salary: a simpler shape than lawyer/org. Court admins
  // earn a flat monthly base (no per-consultation/case bonuses), so the
  // server returns { config: { baseSalary, isHeld, holdReason }, cycles }.
  if (isCourtAdmin) {
    const caConfig = data?.config;
    const caCycles: any[] = data?.cycles || [];
    const caHeld = !!caConfig?.isHeld;
    return (
      <View style={styles.container}>
        <Header onBack={() => navigation.goBack()} subtitle="Court Admin · Salary" styles={styles} COLORS={COLORS} />
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
        >
          {!caConfig ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cash-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No salary configured yet</Text>
              <Text style={styles.emptySub}>
                Your base salary will appear here once a super admin sets it up.
              </Text>
            </View>
          ) : (
            <>
              <View style={[styles.statusPill, { backgroundColor: caHeld ? '#FEE2E2' : '#D1FAE5' }]}>
                <Ionicons name={caHeld ? 'pause-circle' : 'checkmark-circle'} size={14} color={caHeld ? '#B91C1C' : '#047857'} />
                <Text style={[styles.statusPillText, { color: caHeld ? '#B91C1C' : '#047857' }]}>
                  {caHeld ? 'SALARY ON HOLD' : 'SALARY ACTIVE'}
                </Text>
              </View>
              {caHeld && caConfig?.holdReason ? (
                <View style={styles.holdNote}>
                  <Text style={styles.holdNoteLabel}>WHY SALARY IS PAUSED</Text>
                  <Text style={styles.holdNoteText}>{caConfig.holdReason}</Text>
                </View>
              ) : null}

              <View style={styles.card}>
                <Text style={styles.sectionLabel}>CURRENT BASE SALARY</Text>
                <Text style={[styles.netValue, { marginTop: SPACING.sm }]}>
                  ₹{Number(caConfig.baseSalary ?? 0).toLocaleString('en-IN')}
                </Text>
                <Text style={styles.previewHint}>Paid monthly per platform salary cycle.</Text>
              </View>
            </>
          )}

          <Text style={[styles.sectionLabel, { marginHorizontal: SPACING.xs, marginTop: SPACING.lg }]}>
            RECENT CYCLES
          </Text>
          {caCycles.length === 0 ? (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: SPACING.lg }]}>
              <Text style={styles.emptyMuted}>No salary cycles yet.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {caCycles.map((c: any, idx: number) => (
                <View key={c.id || idx} style={[styles.histRow, idx === caCycles.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.histRowTop}>
                    <Text style={styles.histAmount}>₹{Number(c.amount || 0).toLocaleString('en-IN')}</Text>
                    <View style={[styles.cycleStatusPill, { backgroundColor: c.status === 'PAID' ? '#D1FAE5' : '#FEF3C7' }]}>
                      <Text style={[styles.cycleStatusText, { color: c.status === 'PAID' ? '#047857' : '#B45309' }]}>
                        {c.status || 'PENDING'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.histLine}>
                    {c.cycleStart ? formatDate(c.cycleStart) : '—'} — {c.cycleEnd ? formatDate(c.cycleEnd) : '—'}
                  </Text>
                  {c.paidAt ? (
                    <Text style={styles.histMeta}>Paid {formatDate(c.paidAt)} · {formatTime(c.paidAt)}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* Bank accounts — destination for salary payouts */}
          <View style={styles.card}>
            <View style={styles.bankHeader}>
              <Text style={styles.sectionLabel}>BANK / UPI ACCOUNTS</Text>
              <TouchableOpacity style={styles.manageBtn} onPress={() => navigation.navigate('BankAccounts')}>
                <Ionicons name="add" size={14} color={COLORS.primary} />
                <Text style={styles.manageBtnText}>Manage</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.emptyMuted}>
              Add a bank or UPI account so the super admin knows where to send your salary.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  const config = data?.config;
  const cycle = data?.cycle;
  const breakdown = data?.breakdown;
  const performance = data?.performance;
  const payouts = data?.payouts || [];
  const bankAccounts = data?.bankAccounts || [];
  const isOnHold = !!config?.isOnHold;
  const defaultAccount = bankAccounts.find((b: any) => b.isDefault) || bankAccounts[0];

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} subtitle={`${subjectLabel} · Salary analysis`} styles={styles} COLORS={COLORS} />

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
      >
        {/* No-config state — common case for new lawyers/orgs whose super
            admin hasn't set their salary yet. Render a friendly empty state
            instead of zeros so they don't think the system is broken. */}
        {!config ? (
          <View style={styles.emptyCard}>
            <Ionicons name="cash-outline" size={36} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No salary configured yet</Text>
            <Text style={styles.emptySub}>
              Your salary structure will appear here once a super admin sets it up.
              You'll see your monthly base, per-consultation and per-case bonuses, and the live
              earnings for the current cycle.
            </Text>
          </View>
        ) : (
          <>
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
                <Text style={styles.holdNoteLabel}>WHY PAYOUTS ARE PAUSED</Text>
                <Text style={styles.holdNoteText}>{config.holdReason}</Text>
              </View>
            ) : null}

            {/* This cycle */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>
                THIS CYCLE — {cycle ? `${monthName(cycle.cycleMonth)} ${cycle.cycleYear}` : '—'}
              </Text>
              <View style={styles.netRow}>
                <Text style={styles.netLabel}>{data?.alreadyPaid ? 'Paid this cycle' : 'Earnings so far'}</Text>
                <Text style={styles.netValue}>₹{Number(breakdown?.netPayable ?? 0).toLocaleString('en-IN')}</Text>
              </View>

              <View style={styles.divider} />

              <BreakdownLine
                label="Base salary"
                value={`₹${Number(config.baseSalary ?? 0).toLocaleString('en-IN')}`}
                styles={styles}
              />
              <BreakdownLine
                label={`Consultations · ${performance?.consultationCount ?? 0} × ₹${Number(config.bonusPerConsultation ?? 0).toLocaleString('en-IN')}`}
                value={`₹${Number(breakdown?.consultationBonus ?? 0).toLocaleString('en-IN')}`}
                styles={styles}
              />
              <BreakdownLine
                label={`Cases closed · ${performance?.caseClosedCount ?? 0} × ₹${Number(config.bonusPerCaseClosed ?? 0).toLocaleString('en-IN')}`}
                value={`₹${Number(breakdown?.caseClosedBonus ?? 0).toLocaleString('en-IN')}`}
                styles={styles}
              />
              <BreakdownLine
                label={`Cases won · ${performance?.caseWonCount ?? 0} × ₹${Number(config.bonusPerWonCase ?? 0).toLocaleString('en-IN')}`}
                value={`₹${Number(breakdown?.caseWonBonus ?? 0).toLocaleString('en-IN')}`}
                styles={styles}
              />

              {data?.alreadyPaid ? (
                <View style={styles.paidBanner}>
                  <Ionicons name="checkmark-done" size={14} color="#047857" />
                  <Text style={styles.paidBannerText}>
                    Salary for {cycle ? `${monthName(cycle.cycleMonth)} ${cycle.cycleYear}` : 'this cycle'} has been paid.
                  </Text>
                </View>
              ) : (
                <Text style={styles.previewHint}>
                  This is the live preview for the current cycle. Final payout will reflect any
                  adjustments your super admin makes when recording the payout.
                </Text>
              )}
            </View>

            {/* Salary structure — read-only reminder of the rates */}
            {(config.bonusPerConsultation || config.bonusPerCaseClosed || config.bonusPerWonCase) ? (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>YOUR SALARY STRUCTURE</Text>
                <BreakdownLine label="Monthly base" value={`₹${Number(config.baseSalary).toLocaleString('en-IN')}`} styles={styles} />
                <BreakdownLine label="Per consultation" value={`₹${Number(config.bonusPerConsultation).toLocaleString('en-IN')}`} styles={styles} />
                <BreakdownLine label="Per case closed" value={`₹${Number(config.bonusPerCaseClosed).toLocaleString('en-IN')}`} styles={styles} />
                <BreakdownLine label="Per case won (extra)" value={`₹${Number(config.bonusPerWonCase).toLocaleString('en-IN')}`} styles={styles} />
              </View>
            ) : null}
          </>
        )}

        {/* Bank accounts — links to the existing BankAccountsScreen for
            adding / editing. Just preview the default here so the user can
            confirm the destination at a glance. */}
        <View style={styles.card}>
          <View style={styles.bankHeader}>
            <Text style={styles.sectionLabel}>BANK / UPI ACCOUNTS</Text>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={() => navigation.navigate('BankAccounts')}
            >
              <Ionicons name="add" size={14} color={COLORS.primary} />
              <Text style={styles.manageBtnText}>Manage</Text>
            </TouchableOpacity>
          </View>

          {bankAccounts.length === 0 ? (
            <View style={styles.bankEmpty}>
              <Ionicons name="card-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.bankEmptyText}>
                No bank account or UPI ID added yet.
              </Text>
              <Text style={styles.bankEmptySub}>
                Add one so the super admin knows where to send your salary.
              </Text>
              <TouchableOpacity
                style={styles.addAccountBtn}
                onPress={() => navigation.navigate('BankAccounts')}
              >
                <Ionicons name="add" size={14} color="#FFFFFF" />
                <Text style={styles.addAccountText}>Add account</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {defaultAccount && (
                <View style={styles.defaultAccountCard}>
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                  </View>
                  <Text style={styles.accountHolder}>
                    {defaultAccount.accountHolderName || defaultAccount.label || (defaultAccount.type === 'UPI' ? 'UPI' : 'Bank account')}
                  </Text>
                  {defaultAccount.type === 'UPI' ? (
                    <Text style={styles.accountLine}>UPI · {defaultAccount.upiId}</Text>
                  ) : (
                    <>
                      <Text style={styles.accountLine}>
                        {defaultAccount.bankName || 'Bank'} · {maskAccountNumber(defaultAccount.accountNumber)}
                      </Text>
                      {defaultAccount.ifscCode ? (
                        <Text style={styles.accountSub}>IFSC {defaultAccount.ifscCode}</Text>
                      ) : null}
                    </>
                  )}
                </View>
              )}
              {bankAccounts.length > 1 && (
                <Text style={styles.moreAccountsText}>
                  +{bankAccounts.length - 1} more account{bankAccounts.length - 1 === 1 ? '' : 's'} on file
                </Text>
              )}
            </>
          )}
        </View>

        {/* Recent payouts */}
        <Text style={[styles.sectionLabel, { marginHorizontal: SPACING.xs, marginTop: SPACING.lg }]}>
          PAYOUT HISTORY
        </Text>
        {payouts.length === 0 ? (
          <View style={[styles.card, { alignItems: 'center', paddingVertical: SPACING.lg }]}>
            <Text style={styles.emptyMuted}>No payouts yet.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {payouts.map((p: any, idx: number) => (
              <View key={p.id} style={[styles.histRow, idx === payouts.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.histRowTop}>
                  <Text style={styles.histAmount}>
                    ₹{Number(p.netPaid || 0).toLocaleString('en-IN')}
                  </Text>
                  <Text style={styles.histCycle}>{monthName(p.cycleMonth)} {p.cycleYear}</Text>
                </View>
                <Text style={styles.histLine}>
                  Base ₹{Number(p.baseAmount).toLocaleString('en-IN')}
                  {' · '}
                  Bonus ₹{(
                    Number(p.consultationBonus || 0) + Number(p.caseClosedBonus || 0) + Number(p.caseWonBonus || 0) + Number(p.bonusAmount || 0)
                  ).toLocaleString('en-IN')}
                  {p.deductionAmount ? ` · −₹${Number(p.deductionAmount).toLocaleString('en-IN')}` : ''}
                </Text>
                <Text style={styles.histMeta}>
                  {p.createdAt ? `${formatDate(p.createdAt)} · ${formatTime(p.createdAt)}` : ''}
                  {p.providerPayoutId ? ` · UTR ${p.providerPayoutId}` : ''}
                </Text>
                {p.notes ? <Text style={styles.histNotes}>“{p.notes}”</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

const Header = ({ onBack, subtitle, styles, COLORS }: any) => (
  <View style={styles.headerBar}>
    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
      <Ionicons name="arrow-back" size={22} color={COLORS.text} />
    </TouchableOpacity>
    <View style={{ flex: 1 }}>
      <Text style={styles.headerTitle}>Salary analysis</Text>
      {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
    </View>
  </View>
);

const BreakdownLine = ({ label, value, styles }: any) => (
  <View style={styles.breakdownLine}>
    <Text style={styles.breakdownLabel} numberOfLines={1}>{label}</Text>
    <Text style={styles.breakdownValue}>{value}</Text>
  </View>
);

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

  emptyCard: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, alignItems: 'center', ...SHADOWS.sm,
  },
  emptyTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text, marginTop: SPACING.md },
  emptySub: { fontSize: FONT_SIZE.sm, color: C.textSecondary, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 20 },

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
  paidBannerText: { fontSize: FONT_SIZE.xs, color: '#047857', fontWeight: '700', flex: 1 },

  previewHint: {
    fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: SPACING.md, lineHeight: 16,
  },

  bankHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    backgroundColor: C.primaryLight + '18', borderRadius: BORDER_RADIUS.full,
  },
  manageBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.primary },

  bankEmpty: { alignItems: 'center', paddingVertical: SPACING.md, gap: SPACING.xs },
  bankEmptyText: { fontSize: FONT_SIZE.sm, color: C.text, fontWeight: '700', marginTop: SPACING.xs },
  bankEmptySub: { fontSize: FONT_SIZE.xs, color: C.textMuted, textAlign: 'center', paddingHorizontal: SPACING.md },
  addAccountBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: C.primary, borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  addAccountText: { color: '#FFFFFF', fontWeight: '800', fontSize: FONT_SIZE.sm },

  defaultAccountCard: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md,
  },
  defaultBadge: {
    alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 2,
    backgroundColor: C.primary, borderRadius: BORDER_RADIUS.full, marginBottom: SPACING.xs,
  },
  defaultBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  accountHolder: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  accountLine: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: 2 },
  accountSub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  moreAccountsText: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: SPACING.sm },

  emptyMuted: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontStyle: 'italic' },

  cycleStatusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  cycleStatusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  histRow: { paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  histRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  histAmount: { fontSize: FONT_SIZE.lg, fontWeight: '900', color: C.text },
  histCycle: { fontSize: FONT_SIZE.xs, color: C.textMuted, fontWeight: '700' },
  histLine: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: 2 },
  histMeta: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  histNotes: { fontSize: FONT_SIZE.xs, color: C.textSecondary, marginTop: 2, fontStyle: 'italic' },
});

export default MySalaryScreen;

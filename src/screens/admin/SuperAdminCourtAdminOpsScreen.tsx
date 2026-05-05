import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminPerfApi, courtAdminSalaryApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { TabBar } from '../../components/TabBar';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate } from '../../utils/date';

const TABS = [
  { key: 'performance', label: 'Performance' },
  { key: 'cycle',       label: 'Current cycle' },
  { key: 'history',     label: 'Payout history' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const cycleMonthName = (m: number) => MONTH_NAMES[(Math.max(1, Math.min(12, m)) - 1)] || '—';

const actionTitle = (a: 'BASE' | 'HOLD' | 'RELEASE' | 'PAY') => ({
  BASE: 'Set base salary',
  HOLD: 'Hold payouts',
  RELEASE: 'Release hold',
  PAY: 'Record this month’s payout',
}[a]);

const actionHelp = (a: 'BASE' | 'HOLD' | 'RELEASE' | 'PAY') => ({
  BASE: 'The monthly base salary in rupees. Setting this puts the court admin into the payable cycle. Existing payouts already made for this cycle aren’t affected.',
  HOLD: 'Pauses future payouts. The base salary stays set; the court admin won’t appear in the cycle list until released. Hold reason is required and goes into the audit log.',
  RELEASE: 'Resumes payouts. The court admin will reappear in the next payable cycle.',
  PAY: 'Records a payout from the platform wallet to this court admin’s wallet for the current cycle. Idempotent per (court admin, month) — running it twice in the same cycle will fail server-side.',
}[a]);

const previewNet = (base: unknown, bonusStr: string, deductStr: string): number => {
  const baseN = Number(base) || 0;
  const bonusN = Number(bonusStr) || 0;
  const deductN = Number(deductStr) || 0;
  return Math.max(0, baseN + bonusN - deductN);
};

// One screen for the super-admin court-admin operations surface — performance
// metrics (Section 5), current salary cycle, and payout history. The salary
// detail modal lets the super admin set the base salary, hold/release, and
// cut a payout for a specific court admin.
export const SuperAdminCourtAdminOpsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState('performance');
  const [perf, setPerf] = useState<any[]>([]);
  const [cycle, setCycle] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail modal
  const [detail, setDetail] = useState<{ courtAdminId: string; name?: string } | null>(null);
  const [detailConfig, setDetailConfig] = useState<any>(null);
  const [detailHistory, setDetailHistory] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Sub-actions
  const [actionPanel, setActionPanel] = useState<'BASE' | 'HOLD' | 'RELEASE' | 'PAY' | null>(null);
  const [baseInput, setBaseInput] = useState('');
  const [reason, setReason] = useState('');
  const [bonusInput, setBonusInput] = useState('');
  const [deductInput, setDeductInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      if (tab === 'performance') {
        const { data } = await courtAdminPerfApi.listAll();
        setPerf(data?.items || []);
      } else if (tab === 'cycle') {
        const { data } = await courtAdminSalaryApi.currentCycle();
        setCycle(data || null);
      } else {
        const { data } = await courtAdminSalaryApi.payoutHistory({ limit: 100 });
        setHistory(data?.items || data?.payouts || []);
      }
    } catch (err: any) {
      if (tab === 'performance') setPerf([]);
      else if (tab === 'cycle') setCycle(null);
      else setHistory([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (courtAdminId: string, name?: string) => {
    setDetail({ courtAdminId, name });
    setDetailLoading(true);
    setActionPanel(null);
    setReason(''); setBaseInput(''); setBonusInput(''); setDeductInput('');
    try {
      const [{ data: cfgData }, { data: histData }] = await Promise.all([
        courtAdminSalaryApi.getConfig(courtAdminId),
        courtAdminSalaryApi.history(courtAdminId, 25),
      ]);
      const cfg = cfgData?.config || cfgData;
      setDetailConfig(cfg);
      setDetailHistory(histData?.items || []);
      if (cfg?.baseSalary != null) setBaseInput(String(cfg.baseSalary));
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load court admin');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitAction = async () => {
    if (!detail || !actionPanel) return;
    setSubmitting(true);
    try {
      if (actionPanel === 'BASE') {
        const num = Number(baseInput);
        if (!Number.isFinite(num) || num < 0) throw new Error('Enter a valid base salary');
        const { data } = await courtAdminSalaryApi.setBase(detail.courtAdminId, {
          baseSalary: Math.round(num),
          reason: reason.trim() || undefined,
        });
        setDetailConfig(data?.config || data);
        Alert.alert('Saved', `Base salary set to ₹${num.toLocaleString('en-IN')}`);
      } else if (actionPanel === 'HOLD') {
        if (!reason.trim()) throw new Error('Reason is required to hold a salary');
        const { data } = await courtAdminSalaryApi.hold(detail.courtAdminId, { reason: reason.trim() });
        setDetailConfig(data?.config || data);
        Alert.alert('Held', 'Salary placed on hold.');
      } else if (actionPanel === 'RELEASE') {
        const { data } = await courtAdminSalaryApi.release(detail.courtAdminId, reason.trim() ? { reason: reason.trim() } : undefined);
        setDetailConfig(data?.config || data);
        Alert.alert('Released', 'Salary released.');
      } else if (actionPanel === 'PAY') {
        const bonus = bonusInput ? Number(bonusInput) : undefined;
        const deduct = deductInput ? Number(deductInput) : undefined;
        await courtAdminSalaryApi.pay(detail.courtAdminId, {
          bonusAmount: Number.isFinite(bonus as number) ? Math.round(bonus as number) : undefined,
          deductionAmount: Number.isFinite(deduct as number) ? Math.round(deduct as number) : undefined,
          notes: reason.trim() || undefined,
        });
        Alert.alert('Paid', 'Salary payout recorded.');
      }
      setActionPanel(null);
      setReason(''); setBonusInput(''); setDeductInput('');
      // Refresh history regardless
      const { data: histData } = await courtAdminSalaryApi.history(detail.courtAdminId, 25);
      setDetailHistory(histData?.items || []);
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderPerf = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item.courtAdminId || item.id, item.name)}>
      <View style={styles.iconBg}>
        <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name || '—'}</Text>
        <Text style={styles.sub} numberOfLines={1}>{item.email || ''}</Text>
        <View style={styles.statsRow}>
          <Stat label="Verified" value={String(item.verifiedCount ?? item.totalVerified ?? 0)} styles={styles} />
          <Stat label="Pending" value={String(item.pendingCount ?? item.totalPending ?? 0)} styles={styles} />
          <Stat label="Rejected" value={String(item.rejectedCount ?? item.totalRejected ?? 0)} styles={styles} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  // Cycle response shape from /admin/salary-cycles/current:
  //   { cycle: { cycleMonth, cycleYear }, items: [{ courtAdmin, baseSalary,
  //     bonusAmount, deductionAmount, netPayable }] }
  // The court-admin's name lives on item.courtAdmin.name, not item.name.
  const renderCycleItem = ({ item }: { item: any }) => {
    const ca = item.courtAdmin || {};
    const net = Number(item.netPayable ?? item.baseSalary ?? 0);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openDetail(ca.id || item.courtAdminId, ca.name)}>
        <View style={[styles.iconBg, { backgroundColor: '#D1FAE5' }]}>
          <Ionicons name="cash" size={20} color="#047857" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{ca.name || '—'}</Text>
          <Text style={styles.sub} numberOfLines={1}>{ca.email || ''}</Text>
          <Text style={styles.amount}>
            ₹{net.toLocaleString('en-IN')} <Text style={styles.amountSuffix}>payable this cycle</Text>
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  const renderHistory = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={[styles.iconBg, { backgroundColor: '#D1FAE5' }]}>
        <Ionicons name="checkmark-done" size={20} color="#047857" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.courtAdmin?.name || item.courtAdminName || '—'}</Text>
        <Text style={styles.sub}>
          ₹{Number(item.amount || item.netAmount || 0).toLocaleString('en-IN')} · {item.cycleMonth || '—'}/{item.cycleYear || '—'}
        </Text>
        <Text style={styles.sub}>Paid {item.paidAt ? formatDate(item.paidAt) : '—'}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Court Admin Ops</Text>
      </View>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />

      {loading ? <Loading /> : tab === 'performance' ? (
        <FlatList
          data={perf}
          keyExtractor={(it) => String(it.courtAdminId || it.id)}
          renderItem={renderPerf}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="📊" title="No data yet" message="Court admins haven't logged any verifications." />}
        />
      ) : tab === 'cycle' ? (
        <FlatList
          data={cycle?.items || cycle?.payable || []}
          keyExtractor={(it) => String(it.courtAdminId || it.id)}
          renderItem={renderCycleItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="🗓️" title="Nobody payable this cycle" message="Either nobody has a base salary set, all are on hold, or everyone payable has already been paid for this month." />}
          ListHeaderComponent={cycle ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>CURRENT CYCLE</Text>
              <Text style={styles.summaryValue}>
                {cycle.cycle?.cycleMonth ? cycleMonthName(cycle.cycle.cycleMonth) : (cycle.cycleMonth ? cycleMonthName(cycle.cycleMonth) : '—')}
                {' '}
                {cycle.cycle?.cycleYear || cycle.cycleYear || ''}
              </Text>
              <Text style={styles.summaryLabel}>TOTAL PAYABLE</Text>
              <Text style={styles.summaryValue}>
                ₹{(cycle.items || cycle.payable || []).reduce((sum: number, it: any) => sum + Number(it.netPayable ?? it.baseSalary ?? 0), 0).toLocaleString('en-IN')}
              </Text>
              <Text style={styles.summaryHelp}>
                One row per active court admin who has a base salary, isn't on hold, and hasn't been paid yet for this cycle. Tap a row to record their payout from the platform wallet.
              </Text>
            </View>
          ) : null}
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(it) => it.id || `${it.courtAdminId}-${it.paidAt}`}
          renderItem={renderHistory}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="📜" title="No payouts yet" message="No salary payouts have been made." />}
        />
      )}

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{detail?.name || 'Court admin'}</Text>
              <TouchableOpacity onPress={() => setDetail(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {detailLoading ? <Loading /> : (
              <ScrollView contentContainerStyle={styles.modalBody}>
                {/* Explainer — surfaces the model so super admins know what
                    each action means without reading docs. The salary system
                    is intentionally manual: super admin sets a monthly base,
                    optionally holds payouts, and presses "Record payout"
                    once a month per court admin. */}
                <View style={styles.explainer}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.explainerText}>
                    Set a monthly base salary, then run one payout per court admin per cycle.
                    Hold pauses payouts without losing the base. Money flows from the platform wallet
                    to the court admin's wallet.
                  </Text>
                </View>

                {!detailConfig ? (
                  <View style={styles.emptyConfig}>
                    <Ionicons name="cash-outline" size={28} color={COLORS.textMuted} />
                    <Text style={styles.emptyConfigTitle}>No salary set yet</Text>
                    <Text style={styles.emptyConfigSub}>Set a base salary below to add this court admin to the payable cycle.</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.summaryLabel}>BASE SALARY</Text>
                    <Text style={styles.summaryValue}>
                      ₹{Number(detailConfig.baseSalary || 0).toLocaleString('en-IN')} <Text style={styles.month}>/ month</Text>
                    </Text>
                    <View style={[
                      styles.statusPill,
                      { backgroundColor: detailConfig.isOnHold ? '#FEE2E2' : '#D1FAE5' },
                    ]}>
                      <Ionicons
                        name={detailConfig.isOnHold ? 'pause-circle' : 'checkmark-circle'}
                        size={12}
                        color={detailConfig.isOnHold ? '#B91C1C' : '#047857'}
                      />
                      <Text style={[
                        styles.statusPillText,
                        { color: detailConfig.isOnHold ? '#B91C1C' : '#047857' },
                      ]}>
                        {detailConfig.isOnHold ? 'PAYOUTS ON HOLD' : 'PAYOUTS ACTIVE'}
                      </Text>
                    </View>
                    {detailConfig.isOnHold && detailConfig.holdReason ? (
                      <View style={styles.holdNote}>
                        <Text style={styles.holdNoteLabel}>HOLD REASON</Text>
                        <Text style={styles.holdNoteText}>{detailConfig.holdReason}</Text>
                      </View>
                    ) : null}
                  </>
                )}

                {actionPanel ? (
                  <View style={{ marginTop: SPACING.lg }}>
                    <Text style={styles.actionTitle}>{actionTitle(actionPanel)}</Text>
                    <Text style={styles.actionHelp}>{actionHelp(actionPanel)}</Text>

                    {actionPanel === 'BASE' && (
                      <>
                        <Text style={styles.label}>NEW BASE SALARY (₹ PER MONTH)</Text>
                        <TextInput
                          style={styles.input} value={baseInput} onChangeText={setBaseInput}
                          keyboardType="number-pad" placeholder="e.g. 50000"
                          placeholderTextColor={COLORS.textMuted}
                        />
                      </>
                    )}
                    {actionPanel === 'PAY' && (
                      <>
                        <Text style={styles.label}>BONUS (₹, OPTIONAL)</Text>
                        <TextInput
                          style={styles.input} value={bonusInput} onChangeText={setBonusInput}
                          keyboardType="number-pad" placeholder="0" placeholderTextColor={COLORS.textMuted}
                        />
                        <Text style={styles.label}>DEDUCTION (₹, OPTIONAL)</Text>
                        <TextInput
                          style={styles.input} value={deductInput} onChangeText={setDeductInput}
                          keyboardType="number-pad" placeholder="0" placeholderTextColor={COLORS.textMuted}
                        />
                        <Text style={styles.payoutPreview}>
                          Net payout: ₹{previewNet(detailConfig?.baseSalary, bonusInput, deductInput).toLocaleString('en-IN')}
                        </Text>
                      </>
                    )}
                    <Text style={styles.label}>
                      {actionPanel === 'HOLD' ? 'REASON (REQUIRED)' : 'NOTE (OPTIONAL)'}
                    </Text>
                    <TextInput
                      style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                      value={reason} onChangeText={setReason}
                      placeholder="Recorded in audit log" placeholderTextColor={COLORS.textMuted}
                      multiline
                    />
                    <Button
                      title={actionPanel === 'BASE' ? 'Save base salary'
                        : actionPanel === 'HOLD' ? 'Hold payouts'
                        : actionPanel === 'RELEASE' ? 'Release hold'
                        : 'Record payout'}
                      onPress={submitAction}
                      loading={submitting}
                      variant={actionPanel === 'HOLD' ? 'danger' : 'primary'}
                      size="lg"
                    />
                    <TouchableOpacity onPress={() => setActionPanel(null)} style={styles.cancelBtn}>
                      <Text style={styles.cancelText}>Back</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: SPACING.sm, marginTop: SPACING.lg }}>
                    <ActionTile
                      icon="cash-outline"
                      label="Set base salary"
                      hint={detailConfig ? 'Edit the monthly base for this court admin' : 'Initialise this court admin’s salary'}
                      onPress={() => setActionPanel('BASE')}
                      styles={styles} COLORS={COLORS}
                    />
                    {detailConfig?.isOnHold ? (
                      <ActionTile
                        icon="play-circle-outline"
                        label="Release hold"
                        hint="Resume payouts — the court admin will reappear in the payable cycle"
                        onPress={() => setActionPanel('RELEASE')}
                        styles={styles} COLORS={COLORS}
                      />
                    ) : (
                      <ActionTile
                        icon="pause-circle-outline"
                        label="Hold payouts"
                        hint="Pause future payouts without losing the base salary"
                        onPress={() => setActionPanel('HOLD')}
                        styles={styles} COLORS={COLORS}
                        tone="danger"
                        disabled={!detailConfig}
                      />
                    )}
                    <ActionTile
                      icon="checkmark-done-outline"
                      label="Record payout"
                      hint="Pay this month’s salary from the platform wallet — idempotent per cycle"
                      onPress={() => setActionPanel('PAY')}
                      styles={styles} COLORS={COLORS}
                      disabled={!detailConfig || detailConfig.isOnHold}
                    />
                  </View>
                )}

                <Text style={styles.summaryLabel}>RECENT ADJUSTMENTS</Text>
                {detailHistory.length === 0 ? (
                  <Text style={styles.empty}>No adjustments yet.</Text>
                ) : (
                  detailHistory.map((h) => (
                    <View key={h.id} style={styles.histRow}>
                      <Text style={styles.histKind}>{h.kind || h.type || 'EVENT'}</Text>
                      <Text style={styles.histMeta} numberOfLines={2}>
                        {h.amount != null ? `₹${Number(h.amount).toLocaleString('en-IN')} · ` : ''}
                        {h.reason || h.notes || ''}
                      </Text>
                      <Text style={styles.histWhen}>{h.createdAt ? formatDate(h.createdAt) : ''}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const Stat = ({ label, value, styles }: any) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ActionTile = ({ icon, label, hint, onPress, styles, COLORS, tone, disabled }: any) => {
  const color = disabled ? COLORS.textMuted : (tone === 'danger' ? '#B91C1C' : COLORS.primary);
  return (
    <TouchableOpacity
      style={[styles.actionTile, disabled && styles.actionTileDisabled]}
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
    marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  iconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryLight + '22', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  sub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs },
  stat: { },
  statValue: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: C.primary },
  statLabel: { fontSize: 10, color: C.textMuted, letterSpacing: 0.3 },

  summaryCard: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm },
  summaryLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: 4 },
  summaryValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },
  month: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: C.textMuted },

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
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text, flex: 1 },
  modalBody: { padding: SPACING.xl },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full, marginTop: SPACING.xs,
  },
  statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Explainer card at the top of the salary modal so super admins can scan
  // the model in two seconds.
  explainer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: C.primaryLight + '15',
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  explainerText: { flex: 1, fontSize: FONT_SIZE.xs, color: C.textSecondary, lineHeight: 16 },

  emptyConfig: { alignItems: 'center', paddingVertical: SPACING.xl, gap: 4 },
  emptyConfigTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text, marginTop: SPACING.sm },
  emptyConfigSub: { fontSize: FONT_SIZE.xs, color: C.textMuted, textAlign: 'center', paddingHorizontal: SPACING.lg },

  holdNote: {
    backgroundColor: '#FEE2E2', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md, marginTop: SPACING.sm,
  },
  holdNoteLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: '#B91C1C', letterSpacing: 0.5 },
  holdNoteText: { fontSize: FONT_SIZE.sm, color: '#991B1B', marginTop: 2 },

  actionTile: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  actionTileDisabled: { opacity: 0.45 },
  actionTileText: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  actionTileHint: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  actionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '900', color: C.text },
  actionHelp: { fontSize: FONT_SIZE.xs, color: C.textSecondary, marginTop: 4, marginBottom: SPACING.sm, lineHeight: 16 },
  payoutPreview: {
    fontSize: FONT_SIZE.sm, fontWeight: '800', color: C.primary,
    marginTop: -SPACING.xs, marginBottom: SPACING.md,
  },

  label: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: SPACING.xs },
  input: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text, marginBottom: SPACING.md,
  },
  cancelBtn: { alignItems: 'center', marginTop: SPACING.md },
  cancelText: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontWeight: '600' },

  amount: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.primary, marginTop: 4 },
  amountSuffix: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: C.textMuted },

  summaryHelp: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: SPACING.sm, lineHeight: 16 },

  empty: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontStyle: 'italic' },
  histRow: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  histKind: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.primary, letterSpacing: 0.3 },
  histMeta: { fontSize: FONT_SIZE.sm, color: C.text, marginTop: 2 },
  histWhen: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
});

export default SuperAdminCourtAdminOpsScreen;

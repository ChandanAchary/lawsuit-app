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

  const renderCycleItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => openDetail(item.courtAdminId || item.id, item.name)}>
      <View style={[styles.iconBg, { backgroundColor: item.salaryStatus === 'HELD' ? '#FEE2E2' : '#D1FAE5' }]}>
        <Ionicons
          name={item.salaryStatus === 'HELD' ? 'pause-circle' : 'cash'}
          size={20}
          color={item.salaryStatus === 'HELD' ? '#B91C1C' : '#047857'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name || '—'}</Text>
        <Text style={styles.sub}>
          ₹{Number(item.baseSalary || 0).toLocaleString('en-IN')} / month · {item.salaryStatus || 'ACTIVE'}
        </Text>
        {item.cycleMonth ? (
          <Text style={styles.sub}>Cycle {item.cycleMonth}/{item.cycleYear}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

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
          ListEmptyComponent={<EmptyState icon="🗓️" title="No payable cycle" message="Nothing to pay this cycle." />}
          ListHeaderComponent={cycle ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Cycle</Text>
              <Text style={styles.summaryValue}>{cycle.cycleMonth || '—'}/{cycle.cycleYear || '—'}</Text>
              {cycle.totalPayable != null ? (
                <>
                  <Text style={styles.summaryLabel}>Total payable</Text>
                  <Text style={styles.summaryValue}>₹{Number(cycle.totalPayable).toLocaleString('en-IN')}</Text>
                </>
              ) : null}
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
            {detailLoading || !detailConfig ? <Loading /> : (
              <ScrollView contentContainerStyle={styles.modalBody}>
                <Text style={styles.summaryLabel}>BASE SALARY</Text>
                <Text style={styles.summaryValue}>
                  ₹{Number(detailConfig.baseSalary || 0).toLocaleString('en-IN')} <Text style={styles.month}>/ month</Text>
                </Text>
                <View style={[styles.statusPill, { backgroundColor: detailConfig.status === 'HELD' ? '#FEE2E2' : '#D1FAE5' }]}>
                  <Text style={[styles.statusPillText, { color: detailConfig.status === 'HELD' ? '#B91C1C' : '#047857' }]}>
                    {detailConfig.status || 'ACTIVE'}
                  </Text>
                </View>

                {actionPanel ? (
                  <View style={{ marginTop: SPACING.lg }}>
                    {actionPanel === 'BASE' && (
                      <>
                        <Text style={styles.label}>BASE SALARY (₹/MONTH)</Text>
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
                          keyboardType="number-pad" placeholderTextColor={COLORS.textMuted}
                        />
                        <Text style={styles.label}>DEDUCTION (₹, OPTIONAL)</Text>
                        <TextInput
                          style={styles.input} value={deductInput} onChangeText={setDeductInput}
                          keyboardType="number-pad" placeholderTextColor={COLORS.textMuted}
                        />
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
                        : actionPanel === 'HOLD' ? 'Hold salary'
                        : actionPanel === 'RELEASE' ? 'Release salary'
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
                    <ActionTile icon="cash-outline" label="Set base salary" onPress={() => setActionPanel('BASE')} styles={styles} COLORS={COLORS} />
                    {detailConfig.status === 'HELD' ? (
                      <ActionTile icon="play-circle-outline" label="Release hold" onPress={() => setActionPanel('RELEASE')} styles={styles} COLORS={COLORS} />
                    ) : (
                      <ActionTile icon="pause-circle-outline" label="Hold salary" onPress={() => setActionPanel('HOLD')} styles={styles} COLORS={COLORS} tone="danger" />
                    )}
                    <ActionTile icon="checkmark-done-outline" label="Record payout" onPress={() => setActionPanel('PAY')} styles={styles} COLORS={COLORS} />
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

const ActionTile = ({ icon, label, onPress, styles, COLORS, tone }: any) => {
  const color = tone === 'danger' ? '#B91C1C' : COLORS.primary;
  return (
    <TouchableOpacity style={styles.actionTile} onPress={onPress}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.actionTileText, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
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
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, marginTop: SPACING.xs },
  statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  actionTile: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  actionTileText: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '700' },
  label: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: SPACING.xs },
  input: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text, marginBottom: SPACING.md,
  },
  cancelBtn: { alignItems: 'center', marginTop: SPACING.md },
  cancelText: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontWeight: '600' },

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

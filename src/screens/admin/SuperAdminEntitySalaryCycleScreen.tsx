import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { entitySalaryApi, courtAdminSalaryApi, EntitySalarySubject } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { TabBar } from '../../components/TabBar';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate } from '../../utils/date';

// =============================================================================
// SuperAdminEntitySalaryCycleScreen — unified salary management surface.
// Mirrors the desktop AdminSalaryPage in lawsuit-frontend with four tabs:
//
//   - Lawyers       — payable lawyers this cycle (entity-salary)
//   - Organizations — payable orgs this cycle (entity-salary)
//   - Court Admins  — payable court admins this cycle (court-admin-salary)
//   - Cycle History — historical court-admin payouts (cross-cycle list)
//
// Each row drills into the appropriate per-subject detail surface to
// record the payout. The Cycle History tab is read-only.
// =============================================================================

type Tab = 'LAWYER' | 'ORGANIZATION' | 'COURT_ADMIN' | 'HISTORY';

const TABS: { key: Tab; label: string }[] = [
  { key: 'LAWYER',       label: 'Lawyers' },
  { key: 'ORGANIZATION', label: 'Organizations' },
  { key: 'COURT_ADMIN',  label: 'Court Admins' },
  { key: 'HISTORY',      label: 'Cycle History' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const monthName = (m: number) => MONTH_NAMES[Math.max(1, Math.min(12, m)) - 1] || '—';

export const SuperAdminEntitySalaryCycleScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState<Tab>('LAWYER');
  const [data, setData] = useState<{ cycle?: { cycleMonth: number; cycleYear: number }; items: any[] } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      if (tab === 'LAWYER') {
        const res = await entitySalaryApi.payableLawyers();
        setData({ cycle: res.data?.cycle, items: res.data?.items || [] });
      } else if (tab === 'ORGANIZATION') {
        const res = await entitySalaryApi.payableOrganizations();
        setData({ cycle: res.data?.cycle, items: res.data?.items || [] });
      } else if (tab === 'COURT_ADMIN') {
        const res = await courtAdminSalaryApi.currentCycle();
        // Court-admin payable list returns a flat shape — wrap it into the
        // same { cycle, items } envelope the entity tabs use.
        setData({ cycle: res.data?.cycle, items: res.data?.items || res.data || [] });
      } else if (tab === 'HISTORY') {
        // Cross-subject payout history. The court-admin endpoint is the
        // only history endpoint exposed today; lawyer + org payouts are
        // visible per-subject via the drill-down.
        const res = await courtAdminSalaryApi.payoutHistory({ limit: 100 });
        setHistory(res.data?.items || res.data || []);
      }
    } catch (err: any) {
      if (tab === 'HISTORY') setHistory([]);
      else setData({ items: [] });
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  // Refresh on focus so a payout recorded from the per-entity drill-down
  // removes that row from the queue immediately on return.
  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  // Total payable across the visible cycle. For court-admins we sum the
  // flat netPayable / baseSalary fields the server returns; for entity
  // subjects we sum breakdown.netPayable.
  const totalPayable = useMemo(() => {
    if (tab === 'HISTORY') {
      return history.reduce((sum, it: any) => sum + Number(it.amount ?? it.netAmount ?? it.totalPaid ?? 0), 0);
    }
    if (!data?.items) return 0;
    return data.items.reduce((sum, it: any) => {
      if (it.breakdown) return sum + Number(it.breakdown.netPayable ?? 0);
      return sum + Number(it.netPayable ?? it.baseSalary ?? 0);
    }, 0);
  }, [data, history, tab]);

  // Entity (lawyer / org) row — uses the rich breakdown shape.
  const renderEntityRow = ({ item }: { item: any }) => {
    const s = item.subject || {};
    const c = item.config || {};
    const p = item.performance || {};
    const b = item.breakdown || {};
    const isOrg = tab === 'ORGANIZATION';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SuperAdminEntitySalary', {
          subject: tab as EntitySalarySubject,
          subjectId: s.id,
          name: s.name || s.email,
        })}
        activeOpacity={0.85}
      >
        <View style={styles.row}>
          <View style={[styles.iconBg, { backgroundColor: isOrg ? '#EDE9FE' : '#DBEAFE' }]}>
            <Ionicons name={isOrg ? 'business' : 'briefcase'} size={20} color={isOrg ? '#7C3AED' : '#1D4ED8'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{s.name || '—'}</Text>
            <Text style={styles.sub} numberOfLines={1}>{s.email || ''}</Text>
          </View>
          <View style={styles.netBox}>
            <Text style={styles.netLabel}>NET</Text>
            <Text style={styles.netValue}>₹{Number(b.netPayable ?? 0).toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <View style={styles.metricRow}>
          <Metric label="Base" value={`₹${Number(c.baseSalary ?? 0).toLocaleString('en-IN')}`} styles={styles} />
          <MetricDivider styles={styles} />
          <Metric label="Consult" value={`${p.consultationCount ?? 0}`} sub={`₹${Number(b.consultationBonus ?? 0).toLocaleString('en-IN')}`} styles={styles} />
          <MetricDivider styles={styles} />
          <Metric label="Closed" value={`${p.caseClosedCount ?? 0}`} sub={`₹${Number(b.caseClosedBonus ?? 0).toLocaleString('en-IN')}`} styles={styles} />
          <MetricDivider styles={styles} />
          <Metric label="Won" value={`${p.caseWonCount ?? 0}`} sub={`₹${Number(b.caseWonBonus ?? 0).toLocaleString('en-IN')}`} styles={styles} />
        </View>
      </TouchableOpacity>
    );
  };

  // Court admin row — server returns a skinnier shape: { courtAdmin, baseSalary, netPayable }.
  const renderCourtAdminRow = ({ item }: { item: any }) => {
    const ca = item.courtAdmin || item;
    const baseSalary = Number(item.baseSalary ?? 0);
    const netPayable = Number(item.netPayable ?? baseSalary);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SuperAdminCourtAdminOps')}
        activeOpacity={0.85}
      >
        <View style={styles.row}>
          <View style={[styles.iconBg, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="hammer" size={20} color="#B45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{ca.name || '—'}</Text>
            <Text style={styles.sub} numberOfLines={1}>{ca.email || ''}</Text>
          </View>
          <View style={styles.netBox}>
            <Text style={styles.netLabel}>NET</Text>
            <Text style={styles.netValue}>₹{netPayable.toLocaleString('en-IN')}</Text>
          </View>
        </View>
        <View style={styles.metricRow}>
          <Metric label="Base" value={`₹${baseSalary.toLocaleString('en-IN')}`} styles={styles} />
          <MetricDivider styles={styles} />
          <Metric label="Tap" value="View ops" sub="Performance + payout" styles={styles} />
        </View>
      </TouchableOpacity>
    );
  };

  // History row — flat payout record. Read-only; tap copies the record.
  const renderHistoryRow = ({ item }: { item: any }) => {
    const ca = item.courtAdmin || {};
    const amount = Number(item.amount ?? item.totalPaid ?? item.netAmount ?? 0);
    const cycleLabel = item.cycleMonth && item.cycleYear
      ? `${monthName(item.cycleMonth)} ${item.cycleYear}`
      : item.cycleStart
        ? formatDate(item.cycleStart)
        : '—';
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconBg, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-done" size={20} color="#047857" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{ca.name || item.subjectName || '—'}</Text>
            <Text style={styles.sub} numberOfLines={1}>{cycleLabel}</Text>
          </View>
          <View style={styles.netBox}>
            <Text style={styles.netLabel}>PAID</Text>
            <Text style={[styles.netValue, { color: '#047857' }]}>₹{amount.toLocaleString('en-IN')}</Text>
          </View>
        </View>
        {!!item.paidAt && (
          <Text style={styles.historyDate}>Paid {formatDate(item.paidAt)}</Text>
        )}
        {!!item.notes && (
          <Text style={styles.historyNotes} numberOfLines={2}>{item.notes}</Text>
        )}
      </View>
    );
  };

  // Per-tab content + copy. Splitting the big switch out keeps the JSX
  // body readable and avoids dragging the whole component re-render through
  // four tab branches inline.
  const subjectLabel = tab === 'ORGANIZATION' ? 'organization' : tab === 'COURT_ADMIN' ? 'court admin' : 'lawyer';
  const isHistory = tab === 'HISTORY';

  const headerSub = useMemo(() => {
    if (isHistory) return `${history.length} historical payouts`;
    if (data?.cycle) return `${monthName(data.cycle.cycleMonth)} ${data.cycle.cycleYear} · ${data.items.length} payable`;
    return 'Current cycle';
  }, [data, history, isHistory]);

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Salary Management</Text>
          <Text style={styles.headerSub}>{headerSub}</Text>
        </View>
      </View>

      <TabBar
        tabs={TABS as { key: string; label: string }[]}
        active={tab}
        onSelect={(k) => setTab(k as Tab)}
      />

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>
          {isHistory ? 'TOTAL PAID HISTORICALLY' : 'TOTAL PAYABLE THIS CYCLE'}
        </Text>
        <Text style={styles.totalValue}>₹{totalPayable.toLocaleString('en-IN')}</Text>
        <Text style={styles.totalHelp}>
          {isHistory
            ? 'Cross-cycle payout history. Read-only.'
            : `One row per active ${subjectLabel} that has a salary configured, isn’t on hold, and hasn’t been paid yet for this cycle. Tap any row to record their payout.`}
        </Text>
      </View>

      {loading ? <Loading /> : isHistory ? (
        <FlatList
          data={history}
          keyExtractor={(it, idx) => String(it.id || idx)}
          renderItem={renderHistoryRow}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={(
            <EmptyState icon="📜" title="No payout history" message="Recorded payouts will show up here once the first cycle is paid." />
          )}
        />
      ) : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(it, idx) => String(it.subject?.id || it.courtAdmin?.id || it.config?.subjectId || it.id || idx)}
          renderItem={tab === 'COURT_ADMIN' ? renderCourtAdminRow : renderEntityRow}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={(
            <EmptyState
              icon="🗓️"
              title="Nobody payable this cycle"
              message={`No ${subjectLabel} has a salary set, isn’t on hold, and is unpaid for ${data?.cycle ? `${monthName(data.cycle.cycleMonth)} ${data.cycle.cycleYear}` : 'the current cycle'}.`}
            />
          )}
        />
      )}
    </View>
  );
};

const Metric = ({ label, value, sub, styles }: any) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    {sub != null && <Text style={styles.metricSub}>{sub}</Text>}
  </View>
);

const MetricDivider = ({ styles }: any) => <View style={styles.metricDivider} />;

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },
  headerSub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  totalCard: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    marginHorizontal: SPACING.xl, marginTop: SPACING.md, padding: SPACING.lg, ...SHADOWS.sm,
  },
  totalLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5 },
  totalValue: { fontSize: FONT_SIZE.xxxl, fontWeight: '900', color: C.text, marginTop: 2 },
  totalHelp: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: SPACING.sm, lineHeight: 16 },

  list: { padding: SPACING.xl, paddingBottom: 120 },

  card: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  iconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  sub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  netBox: { alignItems: 'flex-end' },
  netLabel: { fontSize: 9, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5 },
  netValue: { fontSize: FONT_SIZE.lg, fontWeight: '900', color: C.primary },

  metricRow: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.sm, marginTop: SPACING.md,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 9, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5 },
  metricValue: { fontSize: FONT_SIZE.md, fontWeight: '900', color: C.text, marginTop: 2 },
  metricSub: { fontSize: 10, color: C.primary, fontWeight: '700', marginTop: 2 },
  metricDivider: { width: 1, backgroundColor: C.borderLight },
  historyDate: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: SPACING.sm },
  historyNotes: { fontSize: FONT_SIZE.xs, color: C.textSecondary, marginTop: 4, fontStyle: 'italic' },
});

export default SuperAdminEntitySalaryCycleScreen;

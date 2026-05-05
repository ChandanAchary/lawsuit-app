import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { entitySalaryApi, EntitySalarySubject } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { TabBar } from '../../components/TabBar';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';

// =============================================================================
// SuperAdminEntitySalaryCycleScreen — payable queue for the current month,
// with two tabs (Lawyers / Organizations). Each row shows the live
// performance breakdown + net payable so the super admin can scan the
// whole cycle in one glance, then tap any row to drill into the
// per-entity salary screen and record the payout there.
// =============================================================================

const TABS: { key: EntitySalarySubject; label: string }[] = [
  { key: 'LAWYER',       label: 'Lawyers' },
  { key: 'ORGANIZATION', label: 'Organizations' },
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

  const [subject, setSubject] = useState<EntitySalarySubject>('LAWYER');
  const [data, setData] = useState<{ cycle?: { cycleMonth: number; cycleYear: number }; items: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const res = subject === 'LAWYER'
        ? await entitySalaryApi.payableLawyers()
        : await entitySalaryApi.payableOrganizations();
      setData({ cycle: res.data?.cycle, items: res.data?.items || [] });
    } catch (err: any) {
      setData({ items: [] });
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load cycle');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [subject]);

  useEffect(() => { void load(); }, [load]);

  // Refresh on focus so a payout recorded from the per-entity drill-down
  // removes that row from the queue immediately on return.
  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const totalPayable = useMemo(() => {
    if (!data?.items) return 0;
    return data.items.reduce((sum, it: any) => sum + Number(it.breakdown?.netPayable ?? 0), 0);
  }, [data]);

  const renderRow = ({ item }: { item: any }) => {
    const s = item.subject || {};
    const c = item.config || {};
    const p = item.performance || {};
    const b = item.breakdown || {};
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('SuperAdminEntitySalary', {
          subject,
          subjectId: s.id,
          name: s.name || s.email,
        })}
        activeOpacity={0.85}
      >
        <View style={styles.row}>
          <View style={[styles.iconBg, { backgroundColor: subject === 'ORGANIZATION' ? '#EDE9FE' : '#DBEAFE' }]}>
            <Ionicons name={subject === 'ORGANIZATION' ? 'business' : 'briefcase'} size={20} color={subject === 'ORGANIZATION' ? '#7C3AED' : '#1D4ED8'} />
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

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Compensation</Text>
          <Text style={styles.headerSub}>
            {data?.cycle ? `${monthName(data.cycle.cycleMonth)} ${data.cycle.cycleYear} · ${data.items.length} payable` : 'Current cycle'}
          </Text>
        </View>
      </View>

      <TabBar
        tabs={TABS as { key: string; label: string }[]}
        active={subject}
        onSelect={(k) => setSubject(k as EntitySalarySubject)}
      />

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>TOTAL PAYABLE THIS CYCLE</Text>
        <Text style={styles.totalValue}>₹{totalPayable.toLocaleString('en-IN')}</Text>
        <Text style={styles.totalHelp}>
          One row per active {subject === 'ORGANIZATION' ? 'organization' : 'lawyer'} that has a salary configured, isn’t on hold, and hasn’t been paid yet for this cycle.
          Tap any row to record their payout.
        </Text>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(it, idx) => String(it.subject?.id || it.config?.subjectId || idx)}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={(
            <EmptyState
              icon="🗓️"
              title="Nobody payable this cycle"
              message={`No ${subject === 'ORGANIZATION' ? 'organization' : 'lawyer'} has a salary set, isn’t on hold, and is unpaid for ${data?.cycle ? `${monthName(data.cycle.cycleMonth)} ${data.cycle.cycleYear}` : 'the current cycle'}.`}
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
});

export default SuperAdminEntitySalaryCycleScreen;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { payoutsApi, BeneficiaryType } from '../../services/api';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate, formatTime } from '../../utils/date';

const TABS = [
  { key: 'ledger',    label: 'Escrow ledger' },
  { key: 'history',   label: 'Payout history' },
  { key: 'reconcile', label: 'Reconcile' },
];

const BENEFICIARY_FILTERS: { key: BeneficiaryType | 'ALL'; label: string }[] = [
  { key: 'ALL',          label: 'All' },
  { key: 'LAWYER',       label: 'Lawyers' },
  { key: 'ORGANIZATION', label: 'Organizations' },
];

// Section 1 — escrow & ledger surfaces. Companion screen to AdminPayouts:
// the list+actions UI lives there, this screen is the financial-operations
// view (what's held, what was paid, does it balance).
export const AdminEscrowLedgerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const me = useAuthStore((s) => s.user);
  const isSuper = me?.level === 'SUPER_ADMIN';

  const [tab, setTab] = useState('ledger');
  const [beneficiaryFilter, setBeneficiaryFilter] = useState<BeneficiaryType | 'ALL'>('ALL');

  const [ledger, setLedger] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [reconcile, setReconcile] = useState<any | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      if (tab === 'ledger') {
        const { data } = await payoutsApi.escrowLedger(
          beneficiaryFilter === 'ALL' ? undefined : beneficiaryFilter,
        );
        setLedger(data?.items || []);
      } else if (tab === 'history') {
        const { data } = await payoutsApi.history({ limit: 100 });
        setHistory(data?.items || data?.payouts || []);
      } else {
        const { data } = await payoutsApi.reconcile();
        setReconcile(data || null);
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        Alert.alert('Forbidden', 'Only super admins can view this surface.');
      } else if (showLoader) {
        Alert.alert('Error', formatErrorMessage(err) || 'Failed to load');
      }
      if (tab === 'ledger') setLedger([]);
      else if (tab === 'history') setHistory([]);
      else setReconcile(null);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab, beneficiaryFilter]);

  useEffect(() => { load(); }, [load]);

  if (!isSuper) {
    return (
      <View style={styles.container}>
        <Header title="Ledger & history" onBack={() => navigation.goBack()} styles={styles} COLORS={COLORS} />
        <EmptyState icon="🔒" title="Super Admins Only" message="Only super admins can view the escrow ledger." />
      </View>
    );
  }

  const renderLedgerRow = ({ item }: { item: any }) => {
    const benefName = item.beneficiary?.name
      || item.beneficiaryName
      || (item.beneficiaryType === 'ORGANIZATION' ? 'Organization' : 'Lawyer');
    const isOrg = item.beneficiaryType === 'ORGANIZATION';
    return (
      <View style={styles.card}>
        <View style={styles.rowTop}>
          <View style={[styles.iconBg, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name={isOrg ? 'business' : 'briefcase'} size={20} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.amount}>₹{Number(item.amount || item.heldAmount || 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.sub} numberOfLines={1}>For {benefName}</Text>
            <Text style={styles.subMuted} numberOfLines={1}>
              Payment {item.paymentId ? String(item.paymentId).slice(0, 12) + '…' : item.id ? String(item.id).slice(0, 12) + '…' : '—'}
            </Text>
          </View>
          <View style={styles.heldBadge}>
            <Text style={styles.heldText}>HELD</Text>
          </View>
        </View>
        <Text style={styles.when}>
          Booking {item.appointment?.scheduledAt ? formatDate(item.appointment.scheduledAt) : (item.createdAt ? formatDate(item.createdAt) : '—')}
        </Text>
      </View>
    );
  };

  const renderHistoryRow = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.rowTop}>
        <View style={[styles.iconBg, { backgroundColor: '#D1FAE5' }]}>
          <Ionicons name="checkmark-done" size={20} color="#047857" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.amount}>₹{Number(item.amount || 0).toLocaleString('en-IN')}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            To {item.recipient?.name || item.recipientName || (item.beneficiaryType === 'ORGANIZATION' ? 'Organization' : 'Lawyer')}
          </Text>
          <Text style={styles.subMuted} numberOfLines={1}>
            {item.providerPayoutId ? `Ref ${item.providerPayoutId}` : `Payout ${String(item.id || '').slice(0, 12)}…`}
          </Text>
        </View>
        <View style={styles.paidBadge}>
          <Text style={styles.paidText}>{item.kind || 'PAID'}</Text>
        </View>
      </View>
      <Text style={styles.when}>
        {item.paidAt ? `Paid ${formatDate(item.paidAt)} · ${formatTime(item.paidAt)}` : (item.createdAt ? `Created ${formatDate(item.createdAt)}` : '')}
        {item.initiatedBy?.name ? ` · by ${item.initiatedBy.name}` : ''}
      </Text>
      {item.notes ? <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Ledger & history" onBack={() => navigation.goBack()} styles={styles} COLORS={COLORS} />
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />

      {tab === 'ledger' && (
        // Secondary filter under the main TabBar — use the `filter` variant
        // so it visually nests instead of competing with the page tabs.
        <TabBar
          variant="filter"
          tabs={BENEFICIARY_FILTERS as { key: string; label: string }[]}
          active={beneficiaryFilter}
          onSelect={(k) => setBeneficiaryFilter(k as BeneficiaryType | 'ALL')}
        />
      )}

      {loading ? <Loading /> : tab === 'ledger' ? (
        <FlatList
          data={ledger}
          keyExtractor={(it) => it.id || it.paymentId}
          renderItem={renderLedgerRow}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="📒" title="Empty ledger" message="No held escrow entries match the filter." />}
        />
      ) : tab === 'history' ? (
        <FlatList
          data={history}
          keyExtractor={(it) => it.id || `${it.paymentId}-${it.paidAt || it.createdAt}`}
          renderItem={renderHistoryRow}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="🧾" title="No payouts yet" message="Once payouts are disbursed they'll appear here." />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
        >
          {!reconcile ? (
            <EmptyState icon="🧮" title="Nothing to reconcile" message="Pull to refresh or check back later." />
          ) : (
            <>
              <View style={[styles.card, reconcile.balanced ? styles.okCard : styles.alertCard]}>
                <View style={styles.reconcileTop}>
                  <Ionicons
                    name={reconcile.balanced ? 'checkmark-circle' : 'alert-circle'}
                    size={24}
                    color={reconcile.balanced ? '#047857' : '#B91C1C'}
                  />
                  <Text style={[styles.reconcileTitle, { color: reconcile.balanced ? '#047857' : '#B91C1C' }]}>
                    {reconcile.balanced ? 'Books are balanced' : 'Discrepancy detected'}
                  </Text>
                </View>
                {!reconcile.balanced && reconcile.discrepancyAmount != null && (
                  <Text style={styles.discrepancy}>
                    Off by ₹{Number(reconcile.discrepancyAmount).toLocaleString('en-IN')}
                  </Text>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.summaryHeader}>Platform wallet</Text>
                <KV k="Balance" v={`₹${Number(reconcile.platformBalance || 0).toLocaleString('en-IN')}`} styles={styles} />
                <KV k="Held escrow (sum)" v={`₹${Number(reconcile.heldEscrowSum || 0).toLocaleString('en-IN')}`} styles={styles} />
                <KV k="Payable (sum)" v={`₹${Number(reconcile.payableSum || 0).toLocaleString('en-IN')}`} styles={styles} />
                <KV k="Disbursed (lifetime)" v={`₹${Number(reconcile.paidOutSum || 0).toLocaleString('en-IN')}`} styles={styles} />
                <KV k="Refunded (lifetime)" v={`₹${Number(reconcile.refundedSum || 0).toLocaleString('en-IN')}`} styles={styles} />
              </View>

              {Array.isArray(reconcile.issues) && reconcile.issues.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.summaryHeader}>Issues</Text>
                  {reconcile.issues.map((issue: any, idx: number) => (
                    <View key={idx} style={styles.issueRow}>
                      <Ionicons name="warning-outline" size={16} color="#B91C1C" />
                      <Text style={styles.issueText}>
                        {issue.message || issue.description || JSON.stringify(issue)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {reconcile.checkedAt && (
                <Text style={styles.checkedAt}>
                  Checked at {formatDate(reconcile.checkedAt)} · {formatTime(reconcile.checkedAt)}
                </Text>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const Header = ({ title, onBack, styles, COLORS }: any) => (
  <View style={styles.headerBar}>
    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
      <Ionicons name="arrow-back" size={22} color={COLORS.text} />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
  </View>
);

const KV = ({ k, v, styles }: any) => (
  <View style={styles.kvRow}>
    <Text style={styles.kvKey}>{k}</Text>
    <Text style={styles.kvValue}>{v}</Text>
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
  card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm },
  okCard: { borderLeftWidth: 4, borderLeftColor: '#047857' },
  alertCard: { borderLeftWidth: 4, borderLeftColor: '#B91C1C' },

  rowTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  iconBg: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  amount: { fontSize: FONT_SIZE.lg, fontWeight: '900', color: C.text },
  sub: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: 2 },
  subMuted: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  when: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: SPACING.sm },
  notes: { fontSize: FONT_SIZE.xs, color: C.textSecondary, marginTop: 4, fontStyle: 'italic' },

  heldBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, backgroundColor: '#FEF3C7' },
  heldText: { fontSize: 10, fontWeight: '800', color: '#B45309', letterSpacing: 0.3 },
  paidBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, backgroundColor: '#D1FAE5' },
  paidText: { fontSize: 10, fontWeight: '800', color: '#047857', letterSpacing: 0.3 },

  reconcileTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  reconcileTitle: { fontSize: FONT_SIZE.lg, fontWeight: '900' },
  discrepancy: { fontSize: FONT_SIZE.md, color: '#B91C1C', marginTop: SPACING.xs, fontWeight: '700' },
  summaryHeader: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5, marginBottom: SPACING.sm },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  kvKey: { fontSize: FONT_SIZE.sm, color: C.textSecondary },
  kvValue: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: C.text },
  issueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs, paddingVertical: SPACING.xs },
  issueText: { flex: 1, fontSize: FONT_SIZE.sm, color: C.text },
  checkedAt: { fontSize: FONT_SIZE.xs, color: C.textMuted, textAlign: 'center', marginTop: SPACING.sm },
});

export default AdminEscrowLedgerScreen;

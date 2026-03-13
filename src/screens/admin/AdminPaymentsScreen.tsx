import { useThemeStore } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminApi } from '../../services/api';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { formatDate, formatTime } from '../../utils/date';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'REFUNDED', label: 'Refunded' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  COMPLETED: { bg: '#D1FAE5', text: '#10B981' },
  PENDING: { bg: '#EDE9FE', text: '#8B5CF6' },
  FAILED: { bg: '#FEE2E2', text: '#EF4444' },
  REFUNDED: { bg: '#DBEAFE', text: '#3B82F6' },
};

export const AdminPaymentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState('all');
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayments = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params: any = {};
      if (tab !== 'all') params.status = tab;
      const { data } = await adminApi.getPayments(params);
      setPayments(data.payments || data.items || data || []);
    } catch { setPayments([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const sc = (status: string) => STATUS_COLORS[status] || STATUS_COLORS.PENDING;

  const renderItem = ({ item }: { item: any }) => {
    const c = sc(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.iconBg, { backgroundColor: c.bg }]}>
            <Ionicons name="card" size={20} color={c.text} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardAmount}>₹{Number(item.amount).toLocaleString('en-IN')}</Text>
            <Text style={styles.cardMeta}>{item.provider || 'N/A'} · User: {(item.userId || '').slice(0, 8)}...</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Text style={[styles.badgeText, { color: c.text }]}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.dateText}>{formatDate(item.createdAt)} · {formatTime(item.createdAt)}</Text>
          {item.escrowStatus && (
            <Text style={styles.escrowText}>Escrow: {item.escrowStatus}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Monitoring</Text>
      </View>
      <TabBar tabs={STATUS_TABS} active={tab} onSelect={setTab} />
      {loading ? <Loading /> : (
        <FlatList
          data={payments}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPayments(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="💳" title="No Payments" message="No payments found" />}
        />
      )}
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardAmount: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  cardMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  dateText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  escrowText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.warning },
});

import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminApi, paymentsApi } from '../../services/api';
import { Button } from '../../components/Button';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { formatDate, formatTime } from '../../utils/date';
import { formatErrorMessage } from '../../utils/formatError';

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
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState('all');
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refundTarget, setRefundTarget] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

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

  const submitRefund = async () => {
    if (!refundTarget) return;
    if (!refundReason.trim()) return Alert.alert('Error', 'Reason is required');
    setRefunding(true);
    try {
      await paymentsApi.refund(refundTarget.id, refundReason.trim());
      Alert.alert('Refunded', 'Payment refunded successfully');
      setRefundTarget(null); setRefundReason('');
      fetchPayments(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to refund');
    } finally { setRefunding(false); }
  };

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
        {item.status === 'COMPLETED' && (
          <TouchableOpacity style={styles.refundBtn} onPress={() => setRefundTarget(item)}>
            <Ionicons name="return-down-back" size={14} color="#EF4444" />
            <Text style={styles.refundText}>Refund</Text>
          </TouchableOpacity>
        )}
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

      <Modal visible={!!refundTarget} transparent animationType="slide" onRequestClose={() => setRefundTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Refund Payment</Text>
              <TouchableOpacity onPress={() => setRefundTarget(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {refundTarget && (
                <Text style={styles.modalInfo}>
                  Amount: ₹{Number(refundTarget.amount || 0).toLocaleString('en-IN')}{'\n'}
                  Payment ID: {String(refundTarget.id).slice(0, 16)}…
                </Text>
              )}
              <TextInput
                style={styles.input}
                value={refundReason}
                onChangeText={setRefundReason}
                placeholder="Reason for refund"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
              <Button title="Confirm Refund" onPress={submitRefund} loading={refunding} size="lg" variant="danger" />
            </View>
          </View>
        </View>
      </Modal>
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
  refundBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end',
    marginTop: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, backgroundColor: '#FEE2E2',
  },
  refundText: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: '#EF4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: SPACING.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  modalBody: { padding: SPACING.xl },
  modalInfo: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.md, lineHeight: 20 },
  input: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md,
    height: 90, textAlignVertical: 'top',
  },
});

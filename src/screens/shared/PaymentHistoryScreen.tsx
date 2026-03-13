import { useThemeStore } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { paymentsApi } from '../../services/api';
import { PaymentStatus } from '../../types';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { formatDate, formatTime } from '../../utils/date';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: PaymentStatus.COMPLETED, label: 'Completed' },
  { key: PaymentStatus.PENDING, label: 'Pending' },
  { key: PaymentStatus.FAILED, label: 'Failed' },
  { key: PaymentStatus.REFUNDED, label: 'Refunded' },
];

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  COMPLETED: { bg: '#D1FAE5', text: '#10B981', icon: 'checkmark-circle' },
  PENDING: { bg: '#EDE9FE', text: '#8B5CF6', icon: 'time' },
  FAILED: { bg: '#FEE2E2', text: '#EF4444', icon: 'close-circle' },
  REFUNDED: { bg: '#DBEAFE', text: '#3B82F6', icon: 'return-down-back' },
};

interface Payment {
  id: string;
  userId: string;
  appointmentId?: string;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status: string;
  escrowStatus?: string;
  metadata?: any;
  createdAt: string;
}

export const PaymentHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState('all');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refunding, setRefunding] = useState(false);

  const fetchPayments = useCallback(async (pageNum = 1, showLoader = true) => {
    if (showLoader && pageNum === 1) setLoading(true);
    try {
      const params: any = { page: pageNum, limit: 20 };
      if (tab !== 'all') params.status = tab;
      const { data } = await paymentsApi.getAll(params);
      const items = data.payments || data.items || data || [];
      if (pageNum === 1) {
        setPayments(items);
      } else {
        setPayments((prev) => [...prev, ...items]);
      }
      setHasMore(items.length >= 20);
      setPage(pageNum);
    } catch {
      if (pageNum === 1) setPayments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { fetchPayments(1); }, [fetchPayments]);

  const onRefresh = () => { setRefreshing(true); fetchPayments(1, false); };
  const loadMore = () => { if (hasMore && !loading) fetchPayments(page + 1, false); };

  const handleRefund = async (paymentId: string) => {
    Alert.alert('Request Refund', 'Are you sure you want to request a refund for this payment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Refund', style: 'destructive', onPress: async () => {
          setRefunding(true);
          try {
            await paymentsApi.refund(paymentId);
            Alert.alert('Success', 'Refund request submitted successfully');
            setSelectedPayment(null);
            fetchPayments(1, false);
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to request refund');
          } finally { setRefunding(false); }
        },
      },
    ]);
  };

  const getStatusStyle = (status: string) => STATUS_STYLE[status] || STATUS_STYLE.PENDING;

  const renderItem = ({ item }: { item: Payment }) => {
    const s = getStatusStyle(item.status);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => setSelectedPayment(item)}>
        <View style={[styles.statusIcon, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon as any} size={20} color={s.text} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardAmount}>₹{Number(item.amount).toLocaleString('en-IN')}</Text>
          <Text style={styles.cardMeta}>{item.provider} · {formatDate(item.createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
          <Text style={[styles.statusText, { color: s.text }]}>{item.status}</Text>
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
        <Text style={styles.headerTitle}>Payment History</Text>
      </View>
      <TabBar tabs={STATUS_TABS} active={tab} onSelect={setTab} />
      {loading && payments.length === 0 ? <Loading /> : (
        <FlatList
          data={payments}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState icon="💳" title="No Payments" message="Your payment history will appear here" />}
        />
      )}

      {/* Payment Detail Modal */}
      <Modal visible={!!selectedPayment} transparent animationType="slide" onRequestClose={() => setSelectedPayment(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Details</Text>
              <TouchableOpacity onPress={() => setSelectedPayment(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {selectedPayment && (
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={styles.detailValue}>₹{Number(selectedPayment.amount).toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(selectedPayment.status).bg }]}>
                    <Text style={[styles.statusText, { color: getStatusStyle(selectedPayment.status).text }]}>
                      {selectedPayment.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Provider</Text>
                  <Text style={styles.detailValue}>{selectedPayment.provider}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Currency</Text>
                  <Text style={styles.detailValue}>{selectedPayment.currency}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedPayment.createdAt)} {formatTime(selectedPayment.createdAt)}</Text>
                </View>
                {selectedPayment.providerPaymentId && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment ID</Text>
                    <Text style={[styles.detailValue, { fontSize: FONT_SIZE.xs }]} numberOfLines={1}>{selectedPayment.providerPaymentId}</Text>
                  </View>
                )}
                {selectedPayment.escrowStatus && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Escrow</Text>
                    <Text style={styles.detailValue}>{selectedPayment.escrowStatus}</Text>
                  </View>
                )}
                {selectedPayment.status === 'COMPLETED' && (
                  <TouchableOpacity
                    style={styles.refundBtn}
                    onPress={() => handleRefund(selectedPayment.id)}
                    disabled={refunding}
                  >
                    <Ionicons name="return-down-back" size={18} color="#EF4444" />
                    <Text style={styles.refundText}>{refunding ? 'Processing...' : 'Request Refund'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardAmount: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  cardMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  modalBody: { padding: SPACING.xl },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  detailLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  detailValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  refundBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginTop: SPACING.xl, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.xl,
    backgroundColor: '#FEE2E2',
  },
  refundText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#EF4444' },
});

import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, FlatList, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { formatErrorMessage } from '../../utils/formatError';
import { useWalletStore } from '../../stores/walletStore';
import { TransactionType, WalletTransaction } from '../../types';
import { formatDate, formatTime } from '../../utils/date';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/Modals';
import { TabBar } from '../../components/TabBar';
import { EmptyState, Loading } from '../../components/Common';
import { RazorpayCheckout } from '../../components/RazorpayCheckout';
import { RazorpayOrderOptions, RazorpayPaymentResult } from '../../utils/razorpay';
import { useAuthStore } from '../../stores/authStore';
import { appointmentsApi, paymentsApi } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

const TX_TABS = [
  { key: 'all', label: 'All' },
  { key: TransactionType.CREDIT, label: 'Credits' },
  { key: TransactionType.DEBIT, label: 'Debits' },
];

const getTxType = (tx: WalletTransaction): string => String(tx.type || '').trim().toUpperCase();

const CREDIT_TYPES = new Set([TransactionType.CREDIT, TransactionType.REFUND]);
const DEBIT_TYPES = new Set([TransactionType.DEBIT, TransactionType.WITHDRAWAL, TransactionType.PAYMENT]);

const isCreditTransaction = (tx: WalletTransaction): boolean => {
  const type = getTxType(tx);
  const description = String(tx.description || '').toLowerCase();
  if (CREDIT_TYPES.has(type as TransactionType)) return true;
  if (type === TransactionType.TRANSFER) {
    return description.includes('received') || description.includes('credited');
  }
  return false;
};

const isDebitTransaction = (tx: WalletTransaction): boolean => {
  const type = getTxType(tx);
  const description = String(tx.description || '').toLowerCase();
  if (DEBIT_TYPES.has(type as TransactionType)) return true;
  if (type === TransactionType.TRANSFER) {
    return description.includes('sent') || description.includes('debited');
  }
  return false;
};

const toSourceLabel = (provider?: string): string | null => {
  const normalized = String(provider || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('razorpay')) return 'Razorpay';
  if (normalized.includes('wallet')) return 'Wallet';
  if (normalized.includes('stripe')) return 'Stripe';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const WalletScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const {
    balance, transactions, totalTransactions, currentPage, loading,
    fetchBalance, fetchTransactions, addMoney, confirmAddMoney, withdraw, transfer,
  } = useWalletStore();
  const user = useAuthStore((s) => s.user);

  const [txTab, setTxTab] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [amount, setAmount] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceByReference, setSourceByReference] = useState<Record<string, string>>({});
  // Razorpay state
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrderOptions | null>(null);

  useEffect(() => {
    fetchBalance();
    fetchTransactions(1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBalance();
      fetchTransactions(1);

      // Refund entries can arrive shortly after cancellation; retry once/twice.
      const t1 = setTimeout(() => { fetchBalance(); fetchTransactions(1); }, 2500);
      const t2 = setTimeout(() => { fetchBalance(); fetchTransactions(1); }, 7000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }, [fetchBalance, fetchTransactions]),
  );

  useEffect(() => {
    let cancelled = false;
    const referenceIds = Array.from(new Set(
      transactions
        .map((tx) => String(tx.referenceId || '').trim())
        .filter((id) => !!id && !sourceByReference[id]),
    ));
    if (!referenceIds.length) return;

    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(referenceIds.map(async (paymentId) => {
        try {
          const { data } = await paymentsApi.getById(paymentId);
          const payment = data?.payment || data?.data || data;
          const source = toSourceLabel(payment?.provider);
          if (source) updates[paymentId] = source;
        } catch {
          try {
            // Some wallet txs reference appointmentId; resolve provider through appointment payment.
            const { data } = await appointmentsApi.getById(paymentId);
            const appointment = data?.appointment || data?.data || data;
            const source = toSourceLabel(appointment?.payment?.provider);
            if (source) updates[paymentId] = source;
          } catch {
            // Ignore references that are neither payment nor appointment IDs.
          }
        }
      }));

      if (!cancelled && Object.keys(updates).length) {
        setSourceByReference((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transactions, sourceByReference]);

  const filteredTransactions = React.useMemo(() => {
    if (txTab === 'all') return transactions;
    if (txTab === TransactionType.CREDIT) return transactions.filter(isCreditTransaction);
    return transactions.filter(isDebitTransaction);
  }, [transactions, txTab]);

  const handleAddMoney = async () => {
    const num = Number(amount);
    if (!num || num < 1) return Alert.alert('Invalid', 'Enter a valid amount');
    setSubmitting(true);
    try {
      const order = await addMoney(num);
      const orderId = order?.order?.id || order?.orderId || order?.id;
      const serverPaymentId = order?.paymentId;
      if (!orderId) {
        Alert.alert('Error', 'Could not create payment order');
        return;
      }
      setRazorpayOrder({
        orderId,
        amount: num * 100,
        name: 'NyayaX',
        description: 'Add money to wallet',
        prefillEmail: user?.email || '',
        prefillPhone: user?.phone || '',
        prefillName: user?.name || '',
        paymentId: serverPaymentId,
      });
      setShowAdd(false);
      setShowRazorpay(true);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err.response?.data || err) || 'Failed to add money');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRazorpaySuccess = async (result: RazorpayPaymentResult) => {
    setShowRazorpay(false);
    try {
      await confirmAddMoney({
        paymentId: razorpayOrder?.paymentId || '',
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_order_id: result.razorpay_order_id,
        razorpay_signature: result.razorpay_signature,
      });
      Alert.alert('Success', 'Money added successfully');
      setAmount('');
      fetchBalance();
      fetchTransactions(1);
    } catch {
      Alert.alert('Error', 'Payment verification failed. Contact support if money was deducted.');
    }
  };

  const handleWithdraw = async () => {
    const num = Number(amount);
    if (!num || num < 1) return Alert.alert('Invalid', 'Enter a valid amount');
    if (num > balance) return Alert.alert('Insufficient', 'Amount exceeds wallet balance');
    setSubmitting(true);
    try {
      await withdraw(num);
      Alert.alert('Success', 'Withdrawal request submitted');
      setShowWithdraw(false);
      setAmount('');
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err.response?.data || err) || 'Failed to withdraw');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    const num = Number(amount);
    if (!num || num < 1) return Alert.alert('Invalid', 'Enter a valid amount');
    if (num > balance) return Alert.alert('Insufficient', 'Amount exceeds wallet balance');
    if (!transferUserId.trim()) return Alert.alert('Invalid', 'Enter user ID to transfer to');
    setSubmitting(true);
    try {
      await transfer(transferUserId.trim(), num, transferDesc.trim() || undefined);
      Alert.alert('Success', 'Transfer completed successfully');
      setShowTransfer(false);
      setAmount('');
      setTransferUserId('');
      setTransferDesc('');
      fetchBalance();
      fetchTransactions(1);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err.response?.data || err) || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([fetchBalance(), fetchTransactions(1)]).finally(() => setRefreshing(false));
  };

  const loadMore = () => {
    if (transactions.length < totalTransactions && !loading) {
      fetchTransactions(currentPage + 1);
    }
  };

  const getTransactionSource = (tx: WalletTransaction): string | null => {
    const ref = String(tx.referenceId || '').trim();
    if (ref && sourceByReference[ref]) return sourceByReference[ref];

    const description = String(tx.description || '').toLowerCase();
    if (description.includes('razorpay')) return 'Razorpay';
    if (description.includes('wallet')) return 'Wallet';

    const type = getTxType(tx);
    if (tx.type === TransactionType.WITHDRAWAL) return 'Wallet';
    if (CREDIT_TYPES.has(type as TransactionType) || DEBIT_TYPES.has(type as TransactionType)) {
      return 'Wallet';
    }
    return null;
  };

  const renderTransaction = ({ item }: { item: WalletTransaction }) => {
    const inferredCredit = isCreditTransaction(item);
    const inferredDebit = isDebitTransaction(item);
    const isCredit = inferredCredit && !inferredDebit;
    const absoluteAmount = Math.abs(Number(item.amount) || 0);
    const source = getTransactionSource(item);
    return (
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: isCredit ? '#e6f9f0' : '#fef1f1' }]}>
          <Ionicons
            name={isCredit ? 'arrow-down' : 'arrow-up'}
            size={18}
            color={isCredit ? COLORS.success : COLORS.error}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description || (isCredit ? 'Credit' : 'Debit')}</Text>
          <Text style={styles.txDate}>{formatDate(item.createdAt)} · {formatTime(item.createdAt)}</Text>
          {source && <Text style={styles.txSource}>Via {source}</Text>}
        </View>
        <Text style={[styles.txAmount, { color: isCredit ? COLORS.success : COLORS.error }]}>
          {isCredit ? '+' : '-'}₹{absoluteAmount.toLocaleString('en-IN')}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Balance card */}
      <LinearGradient colors={[COLORS.primary, COLORS.midnight]} style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>₹{balance.toLocaleString('en-IN')}</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setAmount(''); setShowAdd(true); }}>
            <Ionicons name="add-circle" size={22} color={COLORS.white} />
            <Text style={styles.actionText}>Add Money</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setAmount(''); setShowWithdraw(true); }}>
            <Ionicons name="download" size={22} color={COLORS.white} />
            <Text style={styles.actionText}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setAmount(''); setTransferUserId(''); setTransferDesc(''); setShowTransfer(true); }}>
            <Ionicons name="swap-horizontal" size={22} color={COLORS.white} />
            <Text style={styles.actionText}>Transfer</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.txHeader}>
        <Text style={styles.txTitle}>Transactions</Text>
      </View>
      <TabBar tabs={TX_TABS} active={txTab} onSelect={setTxTab} />

      {loading && transactions.length === 0 ? <Loading /> : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(t) => t.id}
          renderItem={renderTransaction}
          contentContainerStyle={styles.txList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState icon="💳" title="No Transactions" message="Your transaction history will appear here" />}
        />
      )}

      {/* Add Money Modal */}
      <BottomSheet visible={showAdd} onClose={() => setShowAdd(false)} title="Add Money">
        <View style={styles.modalContent}>
          <View style={styles.amountInput}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.amountField}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((q) => (
              <TouchableOpacity key={q} style={styles.quickChip} onPress={() => setAmount(String(q))}>
                <Text style={styles.quickText}>₹{q.toLocaleString('en-IN')}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button title="Add Money" onPress={handleAddMoney} loading={submitting} size="lg" />
        </View>
      </BottomSheet>

      {/* Withdraw Modal */}
      <BottomSheet visible={showWithdraw} onClose={() => setShowWithdraw(false)} title="Withdraw">
        <View style={styles.modalContent}>
          <View style={styles.amountInput}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.amountField}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <Text style={styles.availNote}>Available: ₹{balance.toLocaleString('en-IN')}</Text>
          <Button title="Withdraw" onPress={handleWithdraw} loading={submitting} size="lg" />
        </View>
      </BottomSheet>

      {/* Transfer Modal */}
      <BottomSheet visible={showTransfer} onClose={() => setShowTransfer(false)} title="Transfer Money">
        <View style={styles.modalContent}>
          <View style={styles.amountInput}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.amountField}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <TextInput
            style={styles.transferInput}
            value={transferUserId}
            onChangeText={setTransferUserId}
            placeholder="Recipient User ID"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.transferInput}
            value={transferDesc}
            onChangeText={setTransferDesc}
            placeholder="Description (optional)"
            placeholderTextColor={COLORS.textMuted}
          />
          <Text style={styles.availNote}>Available: ₹{balance.toLocaleString('en-IN')}</Text>
          <Button title="Transfer" onPress={handleTransfer} loading={submitting} size="lg" />
        </View>
      </BottomSheet>

      {/* Razorpay Checkout */}
      {razorpayOrder && (
        <RazorpayCheckout
          visible={showRazorpay}
          orderOptions={razorpayOrder}
          onSuccess={handleRazorpaySuccess}
          onCancel={() => { setShowRazorpay(false); Alert.alert('Cancelled', 'Payment was cancelled'); }}
          onError={(err) => { setShowRazorpay(false); Alert.alert('Payment Failed', err.description || 'Please try again'); }}
        />
      )}
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  balanceCard: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.huge + SPACING.md,
    padding: SPACING.xxl,
    borderRadius: BORDER_RADIUS.xxl,
    ...SHADOWS.lg,
  },
  balanceLabel: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  balanceValue: { fontSize: 36, fontWeight: '900', color: COLORS.white, marginTop: SPACING.sm },
  actionRow: { flexDirection: 'row', gap: SPACING.xl, marginTop: SPACING.xl },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
  },
  actionText: { color: COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  txHeader: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xxl, paddingBottom: SPACING.md },
  txTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  txList: { padding: SPACING.xl, paddingBottom: 100 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  txIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, marginLeft: SPACING.md },
  txDesc: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  txDate: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  txSource: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  txAmount: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  modalContent: { paddingBottom: SPACING.xl },
  amountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  rupee: { fontSize: FONT_SIZE.hero, fontWeight: '700', color: COLORS.textMuted, marginRight: SPACING.sm },
  amountField: { flex: 1, fontSize: FONT_SIZE.hero, fontWeight: '800', color: COLORS.text, paddingVertical: SPACING.lg },
  quickRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.xxl, flexWrap: 'wrap' },
  quickChip: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
  },
  quickText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  availNote: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.xl, textAlign: 'center' },
  transferInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
});

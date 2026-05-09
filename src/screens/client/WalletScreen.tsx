import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, FlatList, RefreshControl, ScrollView,
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
import { appointmentsApi, paymentsApi, bankAccountApi } from '../../services/api';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000];

// Tabs: All / Credits / Debits / Withdrawals. Withdrawals is its own tab so
// money-leaving-via-bank events surface separately from regular debits
// (booking deductions, transfers etc.) — matches the convention used by
// every consumer banking app and helps super admins audit cash-out flow.
const TX_TABS = [
  { key: 'all', label: 'All' },
  { key: TransactionType.CREDIT, label: 'Credits' },
  { key: TransactionType.DEBIT, label: 'Debits' },
  { key: TransactionType.WITHDRAWAL, label: 'Withdrawals' },
];

const getTxType = (tx: WalletTransaction): string => String(tx.type || '').trim().toUpperCase();

// Money-in: regular CREDITs and REFUNDs, plus TRANSFER rows that are clearly
// the receiving side of a transfer (description includes "received").
const CREDIT_TYPES = new Set([TransactionType.CREDIT, TransactionType.REFUND]);
// Money-out via a regular debit (booking deduction, sent transfer). Note
// that WITHDRAWAL is intentionally NOT in this set anymore — it has its
// own tab, and the two should not double-count.
const DEBIT_TYPES = new Set([TransactionType.DEBIT, TransactionType.PAYMENT]);

const isCreditTransaction = (tx: WalletTransaction): boolean => {
  const type = getTxType(tx);
  const description = String(tx.description || '').toLowerCase();
  if (CREDIT_TYPES.has(type as TransactionType)) return true;
  if (type === TransactionType.TRANSFER) {
    return description.includes('received') || description.includes('credited');
  }
  return false;
};

const isWithdrawalTransaction = (tx: WalletTransaction): boolean =>
  getTxType(tx) === TransactionType.WITHDRAWAL;

const isDebitTransaction = (tx: WalletTransaction): boolean => {
  const type = getTxType(tx);
  const description = String(tx.description || '').toLowerCase();
  if (DEBIT_TYPES.has(type as TransactionType)) return true;
  if (type === TransactionType.TRANSFER) {
    return description.includes('sent') || description.includes('debited');
  }
  return false;
};

interface BankAccountLite {
  id: string;
  type?: 'BANK' | 'UPI';
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
  label?: string;
  isDefault?: boolean;
}

const maskAccountNumber = (n?: string) => {
  if (!n) return '';
  const trimmed = n.replace(/\s+/g, '');
  if (trimmed.length <= 4) return trimmed;
  return `••••${trimmed.slice(-4)}`;
};

const bankAccountLabel = (a: BankAccountLite): string => {
  if (a.type === 'UPI' && a.upiId) return a.upiId;
  const bank = a.bankName || 'Bank';
  const tail = maskAccountNumber(a.accountNumber);
  return tail ? `${bank} · ${tail}` : bank;
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
  const insets = useSafeAreaInsets();

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
  // Bank-account picker for the Withdraw flow. We fetch on demand so the
  // user always sees the freshest list (e.g. they just added an account on
  // the BankAccounts screen and came back). Default account, if any, is
  // pre-selected.
  const [bankAccounts, setBankAccounts] = useState<BankAccountLite[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
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
    if (txTab === TransactionType.WITHDRAWAL) return transactions.filter(isWithdrawalTransaction);
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

  // Open the Withdraw sheet. We pre-load the saved bank/UPI accounts so the
  // user can pick a destination before submitting. If they have none, we
  // bounce them to the BankAccounts screen instead of letting them try a
  // withdrawal that has nowhere to land.
  const openWithdrawSheet = useCallback(async () => {
    setAmount('');
    setBankAccountsLoading(true);
    setShowWithdraw(true);
    try {
      const { data } = await bankAccountApi.getAll();
      // Server wraps the array in `{ data: [...] }` (matches the
      // BankAccountsScreen unwrap). We try a few well-known keys, then
      // hard-fall back to an empty array — never assign the wrapper
      // object itself to `list`, otherwise list.find / list.map blow up.
      const raw = (data as any)?.data
        ?? (data as any)?.bankAccounts
        ?? (data as any)?.accounts
        ?? (data as any)?.items
        ?? data;
      const list: BankAccountLite[] = Array.isArray(raw) ? raw : [];
      setBankAccounts(list);
      // Pre-select the default account, falling back to the first one.
      const def = list.find((a) => a.isDefault) || list[0];
      setSelectedBankAccountId(def?.id ?? null);
      if (!list.length) {
        setShowWithdraw(false);
        Alert.alert(
          'No bank account',
          'Add a bank account or UPI ID before withdrawing.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add account', onPress: () => navigation.navigate('BankAccounts') },
          ],
        );
      }
    } catch (err: any) {
      setShowWithdraw(false);
      setBankAccounts([]);
      setSelectedBankAccountId(null);
      Alert.alert('Error', formatErrorMessage(err.response?.data || err) || 'Failed to load bank accounts');
    } finally {
      setBankAccountsLoading(false);
    }
  }, [navigation]);

  const handleWithdraw = async () => {
    const num = Number(amount);
    if (!num || num < 1) return Alert.alert('Invalid', 'Enter a valid amount');
    if (num > balance) return Alert.alert('Insufficient', 'Amount exceeds wallet balance');
    if (!selectedBankAccountId) return Alert.alert('Select account', 'Pick a destination bank or UPI account.');
    setSubmitting(true);
    try {
      await withdraw(num, selectedBankAccountId);
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
    // Money-in vs money-out is the only thing the row needs to communicate.
    // We use the explicit + / - icon (matching the +₹ / -₹ amount) instead
    // of up/down arrows because users found the arrow direction ambiguous —
    // an "up" arrow next to a -₹ red figure read as a contradiction.
    const credit = isCreditTransaction(item);
    const debit = isDebitTransaction(item);
    const withdrawal = isWithdrawalTransaction(item);
    const isCredit = credit && !debit && !withdrawal;
    const absoluteAmount = Math.abs(Number(item.amount) || 0);
    const source = getTransactionSource(item);
    const fallbackLabel = isCredit
      ? 'Credit'
      : withdrawal
        ? 'Withdrawal'
        : 'Debit';
    return (
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: isCredit ? '#e6f9f0' : '#fef1f1' }]}>
          <Ionicons
            name={isCredit ? 'add' : 'remove'}
            size={20}
            color={isCredit ? COLORS.success : COLORS.error}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txDesc} numberOfLines={1}>{item.description || fallbackLabel}</Text>
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionRow}
        >
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setAmount(''); setShowAdd(true); }}>
            <Ionicons name="add-circle" size={22} color={COLORS.white} />
            <Text style={styles.actionText}>Add Money</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={openWithdrawSheet}>
            <Ionicons name="download" size={22} color={COLORS.white} />
            <Text style={styles.actionText}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { setAmount(''); setTransferUserId(''); setTransferDesc(''); setShowTransfer(true); }}>
            <Ionicons name="swap-horizontal" size={22} color={COLORS.white} />
            <Text style={styles.actionText}>Transfer</Text>
          </TouchableOpacity>
        </ScrollView>
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
          contentContainerStyle={[styles.txList, { paddingBottom: Math.max(120, insets.bottom + 90) }]}
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

      {/* Withdraw Modal — bank/UPI picker is mandatory.
          The opener pre-fetches accounts; if the user has none, it bounces
          to BankAccounts before the sheet ever shows. */}
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

          <Text style={styles.pickerLabel}>SEND TO</Text>
          {bankAccountsLoading ? (
            <View style={styles.pickerEmpty}>
              <Text style={styles.pickerEmptyText}>Loading accounts…</Text>
            </View>
          ) : bankAccounts.length === 0 ? (
            <TouchableOpacity
              style={styles.pickerEmpty}
              onPress={() => { setShowWithdraw(false); navigation.navigate('BankAccounts'); }}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={[styles.pickerEmptyText, { color: COLORS.primary }]}>
                Add a bank or UPI account
              </Text>
            </TouchableOpacity>
          ) : (
            <ScrollView
              style={{ maxHeight: 240 }}
              contentContainerStyle={{ paddingBottom: SPACING.sm }}
              showsVerticalScrollIndicator={false}
            >
              {bankAccounts.map((acc) => {
                const active = selectedBankAccountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.bankRow, active && styles.bankRowActive]}
                    onPress={() => setSelectedBankAccountId(acc.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.bankIcon, { backgroundColor: COLORS.primaryLight + '22' }]}>
                      <Ionicons
                        name={acc.type === 'UPI' ? 'phone-portrait-outline' : 'business-outline'}
                        size={18}
                        color={COLORS.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bankTitle} numberOfLines={1}>
                        {acc.label || bankAccountLabel(acc)}
                        {acc.isDefault ? '  ·  Default' : ''}
                      </Text>
                      <Text style={styles.bankSub} numberOfLines={1}>
                        {acc.type === 'UPI'
                          ? (acc.upiId || 'UPI')
                          : `${acc.accountHolderName || 'Account'}${acc.ifscCode ? ` · ${acc.ifscCode}` : ''}`}
                      </Text>
                    </View>
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={active ? COLORS.primary : COLORS.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.bankRowAdd}
                onPress={() => { setShowWithdraw(false); navigation.navigate('BankAccounts'); }}
              >
                <Ionicons name="add" size={18} color={COLORS.primary} />
                <Text style={styles.bankRowAddText}>Add another account</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          <Button
            title="Withdraw"
            onPress={handleWithdraw}
            loading={submitting}
            size="lg"
            disabled={bankAccounts.length === 0 || !selectedBankAccountId}
          />
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
  actionRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl, paddingRight: SPACING.md },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 140,
  },
  actionText: { color: COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  txHeader: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xxl, paddingBottom: SPACING.md },
  txTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  txList: { padding: SPACING.xl, paddingBottom: 120 },
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

  // Bank/UPI picker rows shown inside the Withdraw sheet
  pickerLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 1, marginBottom: SPACING.sm,
  },
  pickerEmpty: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderLight, borderStyle: 'dashed',
    marginBottom: SPACING.xl,
  },
  pickerEmptyText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontWeight: '600' },
  bankRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1, borderColor: 'transparent',
    marginBottom: SPACING.sm,
  },
  bankRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight + '14' },
  bankIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  bankTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  bankSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  bankRowAdd: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  bankRowAddText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.primary },
});

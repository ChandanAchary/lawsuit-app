import { useThemeStore } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminApi } from '../../services/api';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';

const MAIN_TABS = [
  { key: 'wallets', label: 'Wallets' },
  { key: 'withdrawals', label: 'Withdrawals' },
];

export const AdminWalletsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState('wallets');
  const [wallets, setWallets] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Credit/Debit modal
  const [showAction, setShowAction] = useState<'credit' | 'debit' | null>(null);
  const [actionUserId, setActionUserId] = useState('');
  const [actionAmount, setActionAmount] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      if (tab === 'wallets') {
        const { data } = await adminApi.getWallets();
        setWallets(data.wallets || data.items || data || []);
      } else {
        const { data } = await adminApi.getWithdrawals();
        setWithdrawals(data.withdrawals || data.items || data || []);
      }
    } catch { tab === 'wallets' ? setWallets([]) : setWithdrawals([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreditDebit = async () => {
    const amount = Number(actionAmount);
    if (!actionUserId.trim()) return Alert.alert('Error', 'Enter a user ID');
    if (!amount || amount < 1) return Alert.alert('Error', 'Enter a valid amount');
    if (!actionReason.trim()) return Alert.alert('Error', 'Enter a reason');
    setSubmitting(true);
    try {
      if (showAction === 'credit') {
        await adminApi.creditWallet(actionUserId.trim(), amount, actionReason.trim());
      } else {
        await adminApi.debitWallet(actionUserId.trim(), amount, actionReason.trim());
      }
      Alert.alert('Success', `Wallet ${showAction}ed successfully`);
      setShowAction(null);
      setActionUserId(''); setActionAmount(''); setActionReason('');
      fetchData(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || `Failed to ${showAction} wallet`);
    } finally { setSubmitting(false); }
  };

  const handleReverseWithdrawal = (id: string) => {
    Alert.prompt?.('Reverse Withdrawal', 'Enter reason for reversal:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reverse', style: 'destructive', onPress: async (reason?: string) => {
        if (!reason?.trim()) return Alert.alert('Error', 'Reason is required');
        try {
          await adminApi.reverseWithdrawal(id);
          Alert.alert('Success', 'Withdrawal reversed');
          fetchData(false);
        } catch (err: any) {
          Alert.alert('Error', err.response?.data?.error || 'Failed to reverse');
        }
      }},
    ]) ?? Alert.alert('Reverse', 'Reversal is supported on iOS only at this time.');
  };

  const renderWallet = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.iconBg, { backgroundColor: '#D1FAE5' }]}>
          <Ionicons name="wallet" size={20} color="#10B981" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>₹{Number(item.balance || 0).toLocaleString('en-IN')}</Text>
          <Text style={styles.cardSub}>User: {(item.userId || '').slice(0, 12)}...</Text>
        </View>
      </View>
    </View>
  );

  const renderWithdrawal = ({ item }: { item: any }) => {
    const isPending = item.status === 'PENDING';
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={[styles.iconBg, { backgroundColor: isPending ? '#EDE9FE' : '#D1FAE5' }]}>
            <Ionicons name="download" size={20} color={isPending ? '#8B5CF6' : '#10B981'} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>₹{Number(item.amount || 0).toLocaleString('en-IN')}</Text>
            <Text style={styles.cardSub}>{item.status} · User: {(item.userId || '').slice(0, 8)}...</Text>
          </View>
          {item.status === 'COMPLETED' && (
            <TouchableOpacity style={styles.reverseBtn} onPress={() => handleReverseWithdrawal(item.id)}>
              <Text style={styles.reverseText}>Reverse</Text>
            </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Wallet Management</Text>
      </View>
      <TabBar tabs={MAIN_TABS} active={tab} onSelect={setTab} />

      {tab === 'wallets' && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]} onPress={() => setShowAction('credit')}>
            <Ionicons name="add-circle" size={18} color="#10B981" />
            <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Credit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => setShowAction('debit')}>
            <Ionicons name="remove-circle" size={18} color="#EF4444" />
            <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Debit</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? <Loading /> : (
        <FlatList
          data={tab === 'wallets' ? wallets : withdrawals}
          keyExtractor={(item) => item.id}
          renderItem={tab === 'wallets' ? renderWallet : renderWithdrawal}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="💰" title={tab === 'wallets' ? 'No Wallets' : 'No Withdrawals'} message="Nothing to show" />}
        />
      )}

      {/* Credit/Debit Modal */}
      <Modal visible={!!showAction} transparent animationType="slide" onRequestClose={() => setShowAction(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{showAction === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}</Text>
              <TouchableOpacity onPress={() => setShowAction(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.input}
                value={actionUserId}
                onChangeText={setActionUserId}
                placeholder="User ID"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                value={actionAmount}
                onChangeText={setActionAmount}
                placeholder="Amount (₹)"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={actionReason}
                onChangeText={setActionReason}
                placeholder="Reason"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
              <Button
                title={showAction === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
                onPress={handleCreditDebit}
                loading={submitting}
                size="lg"
              />
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
  actionRow: {
    flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, borderRadius: BORDER_RADIUS.full,
  },
  actionBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  cardSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  reverseBtn: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, backgroundColor: '#FEE2E2',
  },
  reverseText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: '#EF4444' },
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
  input: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md,
  },
});

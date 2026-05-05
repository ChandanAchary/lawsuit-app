import {  useThemeStore , useColors } from '../../stores/themeStore';
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
import { formatErrorMessage } from '../../utils/formatError';

const MAIN_TABS = [
  { key: 'wallets', label: 'Wallets' },
  { key: 'withdrawals', label: 'Withdrawals' },
];

// Wallet monitoring is read-only as of Phase 1: manual credit/debit endpoints
// were removed server-side. The only money-out escape hatch left is reversing
// an already-processed withdrawal in case of fraud.
export const AdminWalletsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState('wallets');
  const [wallets, setWallets] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [reverseWithdrawalId, setReverseWithdrawalId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
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

  const handleReverseWithdrawal = (id: string) => {
    setReverseWithdrawalId(id);
    setReverseReason('');
  };

  const submitReverseWithdrawal = async () => {
    if (!reverseWithdrawalId) return;
    if (!reverseReason.trim()) return Alert.alert('Error', 'Reason is required');

    setSubmitting(true);
    try {
      await adminApi.reverseWithdrawal(reverseWithdrawalId, reverseReason.trim());
      Alert.alert('Success', 'Withdrawal reversed');
      setReverseWithdrawalId(null);
      setReverseReason('');
      fetchData(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to reverse');
    } finally {
      setSubmitting(false);
    }
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
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.noticeText}>
            Wallet balances are read-only here. Money in/out flows only through bookings, refunds, and payouts.
          </Text>
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

      <Modal visible={!!reverseWithdrawalId} transparent animationType="slide" onRequestClose={() => setReverseWithdrawalId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reverse Withdrawal</Text>
              <TouchableOpacity onPress={() => setReverseWithdrawalId(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                value={reverseReason}
                onChangeText={setReverseReason}
                placeholder="Reason for reversal"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
              <Button
                title="Reverse Withdrawal"
                onPress={submitReverseWithdrawal}
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
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  noticeText: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 16 },
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

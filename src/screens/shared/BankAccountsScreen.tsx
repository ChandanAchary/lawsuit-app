import { useThemeStore } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Modal, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { formatErrorMessage } from '../../utils/formatError';
import { bankAccountApi } from '../../services/api';

interface BankAccount {
  id: string;
  type: 'BANK' | 'UPI';
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
  label?: string;
  isDefault: boolean;
}

type TabType = 'BANK' | 'UPI';

export const BankAccountsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('BANK');
  const [saving, setSaving] = useState(false);

  // Bank fields
  const [holderName, setHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [label, setLabel] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // UPI fields
  const [upiId, setUpiId] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);
  const [verifyingUpi, setVerifyingUpi] = useState(false);

  // IFSC lookup
  const [lookingUpIfsc, setLookingUpIfsc] = useState(false);

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await bankAccountApi.getAll();
      const list = res.data?.data || res.data || [];
      setAccounts(Array.isArray(list) ? list : []);
    } catch { setAccounts([]); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setHolderName(''); setAccountNumber(''); setIfsc(''); setBankName('');
    setLabel(''); setIsDefault(false); setUpiId(''); setUpiVerified(false);
    setActiveTab('BANK');
  };

  const openModal = () => { resetForm(); setModalVisible(true); };

  const handleIfscLookup = async (code: string) => {
    setIfsc(code);
    if (code.length === 11) {
      setLookingUpIfsc(true);
      try {
        const res = await bankAccountApi.lookupIfsc(code);
        const d = res.data?.data || res.data || {};
        if (d.BANK) setBankName(d.BANK);
        else if (d.bankName) setBankName(d.bankName);
      } catch { /* ignore */ }
      finally { setLookingUpIfsc(false); }
    }
  };

  const handleVerifyUpi = async () => {
    if (!upiId.includes('@')) { Alert.alert('Invalid', 'Enter a valid UPI ID'); return; }
    setVerifyingUpi(true);
    try {
      const res = await bankAccountApi.verifyUpi(upiId);
      const result = res.data?.data || res.data;
      const verified = result?.isValid ?? result?.success;
      if (verified) { setUpiVerified(true); Alert.alert('Verified', result?.name ? `Verified: ${result.name}` : 'UPI ID verified successfully'); }
      else { Alert.alert('Failed', 'Could not verify UPI ID'); }
    } catch { Alert.alert('Error', 'UPI verification failed'); }
    finally { setVerifyingUpi(false); }
  };

  const handleSave = async () => {
    if (activeTab === 'BANK') {
      if (!holderName || !accountNumber || !ifsc) {
        Alert.alert('Missing Info', 'Please fill account holder name, account number and IFSC');
        return;
      }
    } else {
      if (!upiId) { Alert.alert('Missing Info', 'Please enter UPI ID'); return; }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = activeTab === 'BANK'
        ? { type: 'BANK', accountHolderName: holderName, accountNumber, ifscCode: ifsc, bankName, label, isDefault }
        : { type: 'UPI', upiId, label, isDefault };
      await bankAccountApi.create(payload);
      setModalVisible(false);
      fetchAccounts();
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err.response?.data?.message || err.response?.data || err));
    } finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Account', 'Are you sure you want to remove this account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await bankAccountApi.delete(id); fetchAccounts(); }
          catch { Alert.alert('Error', 'Failed to delete account'); }
        },
      },
    ]);
  };

  const renderAccountCard = (acc: BankAccount) => (
    <View key={acc.id} style={styles.accountCard}>
      <View style={styles.accountRow}>
        <View style={[styles.accountIcon, { backgroundColor: acc.type === 'BANK' ? COLORS.infoLight : COLORS.pendingLight }]}>
          <Ionicons
            name={acc.type === 'BANK' ? 'business-outline' : 'phone-portrait-outline'}
            size={20} color={acc.type === 'BANK' ? COLORS.info : COLORS.pending}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.accountTitle}>
            {acc.type === 'BANK' ? (acc.bankName || 'Bank Account') : 'UPI'}
            {acc.label ? ` • ${acc.label}` : ''}
          </Text>
          <Text style={styles.accountSub}>
            {acc.type === 'BANK'
              ? `${acc.accountHolderName} • ••••${acc.accountNumber?.slice(-4)}`
              : acc.upiId}
          </Text>
          {acc.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => handleDelete(acc.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bank & UPI Accounts</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Add button */}
          <TouchableOpacity style={styles.addBtn} onPress={openModal}>
            <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
            <Text style={styles.addBtnText}>Add Bank Account or UPI</Text>
          </TouchableOpacity>

          {accounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={56} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>No Accounts Added</Text>
              <Text style={styles.emptySub}>Add a bank account or UPI ID for withdrawals</Text>
            </View>
          ) : (
            accounts.map(renderAccountCard)
          )}
        </ScrollView>
      )}

      {/* Add Account Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Account</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
              {(['BANK', 'UPI'] as TabType[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Ionicons
                    name={tab === 'BANK' ? 'business-outline' : 'phone-portrait-outline'}
                    size={16} color={activeTab === tab ? COLORS.white : COLORS.textSecondary}
                  />
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                    {tab === 'BANK' ? 'Bank Account' : 'UPI ID'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 24 }}>
              {activeTab === 'BANK' ? (
                <>
                  <FieldInput label="Account Holder Name" value={holderName} onChangeText={setHolderName} placeholder="Full name" />
                  <FieldInput label="Account Number" value={accountNumber} onChangeText={setAccountNumber} placeholder="Enter account number" keyboardType="numeric" />
                  <View>
                    <FieldInput label="IFSC Code" value={ifsc} onChangeText={handleIfscLookup} placeholder="e.g. SBIN0001234" autoCapitalize="characters" maxLength={11} />
                    {lookingUpIfsc && <ActivityIndicator size="small" color={COLORS.primary} style={{ position: 'absolute', right: 16, top: 38 }} />}
                  </View>
                  <FieldInput label="Bank Name" value={bankName} onChangeText={setBankName} placeholder="Auto-filled from IFSC" />
                </>
              ) : (
                <>
                  <FieldInput label="UPI ID" value={upiId} onChangeText={(t) => { setUpiId(t); setUpiVerified(false); }} placeholder="name@upi" />
                  <TouchableOpacity
                    style={[styles.verifyBtn, upiVerified && styles.verifyBtnDone]}
                    onPress={handleVerifyUpi} disabled={verifyingUpi || upiVerified}
                  >
                    {verifyingUpi ? <ActivityIndicator size="small" color={COLORS.white} /> : (
                      <>
                        <Ionicons name={upiVerified ? 'checkmark-circle' : 'shield-checkmark-outline'} size={16} color={COLORS.white} />
                        <Text style={styles.verifyBtnText}>{upiVerified ? 'Verified' : 'Verify UPI'}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <FieldInput label="Label (optional)" value={label} onChangeText={setLabel} placeholder="e.g. Salary Account" />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Set as default</Text>
                <Switch
                  value={isDefault} onValueChange={setIsDefault}
                  trackColor={{ true: COLORS.primary, false: COLORS.border }}
                  thumbColor={COLORS.white}
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : (
                <Text style={styles.saveBtnText}>Add Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

/* ─── Field Input helper ─── */
const FieldInput: React.FC<{
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric'; autoCapitalize?: 'none' | 'characters';
  maxLength?: number;
}> = ({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, maxLength }) => (
  <View style={fiStyles.field}>
    <Text style={fiStyles.label}>{label}</Text>
    <TextInput
      style={fiStyles.input} value={value} onChangeText={onChangeText}
      placeholder={placeholder} placeholderTextColor={COLORS.textLight}
      keyboardType={keyboardType} autoCapitalize={autoCapitalize} maxLength={maxLength}
    />
  </View>
);

const fiStyles = StyleSheet.create({
  field: { marginBottom: SPACING.lg },
  label: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600', marginBottom: SPACING.xs },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, backgroundColor: COLORS.white,
  },
});

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge, paddingBottom: SPACING.xl,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.white },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: SPACING.xl, paddingBottom: 100 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    justifyContent: 'center', marginBottom: SPACING.xl,
  },
  addBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
  emptyState: { alignItems: 'center', marginTop: SPACING.huge },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.xl },
  emptySub: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.sm },
  accountCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  accountIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  accountTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  accountSub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  defaultBadge: {
    backgroundColor: COLORS.successLight, paddingHorizontal: SPACING.sm,
    paddingVertical: 2, borderRadius: BORDER_RADIUS.sm, alignSelf: 'flex-start', marginTop: SPACING.xs,
  },
  defaultBadgeText: { fontSize: FONT_SIZE.xs, color: COLORS.success, fontWeight: '600' },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.errorLight, alignItems: 'center', justifyContent: 'center',
  },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  modalContainer: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.md,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  tabsRow: { flexDirection: 'row', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginBottom: SPACING.xl },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  modalScroll: { paddingHorizontal: SPACING.xl },
  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full, marginBottom: SPACING.lg,
  },
  verifyBtnDone: { backgroundColor: COLORS.success },
  verifyBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.white },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  switchLabel: { fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '600' },
  saveBtn: {
    backgroundColor: COLORS.primary, marginHorizontal: SPACING.xl, marginBottom: SPACING.xxl,
    paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.full,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.white },
});

import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminApi } from '../../services/api';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { formatDate } from '../../utils/date';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'history', label: 'My Verifications' },
];

export const LawyerVerificationScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const initialTab = route?.params?.tab || 'pending';
  const [tab, setTab] = useState(initialTab);
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Action modal
  const [selectedLawyer, setSelectedLawyer] = useState<any>(null);
  const [actionType, setActionType] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      if (tab === 'pending') {
        const { data } = await courtAdminApi.getPendingVerifications();
        setPending(data.lawyers || data || []);
      } else {
        const { data } = await courtAdminApi.getMyVerifications();
        setHistory(data.verifications || data.items || data || []);
      }
    } catch { tab === 'pending' ? setPending([]) : setHistory([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVerify = async () => {
    if (!selectedLawyer || !actionType) return;
    setSubmitting(true);
    try {
      await courtAdminApi.verifyLawyer(selectedLawyer.id, {
        status: actionType,
        remarks: remarks.trim() || undefined,
      });
      Alert.alert('Success', `Lawyer ${actionType.toLowerCase()} successfully`);
      setSelectedLawyer(null);
      setActionType(null);
      setRemarks('');
      fetchData(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Verification failed');
    } finally { setSubmitting(false); }
  };

  const openAction = (lawyer: any, type: 'APPROVED' | 'REJECTED') => {
    setSelectedLawyer(lawyer);
    setActionType(type);
    setRemarks('');
  };

  const renderPending = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBg, { backgroundColor: '#EDE9FE' }]}>
          <Ionicons name="person" size={22} color="#8B5CF6" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name || 'Unknown Lawyer'}</Text>
          <Text style={styles.cardSub}>{item.email || ''}</Text>
        </View>
      </View>
      <View style={styles.detailsGrid}>
        {item.licenseNumber && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>License</Text>
            <Text style={styles.detailValue}>{item.licenseNumber}</Text>
          </View>
        )}
        {item.barCouncilId && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Bar Council</Text>
            <Text style={styles.detailValue}>{item.barCouncilId}</Text>
          </View>
        )}
        {item.experienceYears != null && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Experience</Text>
            <Text style={styles.detailValue}>{item.experienceYears} yrs</Text>
          </View>
        )}
        {item.specializations?.length > 0 && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Specializations</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{item.specializations.join(', ')}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]} onPress={() => openAction(item, 'APPROVED')}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={[styles.actionText, { color: '#10B981' }]}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => openAction(item, 'REJECTED')}>
          <Ionicons name="close-circle" size={18} color="#EF4444" />
          <Text style={[styles.actionText, { color: '#EF4444' }]}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHistory = ({ item }: { item: any }) => {
    const isApproved = item.status === 'APPROVED';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBg, { backgroundColor: isApproved ? '#D1FAE5' : '#FEE2E2' }]}>
            <Ionicons name={isApproved ? 'checkmark-circle' : 'close-circle'} size={22} color={isApproved ? '#10B981' : '#EF4444'} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>Lawyer ID: {(item.lawyerId || '').slice(0, 12)}...</Text>
            <Text style={styles.cardSub}>{item.status} · {formatDate(item.verifiedAt || item.createdAt)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isApproved ? '#D1FAE5' : '#FEE2E2' }]}>
            <Text style={[styles.badgeText, { color: isApproved ? '#10B981' : '#EF4444' }]}>{item.status}</Text>
          </View>
        </View>
        {item.remarks && (
          <Text style={styles.remarks}>Remarks: {item.remarks}</Text>
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
        <Text style={styles.headerTitle}>Lawyer Verification</Text>
      </View>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      {loading ? <Loading /> : (
        <FlatList
          data={tab === 'pending' ? pending : history}
          keyExtractor={(item) => item.id}
          renderItem={tab === 'pending' ? renderPending : renderHistory}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon={tab === 'pending' ? '✅' : '📋'}
              title={tab === 'pending' ? 'No Pending Verifications' : 'No Verification History'}
              message={tab === 'pending' ? 'All lawyers have been reviewed' : 'Your verifications will appear here'}
            />
          }
        />
      )}

      {/* Verify/Reject Modal */}
      <Modal visible={!!actionType} transparent animationType="slide" onRequestClose={() => { setActionType(null); setSelectedLawyer(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{actionType === 'APPROVED' ? 'Approve Lawyer' : 'Reject Lawyer'}</Text>
              <TouchableOpacity onPress={() => { setActionType(null); setSelectedLawyer(null); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.confirmText}>
                {actionType === 'APPROVED'
                  ? `Are you sure you want to approve ${selectedLawyer?.name || 'this lawyer'}?`
                  : `Are you sure you want to reject ${selectedLawyer?.name || 'this lawyer'}?`}
              </Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Add remarks (optional)"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
              <Button
                title={actionType === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection'}
                onPress={handleVerify}
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
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  detailsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md,
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  detailItem: { width: '45%' },
  detailLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  detailValue: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  cardActions: {
    flexDirection: 'row', gap: SPACING.md,
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg,
  },
  actionText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  badge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  remarks: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.md, fontStyle: 'italic' },
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
  confirmText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 22 },
  input: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.lg,
  },
});

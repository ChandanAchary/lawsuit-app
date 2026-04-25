import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { formatDate } from '../../utils/date';

export const OrgRequestsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [requests, setRequests] = useState<any[]>([]);
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Assign Modal
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [actionType, setActionType] = useState<'ASSIGN' | 'REJECT' | null>(null);
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [reqRes, lawRes] = await Promise.all([
        organizationsApi.listOrgAppointmentRequests(),
        organizationsApi.listLawyers(),
      ]);
      setRequests(reqRes.data.requests || reqRes.data.items || reqRes.data || []);
      setLawyers(lawRes.data.lawyers || lawRes.data.items || lawRes.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async () => {
    if (!selectedReq || !actionType) return;
    if (actionType === 'ASSIGN' && !selectedLawyerId) return Alert.alert('Required', 'Please select a lawyer');
    setSubmitting(true);
    try {
      if (actionType === 'ASSIGN') {
        await organizationsApi.assignAppointmentRequest(selectedReq.id, { lawyerId: selectedLawyerId });
        Alert.alert('Success', 'Request assigned to lawyer');
      } else {
        await organizationsApi.rejectAppointmentRequest(selectedReq.id, { reason });
        Alert.alert('Success', 'Request rejected');
      }
      setSelectedReq(null); setActionType(null); setReason(''); setSelectedLawyerId('');
      fetchData(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to process request');
    } finally { setSubmitting(false); }
  };

  const renderRequest = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color={COLORS.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.client?.name || 'Client'}</Text>
          <Text style={styles.cardMeta}>{formatDate(item.createdAt)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'PENDING' ? '#FEF3C7' : COLORS.surfaceAlt }]}>
          <Text style={[styles.statusText, { color: item.status === 'PENDING' ? '#D97706' : COLORS.text }]}>{item.status}</Text>
        </View>
      </View>
      {item.reason && <Text style={styles.reasonText}>Reason: {item.reason}</Text>}
      {item.status === 'PENDING' && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]} onPress={() => { setSelectedReq(item); setActionType('ASSIGN'); }}>
            <Ionicons name="person-add" size={18} color="#10B981" />
            <Text style={[styles.actionText, { color: '#10B981' }]}>Assign Lawyer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => { setSelectedReq(item); setActionType('REJECT'); }}>
            <Ionicons name="close" size={18} color="#EF4444" />
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment Requests</Text>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="calendar" title="No Requests" message="You have no appointment requests" />}
        />
      )}

      <Modal visible={!!actionType} transparent animationType="slide" onRequestClose={() => { setActionType(null); setSelectedReq(null); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{actionType === 'ASSIGN' ? 'Assign Lawyer' : 'Reject Request'}</Text>
              <TouchableOpacity onPress={() => { setActionType(null); setSelectedReq(null); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              {actionType === 'ASSIGN' ? (
                <>
                  <Text style={styles.label}>Select a lawyer to handle this request:</Text>
                  {lawyers.length === 0 ? <Text style={styles.errorText}>No lawyers available. Add lawyers to your team first.</Text> : (
                    <View style={styles.lawyerList}>
                      {lawyers.map((l) => (
                        <TouchableOpacity
                          key={l.id}
                          style={[styles.lawyerChip, selectedLawyerId === l.id && styles.lawyerChipActive]}
                          onPress={() => setSelectedLawyerId(l.id)}
                        >
                          <Text style={[styles.lawyerChipText, selectedLawyerId === l.id && styles.lawyerChipTextActive]}>{l.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Reason for rejection (optional)" value={reason} onChangeText={setReason} multiline placeholderTextColor={COLORS.textMuted} />
              )}
              <Button title="Confirm" onPress={handleAction} loading={submitting} size="lg" disabled={actionType === 'ASSIGN' && !selectedLawyerId} />
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
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { marginLeft: SPACING.md, fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight + '20', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  cardMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  reasonText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.md, fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg },
  actionText: { fontSize: FONT_SIZE.sm, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: SPACING.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.xl, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  modalBody: { padding: SPACING.xl },
  label: { fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md },
  errorText: { color: COLORS.error, fontSize: FONT_SIZE.sm, marginBottom: SPACING.lg },
  lawyerList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl },
  lawyerChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border },
  lawyerChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  lawyerChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  lawyerChipTextActive: { color: COLORS.white },
  input: { backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md },
});

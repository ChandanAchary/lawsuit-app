import { useThemeStore } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: '#D1FAE5', text: '#10B981' },
  INACTIVE: { bg: '#EDE9FE', text: '#8B5CF6' },
  SUSPENDED: { bg: '#FEE2E2', text: '#EF4444' },
};

export const CourtAdminManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useThemeStore((s: any) => s.isDark ? require('../../stores/themeStore').DARK_COLORS : require('../../constants').COLORS);
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', courtId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [courts, setCourts] = useState<any[]>([]);

  const fetchAdmins = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await courtAdminApi.getAdmins();
      setAdmins(data.admins || data.courtAdmins || data.items || data || []);
    } catch { setAdmins([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const fetchCourts = useCallback(async () => {
    try {
      const { data } = await courtAdminApi.getCourts();
      setCourts(data.courts || data.items || data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchAdmins(); fetchCourts(); }, []);

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.password.trim() || !formData.courtId) {
      return Alert.alert('Error', 'All fields are required');
    }
    setSubmitting(true);
    try {
      await courtAdminApi.createAdmin(formData);
      Alert.alert('Success', 'Court admin created');
      setShowCreate(false);
      setFormData({ name: '', email: '', phone: '', password: '', courtId: '' });
      fetchAdmins(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create');
    } finally { setSubmitting(false); }
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const statuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'].filter(s => s !== currentStatus);
    Alert.alert('Change Status', `Current: ${currentStatus}`, [
      { text: 'Cancel', style: 'cancel' },
      ...statuses.map(s => ({
        text: s, onPress: async () => {
          try {
            await courtAdminApi.updateAdminStatus(id, s);
            Alert.alert('Success', `Status changed to ${s}`);
            fetchAdmins(false);
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Status change failed');
          }
        },
      })),
    ]);
  };

  const renderAdmin = ({ item }: { item: any }) => {
    const sc = STATUS_COLORS[item.status] || STATUS_COLORS.ACTIVE;
    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={[styles.iconBg, { backgroundColor: '#EDE9FE' }]}>
            <Ionicons name="person-circle" size={22} color="#8B5CF6" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{item.name}</Text>
            <Text style={styles.cardSub}>{item.email}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.courtLabel}>
            Court: {item.court?.name || item.courtId?.slice(0, 12) || 'N/A'}
          </Text>
          <TouchableOpacity style={styles.statusBtn} onPress={() => handleToggleStatus(item.id, item.status)}>
            <Text style={styles.statusBtnText}>Change Status</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Court Admins</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      {loading ? <Loading /> : (
        <FlatList
          data={admins}
          keyExtractor={(a) => a.id}
          renderItem={renderAdmin}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAdmins(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="👤" title="No Court Admins" message="Create court admins to manage verifications" />}
        />
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Court Admin</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput style={styles.input} value={formData.name} onChangeText={(v) => setFormData(p => ({ ...p, name: v }))} placeholder="Full Name *" placeholderTextColor={COLORS.textMuted} />
              <TextInput style={styles.input} value={formData.email} onChangeText={(v) => setFormData(p => ({ ...p, email: v }))} placeholder="Email *" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={styles.input} value={formData.phone} onChangeText={(v) => setFormData(p => ({ ...p, phone: v }))} placeholder="Phone *" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
              <TextInput style={styles.input} value={formData.password} onChangeText={(v) => setFormData(p => ({ ...p, password: v }))} placeholder="Password *" placeholderTextColor={COLORS.textMuted} secureTextEntry />
              <Text style={styles.selectLabel}>Select Court *</Text>
              <View style={styles.courtList}>
                {courts.map(c => (
                  <TouchableOpacity key={c.id} style={[styles.courtChip, formData.courtId === c.id && styles.courtChipActive]} onPress={() => setFormData(p => ({ ...p, courtId: c.id }))}>
                    <Text style={[styles.courtChipText, formData.courtId === c.id && styles.courtChipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
                {courts.length === 0 && <Text style={styles.noCourts}>No courts available. Create a court first.</Text>}
              </View>
              <Button title="Create Admin" onPress={handleCreate} loading={submitting} size="lg" />
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
  headerTitle: { flex: 1, fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  courtLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  statusBtn: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.primaryLight + '20',
  },
  statusBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '85%', paddingBottom: SPACING.xxl,
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
  selectLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  courtList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl },
  courtChip: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
  },
  courtChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  courtChipText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textSecondary },
  courtChipTextActive: { color: COLORS.white },
  noCourts: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontStyle: 'italic' },
});

import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput, Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { AddressFormPicker } from '../../components/AddressFormPicker';
import { formatErrorMessage } from '../../utils/formatError';

const COURT_TYPES = ['HIGH_COURT', 'DISTRICT_COURT', 'SUPREME_COURT'];

export const CourtManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCourt, setEditingCourt] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', code: '', type: 'DISTRICT_COURT', pincode: '', state: '', district: '', city: '', address: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchCourts = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await courtAdminApi.getCourts();
      setCourts(data.courts || data.items || data || []);
    } catch { setCourts([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchCourts(); }, []);

  const resetForm = () => {
    setFormData({ name: '', code: '', type: 'DISTRICT_COURT', pincode: '', state: '', district: '', city: '', address: '' });
    setEditingCourt(null);
  };

  const openCreate = () => { resetForm(); setShowForm(true); };
  const openEdit = (court: any) => {
    setEditingCourt(court);
    setFormData({
      name: court.name || '', code: court.code || '', type: court.type || 'DISTRICT_COURT',
      pincode: court.pincode || '', state: court.state || '', district: court.district || '', city: court.city || '', address: court.address || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      return Alert.alert('Error', 'Name and Code are required');
    }
    setSubmitting(true);
    try {
      if (editingCourt) {
        await courtAdminApi.updateCourt(editingCourt.id, formData);
      } else {
        await courtAdminApi.createCourt(formData);
      }
      Alert.alert('Success', editingCourt ? 'Court updated' : 'Court created');
      setShowForm(false);
      resetForm();
      fetchCourts(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Operation failed');
    } finally { setSubmitting(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Court', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await courtAdminApi.deleteCourt(id);
          Alert.alert('Deleted', 'Court removed');
          fetchCourts(false);
        } catch (err: any) {
          Alert.alert('Error', formatErrorMessage(err) || 'Delete failed');
        }
      }},
    ]);
  };

  const renderCourt = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.iconBg, { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name="business" size={22} color="#3B82F6" />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSub}>{item.code} · {(item.type || '').replace(/_/g, ' ')}</Text>
        </View>
      </View>
      {(item.city || item.state || item.pincode) && (
        <Text style={styles.cardLocation}>
          {[item.city, item.district, item.state, item.pincode].filter(Boolean).join(', ')}
        </Text>
      )}
      <View style={styles.cardActions}>
        <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#DBEAFE' }]} onPress={() => openEdit(item)}>
          <Ionicons name="create-outline" size={16} color="#3B82F6" />
          <Text style={[styles.actionChipText, { color: '#3B82F6' }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionChip, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDelete(item.id)}>
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
          <Text style={[styles.actionChipText, { color: '#EF4444' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Courts</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      {loading ? <Loading /> : (
        <FlatList
          data={courts}
          keyExtractor={(c) => c.id}
          renderItem={renderCourt}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCourts(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="🏛️" title="No Courts" message="Add courts to manage" />}
        />
      )}

      {/* Create/Edit Court Modal */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCourt ? 'Edit Court' : 'New Court'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <TextInput style={styles.input} value={formData.name} onChangeText={(v) => setFormData(p => ({ ...p, name: v }))} placeholder="Court Name *" placeholderTextColor={COLORS.textMuted} />
              <TextInput style={styles.input} value={formData.code} onChangeText={(v) => setFormData(p => ({ ...p, code: v }))} placeholder="Code (e.g., HC-DEL) *" placeholderTextColor={COLORS.textMuted} autoCapitalize="characters" />
              <View style={styles.typeRow}>
                {COURT_TYPES.map(t => (
                  <TouchableOpacity key={t} style={[styles.typeChip, formData.type === t && styles.typeChipActive]} onPress={() => setFormData(p => ({ ...p, type: t }))}>
                    <Text style={[styles.typeChipText, formData.type === t && styles.typeChipTextActive]}>{t.replace(/_/g, ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Shared address picker — same flow used everywhere addresses
                  are collected (state → district → pincode → place → text). */}
              <AddressFormPicker
                value={{
                  state: formData.state,
                  district: formData.district,
                  pincode: formData.pincode,
                  city: formData.city,
                  address: formData.address,
                }}
                onChange={(next) => setFormData(p => ({
                  ...p,
                  state: next.state,
                  district: next.district,
                  pincode: next.pincode,
                  city: next.city,
                  address: next.address,
                }))}
                required={['state', 'district', 'pincode']}
                labels={{ city: 'Court location', address: 'Court address' }}
              />

              <Button title={editingCourt ? 'Update Court' : 'Create Court'} onPress={handleSave} loading={submitting} size="lg" />
            </ScrollView>
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
  cardLocation: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.md },
  cardActions: {
    flexDirection: 'row', gap: SPACING.md,
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  actionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, borderRadius: BORDER_RADIUS.full,
  },
  actionChipText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
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
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  typeChip: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textSecondary },
  typeChipTextActive: { color: COLORS.white },
});

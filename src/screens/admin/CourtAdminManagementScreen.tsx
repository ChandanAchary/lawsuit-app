import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput, Modal,
  ScrollView, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { courtAdminApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { formatErrorMessage } from '../../utils/formatError';
import { pickAndUploadImage } from '../../utils/uploadImage';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: '#D1FAE5', text: '#10B981' },
  INACTIVE: { bg: '#EDE9FE', text: '#8B5CF6' },
  SUSPENDED: { bg: '#FEE2E2', text: '#EF4444' },
};

export const CourtAdminManagementScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  // Onboarding payload mirrors the self-register flow's fields. Password
  // is optional — when blank the server auto-generates a temp password
  // and emails the credentials.
  const initialForm = {
    name: '',
    email: '',
    phone: '',
    password: '',
    courtId: '',
    registrationNumber: '',
    avatarUrl: '',
    idProofUrl: '',
    authorizationProofUrl: '',
  };
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [courts, setCourts] = useState<any[]>([]);
  const [uploadingField, setUploadingField] = useState<null | 'avatarUrl' | 'idProofUrl' | 'authorizationProofUrl'>(null);

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
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.courtId || !formData.registrationNumber.trim()) {
      return Alert.alert('Required', 'Name, email, phone, court, and registration number are all required.');
    }
    if (!formData.idProofUrl || !formData.authorizationProofUrl) {
      return Alert.alert('Documents required', 'Upload the ID proof and authorization document before creating the account.');
    }
    setSubmitting(true);
    try {
      // Strip empty strings so the server's optional fields are truly
      // omitted (it auto-generates a password when omitted and emails
      // credentials to the new court admin).
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        courtId: formData.courtId,
        registrationNumber: formData.registrationNumber.trim(),
        idProofUrl: formData.idProofUrl,
        authorizationProofUrl: formData.authorizationProofUrl,
      };
      if (formData.password.trim()) payload.password = formData.password.trim();
      if (formData.avatarUrl) payload.avatarUrl = formData.avatarUrl;

      await courtAdminApi.createAdmin(payload);
      const passwordWasGenerated = !formData.password.trim();
      Alert.alert(
        'Court admin created',
        passwordWasGenerated
          ? `Credentials have been emailed to ${formData.email.trim()}. They'll be asked to change the password on first login.`
          : 'Account is active. Share the login credentials with the court admin.',
      );
      setShowCreate(false);
      setFormData(initialForm);
      fetchAdmins(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to create');
    } finally { setSubmitting(false); }
  };

  const uploadDocument = async (
    field: 'avatarUrl' | 'idProofUrl' | 'authorizationProofUrl',
    folder: string,
    label: string,
  ) => {
    setUploadingField(field);
    try {
      const result = await pickAndUploadImage(folder, {
        // Documents are usually portrait-ish but let the user choose freely.
        allowsEditing: false,
        quality: 0.8,
      });
      if (result?.secureUrl) {
        setFormData((p) => ({ ...p, [field]: result.secureUrl }));
      }
    } catch (err: any) {
      Alert.alert('Upload failed', formatErrorMessage(err) || `Could not upload ${label}.`);
    } finally {
      setUploadingField(null);
    }
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
            Alert.alert('Error', formatErrorMessage(err) || 'Status change failed');
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
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.notice}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
                <Text style={styles.noticeText}>
                  Court admins added by you skip the approval queue and are active immediately.
                  Leave the password blank to email the temporary password.
                </Text>
              </View>

              <TextInput style={styles.input} value={formData.name} onChangeText={(v) => setFormData(p => ({ ...p, name: v }))} placeholder="Full Name *" placeholderTextColor={COLORS.textMuted} />
              <TextInput style={styles.input} value={formData.email} onChangeText={(v) => setFormData(p => ({ ...p, email: v }))} placeholder="Email *" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={styles.input} value={formData.phone} onChangeText={(v) => setFormData(p => ({ ...p, phone: v }))} placeholder="Phone *" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
              <TextInput style={styles.input} value={formData.registrationNumber} onChangeText={(v) => setFormData(p => ({ ...p, registrationNumber: v }))} placeholder="Registration Number *" placeholderTextColor={COLORS.textMuted} autoCapitalize="characters" />
              <TextInput
                style={styles.input}
                value={formData.password}
                onChangeText={(v) => setFormData(p => ({ ...p, password: v }))}
                placeholder="Password (optional — auto-generated if blank)"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
              />

              <Text style={styles.selectLabel}>Select Court *</Text>
              <View style={styles.courtList}>
                {courts.map(c => (
                  <TouchableOpacity key={c.id} style={[styles.courtChip, formData.courtId === c.id && styles.courtChipActive]} onPress={() => setFormData(p => ({ ...p, courtId: c.id }))}>
                    <Text style={[styles.courtChipText, formData.courtId === c.id && styles.courtChipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
                {courts.length === 0 && <Text style={styles.noCourts}>No courts available. Create a court first.</Text>}
              </View>

              <Text style={styles.selectLabel}>Documents</Text>
              <DocTile
                label="ID proof"
                required
                value={formData.idProofUrl}
                uploading={uploadingField === 'idProofUrl'}
                onPick={() => uploadDocument('idProofUrl', 'court-admin-docs', 'ID proof')}
                onClear={() => setFormData((p) => ({ ...p, idProofUrl: '' }))}
                styles={styles}
                COLORS={COLORS}
              />
              <DocTile
                label="Authorization document"
                required
                value={formData.authorizationProofUrl}
                uploading={uploadingField === 'authorizationProofUrl'}
                onPick={() => uploadDocument('authorizationProofUrl', 'court-admin-docs', 'authorization document')}
                onClear={() => setFormData((p) => ({ ...p, authorizationProofUrl: '' }))}
                styles={styles}
                COLORS={COLORS}
              />
              <DocTile
                label="Profile photo (optional)"
                value={formData.avatarUrl}
                uploading={uploadingField === 'avatarUrl'}
                onPick={() => uploadDocument('avatarUrl', 'profiles', 'profile photo')}
                onClear={() => setFormData((p) => ({ ...p, avatarUrl: '' }))}
                styles={styles}
                COLORS={COLORS}
              />

              <Button
                title="Create court admin"
                onPress={handleCreate}
                loading={submitting}
                size="lg"
                style={{ marginTop: SPACING.md }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const DocTile = ({ label, required, value, uploading, onPick, onClear, styles, COLORS }: any) => {
  const hasFile = !!value;
  return (
    <View style={styles.docTile}>
      <View style={{ flex: 1 }}>
        <Text style={styles.docLabel}>
          {label}{required ? ' *' : ''}
        </Text>
        {hasFile ? (
          <View style={styles.docPreviewRow}>
            <Image source={{ uri: value }} style={styles.docThumb} />
            <Text style={styles.docUploadedText} numberOfLines={1}>Uploaded</Text>
            <TouchableOpacity onPress={onClear} style={styles.docClearBtn}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.docHint}>Not uploaded yet</Text>
        )}
      </View>
      <TouchableOpacity style={styles.docPickBtn} onPress={onPick} disabled={uploading}>
        {uploading
          ? <Text style={styles.docPickBtnText}>Uploading…</Text>
          : <Text style={styles.docPickBtnText}>{hasFile ? 'Replace' : 'Upload'}</Text>}
      </TouchableOpacity>
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

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: COLORS.primaryLight + '15',
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  noticeText: { flex: 1, fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 16 },

  docTile: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  docLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  docHint: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  docPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 4 },
  docThumb: { width: 28, height: 28, borderRadius: 6, backgroundColor: COLORS.border },
  docUploadedText: { fontSize: FONT_SIZE.xs, color: COLORS.success || '#047857', fontWeight: '700' },
  docClearBtn: { padding: 2 },
  docPickBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full,
  },
  docPickBtnText: { color: '#FFFFFF', fontSize: FONT_SIZE.xs, fontWeight: '800' },
});

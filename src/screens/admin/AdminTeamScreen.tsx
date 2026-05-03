import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, TextInput, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminManagementApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { TabBar } from '../../components/TabBar';
import { formatErrorMessage } from '../../utils/formatError';
import { useAuthStore } from '../../stores/authStore';
import { AdminTeamMember } from '../../types';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'SUPER_ADMIN', label: 'Super Admins' },
  { key: 'ADMIN', label: 'Admins' },
  { key: 'inactive', label: 'Inactive' },
];

type Level = 'SUPER_ADMIN' | 'ADMIN';

export const AdminTeamScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const me = useAuthStore((s) => s.user);
  const isSuper = (me?.level === 'SUPER_ADMIN');

  const [tab, setTab] = useState('all');
  const [admins, setAdmins] = useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<{ name: string; email: string; phone: string; level: Level }>(
    { name: '', email: '', phone: '', level: 'ADMIN' },
  );
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<AdminTeamMember | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; phone: string; level: Level; isActive: boolean }>(
    { name: '', phone: '', level: 'ADMIN', isActive: true },
  );
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAdmins = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (tab === 'SUPER_ADMIN' || tab === 'ADMIN') params.level = tab;
      if (tab === 'inactive') params.isActive = false;
      else if (tab !== 'all') {
        // Default the role-tabs to active-only; "all" intentionally returns both.
        params.isActive = true;
      }
      const { data } = await adminManagementApi.list(params);
      setAdmins((data?.items as AdminTeamMember[]) || []);
    } catch (err: any) {
      setAdmins([]);
      if (err?.response?.status === 403) {
        Alert.alert('Forbidden', 'Only super admins can view the admin team.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const handleCreate = async () => {
    const name = createForm.name.trim();
    const email = createForm.email.trim().toLowerCase();
    const phone = createForm.phone.trim();
    if (!name || name.length < 2) return Alert.alert('Error', 'Name must be at least 2 characters');
    if (!email.includes('@')) return Alert.alert('Error', 'Enter a valid email');
    if (!phone || phone.length < 7) return Alert.alert('Error', 'Enter a valid phone');

    setCreating(true);
    try {
      const { data } = await adminManagementApi.create({ name, email, phone, level: createForm.level });
      const delivered = data?.inviteEmail?.delivered;
      Alert.alert(
        'Admin Invited',
        delivered
          ? `Invitation email sent to ${email}. They'll set their password on first login.`
          : `Admin created. Invitation email could NOT be delivered (${data?.inviteEmail?.error || 'unknown'}). Share the temp password manually.`,
      );
      setShowCreate(false);
      setCreateForm({ name: '', email: '', phone: '', level: 'ADMIN' });
      fetchAdmins(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to invite admin');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (admin: AdminTeamMember) => {
    setEditing(admin);
    setEditForm({
      name: admin.name,
      phone: admin.phone,
      level: admin.level as Level,
      isActive: admin.isActive,
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const name = editForm.name.trim();
    const phone = editForm.phone.trim();
    if (!name || name.length < 2) return Alert.alert('Error', 'Name must be at least 2 characters');
    if (!phone || phone.length < 7) return Alert.alert('Error', 'Enter a valid phone');

    setSavingEdit(true);
    try {
      await adminManagementApi.update(editing.id, {
        name,
        phone,
        level: editForm.level,
        isActive: editForm.isActive,
      });
      Alert.alert('Saved', 'Admin updated');
      setEditing(null);
      fetchAdmins(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to update');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeactivate = (admin: AdminTeamMember) => {
    if (admin.id === me?.id) {
      return Alert.alert('Not allowed', 'You cannot deactivate your own account.');
    }
    Alert.alert(
      'Deactivate admin?',
      `${admin.name} will no longer be able to sign in. They can be reactivated later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminManagementApi.delete(admin.id);
              Alert.alert('Deactivated', `${admin.name} is now inactive.`);
              fetchAdmins(false);
            } catch (err: any) {
              Alert.alert('Error', formatErrorMessage(err) || 'Failed to deactivate');
            }
          },
        },
      ],
    );
  };

  const handleReactivate = async (admin: AdminTeamMember) => {
    try {
      await adminManagementApi.update(admin.id, { isActive: true });
      Alert.alert('Reactivated', `${admin.name} can sign in again.`);
      fetchAdmins(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to reactivate');
    }
  };

  const renderAdmin = ({ item }: { item: AdminTeamMember }) => {
    const isSelf = item.id === me?.id;
    const levelBg = item.level === 'SUPER_ADMIN' ? '#FEF3C7' : '#DBEAFE';
    const levelFg = item.level === 'SUPER_ADMIN' ? '#B45309' : '#1D4ED8';
    return (
      <View style={[styles.card, !item.isActive && styles.cardInactive]}>
        <View style={styles.cardRow}>
          <View style={[styles.iconBg, { backgroundColor: levelBg }]}>
            <Ionicons
              name={item.level === 'SUPER_ADMIN' ? 'shield-checkmark' : 'person-circle'}
              size={22}
              color={levelFg}
            />
          </View>
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              {isSelf && <Text style={styles.youBadge}>You</Text>}
            </View>
            <Text style={styles.cardSub} numberOfLines={1}>{item.email}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{item.phone}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: levelBg }]}>
            <Text style={[styles.badgeText, { color: levelFg }]}>
              {item.level === 'SUPER_ADMIN' ? 'SUPER' : 'ADMIN'}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          {item.mustChangePassword && (
            <View style={styles.metaPill}>
              <Ionicons name="key-outline" size={12} color={COLORS.warning} />
              <Text style={[styles.metaPillText, { color: COLORS.warning }]}>Pending pwd reset</Text>
            </View>
          )}
          <View style={[styles.metaPill, { backgroundColor: item.isActive ? COLORS.success + '15' : COLORS.error + '15' }]}>
            <Ionicons
              name={item.isActive ? 'checkmark-circle' : 'close-circle'}
              size={12}
              color={item.isActive ? COLORS.success : COLORS.error}
            />
            <Text style={[styles.metaPillText, { color: item.isActive ? COLORS.success : COLORS.error }]}>
              {item.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        {item.createdBy && (
          <Text style={styles.invitedBy}>
            Invited by {item.createdBy.name}
          </Text>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)} disabled={!isSuper}>
            <Ionicons name="create-outline" size={16} color={COLORS.primary} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>
          {item.isActive ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionDanger]}
              onPress={() => handleDeactivate(item)}
              disabled={!isSuper || isSelf}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.error} />
              <Text style={[styles.actionBtnText, { color: COLORS.error }]}>Deactivate</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSuccess]}
              onPress={() => handleReactivate(item)}
              disabled={!isSuper}
            >
              <Ionicons name="refresh-outline" size={16} color={COLORS.success} />
              <Text style={[styles.actionBtnText, { color: COLORS.success }]}>Reactivate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (!isSuper) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Team</Text>
        </View>
        <EmptyState
          icon="🛡️"
          title="Super Admins Only"
          message="Only super admins can manage the admin team."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Team</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <TabBar tabs={TABS} active={tab} onSelect={setTab} />

      {loading ? <Loading /> : (
        <FlatList
          data={admins}
          keyExtractor={(a) => a.id}
          renderItem={renderAdmin}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAdmins(false); }}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="🛡️"
              title="No Admins"
              message={tab === 'inactive' ? 'No deactivated admins.' : 'Invite a teammate to get started.'}
            />
          }
        />
      )}

      {/* Create / Invite Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Admin</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalDesc}>
                We'll email the new admin a temporary password. They must rotate it on first login.
              </Text>
              <TextInput
                style={styles.input}
                value={createForm.name}
                onChangeText={(v) => setCreateForm((p) => ({ ...p, name: v }))}
                placeholder="Full Name *"
                placeholderTextColor={COLORS.textMuted}
              />
              <TextInput
                style={styles.input}
                value={createForm.email}
                onChangeText={(v) => setCreateForm((p) => ({ ...p, email: v }))}
                placeholder="Email *"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                value={createForm.phone}
                onChangeText={(v) => setCreateForm((p) => ({ ...p, phone: v }))}
                placeholder="Phone *"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
              />
              <Text style={styles.selectLabel}>Level</Text>
              <View style={styles.levelRow}>
                {(['ADMIN', 'SUPER_ADMIN'] as Level[]).map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[styles.levelChip, createForm.level === lvl && styles.levelChipActive]}
                    onPress={() => setCreateForm((p) => ({ ...p, level: lvl }))}
                  >
                    <Text style={[styles.levelChipText, createForm.level === lvl && styles.levelChipTextActive]}>
                      {lvl === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button title="Send Invitation" onPress={handleCreate} loading={creating} size="lg" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Admin</Text>
              <TouchableOpacity onPress={() => setEditing(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {editing && (
              <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalDesc}>{editing.email}</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.name}
                  onChangeText={(v) => setEditForm((p) => ({ ...p, name: v }))}
                  placeholder="Full Name *"
                  placeholderTextColor={COLORS.textMuted}
                />
                <TextInput
                  style={styles.input}
                  value={editForm.phone}
                  onChangeText={(v) => setEditForm((p) => ({ ...p, phone: v }))}
                  placeholder="Phone *"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                />
                <Text style={styles.selectLabel}>Level</Text>
                <View style={styles.levelRow}>
                  {(['ADMIN', 'SUPER_ADMIN'] as Level[]).map((lvl) => {
                    const disabled = editing.id === me?.id && lvl !== editing.level;
                    return (
                      <TouchableOpacity
                        key={lvl}
                        disabled={disabled}
                        style={[
                          styles.levelChip,
                          editForm.level === lvl && styles.levelChipActive,
                          disabled && styles.levelChipDisabled,
                        ]}
                        onPress={() => setEditForm((p) => ({ ...p, level: lvl }))}
                      >
                        <Text style={[styles.levelChipText, editForm.level === lvl && styles.levelChipTextActive]}>
                          {lvl === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {editing.id === me?.id && (
                  <Text style={styles.helperText}>You cannot change your own level or deactivate yourself.</Text>
                )}
                <Text style={styles.selectLabel}>Status</Text>
                <View style={styles.levelRow}>
                  {[true, false].map((active) => {
                    const disabled = !active && editing.id === me?.id;
                    return (
                      <TouchableOpacity
                        key={String(active)}
                        disabled={disabled}
                        style={[
                          styles.levelChip,
                          editForm.isActive === active && styles.levelChipActive,
                          disabled && styles.levelChipDisabled,
                        ]}
                        onPress={() => setEditForm((p) => ({ ...p, isActive: active }))}
                      >
                        <Text style={[styles.levelChipText, editForm.isActive === active && styles.levelChipTextActive]}>
                          {active ? 'Active' : 'Inactive'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Button title="Save Changes" onPress={handleSaveEdit} loading={savingEdit} size="lg" />
              </ScrollView>
            )}
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
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },

  list: { padding: SPACING.xl, paddingBottom: 100 },

  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardInactive: { opacity: 0.7 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  youBadge: {
    fontSize: FONT_SIZE.xs - 1, fontWeight: '700', color: COLORS.primary,
    backgroundColor: COLORS.primaryLight + '20',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
  },
  cardSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '800' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md },
  metaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.warning + '15',
  },
  metaPillText: { fontSize: FONT_SIZE.xs - 1, fontWeight: '700' },
  invitedBy: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: SPACING.sm, fontStyle: 'italic' },

  actionsRow: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm,
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryLight + '20',
  },
  actionDanger: { backgroundColor: COLORS.error + '15' },
  actionSuccess: { backgroundColor: COLORS.success + '15' },
  actionBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl,
    maxHeight: '85%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  modalBody: { padding: SPACING.xl },
  modalDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 20 },

  input: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md,
  },
  selectLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  levelRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  levelChip: {
    flex: 1,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  levelChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  levelChipDisabled: { opacity: 0.4 },
  levelChipText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.textSecondary },
  levelChipTextActive: { color: COLORS.white },
  helperText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.md, marginTop: -SPACING.sm, fontStyle: 'italic' },
});

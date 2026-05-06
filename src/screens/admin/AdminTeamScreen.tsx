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
import { AdminTeamMember, ADMIN_PERMISSION_OPTIONS, AdminPermissionKey } from '../../types';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'SUPER_ADMIN', label: 'Super Admin' },
  { key: 'ADMIN', label: 'Admins' },
  { key: 'inactive', label: 'Inactive' },
];

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
  const [createForm, setCreateForm] = useState<{ name: string; email: string; phone: string; permissions: AdminPermissionKey[] }>(
    { name: '', email: '', phone: '', permissions: [] },
  );
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<AdminTeamMember | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; phone: string; permissions: AdminPermissionKey[]; isActive: boolean }>(
    { name: '', phone: '', permissions: [], isActive: true },
  );
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAdmins = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (tab === 'SUPER_ADMIN' || tab === 'ADMIN') params.level = tab;
      if (tab === 'inactive') params.isActive = false;
      else if (tab !== 'all') {
        params.isActive = true;
      }
      const { data } = await adminManagementApi.list(params);
      setAdmins((data?.items as AdminTeamMember[]) || []);
    } catch (err: any) {
      setAdmins([]);
      if (err?.response?.status === 403) {
        Alert.alert('Forbidden', 'Only the super admin can view the admin team.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const togglePermission = (set: AdminPermissionKey[], key: AdminPermissionKey): AdminPermissionKey[] => {
    return set.includes(key) ? set.filter((k) => k !== key) : [...set, key];
  };

  const handleCreate = async () => {
    const name = createForm.name.trim();
    const email = createForm.email.trim().toLowerCase();
    const phone = createForm.phone.trim();
    if (!name || name.length < 2) return Alert.alert('Error', 'Name must be at least 2 characters');
    if (!email.includes('@')) return Alert.alert('Error', 'Enter a valid email');
    if (!phone || phone.length < 7) return Alert.alert('Error', 'Enter a valid phone');

    setCreating(true);
    try {
      const { data } = await adminManagementApi.create({
        name,
        email,
        phone,
        permissions: createForm.permissions,
      });
      const delivered = data?.inviteEmail?.delivered;
      Alert.alert(
        'Admin Invited',
        delivered
          ? `Invitation email sent to ${email}. They'll set their password on first login.`
          : `Admin created. Invitation email could NOT be delivered (${data?.inviteEmail?.error || 'unknown'}). Share the temp password manually.`,
      );
      setShowCreate(false);
      setCreateForm({ name: '', email: '', phone: '', permissions: [] });
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
      permissions: ((admin.permissions ?? []) as AdminPermissionKey[]).filter(
        (k) => ADMIN_PERMISSION_OPTIONS.some((o) => o.key === k),
      ),
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
      // Permissions edit only applies to ADMIN-tier rows; super admin already
      // has implicit access to everything and the server ignores the field.
      const payload: any = { name, phone, isActive: editForm.isActive };
      if (editing.level === 'ADMIN') payload.permissions = editForm.permissions;
      await adminManagementApi.update(editing.id, payload);
      Alert.alert('Saved', 'Admin updated');
      setEditing(null);
      fetchAdmins(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to update');
    } finally {
      setSavingEdit(false);
    }
  };

  // Server enforces these rules; the UI mirrors them so the action button is
  // disabled rather than letting the admin tap and get a 403.
  //   - SUPER_ADMINs are permanent and cannot be deleted by anyone.
  //   - ADMINs can only be deleted by the SUPER_ADMIN that invited them.
  const canDeleteAdmin = (admin: AdminTeamMember) => {
    if (admin.id === me?.id) return false;
    if (admin.level === 'SUPER_ADMIN') return false;
    if (admin.createdById && me?.id && admin.createdById !== me.id) return false;
    return true;
  };

  const explainNoDelete = (admin: AdminTeamMember) => {
    if (admin.id === me?.id) return 'You cannot deactivate your own account.';
    if (admin.level === 'SUPER_ADMIN') return 'The super admin is permanent and cannot be deleted.';
    if (admin.createdById && me?.id && admin.createdById !== me.id) {
      return 'Only the super admin who invited this admin can delete them.';
    }
    return 'You do not have permission to delete this admin.';
  };

  const handleDeactivate = (admin: AdminTeamMember) => {
    if (!canDeleteAdmin(admin)) {
      return Alert.alert('Not allowed', explainNoDelete(admin));
    }
    Alert.alert(
      'Delete admin?',
      `${admin.name} will lose access immediately. They can be reactivated later by you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminManagementApi.delete(admin.id);
              Alert.alert('Deleted', `${admin.name} is now inactive.`);
              fetchAdmins(false);
            } catch (err: any) {
              Alert.alert('Error', formatErrorMessage(err) || 'Failed to delete admin');
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

  const renderPermissionSummary = (admin: AdminTeamMember) => {
    if (admin.level === 'SUPER_ADMIN') return 'Full access';
    const count = (admin.permissions ?? []).filter(
      (k) => ADMIN_PERMISSION_OPTIONS.some((o) => o.key === k),
    ).length;
    if (count === 0) return 'No module access';
    if (count === ADMIN_PERMISSION_OPTIONS.length) return 'All modules';
    return `${count} of ${ADMIN_PERMISSION_OPTIONS.length} modules`;
  };

  const renderAdmin = ({ item }: { item: AdminTeamMember }) => {
    const isSelf = item.id === me?.id;
    const isSuperRow = item.level === 'SUPER_ADMIN';
    const deletable = canDeleteAdmin(item);
    const levelBg = isSuperRow ? '#FEF3C7' : '#DBEAFE';
    const levelFg = isSuperRow ? '#B45309' : '#1D4ED8';
    return (
      <View style={[styles.card, !item.isActive && styles.cardInactive]}>
        <View style={styles.cardRow}>
          <View style={[styles.iconBg, { backgroundColor: levelBg }]}>
            <Ionicons
              name={isSuperRow ? 'shield-checkmark' : 'person-circle'}
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
              {isSuperRow ? 'SUPER' : 'ADMIN'}
            </Text>
          </View>
        </View>

        <View style={styles.permRow}>
          <Ionicons name="key-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.permRowText}>{renderPermissionSummary(item)}</Text>
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
              style={[
                styles.actionBtn,
                styles.actionDanger,
                !deletable && styles.actionBtnDisabled,
              ]}
              onPress={() => handleDeactivate(item)}
              disabled={!deletable}
            >
              <Ionicons
                name={isSuperRow ? 'lock-closed-outline' : 'trash-outline'}
                size={16}
                color={COLORS.error}
              />
              <Text style={[styles.actionBtnText, { color: COLORS.error }]}>
                {isSuperRow ? 'Protected' : 'Delete'}
              </Text>
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

  const renderPermissionPicker = (
    selected: AdminPermissionKey[],
    onToggle: (k: AdminPermissionKey) => void,
    disabled = false,
  ) => (
    <View style={styles.permPicker}>
      {ADMIN_PERMISSION_OPTIONS.map((opt) => {
        const on = selected.includes(opt.key);
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.permTile, on && styles.permTileActive, disabled && styles.permTileDisabled]}
            onPress={() => !disabled && onToggle(opt.key)}
            activeOpacity={0.75}
            disabled={disabled}
          >
            <View style={[styles.permCheckbox, on && styles.permCheckboxOn]}>
              {on && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.permTileLabel}>{opt.label}</Text>
              <Text style={styles.permTileDesc}>{opt.desc}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

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
          title="Super Admin Only"
          message="Only the super admin can manage the admin team."
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

              <Text style={styles.selectLabel}>Module access</Text>
              <Text style={styles.helperText}>
                Pick the modules this admin should be able to use. You can change this later.
              </Text>
              {renderPermissionPicker(
                createForm.permissions,
                (k) => setCreateForm((p) => ({ ...p, permissions: togglePermission(p.permissions, k) })),
              )}

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

                <Text style={styles.selectLabel}>Module access</Text>
                {editing.level === 'SUPER_ADMIN' ? (
                  <Text style={styles.helperText}>
                    The super admin holds full access to every module. Module access is not editable for this account.
                  </Text>
                ) : (
                  <>
                    <Text style={styles.helperText}>
                      Pick the modules this admin can use. Toggling a module off revokes access on their next request.
                    </Text>
                    {renderPermissionPicker(
                      editForm.permissions,
                      (k) => setEditForm((p) => ({ ...p, permissions: togglePermission(p.permissions, k) })),
                    )}
                  </>
                )}

                <Text style={styles.selectLabel}>Status</Text>
                <View style={styles.levelRow}>
                  {[true, false].map((active) => {
                    const isSuperTarget = editing.level === 'SUPER_ADMIN';
                    const disabled =
                      (!active && editing.id === me?.id) || (!active && isSuperTarget);
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
                {editing.level === 'SUPER_ADMIN' && (
                  <Text style={styles.helperText}>
                    The super admin is permanent and cannot be deactivated.
                  </Text>
                )}
                {editing.id === me?.id && editing.level !== 'SUPER_ADMIN' && (
                  <Text style={styles.helperText}>You cannot deactivate yourself.</Text>
                )}
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

  permRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.md,
  },
  permRowText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600' },

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
  actionBtnDisabled: { opacity: 0.45 },
  actionBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.primary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl,
    maxHeight: '90%', paddingBottom: SPACING.xxl,
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
  selectLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginTop: SPACING.sm, marginBottom: SPACING.xs },
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
  helperText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: SPACING.md, lineHeight: 16 },

  permPicker: { gap: SPACING.sm, marginBottom: SPACING.lg },
  permTile: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  permTileActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight + '10' },
  permTileDisabled: { opacity: 0.5 },
  permCheckbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  permCheckboxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  permTileLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  permTileDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
});

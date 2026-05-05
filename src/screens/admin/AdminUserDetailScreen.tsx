import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Image,
  Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminApi, userControlApi, ControllableRole } from '../../services/api';
import { Loading } from '../../components/Common';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../stores/authStore';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate, formatTime } from '../../utils/date';

type Action =
  | 'VERIFY'
  | 'BAN' | 'UNBAN' | 'SOFT_DELETE' | 'FORCE_PW_RESET'
  | 'KYC_OVERRIDE_VERIFY' | 'KYC_OVERRIDE_UNVERIFY';

const ACTION_META: Record<Action, { title: string; danger?: boolean; reasonRequired?: boolean; hint?: string }> = {
  VERIFY:                  { title: 'Verify user',            hint: 'Marks the user as verified.' },
  BAN:                     { title: 'Ban user',               danger: true,  reasonRequired: true,  hint: 'Blocks login until unbanned. Sessions are revoked.' },
  UNBAN:                   { title: 'Unban user',             hint: 'Restores access immediately.' },
  SOFT_DELETE:             { title: 'Soft delete account',    danger: true,  hint: 'Marks the account as deleted. Reversible by support.' },
  FORCE_PW_RESET:          { title: 'Force password reset',   hint: 'On next login the user is forced to rotate their password.' },
  KYC_OVERRIDE_VERIFY:     { title: 'Mark KYC verified',      reasonRequired: true, hint: 'Manual override — bypasses the standard court-admin verification flow.' },
  KYC_OVERRIDE_UNVERIFY:   { title: 'Clear KYC verification', danger: true, reasonRequired: true, hint: 'Removes the verified flag. The user can re-apply via the standard flow.' },
};

// Roles that can be controlled (banned, force-pw-reset, etc.). ADMIN is excluded
// — admins are managed by the AdminTeam screen, not the user-control flow.
const CONTROLLABLE: readonly string[] = ['CLIENT', 'LAWYER', 'ORGANIZATION', 'COURT_ADMIN'];

type RouteParams = { userId: string; role?: string };

export const AdminUserDetailScreen: React.FC<{ navigation: any; route: { params: RouteParams } }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const me = useAuthStore((s) => s.user);
  const isSuper = me?.level === 'SUPER_ADMIN';

  const userId = route.params?.userId;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await adminApi.getUserById(userId);
      const fetched = data?.user || data;
      setUser(fetched || null);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load user');
      setUser(null);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading />;
  if (!user) {
    return (
      <View style={styles.container}>
        <Header title="User" onBack={() => navigation.goBack()} styles={styles} COLORS={COLORS} />
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={36} color={COLORS.textMuted} />
          <Text style={styles.errorText}>User not found.</Text>
        </View>
      </View>
    );
  }

  const role: string = String(user.role || route.params?.role || '').toUpperCase();
  const controllable = CONTROLLABLE.includes(role);
  const kycEligible = role === 'LAWYER' || role === 'ORGANIZATION';

  const isBanned = !!user.bannedAt || user.isBanned === true;
  const isDeleted = !!user.deletedAt;
  const mustChangePassword = !!user.mustChangePassword;
  const isVerified = !!user.isVerified;

  const startAction = (a: Action) => { setAction(a); setReason(''); };
  const closeAction = () => { setAction(null); setReason(''); };

  const submit = async () => {
    if (!action) return;
    const meta = ACTION_META[action];
    if (meta.reasonRequired && !reason.trim()) {
      return Alert.alert('Required', `Please provide a reason for ${meta.title.toLowerCase()}.`);
    }
    setSubmitting(true);
    try {
      const r = reason.trim() || undefined;
      switch (action) {
        case 'VERIFY':
          // Uses the live /admin/users/:id/verification toggle which writes
          // lawyer.isVerified (or client.isVerified) directly. The legacy
          // adminApi.verifyLawyer / verifyClient routes were removed in
          // Phase 1 and silently 404'd, leaving the flag stuck false.
          if (role === 'CLIENT' || role === 'LAWYER') {
            await adminApi.setUserVerified(user.id, true);
          } else if (role === 'ORGANIZATION' || role === 'COURT_ADMIN') {
            await adminApi.setUserVerified(user.id, true);
          } else {
            throw new Error('This role is not verifiable through this screen.');
          }
          break;
        case 'BAN':
          await userControlApi.ban(role as ControllableRole, user.id, r as string);
          break;
        case 'UNBAN':
          await userControlApi.unban(role as ControllableRole, user.id, r);
          break;
        case 'SOFT_DELETE':
          await userControlApi.softDelete(role as ControllableRole, user.id, r);
          break;
        case 'FORCE_PW_RESET':
          await userControlApi.forcePasswordReset(role as ControllableRole, user.id, r);
          break;
        case 'KYC_OVERRIDE_VERIFY':
        case 'KYC_OVERRIDE_UNVERIFY': {
          const next = action === 'KYC_OVERRIDE_VERIFY';
          if (role === 'LAWYER') {
            await userControlApi.overrideLawyerKyc(user.id, { isVerified: next, reason: r as string });
          } else if (role === 'ORGANIZATION') {
            await userControlApi.overrideOrgKyc(user.id, { isVerified: next, reason: r as string });
          } else {
            throw new Error('KYC override only applies to lawyers and organizations.');
          }
          break;
        }
      }
      Alert.alert('Done', `${meta.title} applied.`);
      closeAction();
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title={user.name || user.email || 'User'} onBack={() => navigation.goBack()} styles={styles} COLORS={COLORS} />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
      >
        {/* Identity */}
        <View style={styles.identityCard}>
          {user.avatarUrl || user.avatar ? (
            <Image source={{ uri: user.avatarUrl || user.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPH]}>
              <Ionicons name="person" size={28} color={COLORS.textMuted} />
            </View>
          )}
          <Text style={styles.name}>{user.name || '—'}</Text>
          <Text style={styles.email}>{user.email || '—'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{role || 'USER'}</Text>
          </View>

          {/* Status flags */}
          <View style={styles.flagRow}>
            <Tag label={isVerified ? 'VERIFIED' : 'UNVERIFIED'} tone={isVerified ? 'ok' : 'warn'} styles={styles} />
            {isBanned && <Tag label="BANNED" tone="danger" styles={styles} />}
            {isDeleted && <Tag label="DELETED" tone="muted" styles={styles} />}
            {mustChangePassword && <Tag label="MUST CHANGE PW" tone="warn" styles={styles} />}
          </View>
        </View>

        {/* Details */}
        <Section title="Account" styles={styles}>
          <KV k="Phone" v={user.phone || '—'} styles={styles} />
          {role === 'LAWYER' && (
            <>
              <KV k="License #" v={user.licenseNumber || '—'} styles={styles} />
              <KV k="Bar Council ID" v={user.barCouncilId || '—'} styles={styles} />
              <KV k="Specializations" v={(user.specializations || []).join(', ') || '—'} styles={styles} />
            </>
          )}
          {role === 'ORGANIZATION' && (
            <>
              <KV k="Registration #" v={user.registrationNumber || '—'} styles={styles} />
              <KV k="GST" v={user.gstNumber || '—'} styles={styles} />
              <KV k="Practice areas" v={(user.practiceAreas || []).join(', ') || '—'} styles={styles} />
            </>
          )}
          {role === 'COURT_ADMIN' && (
            <>
              <KV k="Registration #" v={user.registrationNumber || '—'} styles={styles} />
              <KV k="Court" v={user.court?.name || '—'} styles={styles} />
              <KV k="Authorization" v={user.isAuthorized ? 'Authorized' : (user.status || 'Pending')} styles={styles} />
            </>
          )}
          {(user.city || user.state || user.pincode) && (
            <KV k="Location" v={[user.city, user.state, user.pincode].filter(Boolean).join(' · ')} styles={styles} />
          )}
          <KV k="Joined" v={user.createdAt ? `${formatDate(user.createdAt)} · ${formatTime(user.createdAt)}` : '—'} styles={styles} />
          {user.bannedAt && <KV k="Banned at" v={`${formatDate(user.bannedAt)} · ${formatTime(user.bannedAt)}`} styles={styles} />}
          {user.banReason && <KV k="Ban reason" v={user.banReason} styles={styles} />}
        </Section>

        {/* Actions */}
        <Section title="Actions" styles={styles}>
          {/* Simple admin Verify shortcut — flips lawyer/client/org/court-admin
              isVerified directly via /admin/users/:id/verification. The richer
              KYC-override flow below (super-admin only, with reason + audit
              log) is the canonical path for lawyer/org verification reversals. */}
          {!isVerified && controllable && (
            <ActionRow icon="checkmark-circle-outline" label="Verify user" tone="primary" onPress={() => startAction('VERIFY')} styles={styles} COLORS={COLORS} />
          )}

          {isSuper && controllable && (
            <>
              {kycEligible && (
                isVerified
                  ? <ActionRow icon="close-circle-outline" label="Clear KYC verification" tone="danger" onPress={() => startAction('KYC_OVERRIDE_UNVERIFY')} styles={styles} COLORS={COLORS} />
                  : <ActionRow icon="ribbon-outline" label="KYC override — mark verified" tone="primary" onPress={() => startAction('KYC_OVERRIDE_VERIFY')} styles={styles} COLORS={COLORS} />
              )}
              {isBanned
                ? <ActionRow icon="checkmark-circle-outline" label="Unban user" tone="ok" onPress={() => startAction('UNBAN')} styles={styles} COLORS={COLORS} />
                : <ActionRow icon="ban-outline" label="Ban user" tone="danger" onPress={() => startAction('BAN')} styles={styles} COLORS={COLORS} />
              }
              <ActionRow icon="key-outline" label="Force password reset" tone="primary" onPress={() => startAction('FORCE_PW_RESET')} styles={styles} COLORS={COLORS} />
              {!isDeleted && (
                <ActionRow icon="trash-outline" label="Soft delete account" tone="danger" onPress={() => startAction('SOFT_DELETE')} styles={styles} COLORS={COLORS} />
              )}
              {/* Salary & performance — opens the dedicated screen for
                  base salary, bonus rates, hold/release, and per-cycle payout. */}
              {(role === 'LAWYER' || role === 'ORGANIZATION') && (
                <ActionRow
                  icon="cash-outline"
                  label="Salary & performance"
                  tone="primary"
                  onPress={() => navigation.navigate('SuperAdminEntitySalary', {
                    subject: role,
                    subjectId: user.id,
                    name: user.name || user.email,
                  })}
                  styles={styles} COLORS={COLORS}
                />
              )}
            </>
          )}

          {!isSuper && controllable && (
            <Text style={styles.hint}>Sign in as a Super Admin to ban, soft-delete, force a password reset, or override KYC.</Text>
          )}
          {!controllable && role === 'ADMIN' && (
            <Text style={styles.hint}>Admin accounts are managed from the Admin Team screen.</Text>
          )}
        </Section>
      </ScrollView>

      <Modal visible={!!action} transparent animationType="slide" onRequestClose={closeAction}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{action ? ACTION_META[action].title : ''}</Text>
              <TouchableOpacity onPress={closeAction}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {action && ACTION_META[action].hint && (
                <Text style={styles.modalHint}>{ACTION_META[action].hint}</Text>
              )}
              {action && (action !== 'VERIFY') && (
                <>
                  <Text style={styles.label}>
                    Reason {action && ACTION_META[action].reasonRequired ? '(required)' : '(optional)'}
                  </Text>
                  <TextInput
                    style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Goes into the audit log"
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                  />
                </>
              )}
              <Button
                title={action ? `Confirm — ${ACTION_META[action].title}` : 'Confirm'}
                onPress={submit}
                loading={submitting}
                variant={action && ACTION_META[action].danger ? 'danger' : 'primary'}
                size="lg"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const Header = ({ title, onBack, styles, COLORS }: any) => (
  <View style={styles.headerBar}>
    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
      <Ionicons name="arrow-back" size={22} color={COLORS.text} />
    </TouchableOpacity>
    <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
  </View>
);

const Section = ({ title, children, styles }: any) => (
  <View style={{ marginBottom: SPACING.lg }}>
    <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
    <View style={styles.card}>{children}</View>
  </View>
);

const KV = ({ k, v, styles }: any) => (
  <View style={styles.kvRow}>
    <Text style={styles.kvKey}>{k}</Text>
    <Text style={styles.kvValue}>{v}</Text>
  </View>
);

const Tag = ({ label, tone, styles }: any) => {
  const palette: Record<string, { bg: string; fg: string }> = {
    ok:     { bg: '#D1FAE5', fg: '#047857' },
    warn:   { bg: '#FEF3C7', fg: '#B45309' },
    danger: { bg: '#FEE2E2', fg: '#B91C1C' },
    muted:  { bg: '#E5E7EB', fg: '#374151' },
  };
  const p = palette[tone] || palette.muted;
  return (
    <View style={[styles.tag, { backgroundColor: p.bg }]}>
      <Text style={[styles.tagText, { color: p.fg }]}>{label}</Text>
    </View>
  );
};

const ActionRow = ({ icon, label, tone, onPress, styles, COLORS }: any) => {
  const colorMap: Record<string, string> = { danger: '#B91C1C', ok: '#047857', primary: COLORS.primary };
  const color = colorMap[tone] || COLORS.primary;
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.xl, fontWeight: '900', color: C.text },
  body: { padding: SPACING.xl, paddingBottom: 100 },

  errorBox: { padding: SPACING.huge, alignItems: 'center', gap: SPACING.sm },
  errorText: { color: C.textMuted, fontSize: FONT_SIZE.md },

  identityCard: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.lg, ...SHADOWS.sm,
  },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: SPACING.md },
  avatarPH: { backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: C.text },
  email: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: 2 },
  roleBadge: {
    marginTop: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 4,
    backgroundColor: C.primaryLight + '20', borderRadius: BORDER_RADIUS.full,
  },
  roleText: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.primary, letterSpacing: 0.5 },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.md, justifyContent: 'center' },
  tag: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  sectionLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5, marginBottom: SPACING.sm, marginLeft: SPACING.xs },
  card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, ...SHADOWS.sm },

  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  kvKey: { fontSize: FONT_SIZE.sm, color: C.textMuted, flex: 1 },
  kvValue: { fontSize: FONT_SIZE.sm, color: C.text, fontWeight: '600', flex: 1.6, textAlign: 'right' },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  actionLabel: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '700' },
  hint: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontStyle: 'italic', paddingVertical: SPACING.sm },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.white, borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '90%', paddingBottom: SPACING.xxl },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text, flex: 1 },
  modalBody: { padding: SPACING.xl },
  modalHint: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginBottom: SPACING.md, lineHeight: 18 },
  label: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5, marginBottom: SPACING.xs },
  input: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text, marginBottom: SPACING.md,
  },
});

export default AdminUserDetailScreen;

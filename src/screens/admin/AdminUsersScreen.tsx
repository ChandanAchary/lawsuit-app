import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminApi } from '../../services/api';
import { User, UserRole } from '../../types';
import { Loading, EmptyState } from '../../components/Common';
import { TabBar } from '../../components/TabBar';

// People tab — single entry point for browsing every controllable user role
// across the platform. Tap a row to open AdminUserDetailScreen, which hosts
// every action (verify, ban, unban, soft-delete, force-pw-reset, KYC
// override) in one place. The standalone UserControl/KycOverride screens
// are intentionally retired; this list-then-drill flow is now the canonical
// path for per-user moderation.
const TABS: { key: string; label: string }[] = [
  { key: 'all',                    label: 'All' },
  { key: UserRole.CLIENT,          label: 'Clients' },
  { key: UserRole.LAWYER,          label: 'Lawyers' },
  { key: UserRole.ORGANIZATION,    label: 'Orgs' },
  { key: UserRole.COURT_ADMIN,     label: 'Court Admins' },
  { key: 'pending',                label: 'Pending KYC' },
];

export const AdminUsersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      if (tab === 'pending') {
        // Pending tab combines unverified clients + lawyers. ORG/COURT_ADMIN
        // verifications go through their dedicated approval flows.
        const [clientsRes, lawyersRes] = await Promise.all([
          adminApi.getNotVerifiedClients().catch(() => ({ data: [] })),
          adminApi.getNotVerifiedLawyers().catch(() => ({ data: [] })),
        ]);
        const normalize = (arr: any, role: string) => {
          const list = arr?.users || arr?.items || arr?.data || arr || [];
          return (Array.isArray(list) ? list : []).map((u: any) => ({ ...u, role: u.role || role }));
        };
        const pending = [
          ...normalize(clientsRes.data, UserRole.CLIENT),
          ...normalize(lawyersRes.data, UserRole.LAWYER),
        ];
        const filter = search.trim().toLowerCase();
        const filtered = filter
          ? pending.filter((u) =>
              [u.name, u.email, u.phone].some((v) => String(v || '').toLowerCase().includes(filter)),
            )
          : pending;
        setUsers(filtered);
      } else {
        const params: any = { limit: 50 };
        if (tab !== 'all') params.role = tab;
        if (search.trim()) params.search = search.trim();
        const { data } = await adminApi.getUsers(params);
        setUsers(data?.items || data?.users || data || []);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Refresh on focus so verification flips done elsewhere — court-admin
  // approvals, super-admin KYC overrides, the Verify shortcut on the user
  // detail screen — show up here without requiring a manual pull-to-refresh.
  // Without this, the list would still render the stale UNVERIFIED badge
  // until the user pulled the list down by hand.
  useFocusEffect(
    useCallback(() => {
      fetchUsers(false);
    }, [fetchUsers]),
  );

  const renderItem = ({ item }: { item: any }) => {
    const role = String(item.role || '').toUpperCase();
    const isLawyer = role === UserRole.LAWYER;
    const isOrg = role === UserRole.ORGANIZATION;
    const isCa = role === UserRole.COURT_ADMIN;
    const isVerified = !!item.isVerified;
    const isBanned = !!item.bannedAt || item.isBanned === true;
    const isDeleted = !!item.deletedAt;

    // Role badge palette — one tone per role so scanning the list at a
    // glance lets you spot the mix without reading the badge.
    const roleColor =
      isLawyer ? COLORS.accent
      : isOrg   ? '#7C3AED'
      : isCa    ? '#0EA5E9'
      : COLORS.primary;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('AdminUserDetail', { userId: item.id, role })}
      >
        <View style={styles.cardTop}>
          {item.avatarUrl || item.avatar ? (
            <Image source={{ uri: item.avatarUrl || item.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPH]}>
              <Ionicons
                name={isOrg ? 'business' : isCa ? 'shield' : 'person'}
                size={20}
                color={COLORS.textMuted}
              />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name || '—'}</Text>
            <Text style={styles.cardEmail} numberOfLines={1}>{item.email}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{role.replace('_', ' ')}</Text>
          </View>
        </View>

        <View style={styles.flagRow}>
          <Flag
            label={isVerified ? 'VERIFIED' : 'UNVERIFIED'}
            tone={isVerified ? 'ok' : 'warn'}
            styles={styles}
          />
          {isBanned && <Flag label="BANNED" tone="danger" styles={styles} />}
          {isDeleted && <Flag label="DELETED" tone="muted" styles={styles} />}
          {item.mustChangePassword && <Flag label="MUST CHANGE PW" tone="warn" styles={styles} />}
          {isCa && item.isAuthorized === false && <Flag label="UNAUTH" tone="warn" styles={styles} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>People</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => fetchUsers()}
          placeholder="Search name, email, or phone"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {!!search && (
          <TouchableOpacity onPress={() => { setSearch(''); }}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Shared TabBar — pill variant with built-in horizontal scroll. Same
          look as AdminPaymentsScreen / AdminPayoutsScreen so the admin
          section's filter chips feel consistent across screens. */}
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />

      {loading ? <Loading /> : (
        <FlatList
          data={users}
          keyExtractor={(u, idx) => u.id || `${u.email}-${idx}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="👥" title="No users" message="Nothing matches the current filter." />}
        />
      )}
    </View>
  );
};

const Flag = ({ label, tone, styles }: any) => {
  const palette: Record<string, { bg: string; fg: string }> = {
    ok:     { bg: '#D1FAE5', fg: '#047857' },
    warn:   { bg: '#FEF3C7', fg: '#B45309' },
    danger: { bg: '#FEE2E2', fg: '#B91C1C' },
    muted:  { bg: '#E5E7EB', fg: '#374151' },
  };
  const p = palette[tone] || palette.muted;
  return (
    <View style={[styles.flag, { backgroundColor: p.bg }]}>
      <Text style={[styles.flagText, { color: p.fg }]}>{label}</Text>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginTop: SPACING.md,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, padding: 0 },

  list: { padding: SPACING.xl, paddingBottom: 120 },

  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '800', color: COLORS.text },
  cardEmail: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  roleBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  roleText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  flag: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full },
  flagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
});

export default AdminUsersScreen;

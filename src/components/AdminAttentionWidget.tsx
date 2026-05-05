import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../constants';
import { useColors, useThemeStore } from '../stores/themeStore';
import {
  adminApi,
  courtAdminApprovalApi,
  payoutsApi,
} from '../services/api';

type Item = {
  key: string;
  icon: string;
  label: string;
  count: number;
  tone: 'urgent' | 'warn' | 'info';
  onPress: () => void;
  loading?: boolean;
};

// Reads triage-worthy counts from existing admin endpoints and surfaces them
// as a tap-to-navigate list. Designed for the dashboard "Needs your
// attention" block.
//
// Counts are fetched independently (Promise.allSettled) so a single 403/500
// doesn't blank the whole widget — failed rows just don't appear.
//
// Endpoints used (all already wired in api.ts):
//   - /admin/court-admins/pending           (super-admin only)
//   - /admin/payouts?payoutStatus=PAYABLE   (super-admin only)
//   - /admin/payouts?payoutStatus=HELD…     (super; we count items with disputeStatus=OPEN)
//   - /admin/not-verified-client            (admin)
//   - /admin/not-verified-lawyers           (admin)
type Props = {
  isSuper: boolean;
  navigation: any;
};

export const AdminAttentionWidget: React.FC<Props> = ({ isSuper, navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    pendingCourtAdmins: 0,
    payoutsPayable: 0,
    openDisputes: 0,
    unverifiedClients: 0,
    unverifiedLawyers: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [caRes, payRes, heldRes, ucRes, ulRes] = await Promise.allSettled([
      isSuper ? courtAdminApprovalApi.listPending({ limit: 1 }) : Promise.reject('skip'),
      isSuper ? payoutsApi.list({ payoutStatus: 'PAYABLE', limit: 100 }) : Promise.reject('skip'),
      isSuper ? payoutsApi.list({ payoutStatus: 'HELD_BY_PLATFORM', limit: 100 }) : Promise.reject('skip'),
      adminApi.getNotVerifiedClients(),
      adminApi.getNotVerifiedLawyers(),
    ]);

    const lengthOf = (data: any): number => {
      if (!data) return 0;
      if (typeof data.total === 'number') return data.total;
      const arr = data.items || data.users || data.payouts || data.courtAdmins || data;
      return Array.isArray(arr) ? arr.length : 0;
    };

    setCounts({
      pendingCourtAdmins:
        caRes.status === 'fulfilled' ? lengthOf((caRes.value as any).data) : 0,
      payoutsPayable:
        payRes.status === 'fulfilled' ? lengthOf((payRes.value as any).data) : 0,
      openDisputes:
        heldRes.status === 'fulfilled'
          ? (((heldRes.value as any).data?.items || []) as any[]).filter(
              (p) => p.disputeStatus === 'OPEN',
            ).length
          : 0,
      unverifiedClients:
        ucRes.status === 'fulfilled' ? lengthOf((ucRes.value as any).data) : 0,
      unverifiedLawyers:
        ulRes.status === 'fulfilled' ? lengthOf((ulRes.value as any).data) : 0,
    });
    setLoading(false);
  }, [isSuper]);

  useEffect(() => { void load(); }, [load]);

  const items: Item[] = [
    isSuper && counts.pendingCourtAdmins > 0 ? {
      key: 'court-admins',
      icon: 'shield-checkmark-outline',
      label: 'Court admin applications waiting',
      count: counts.pendingCourtAdmins,
      tone: 'urgent' as const,
      onPress: () => navigation.navigate('SuperAdminCourtAdminApprovals'),
    } : null,
    isSuper && counts.openDisputes > 0 ? {
      key: 'disputes',
      icon: 'alert-circle-outline',
      label: 'Payouts under dispute',
      count: counts.openDisputes,
      tone: 'urgent' as const,
      onPress: () => navigation.navigate('AdminPayouts'),
    } : null,
    isSuper && counts.payoutsPayable > 0 ? {
      key: 'payouts',
      icon: 'cash-outline',
      label: 'Payouts ready to disburse',
      count: counts.payoutsPayable,
      tone: 'warn' as const,
      onPress: () => navigation.navigate('AdminPayouts'),
    } : null,
    counts.unverifiedLawyers > 0 ? {
      key: 'unv-lawyers',
      icon: 'briefcase-outline',
      label: 'Lawyers awaiting verification',
      count: counts.unverifiedLawyers,
      tone: 'warn' as const,
      onPress: () => navigation.navigate('AdminUsers'),
    } : null,
    counts.unverifiedClients > 0 ? {
      key: 'unv-clients',
      icon: 'person-outline',
      label: 'Clients awaiting verification',
      count: counts.unverifiedClients,
      tone: 'info' as const,
      onPress: () => navigation.navigate('AdminUsers'),
    } : null,
  ].filter(Boolean) as Item[];

  if (loading) {
    return (
      <View style={[styles.card, { alignItems: 'center', paddingVertical: SPACING.lg }]}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <View style={[styles.emptyIcon, { backgroundColor: '#D1FAE5' }]}>
          <Ionicons name="checkmark-done" size={20} color="#047857" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.emptyTitle}>You're all caught up</Text>
          <Text style={styles.emptySub}>Nothing pending right now.</Text>
        </View>
        <TouchableOpacity onPress={() => void load()}>
          <Ionicons name="refresh" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {items.map((it, idx) => (
        <Row key={it.key} item={it} isLast={idx === items.length - 1} styles={styles} COLORS={COLORS} />
      ))}
    </View>
  );
};

const Row = ({ item, isLast, styles, COLORS }: { item: Item; isLast: boolean; styles: any; COLORS: any }) => {
  const palette = {
    urgent: { bg: '#FEE2E2', fg: '#B91C1C' },
    warn:   { bg: '#FEF3C7', fg: '#B45309' },
    info:   { bg: '#DBEAFE', fg: '#1D4ED8' },
  } as const;
  const p = palette[item.tone];
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowDivider]}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBg, { backgroundColor: p.bg }]}>
        <Ionicons name={item.icon as any} size={18} color={p.fg} />
      </View>
      <Text style={styles.rowLabel} numberOfLines={2}>{item.label}</Text>
      <View style={[styles.countPill, { backgroundColor: p.bg }]}>
        <Text style={[styles.countText, { color: p.fg }]}>{item.count}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, ...SHADOWS.sm },
  emptyCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, ...SHADOWS.sm,
  },
  emptyIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  emptySub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: C.borderLight },
  iconBg: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: FONT_SIZE.sm, fontWeight: '600', color: C.text },
  countPill: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full, minWidth: 28, alignItems: 'center' },
  countText: { fontSize: FONT_SIZE.xs, fontWeight: '900' },
});

export default AdminAttentionWidget;

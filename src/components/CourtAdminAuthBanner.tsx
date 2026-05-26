import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BORDER_RADIUS, FONT_SIZE, SPACING } from '../constants';
import { useColors } from '../stores/themeStore';
import { courtAdminApi } from '../services/api';
import { formatErrorMessage } from '../utils/formatError';

// =============================================================================
// CourtAdminAuthBanner — mirrors the web's CourtAdminAuthBanner.
//
// A self-onboarded court admin lands in PENDING_SUPER_ADMIN_APPROVAL and stays
// feature-locked until a super admin approves. The mobile app previously had
// NO way to show that state — a pending/rejected court admin saw a normal
// dashboard with no explanation. This banner surfaces the real status from
// GET /court-admin/me/authorization and offers a one-tap re-apply when the
// application was rejected.
//
// The court-admin row carries TWO independent status fields:
//   - verificationStatus: PENDING_SUPER_ADMIN_APPROVAL | APPROVED | REJECTED
//   - status:             ACTIVE | INACTIVE | SUSPENDED
// Operational status (SUSPENDED/INACTIVE) takes precedence because a prior
// approval is moot if the account is currently suspended. APPROVED + ACTIVE
// renders nothing (the happy path).
// =============================================================================

type BannerKind = 'PENDING' | 'REJECTED' | 'SUSPENDED' | 'INACTIVE';

interface AuthRow {
  verificationStatus?: string;
  status?: string;
  isAuthorized?: boolean;
  rejectionReason?: string | null;
}

export const CourtAdminAuthBanner: React.FC = () => {
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [COLORS]);

  const [row, setRow] = useState<AuthRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [reapplying, setReapplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await courtAdminApi.getMyAuthorization();
      // Server returns `{ courtAdmin, history }`. Tolerate older deploys that
      // returned the row directly.
      const ca =
        data?.courtAdmin ??
        data?.data?.courtAdmin ??
        (data && typeof data === 'object' && ('verificationStatus' in data || 'status' in data) ? data : null);
      setRow((ca as AuthRow) || null);
    } catch {
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleReapply = async () => {
    setReapplying(true);
    try {
      await courtAdminApi.reapply();
      Alert.alert('Re-applied', 'Your request is pending super admin review.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to re-apply');
    } finally {
      setReapplying(false);
    }
  };

  const kind: BannerKind | null = useMemo(() => {
    if (!row) return null;
    const op = String(row.status || '').toUpperCase();
    const verif = String(row.verificationStatus || '').toUpperCase();
    if (op === 'SUSPENDED') return 'SUSPENDED';
    if (op === 'INACTIVE') return 'INACTIVE';
    if (verif === 'REJECTED') return 'REJECTED';
    if (verif === 'PENDING_SUPER_ADMIN_APPROVAL') return 'PENDING';
    return null; // APPROVED + ACTIVE (and unknowns) → no banner
  }, [row]);

  if (loading || !kind) return null;

  const palette: Record<BannerKind, { bg: string; fg: string; icon: any; title: string; body: string }> = {
    PENDING: {
      bg: '#FEF3C7', fg: '#B45309', icon: 'time-outline',
      title: 'Awaiting super admin approval',
      body: 'Your account is pending review. You can edit your profile, but verification actions unlock once approved.',
    },
    REJECTED: {
      bg: '#FEE2E2', fg: '#B91C1C', icon: 'alert-circle-outline',
      title: 'Application rejected',
      body: row?.rejectionReason || 'Your application was rejected. You may re-apply with updated details.',
    },
    SUSPENDED: {
      bg: '#FEE2E2', fg: '#B91C1C', icon: 'alert-circle-outline',
      title: 'Account suspended',
      body: row?.rejectionReason || 'Your account is suspended. Contact platform support.',
    },
    INACTIVE: {
      bg: COLORS.surfaceAlt, fg: COLORS.textSecondary, icon: 'pause-circle-outline',
      title: 'Account inactive',
      body: 'Your account is inactive. Contact platform support if this is unexpected.',
    },
  };
  const cfg = palette[kind];

  return (
    <View style={[styles.banner, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={20} color={cfg.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: cfg.fg }]}>{cfg.title}</Text>
        <Text style={[styles.body, { color: cfg.fg }]}>{cfg.body}</Text>
        {kind === 'REJECTED' && (
          <TouchableOpacity style={styles.reapplyBtn} onPress={handleReapply} disabled={reapplying}>
            {reapplying ? (
              <ActivityIndicator size="small" color={cfg.fg} />
            ) : (
              <>
                <Ionicons name="refresh" size={14} color={cfg.fg} />
                <Text style={[styles.reapplyText, { color: cfg.fg }]}>Re-apply</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.xl, marginTop: SPACING.md,
  },
  title: { fontSize: FONT_SIZE.sm, fontWeight: '800' },
  body: { fontSize: FONT_SIZE.xs, marginTop: 2, lineHeight: 17, opacity: 0.95 },
  reapplyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: BORDER_RADIUS.full,
  },
  reapplyText: { fontSize: FONT_SIZE.xs, fontWeight: '800' },
});

export default CourtAdminAuthBanner;

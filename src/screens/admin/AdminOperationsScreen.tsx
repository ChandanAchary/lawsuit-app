import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { payoutsApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useColors, useThemeStore } from '../../stores/themeStore';

// "Operations" bottom tab — money flow + audit. Pulled out of the dashboard
// menu so super-admin financial work is a first-class destination instead of
// buried under a long scrolling list. The summary block at the top is taken
// from /admin/payouts/summary so the operator sees held / payable / paid
// totals at a glance before drilling into a specific screen.
export const AdminOperationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const me = useAuthStore((s) => s.user);
  const isSuper = me?.level === 'SUPER_ADMIN';

  const [summary, setSummary] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async () => {
    if (!isSuper) return;
    try {
      const { data } = await payoutsApi.summary();
      setSummary(data?.summary || null);
    } catch {
      setSummary(null);
    }
  }, [isSuper]);

  useEffect(() => { void fetchSummary(); }, [fetchSummary]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSummary();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.hero}>
        <Ionicons name="cash" size={26} color={COLORS.white} />
        <Text style={styles.heroTitle}>Operations</Text>
        <Text style={styles.heroSub}>
          {isSuper ? 'Money flow, ledger, audit' : 'Payments and wallets'}
        </Text>
      </LinearGradient>

      {isSuper && summary && (
        <View style={styles.summaryRow}>
          <SummaryTile
            label="Held"
            tone="warn"
            amount={summary.heldByPlatform?.amount}
            count={summary.heldByPlatform?.count}
            styles={styles}
          />
          <SummaryTile
            label="Ready"
            tone="info"
            amount={summary.payable?.amount}
            count={summary.payable?.count}
            styles={styles}
          />
          <SummaryTile
            label="Paid"
            tone="ok"
            amount={summary.paidOut?.amount}
            count={summary.paidOut?.count}
            styles={styles}
          />
        </View>
      )}

      <Section label="MONEY FLOW" styles={styles}>
        <Card
          icon="card-outline"
          tint="#3B82F6"
          label="Payments"
          desc="Browse all platform payments and refund completed ones"
          onPress={() => navigation.navigate('AdminPayments')}
          styles={styles} COLORS={COLORS}
        />
        <Card
          icon="wallet-outline"
          tint="#10B981"
          label="Wallets"
          desc="Read-only wallets and withdrawal reversals"
          onPress={() => navigation.navigate('AdminWallets')}
          styles={styles} COLORS={COLORS}
        />
        {isSuper && (
          <Card
            icon="cash-outline"
            tint="#8B5CF6"
            label="Booking payouts"
            desc="Disburse, refund, dispute and resolve held bookings"
            onPress={() => navigation.navigate('AdminPayouts')}
            styles={styles} COLORS={COLORS}
          />
        )}
        {isSuper && (
          <Card
            icon="receipt-outline"
            tint="#0EA5E9"
            label="Ledger & history"
            desc="Escrow ledger, payout history, reconciliation"
            onPress={() => navigation.navigate('AdminEscrowLedger')}
            styles={styles} COLORS={COLORS}
          />
        )}
      </Section>

      {isSuper && (
        <Section label="AUDIT" styles={styles}>
          <Card
            icon="reader-outline"
            tint="#6B7280"
            label="Audit log"
            desc="Every super-admin action with actor, target, before/after"
            onPress={() => navigation.navigate('SuperAdminAuditLog')}
            styles={styles} COLORS={COLORS}
          />
        </Section>
      )}

      {!isSuper && (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.noticeText}>
            Payouts, ledger, and audit log are super-admin surfaces.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const Section = ({ label, children, styles }: any) => {
  const items = React.Children.toArray(children).filter(Boolean);
  const cloned = items.map((child: any, idx: number) =>
    React.isValidElement(child) && idx === items.length - 1
      ? React.cloneElement(child, { isLast: true } as any)
      : child,
  );
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionCard}>{cloned}</View>
    </View>
  );
};

const Card = ({ icon, tint, label, desc, onPress, isLast, styles, COLORS }: any) => (
  <TouchableOpacity
    style={[styles.card, isLast && styles.cardLast]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.cardIcon, { backgroundColor: tint + '18' }]}>
      <Ionicons name={icon} size={22} color={tint} />
    </View>
    <View style={styles.cardInfo}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const SummaryTile = ({ label, tone, amount, count, styles }: any) => {
  const palette: Record<string, { bg: string; fg: string }> = {
    warn: { bg: '#FEF3C7', fg: '#B45309' },
    info: { bg: '#DBEAFE', fg: '#1D4ED8' },
    ok:   { bg: '#D1FAE5', fg: '#047857' },
  };
  const p = palette[tone] || palette.info;
  return (
    <View style={[styles.summaryTile, { borderColor: p.fg + '30' }]}>
      <Text style={[styles.summaryLabel, { color: p.fg }]}>{label}</Text>
      <Text style={styles.summaryAmount}>₹{Number(amount || 0).toLocaleString('en-IN')}</Text>
      <Text style={styles.summaryCount}>{count || 0} payment{(count || 0) === 1 ? '' : 's'}</Text>
    </View>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { paddingBottom: 120 },

  hero: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge + SPACING.md,
    paddingBottom: SPACING.xxxl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl, borderBottomRightRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
  },
  heroTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.white, marginTop: SPACING.sm },
  heroSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.78)', marginTop: 2 },

  summaryRow: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.xl, marginTop: -SPACING.xxl,
  },
  summaryTile: {
    flex: 1, backgroundColor: C.white,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: SPACING.md,
  },
  summaryLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800', letterSpacing: 0.5 },
  summaryAmount: { fontSize: FONT_SIZE.lg, fontWeight: '900', color: C.text, marginTop: 2 },
  summaryCount: { fontSize: FONT_SIZE.xs - 1, color: C.textMuted, marginTop: 2 },

  section: { paddingHorizontal: SPACING.xl, marginTop: SPACING.xl },
  sectionLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textMuted,
    letterSpacing: 1, marginBottom: SPACING.sm, paddingHorizontal: SPACING.xs,
  },
  sectionCard: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, ...SHADOWS.sm, overflow: 'hidden' },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  cardLast: { borderBottomWidth: 0 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  cardDesc: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    margin: SPACING.xl, padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: C.surfaceAlt,
  },
  noticeText: { flex: 1, fontSize: FONT_SIZE.xs, color: C.textSecondary, lineHeight: 16 },
});

export default AdminOperationsScreen;

// AdminPerformanceLogScreen
//
// Super-admin → tap "Activity" on a lawyer / org / court admin → this screen.
// One screen, three roles, parameterised by `route.params.role`. Mirrors the
// `/admin/{role}/:id/activity` web page exactly: month picker → 5 headline
// metrics → detailed counts → auto-computed salary → activity feed.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminApi } from '../../services/api';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate, formatTime } from '../../utils/date';

type Role = 'LAWYER' | 'ORGANIZATION' | 'COURT_ADMIN';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmtRupee = (n?: number | null) =>
  n != null
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n))
    : '—';

interface RouteParams {
  role: Role;
  subjectId: string;
  name?: string;
  // Optional cycle override; defaults to current month.
  month?: number;
  year?: number;
}

export const AdminPerformanceLogScreen: React.FC<{ navigation: any; route: { params: RouteParams } }> = ({
  navigation,
  route,
}) => {
  const { role, subjectId, name } = route.params;
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const now = new Date();
  const [month, setMonth] = useState(route.params.month ?? now.getMonth() + 1);
  const [year, setYear] = useState(route.params.year ?? now.getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const fn =
        role === 'LAWYER'
          ? adminApi.getLawyerMonthlyActivity
          : role === 'ORGANIZATION'
            ? adminApi.getOrganizationMonthlyActivity
            : adminApi.getCourtAdminMonthlyActivity;
      const res = await fn(subjectId, { month, year });
      setData(res.data);
    } catch (err: any) {
      setError(formatErrorMessage(err) || "We couldn't load the activity log.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, subjectId, month, year]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const stepMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const roleLabel = role === 'LAWYER' ? 'Lawyer' : role === 'ORGANIZATION' ? 'Organization' : 'Court admin';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{name || roleLabel}</Text>
          <Text style={styles.headerSub}>Monthly activity · {roleLabel}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Cycle picker */}
        <View style={styles.cycleCard}>
          <TouchableOpacity onPress={() => stepMonth(-1)} style={styles.cycleNav}>
            <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={styles.cycleLabel}>CYCLE</Text>
            <Text style={styles.cycleValue}>{MONTHS[month - 1]} {year}</Text>
          </View>
          <TouchableOpacity onPress={() => stepMonth(1)} style={styles.cycleNav}>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {loading && !data ? (
          <View style={{ paddingVertical: SPACING.huge, alignItems: 'center' }}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : error ? (
          <View style={[styles.banner, styles.bannerError]}>
            <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
            <Text style={styles.bannerErrorText}>{error}</Text>
          </View>
        ) : !data ? null : (
          <>
            {/* Compliance banner */}
            {!data.compliance?.pass && (
              <View style={[styles.banner, styles.bannerError]}>
                <Ionicons name="alert-circle" size={16} color="#B91C1C" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bannerErrorText, { fontWeight: '700' }]}>
                    Compliance gate failing — salary on hold
                  </Text>
                  {(data.compliance.issues || []).slice(0, 3).map((i: string) => (
                    <Text key={i} style={styles.bannerErrorText}>• {i}</Text>
                  ))}
                </View>
              </View>
            )}

            {/* Must-have metrics (5 cards) */}
            <SectionLabel styles={styles}>Must-have metrics</SectionLabel>
            <View style={styles.grid}>
              {role === 'LAWYER' && data.metrics && (
                <>
                  <MetricCard styles={styles} icon="call-outline" label="Consultations" value={String(data.metrics.consultationsCompleted ?? 0)} />
                  <MetricCard styles={styles} icon="briefcase-outline" label="Closed / Won" value={`${data.metrics.casesClosed ?? 0} / ${data.metrics.casesWon ?? 0}`} />
                  <MetricCard
                    styles={styles}
                    icon="star-outline"
                    label="Avg rating"
                    value={data.metrics.cycleAvgRating != null ? `${data.metrics.cycleAvgRating}/5` : '—'}
                    hint={`${data.metrics.cycleReviewCount ?? 0} reviews`}
                  />
                  <MetricCard
                    styles={styles}
                    icon="shield-checkmark-outline"
                    label="Compliance"
                    value={data.compliance.pass ? 'OK' : `${data.compliance.issues?.length || 0} issue`}
                  />
                  <MetricCard
                    styles={styles}
                    icon="cash-outline"
                    label="Net payable"
                    value={fmtRupee(data.salary?.breakdown?.netPayable)}
                    hint={data.salary?.alreadyPaid ? 'paid' : data.salary?.breakdown?.isOnHold ? 'on hold' : 'pending'}
                  />
                </>
              )}
              {role === 'ORGANIZATION' && data.metrics && (
                <>
                  <MetricCard styles={styles} icon="call-outline" label="Consultations" value={String(data.metrics.totalConsultations ?? 0)} />
                  <MetricCard styles={styles} icon="people-outline" label="Active lawyers" value={String(data.metrics.activeLawyerCount ?? 0)} hint={`${data.metrics.newLawyersThisMonth ?? 0} new`} />
                  <MetricCard styles={styles} icon="star-outline" label="Aggregate rating" value={data.metrics.aggregateRating != null ? `${data.metrics.aggregateRating}/5` : '—'} />
                  <MetricCard styles={styles} icon="shield-checkmark-outline" label="Compliance" value={data.compliance.pass ? 'OK' : `${data.compliance.issues?.length || 0} issue`} />
                  <MetricCard styles={styles} icon="cash-outline" label="Net payable" value={fmtRupee(data.salary?.breakdown?.netPayable)} hint={data.salary?.alreadyPaid ? 'paid' : data.salary?.breakdown?.isOnHold ? 'on hold' : 'pending'} />
                </>
              )}
              {role === 'COURT_ADMIN' && data.metrics && (
                <>
                  <MetricCard styles={styles} icon="checkmark-done-outline" label="Decisions" value={String(data.metrics.totalDecisions ?? 0)} hint={`${data.metrics.lawyersReviewed ?? 0}L · ${data.metrics.orgsReviewed ?? 0}O`} />
                  <MetricCard styles={styles} icon="time-outline" label="Median time" value={data.metrics.medianDecisionTimeHours != null ? `${data.metrics.medianDecisionTimeHours}h` : '—'} />
                  <MetricCard styles={styles} icon="warning-outline" label="Backlog >7d" value={String(data.metrics.pendingBacklog ?? 0)} />
                  <MetricCard styles={styles} icon="shield-checkmark-outline" label="Authorization" value={data.compliance.pass ? 'Active' : 'Inactive'} />
                  <MetricCard styles={styles} icon="cash-outline" label="Net payable" value={fmtRupee(data.salary?.breakdown?.netPayable)} hint={data.salary?.alreadyPaid ? 'paid' : data.salary?.breakdown?.isOnHold ? 'on hold' : 'pending'} />
                </>
              )}
            </View>

            {/* Salary breakdown */}
            {data.salary?.breakdown && (
              <>
                <SectionLabel styles={styles}>Auto-computed salary</SectionLabel>
                <View style={styles.card}>
                  {role === 'LAWYER' || role === 'ORGANIZATION' ? (
                    <>
                      <KV styles={styles} k="Base salary" v={fmtRupee(data.salary.breakdown.baseSalary)} />
                      <KV styles={styles} k="Consultation bonus" v={fmtRupee(data.salary.breakdown.consultationBonus)} />
                      <KV styles={styles} k="Case-closed bonus" v={fmtRupee(data.salary.breakdown.caseClosedBonus)} />
                      <KV styles={styles} k="Case-won bonus" v={fmtRupee(data.salary.breakdown.caseWonBonus)} />
                    </>
                  ) : (
                    <>
                      <KV styles={styles} k="Base salary" v={fmtRupee(data.salary.breakdown.baseSalary)} />
                      <KV styles={styles} k="Verification bonus" v={fmtRupee(data.salary.breakdown.verificationBonus)} />
                    </>
                  )}
                  <KV styles={styles} k="Net payable" v={fmtRupee(data.salary.breakdown.netPayable)} bold />
                  {data.salary.breakdown.isOnHold && (
                    <View style={styles.holdBanner}>
                      <Ionicons name="pause-circle-outline" size={14} color="#B45309" />
                      <Text style={styles.holdText}>
                        On hold{data.salary.breakdown.holdReason ? ` — ${data.salary.breakdown.holdReason}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Activity feed */}
            <SectionLabel styles={styles}>Activity log</SectionLabel>
            {(data.activities || []).length === 0 ? (
              <View style={[styles.card, { alignItems: 'center', paddingVertical: SPACING.xl }]}>
                <Ionicons name="pulse-outline" size={28} color={COLORS.textMuted} />
                <Text style={{ color: COLORS.textMuted, marginTop: SPACING.xs }}>No activity this cycle.</Text>
              </View>
            ) : (
              <View style={[styles.card, { paddingVertical: 0 }]}>
                {data.activities.map((a: any, idx: number) => (
                  <View
                    key={`${a.type}-${a.refId || idx}-${a.at}`}
                    style={[styles.activityRow, idx === data.activities.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={[styles.activityIcon, { backgroundColor: COLORS.primaryLight + '30' }]}>
                      <Ionicons name={iconForType(a.type)} size={16} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle}>{a.title}</Text>
                      {a.subtitle && <Text style={styles.activitySub} numberOfLines={2}>{a.subtitle}</Text>}
                      <Text style={styles.activityTs}>
                        {a.at ? `${formatDate(a.at)} · ${formatTime(a.at)}` : '—'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: SPACING.xxl }} />
          </>
        )}
      </ScrollView>
    </View>
  );
};

const iconForType = (t: string): keyof typeof Ionicons.glyphMap => {
  switch (t) {
    case 'CONSULTATION_COMPLETED': return 'call-outline';
    case 'CASE_OPENED': return 'folder-outline';
    case 'CASE_CLOSED': return 'checkmark-circle-outline';
    case 'CASE_WON': return 'trophy-outline';
    case 'MEDIATION_CONCLUDED': return 'shield-checkmark-outline';
    case 'REVIEW_RECEIVED': return 'star-outline';
    case 'REQUEST_RECEIVED': return 'document-outline';
    case 'REQUEST_ASSIGNED': return 'person-add-outline';
    case 'REQUEST_REJECTED': return 'close-circle-outline';
    case 'LAWYER_APPROVED':
    case 'ORG_APPROVED': return 'checkmark-circle-outline';
    case 'LAWYER_REJECTED':
    case 'ORG_REJECTED': return 'close-circle-outline';
    default: return 'ellipse-outline';
  }
};

// Atoms
const SectionLabel = ({ children, styles }: any) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

const MetricCard = ({ icon, label, value, hint, styles }: any) => (
  <View style={styles.metricCard}>
    <View style={styles.metricLabelRow}>
      <Ionicons name={icon} size={12} color={styles.__colors?.textMuted ?? '#6B7280'} />
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
    <Text style={styles.metricValue}>{value}</Text>
    {hint && <Text style={styles.metricHint}>{hint}</Text>}
  </View>
);

const KV = ({ k, v, bold, styles }: any) => (
  <View style={styles.kvRow}>
    <Text style={styles.kvKey}>{k}</Text>
    <Text style={[styles.kvValue, bold && { fontWeight: '800', color: '#047857' }]}>{v}</Text>
  </View>
);

const getStyles = (C: any) => {
  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    headerBar: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      paddingHorizontal: SPACING.xl,
      paddingTop: Platform.OS === 'ios' ? SPACING.huge : SPACING.xl,
      paddingBottom: SPACING.md,
      backgroundColor: C.white, ...SHADOWS.sm,
    },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: FONT_SIZE.lg, fontWeight: '900', color: C.text },
    headerSub: { fontSize: FONT_SIZE.xs, color: C.textMuted },
    body: { padding: SPACING.xl, paddingBottom: SPACING.huge },

    cycleCard: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
      backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.md, marginBottom: SPACING.lg, ...SHADOWS.sm,
    },
    cycleNav: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primaryLight + '30', alignItems: 'center', justifyContent: 'center' },
    cycleLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5 },
    cycleValue: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text, marginTop: 2 },

    sectionLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: SPACING.sm, marginLeft: SPACING.xs },

    card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, ...SHADOWS.sm },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    metricCard: {
      flexBasis: '47%', flexGrow: 1,
      backgroundColor: C.white, borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md, ...SHADOWS.sm,
    },
    metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metricLabel: { fontSize: 10, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5 },
    metricValue: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text, marginTop: 4 },
    metricHint: { fontSize: 10, color: C.textMuted, marginTop: 2 },

    kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: C.borderLight },
    kvKey: { fontSize: FONT_SIZE.sm, color: C.textMuted, flex: 1 },
    kvValue: { fontSize: FONT_SIZE.sm, color: C.text, fontWeight: '600', flex: 1.4, textAlign: 'right' },

    activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: C.borderLight },
    activityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    activityTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
    activitySub: { fontSize: FONT_SIZE.xs, color: C.textSecondary, marginTop: 2 },
    activityTs: { fontSize: 10, color: C.textMuted, marginTop: 4 },

    banner: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md },
    bannerError: { backgroundColor: '#FEE2E2' },
    bannerErrorText: { fontSize: FONT_SIZE.xs, color: '#B91C1C', flex: 1 },

    holdBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, backgroundColor: '#FEF3C7', padding: SPACING.sm, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.sm },
    holdText: { fontSize: FONT_SIZE.xs, color: '#92400E', flex: 1 },
  });
  // Attach a colour reference so atoms can read the muted icon colour without
  // re-importing useColors (RN StyleSheet doesn't allow dynamic access from
  // child components otherwise).
  (s as any).__colors = C;
  return s;
};

export default AdminPerformanceLogScreen;

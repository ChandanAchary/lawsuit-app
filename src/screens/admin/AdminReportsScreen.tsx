import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
  Image, ScrollView, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminReportsApi, ReportStatus } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { TabBar } from '../../components/TabBar';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate, formatTime } from '../../utils/date';

const STATUS_TABS: { key: ReportStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',        label: 'All' },
  { key: 'OPEN',       label: 'Open' },
  { key: 'IN_REVIEW',  label: 'In review' },
  { key: 'RESOLVED',   label: 'Resolved' },
];

const STATUS_PALETTE: Record<ReportStatus, { bg: string; fg: string; label: string }> = {
  OPEN:      { bg: '#FEF3C7', fg: '#B45309', label: 'OPEN' },
  IN_REVIEW: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'IN REVIEW' },
  RESOLVED:  { bg: '#D1FAE5', fg: '#047857', label: 'RESOLVED' },
};

// Issue tracking — user-submitted reports landing in OPEN; admins move
// them through IN_REVIEW → RESOLVED. This screen is the triage queue.
export const AdminReportsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState<ReportStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [counts, setCounts] = useState<{ OPEN: number; IN_REVIEW: number; RESOLVED: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [detail, setDetail] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (tab !== 'ALL') params.status = tab;
      if (search.trim()) params.q = search.trim();
      const { data } = await adminReportsApi.list(params);
      setItems(data?.items || []);
      if (data?.counts) setCounts(data.counts);
    } catch (err: any) {
      setItems([]);
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load reports');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [tab, search]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (next: ReportStatus) => {
    if (!detail) return;
    setSubmitting(true);
    try {
      const { data } = await adminReportsApi.updateStatus(detail.id, next);
      setDetail(data?.report || { ...detail, status: next });
      Alert.alert('Updated', `Marked as ${next.replace('_', ' ').toLowerCase()}.`);
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const p = STATUS_PALETTE[item.status as ReportStatus] || STATUS_PALETTE.OPEN;
    return (
      <TouchableOpacity style={styles.card} onPress={() => setDetail(item)} activeOpacity={0.85}>
        <View style={styles.cardTop}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.badge, { backgroundColor: p.bg }]}>
            <Text style={[styles.badgeText, { color: p.fg }]}>{p.label}</Text>
          </View>
        </View>
        <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
        <Text style={styles.meta}>
          {formatDate(item.createdAt)} · {formatTime(item.createdAt)} · by {String(item.userId || '').slice(0, 8)}…
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
      </View>

      {counts && (
        <View style={styles.summaryRow}>
          <Stat label="Open" value={counts.OPEN} tone="warn" styles={styles} />
          <Stat label="In review" value={counts.IN_REVIEW} tone="info" styles={styles} />
          <Stat label="Resolved" value={counts.RESOLVED} tone="ok" styles={styles} />
        </View>
      )}

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load()}
          placeholder="Search title or description"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      <TabBar
        tabs={STATUS_TABS as { key: string; label: string }[]}
        active={tab}
        onSelect={(k) => setTab(k as typeof tab)}
      />

      {loading ? <Loading /> : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="📭" title="No reports" message="Nothing matches the current filter." />}
        />
      )}

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{detail?.title}</Text>
              <TouchableOpacity onPress={() => setDetail(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              {detail && (
                <>
                  <View style={[styles.badge, { backgroundColor: STATUS_PALETTE[detail.status as ReportStatus]?.bg, alignSelf: 'flex-start' }]}>
                    <Text style={[styles.badgeText, { color: STATUS_PALETTE[detail.status as ReportStatus]?.fg }]}>
                      {STATUS_PALETTE[detail.status as ReportStatus]?.label}
                    </Text>
                  </View>
                  <Text style={styles.detailMeta}>
                    Submitted {formatDate(detail.createdAt)} · {formatTime(detail.createdAt)}
                    {'\n'}User {String(detail.userId || '').slice(0, 16)}…
                  </Text>
                  {detail.resolvedAt && (
                    <Text style={styles.detailMeta}>
                      Resolved {formatDate(detail.resolvedAt)} · {formatTime(detail.resolvedAt)}
                    </Text>
                  )}

                  <Text style={styles.sectionLabel}>DESCRIPTION</Text>
                  <Text style={styles.descBlock}>{detail.description}</Text>

                  {detail.screenshotUrl ? (
                    <>
                      <Text style={styles.sectionLabel}>SCREENSHOT</Text>
                      <TouchableOpacity onPress={() => Linking.openURL(detail.screenshotUrl)}>
                        <Image source={{ uri: detail.screenshotUrl }} style={styles.screenshot} resizeMode="cover" />
                      </TouchableOpacity>
                    </>
                  ) : null}

                  <Text style={styles.sectionLabel}>UPDATE STATUS</Text>
                  <View style={styles.actionRow}>
                    {(['OPEN', 'IN_REVIEW', 'RESOLVED'] as ReportStatus[]).map((s) => (
                      <TouchableOpacity
                        key={s}
                        disabled={detail.status === s || submitting}
                        style={[
                          styles.actionBtn,
                          detail.status === s && styles.actionBtnDisabled,
                        ]}
                        onPress={() => updateStatus(s)}
                      >
                        <Text style={styles.actionText}>{s.replace('_', ' ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const Stat = ({ label, value, tone, styles }: any) => {
  const palette: Record<string, { bg: string; fg: string }> = {
    warn: { bg: '#FEF3C7', fg: '#B45309' },
    info: { bg: '#DBEAFE', fg: '#1D4ED8' },
    ok:   { bg: '#D1FAE5', fg: '#047857' },
  };
  const p = palette[tone] || palette.info;
  return (
    <View style={[styles.statTile, { borderColor: p.fg + '30' }]}>
      <Text style={[styles.statLabel, { color: p.fg }]}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },

  summaryRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  statTile: {
    flex: 1, backgroundColor: C.white, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, padding: SPACING.md, alignItems: 'flex-start',
  },
  statLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800', letterSpacing: 0.5 },
  statValue: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: C.text, marginTop: 2 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginTop: SPACING.md,
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZE.sm, color: C.text, padding: 0 },

  list: { padding: SPACING.xl, paddingBottom: 120 },

  card: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  title: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  desc: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: SPACING.xs },
  meta: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: SPACING.sm },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '92%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, gap: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  modalTitle: { flex: 1, fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text },
  modalBody: { padding: SPACING.xl },
  detailMeta: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: SPACING.sm },
  sectionLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textMuted,
    letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: SPACING.xs,
  },
  descBlock: { fontSize: FONT_SIZE.sm, color: C.text, lineHeight: 20 },
  screenshot: { width: '100%', height: 200, borderRadius: BORDER_RADIUS.lg, backgroundColor: C.surfaceAlt },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  actionBtn: {
    flex: 1, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg, backgroundColor: C.primary, alignItems: 'center',
  },
  actionBtnDisabled: { backgroundColor: C.surfaceAlt },
  actionText: { color: '#FFFFFF', fontWeight: '800', fontSize: FONT_SIZE.xs, letterSpacing: 0.3 },
});

export default AdminReportsScreen;

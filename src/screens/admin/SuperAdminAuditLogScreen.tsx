import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ScrollView, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { auditLogApi, AuditAction } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatDate, formatTime } from '../../utils/date';

const ACTION_FILTERS: { key: AuditAction | 'ALL'; label: string }[] = [
  { key: 'ALL',                              label: 'All' },
  { key: 'PAYOUT_DISBURSED',                 label: 'Payouts' },
  { key: 'PAYOUT_REFUNDED',                  label: 'Refunds' },
  { key: 'PAYOUT_DISPUTE_OPENED',            label: 'Disputes' },
  { key: 'PAYOUT_DISPUTE_RESOLVED',          label: 'Dispute resolved' },
  { key: 'COURT_ADMIN_APPROVED',             label: 'CA approved' },
  { key: 'COURT_ADMIN_REJECTED',             label: 'CA rejected' },
  { key: 'LAWYER_VERIFICATION_OVERRIDDEN',   label: 'Lawyer KYC' },
  { key: 'ORGANIZATION_VERIFICATION_OVERRIDDEN', label: 'Org KYC' },
  { key: 'ADMIN_INVITED',                    label: 'Admin invited' },
  { key: 'ADMIN_UPDATED',                    label: 'Admin updated' },
  { key: 'ADMIN_DELETED',                    label: 'Admin deleted' },
  { key: 'PLATFORM_CONFIG_UPDATED',          label: 'Config' },
];

const ACTION_COLOR: Record<string, string> = {
  PAYOUT_DISBURSED: '#0EA5E9',
  PAYOUT_REFUNDED: '#F97316',
  PAYOUT_DISPUTE_OPENED: '#B45309',
  PAYOUT_DISPUTE_RESOLVED: '#047857',
  COURT_ADMIN_APPROVED: '#047857',
  COURT_ADMIN_REJECTED: '#B91C1C',
  LAWYER_VERIFICATION_OVERRIDDEN: '#7C3AED',
  ORGANIZATION_VERIFICATION_OVERRIDDEN: '#7C3AED',
  ADMIN_INVITED: '#0EA5E9',
  ADMIN_UPDATED: '#0EA5E9',
  ADMIN_DELETED: '#B91C1C',
  PLATFORM_CONFIG_UPDATED: '#374151',
};

export const SuperAdminAuditLogScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [filter, setFilter] = useState<AuditAction | 'ALL'>('ALL');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (filter !== 'ALL') params.action = filter;
      const { data } = await auditLogApi.list(params);
      setItems(data?.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const renderRow = ({ item }: { item: any }) => {
    const color = ACTION_COLOR[item.action] || COLORS.textSecondary;
    return (
      <TouchableOpacity style={styles.card} onPress={() => setDetail(item)}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.action}>{item.action.replace(/_/g, ' ')}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.targetType} {item.targetId ? `· ${String(item.targetId).slice(0, 12)}…` : ''}
          </Text>
          <Text style={styles.when}>
            {formatDate(item.createdAt)} · {formatTime(item.createdAt)}
            {item.actorName ? ` · ${item.actorName}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audit Log</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {ACTION_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.chipText, filter === f.key && { color: '#FFFFFF' }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <Loading /> : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="📜" title="No events" message="Nothing recorded yet for this filter." />}
        />
      )}

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {detail?.action?.replace(/_/g, ' ')}
              </Text>
              <TouchableOpacity onPress={() => setDetail(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <KV k="When" v={detail ? `${formatDate(detail.createdAt)} · ${formatTime(detail.createdAt)}` : '—'} styles={styles} />
              <KV k="Actor" v={detail?.actorName || detail?.actorId || '—'} styles={styles} />
              <KV k="Actor role" v={detail?.actorRole || '—'} styles={styles} />
              <KV k="Target" v={`${detail?.targetType || ''} ${detail?.targetId ? '· ' + detail.targetId : ''}`} styles={styles} />
              {detail?.reason ? <KV k="Reason" v={detail.reason} styles={styles} /> : null}
              {detail?.notes ? <KV k="Notes" v={detail.notes} styles={styles} /> : null}
              {detail?.context?.ip ? <KV k="IP" v={String(detail.context.ip)} styles={styles} /> : null}
              {detail?.context?.userAgent ? <KV k="User agent" v={String(detail.context.userAgent)} styles={styles} /> : null}
              {detail?.before ? (
                <View style={styles.diffBox}>
                  <Text style={styles.diffLabel}>BEFORE</Text>
                  <Text style={styles.diffJson}>{JSON.stringify(detail.before, null, 2)}</Text>
                </View>
              ) : null}
              {detail?.after ? (
                <View style={styles.diffBox}>
                  <Text style={styles.diffLabel}>AFTER</Text>
                  <Text style={styles.diffJson}>{JSON.stringify(detail.after, null, 2)}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const KV = ({ k, v, styles }: any) => (
  <View style={styles.kvRow}>
    <Text style={styles.kvKey}>{k}</Text>
    <Text style={styles.kvValue}>{v}</Text>
  </View>
);

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },
  filtersRow: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: C.surfaceAlt, borderWidth: 1, borderColor: C.border,
    marginRight: SPACING.xs,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textSecondary },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg,
    marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  action: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  meta: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
  when: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '90%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text, flex: 1 },
  modalBody: { padding: SPACING.xl },
  kvRow: { marginBottom: SPACING.md },
  kvKey: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5 },
  kvValue: { fontSize: FONT_SIZE.sm, color: C.text, marginTop: 2 },
  diffBox: { backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginTop: SPACING.md },
  diffLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted, letterSpacing: 0.5, marginBottom: SPACING.xs },
  diffJson: { fontFamily: 'monospace', fontSize: 11, color: C.text },
});

export default SuperAdminAuditLogScreen;

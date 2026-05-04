import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { mediationApi } from '../../services/api';
import { socketService } from '../../services/socket';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { useAuthStore } from '../../stores/authStore';
import { UserRole, Mediation } from '../../types';
import { formatDate } from '../../utils/date';
import { formatErrorMessage, isEndpointMissing } from '../../utils/formatError';

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'concluded', label: 'Concluded' },
];

const statusColor: Record<string, { bg: string; fg: string }> = {
  AWAITING_RESPONDENT_LAWYER: { bg: '#FEF3C7', fg: '#B45309' },
  AWAITING_MEDIATOR_SELECTION: { bg: '#DBEAFE', fg: '#1D4ED8' },
  IN_SESSION: { bg: '#D1FAE5', fg: '#047857' },
  RESOLVED: { bg: '#DCFCE7', fg: '#166534' },
  ESCALATED_TO_CASE: { bg: '#FEE2E2', fg: '#B91C1C' },
  CANCELLED: { bg: '#E5E7EB', fg: '#374151' },
};

const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export const MediationsListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState('active');
  const [items, setItems] = useState<Mediation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await mediationApi.list();
      setItems(data.data || data.items || []);
      setUnavailable(false);
    } catch (err: any) {
      setItems([]);
      if (isEndpointMissing(err)) {
        setUnavailable(true);
      } else {
        Alert.alert('Error', formatErrorMessage(err) || 'Failed to load mediations');
      }
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh on server-side mediation state changes. Server emits to every
  // participant's `user:${id}` room so this reaches both initiator/respondent
  // sides without requiring a per-mediation join.
  useEffect(() => {
    const off = socketService.on('mediation:updated', () => {
      if (!unavailable) load(false);
    });
    return off;
  }, [load, unavailable]);

  const CONCLUDED = new Set(['RESOLVED', 'ESCALATED_TO_CASE', 'CANCELLED']);
  const filtered = items.filter((m) => tab === 'active' ? !CONCLUDED.has(m.status) : CONCLUDED.has(m.status));
  const isLawyer = user?.role === UserRole.LAWYER;
  const isClient = user?.role === UserRole.CLIENT;

  const renderItem = ({ item }: { item: Mediation }) => {
    const other =
      item.initiatorClientId === user?.id ? item.respondentClient : item.initiatorClient;
    const badge = statusColor[item.status] || statusColor.CANCELLED;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('MediationDetail', { id: item.id })}
      >
        <View style={styles.cardTop}>
          <Text style={styles.title} numberOfLines={1}>{item.disputeTitle}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.fg }]}>{pretty(item.status)}</Text>
          </View>
        </View>
        <Text style={styles.sub} numberOfLines={2}>{item.disputeDescription}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="person-circle-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.meta}>{other?.name || 'Other party'}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mediations</Text>
        {isLawyer && (
          <TouchableOpacity onPress={() => navigation.navigate('MediatorSettings')} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        )}
      </View>

      <TabBar tabs={TABS} active={tab} onSelect={setTab} />

      {isClient && !unavailable && (
        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('NewMediationInvite')}>
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.ctaText}>New Mediation Invite</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? <Loading /> : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon={unavailable ? '🚧' : '🤝'}
              title={unavailable ? 'Mediations not available' : (tab === 'active' ? 'No active mediations' : 'No concluded mediations')}
              message={unavailable
                ? 'This feature is not enabled on the server yet. Please try again later.'
                : (isClient && tab === 'active' ? 'Start one by inviting a respondent.' : 'Nothing here yet.')}
            />
          }
        />
      )}
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
  iconBtn: { marginLeft: 'auto', width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },
  ctaRow: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, backgroundColor: C.primary, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: FONT_SIZE.md },
  list: { padding: SPACING.xl, paddingBottom: 120 },
  card: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, marginBottom: SPACING.xs },
  title: { flex: 1, fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '800' },
  sub: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  meta: { fontSize: FONT_SIZE.xs, color: C.textMuted },
  dot: { color: C.textMuted, marginHorizontal: 2 },
});

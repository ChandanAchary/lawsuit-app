import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { videoApi } from '../../services/api';
import { CallHistory, CallStatus } from '../../types';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { formatDate, formatTime } from '../../utils/date';
import { useAuthStore } from '../../stores/authStore';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: CallStatus.COMPLETED, label: 'Completed' },
  { key: CallStatus.MISSED, label: 'Missed' },
  { key: CallStatus.DECLINED, label: 'Declined' },
  { key: CallStatus.FAILED, label: 'Failed' },
  { key: CallStatus.CANCELLED, label: 'Cancelled' },
];

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  COMPLETED: { bg: '#D1FAE5', text: '#10B981', icon: 'call' },
  MISSED: { bg: '#FEE2E2', text: '#EF4444', icon: 'call-outline' },
  DECLINED: { bg: '#FEE2E2', text: '#EF4444', icon: 'close-circle' },
  FAILED: { bg: '#FEE2E2', text: '#EF4444', icon: 'warning' },
  CANCELLED: { bg: '#DBEAFE', text: '#3B82F6', icon: 'close' },
};

export const CallHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState('all');
  const [calls, setCalls] = useState<CallHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchCalls = useCallback(async (pageNum = 1, showLoader = true) => {
    if (showLoader && pageNum === 1) setLoading(true);
    try {
      const params: any = { page: pageNum, limit: 20 };
      if (tab !== 'all') params.status = tab;
      const { data } = await videoApi.getCallHistory(params);
      const items = data.calls || data.items || data || [];
      if (pageNum === 1) {
        setCalls(items);
      } else {
        setCalls((prev) => [...prev, ...items]);
      }
      setHasMore(items.length >= 20);
      setPage(pageNum);
    } catch {
      if (pageNum === 1) setCalls([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { fetchCalls(1); }, [fetchCalls]);

  const onRefresh = () => { setRefreshing(true); fetchCalls(1, false); };
  const loadMore = () => { if (hasMore && !loading) fetchCalls(page + 1, false); };

  const getStatusStyle = (status: string) => STATUS_STYLE[status] || STATUS_STYLE.COMPLETED;

  const handleCallPress = (item: CallHistory) => {
    if (item.callType === 'APPOINTMENT') {
      navigation.navigate('AppointmentDetail', { appointmentId: item.referenceId });
    } else if (item.callType === 'CHAT') {
      navigation.navigate('ChatScreen', { chatId: item.referenceId });
    }
  };

  const renderItem = ({ item }: { item: CallHistory }) => {
    const s = getStatusStyle(item.status);
    const isCaller = item.callerId === user?.id;
    const otherPartyName = isCaller ? item.calleeName : item.callerName;
    const callDirectionIcon: keyof typeof Ionicons.glyphMap = isCaller
      ? 'arrow-up-outline'
      : 'arrow-down-outline';
    
    // Format duration e.g. "05:23"
    const minutes = Math.floor(item.duration / 60);
    const seconds = item.duration % 60;
    const durationStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => handleCallPress(item)}>
        <View style={[styles.statusIcon, { backgroundColor: s.bg }]}>
          <Ionicons name={s.icon as any} size={20} color={s.text} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Ionicons name={callDirectionIcon} size={14} color={COLORS.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.cardAmount}>{otherPartyName}</Text>
          </View>
          <Text style={styles.cardMeta}>{formatDate(item.createdAt)} · {formatTime(item.createdAt)}</Text>
        </View>
        <View style={styles.rightSection}>
          <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
            <Text style={[styles.statusText, { color: s.text }]}>{item.status}</Text>
          </View>
          {item.duration > 0 && <Text style={styles.durationText}>{durationStr}</Text>}
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
        <Text style={styles.headerTitle}>Call History</Text>
      </View>
      <TabBar tabs={STATUS_TABS} active={tab} onSelect={setTab} />
      {loading && calls.length === 0 ? <Loading /> : (
        <FlatList
          data={calls}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={<EmptyState icon="📞" title="No Calls" message="Your call history will appear here" />}
        />
      )}
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
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  cardAmount: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  cardMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4 },
  rightSection: { alignItems: 'flex-end', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  durationText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4, fontWeight: '600' }
});

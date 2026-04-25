import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';

export const OrgListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [orgs, setOrgs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [pincode, setPincode] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterVerified, setFilterVerified] = useState<'true' | 'false' | undefined>(undefined);

  const fetchOrgs = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1 && !append) setLoading(true);
    else if (append) setLoadingMore(true);
    try {
      const params: any = { page: pageNum, limit: 20 };
      if (pincode.trim().length === 6) params.pincode = pincode.trim();
      if (filterVerified) params.verified = filterVerified;

      const { data } = await organizationsApi.listPublic(params);
      const items = data.items || data.organizations || data || [];
      setTotal(data.total || items.length);
      if (append) {
        setOrgs((prev) => [...prev, ...items]);
      } else {
        setOrgs(items);
      }
      setPage(pageNum);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [pincode, filterVerified]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleLoadMore = () => {
    if (loadingMore || orgs.length >= total) return;
    fetchOrgs(page + 1, true);
  };

  const renderOrg = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('OrgDetail', { orgId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="business" size={22} color={COLORS.primary} />
          )}
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            {item.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={styles.cardLocation} numberOfLines={1}>
            {[item.city, item.state].filter(Boolean).join(', ') || 'India'}
          </Text>
        </View>
      </View>

      {item.practiceAreas?.length > 0 && (
        <View style={styles.practiceRow}>
          {item.practiceAreas.slice(0, 3).map((area: string, i: number) => (
            <View key={i} style={styles.areaChip}>
              <Text style={styles.areaChipText}>{area}</Text>
            </View>
          ))}
          {item.practiceAreas.length > 3 && (
            <Text style={styles.moreText}>+{item.practiceAreas.length - 3}</Text>
          )}
        </View>
      )}

      <View style={styles.cardFooter}>
        {item.consultationFee != null && item.consultationFee > 0 && (
          <View style={styles.feeBox}>
            <Ionicons name="cash-outline" size={14} color={COLORS.primary} />
            <Text style={styles.feeText}>₹{Math.round(item.consultationFee / 100)}</Text>
          </View>
        )}
        {item.pincode && (
          <View style={styles.feeBox}>
            <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.locationText}>{item.pincode}</Text>
          </View>
        )}
        <View style={styles.arrowBox}>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organizations</Text>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(!showFilters)}>
          <Ionicons name="filter" size={20} color={showFilters ? COLORS.primary : COLORS.text} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Filter by pincode (6 digits)"
              value={pincode}
              onChangeText={(t) => { setPincode(t); if (t.length === 6 || t.length === 0) setPage(1); }}
              keyboardType="numeric"
              maxLength={6}
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <View style={styles.filterChips}>
            <TouchableOpacity
              style={[styles.filterChip, filterVerified === undefined && styles.filterChipActive]}
              onPress={() => setFilterVerified(undefined)}
            >
              <Text style={[styles.filterChipText, filterVerified === undefined && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterVerified === 'true' && styles.filterChipActive]}
              onPress={() => setFilterVerified('true')}
            >
              <Text style={[styles.filterChipText, filterVerified === 'true' && styles.filterChipTextActive]}>Verified</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterVerified === 'false' && styles.filterChipActive]}
              onPress={() => setFilterVerified('false')}
            >
              <Text style={[styles.filterChipText, filterVerified === 'false' && styles.filterChipTextActive]}>Unverified</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? <Loading /> : (
        <FlatList
          data={orgs}
          keyExtractor={(item) => item.id}
          renderItem={renderOrg}
          contentContainerStyle={styles.list}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrgs(1); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="🏢" title="No Organizations" message="No organizations found. Try adjusting your filters." />}
          ListFooterComponent={loadingMore ? <Loading /> : null}
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
    backgroundColor: COLORS.white, ...SHADOWS.sm, zIndex: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  filterBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  filtersContainer: {
    backgroundColor: COLORS.white, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.sm,
  },
  searchInput: { flex: 1, paddingVertical: SPACING.sm, fontSize: FONT_SIZE.md, color: COLORS.text },
  filterChips: { flexDirection: 'row', gap: SPACING.sm },
  filterChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  filterChipTextActive: { color: COLORS.white },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, flex: 1 },
  cardLocation: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  practiceRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs,
    marginTop: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  areaChip: {
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary + '10',
  },
  areaChipText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600' },
  moreText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: '600', alignSelf: 'center' },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.lg,
    marginTop: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  feeBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  feeText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.primary },
  locationText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  arrowBox: { marginLeft: 'auto' },
});

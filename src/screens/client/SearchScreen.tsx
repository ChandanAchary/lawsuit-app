import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING } from '../../constants';
import { LawyerCard } from '../../components/LawyerCard';
import { useLawyerStore } from '../../stores/lawyerStore';
import { Lawyer, LawyerFilterOptions } from '../../types';
import { BottomSheet } from '../../components/Modals';
import { ChipGroup } from '../../components/TabBar';
import { getCurrentLocation, UserLocation } from '../../utils/permissions';

export const SearchScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const { lawyers, loading, total, page, filterOptions, fetchLawyers } = useLawyerStore();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<LawyerFilterOptions>({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('rating');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [sortedLawyers, setSortedLawyers] = useState<Lawyer[]>([]);
  const locationFetched = useRef(false);

  useEffect(() => {
    fetchLawyers({ ...filters, search, sortBy, sortOrder: 'desc' });
  }, []);

  // Keep sortedLawyers in sync with lawyers list and sort mode
  useEffect(() => {
    if (sortBy === 'nearme' && userLocation) {
      // Sort: lawyers in the same city first, then by rating
      const sorted = [...lawyers].sort((a, b) => {
        const userCity = (userLocation.city || '').toLowerCase();
        const aMatch = a.location?.toLowerCase().includes(userCity) ? 0 : 1;
        const bMatch = b.location?.toLowerCase().includes(userCity) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return b.rating - a.rating;
      });
      setSortedLawyers(sorted);
    } else {
      setSortedLawyers(lawyers);
    }
  }, [lawyers, sortBy, userLocation]);

  const handleSearch = useCallback(() => {
    const effectiveSortBy = sortBy === 'nearme' ? 'rating' : sortBy;
    fetchLawyers({ ...filters, search, sortBy: effectiveSortBy, sortOrder: 'desc' });
  }, [search, filters, sortBy]);

  const handleSortChange = async (s: string) => {
    setSortBy(s);
    if (s === 'nearme') {
      if (!locationFetched.current) {
        setLocationLoading(true);
        const loc = await getCurrentLocation();
        setUserLocation(loc);
        setLocationLoading(false);
        locationFetched.current = true;
      }
      // Fetch from server sorted by rating; client-side location sort applied in useEffect
      fetchLawyers({ ...filters, search, sortBy: 'rating', sortOrder: 'desc' });
    } else {
      fetchLawyers({ ...filters, search, sortBy: s, sortOrder: 'desc' });
    }
  };

  const handleLawyerPress = (lawyer: Lawyer) => {
    navigation.navigate('LawyerDetail', { lawyerId: lawyer.id });
  };

  const handleLoadMore = () => {
    if (lawyers.length < total) {
      const effectiveSortBy = sortBy === 'nearme' ? 'rating' : sortBy;
      fetchLawyers({ ...filters, search, sortBy: effectiveSortBy, sortOrder: 'desc' }, page + 1);
    }
  };

  const renderSubHeader = () => (
    <View style={styles.subHeader}>
      <View style={styles.sortRow}>
        {(['rating', 'experience', 'fee', 'nearme'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.sortChip, sortBy === s && styles.sortChipActive]}
            onPress={() => handleSortChange(s)}
          >
            {s === 'nearme' ? (
              <View style={styles.nearMeChipInner}>
                <Ionicons
                  name="location"
                  size={13}
                  color={sortBy === s ? COLORS.white : COLORS.textSecondary}
                />
                <Text style={[styles.sortText, sortBy === s && styles.sortTextActive]}>
                  {locationLoading ? 'Locating...' : 'Near Me'}
                </Text>
              </View>
            ) : (
              <Text style={[styles.sortText, sortBy === s && styles.sortTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {sortBy === 'nearme' && userLocation?.city && (
        <View style={styles.locationBanner}>
          <Ionicons name="location" size={14} color={COLORS.primary} />
          <Text style={styles.locationBannerText}>
            Showing lawyers near{' '}
            <Text style={{ fontWeight: '700' }}>{userLocation.city}</Text>
          </Text>
        </View>
      )}
      {sortBy === 'nearme' && !userLocation?.city && !locationLoading && (
        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
          <Text style={[styles.locationBannerText, { color: COLORS.textMuted }]}>
            Could not detect location. Please enable location permission.
          </Text>
        </View>
      )}

      <Text style={styles.resultCount}>
        {total} lawyer{total !== 1 ? 's' : ''} found
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Fixed primary-coloured search header */}
      <View style={styles.headerFixed}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search lawyers..."
              placeholderTextColor={COLORS.textMuted}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearch('');
                  const effectiveSortBy = sortBy === 'nearme' ? 'rating' : sortBy;
                  fetchLawyers({ ...filters, search: '', sortBy: effectiveSortBy, sortOrder: 'desc' });
                }}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, Object.keys(filters).length > 0 && styles.filterBtnActive]}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={sortedLawyers}
        renderItem={({ item }) => {
          const isNearMe =
            sortBy === 'nearme' &&
            !!userLocation?.city &&
            !!item.location?.toLowerCase().includes((userLocation.city || '').toLowerCase());
          return (
            <LawyerCard
              lawyer={item}
              onPress={() => handleLawyerPress(item)}
              nearMe={isNearMe}
            />
          );
        }}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderSubHeader}
        contentContainerStyle={styles.list}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ padding: SPACING.lg }} />
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No lawyers found</Text>
              <Text style={styles.emptyDesc}>Try adjusting your search or filters</Text>
            </View>
          ) : null
        }
      />

      <BottomSheet visible={showFilters} onClose={() => setShowFilters(false)} title="Filters">
        <View style={styles.filterSection}>
          {filterOptions.specializations.length > 0 && (
            <>
              <Text style={styles.filterLabel}>Specialization</Text>
              <ChipGroup
                items={['All', ...filterOptions.specializations]}
                selected={filters.specialization || 'All'}
                onSelect={(v) => {
                  const newFilters = { ...filters };
                  if (v === 'All') delete newFilters.specialization;
                  else newFilters.specialization = v;
                  setFilters(newFilters);
                }}
              />
            </>
          )}
          {filterOptions.locations.length > 0 && (
            <>
              <Text style={styles.filterLabel}>Location</Text>
              <ChipGroup
                items={['All', ...filterOptions.locations]}
                selected={filters.location || 'All'}
                onSelect={(v) => {
                  const newFilters = { ...filters };
                  if (v === 'All') delete newFilters.location;
                  else newFilters.location = v;
                  setFilters(newFilters);
                }}
              />
            </>
          )}
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => {
              setShowFilters(false);
              handleSearch();
            }}
          >
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerFixed: {
    backgroundColor: COLORS.primary,
    paddingTop: SPACING.huge,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  subHeader: { paddingTop: SPACING.md, paddingBottom: SPACING.xs },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    height: 48,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: COLORS.white,
  },
  sortRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
  },
  sortChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  nearMeChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  sortTextActive: { color: COLORS.white },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.primary + '12',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  locationBannerText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },
  resultCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  list: { padding: SPACING.lg, paddingTop: SPACING.xs },
  empty: { alignItems: 'center', paddingVertical: SPACING.huge },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptyDesc: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  filterSection: { paddingBottom: SPACING.xxl },
  filterLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.lg,
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md + 2,
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  applyBtnText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.white,
  },
});

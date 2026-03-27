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
import { usersApi } from '../../services/api';

const DISTANCE_SEARCH_RADIUS_KM = 50000;
type QuickFilterKey = 'verifiedTop' | 'nearme' | 'fee' | 'experience' | 'rating' | 'availability';

export const SearchScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const { lawyers, loading, total, page, filterOptions, fetchLawyers } = useLawyerStore();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<LawyerFilterOptions>({});
  const [showFilters, setShowFilters] = useState(false);
  const [quickFilters, setQuickFilters] = useState<Record<QuickFilterKey, boolean>>({
    verifiedTop: false,
    nearme: false,
    fee: false,
    experience: false,
    rating: false,
    availability: false,
  });
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [profilePincode, setProfilePincode] = useState<string | null>(null);
  const [nearMeSource, setNearMeSource] = useState<'device' | 'profile' | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const locationFetched = useRef(false);
  const hasMountedSearchEffect = useRef(false);

  const buildDistanceFilters = useCallback((base: LawyerFilterOptions): LawyerFilterOptions => {
    const distanceFilters: LawyerFilterOptions = { ...base };
    delete distanceFilters.location;
    distanceFilters.sortBy = 'distance';
    distanceFilters.sortOrder = 'asc';
    distanceFilters.radius = DISTANCE_SEARCH_RADIUS_KM;
    return distanceFilters;
  }, []);

  useEffect(() => {
    fetchLawyers({ ...filters, search });
  }, []);

  useEffect(() => {
    if (!hasMountedSearchEffect.current) {
      hasMountedSearchEffect.current = true;
      return;
    }

    const timer = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSearch = useCallback(() => {
    if (quickFilters.nearme && userLocation) {
      const distanceFilters = buildDistanceFilters(filters);
      fetchLawyers({
        ...distanceFilters,
        search,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
      return;
    }

    if (quickFilters.nearme && profilePincode) {
      const distanceFilters = buildDistanceFilters(filters);
      fetchLawyers({
        ...distanceFilters,
        search,
        clientPincode: profilePincode,
      });
      return;
    }

    fetchLawyers({ ...filters, search });
  }, [search, filters, userLocation, profilePincode, quickFilters.nearme, fetchLawyers, buildDistanceFilters]);

  const searchWithSavedProfileLocation = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await usersApi.getClientInformation();
      const pin = String(data?.client?.pincode || '').trim();
      if (!/^\d{6}$/.test(pin)) return false;

      setUserLocation(null);
      setProfilePincode(pin);
      setNearMeSource('profile');
      setQuickFilters((prev) => ({ ...prev, nearme: true }));

      const profileFilters: LawyerFilterOptions = {
        ...filters,
        location: undefined,
        latitude: undefined,
        longitude: undefined,
        clientPincode: pin,
      };

      const distanceFilters = buildDistanceFilters(profileFilters);
      setFilters(distanceFilters);
      await fetchLawyers({ ...distanceFilters, search });
      return true;
    } catch {
      return false;
    }
  }, [filters, search, fetchLawyers, buildDistanceFilters]);

  const handleUseMyLocation = useCallback(async () => {
    setLocationLoading(true);
    const loc = await getCurrentLocation();
    locationFetched.current = true;

    if (!loc) {
      const fallbackApplied = await searchWithSavedProfileLocation();
      setLocationLoading(false);
      if (!fallbackApplied) {
        setUserLocation(null);
        setNearMeSource(null);
      }
      return;
    }

    setLocationLoading(false);

    setUserLocation(loc);
    setProfilePincode(null);
    setNearMeSource('device');
    setQuickFilters((prev) => ({ ...prev, nearme: true }));

    const locationFilters: LawyerFilterOptions = {
      ...filters,
      location: undefined,
      clientPincode: undefined,
      latitude: loc.latitude,
      longitude: loc.longitude,
    };

    const distanceFilters = buildDistanceFilters(locationFilters);
    setFilters(distanceFilters);
    fetchLawyers({ ...distanceFilters, search });
  }, [filters, search, fetchLawyers, searchWithSavedProfileLocation, buildDistanceFilters]);

  const toggleQuickFilter = async (key: QuickFilterKey) => {
    const isActive = quickFilters[key];

    if (key === 'nearme') {
      if (isActive) {
        const nextFilters = { ...filters };
        delete nextFilters.latitude;
        delete nextFilters.longitude;
        delete nextFilters.radius;
        delete nextFilters.clientPincode;
        setNearMeSource(null);
        setProfilePincode(null);
        setUserLocation(null);
        setQuickFilters((prev) => ({ ...prev, nearme: false }));
        setFilters(nextFilters);
        fetchLawyers({ ...nextFilters, search });
        return;
      }

      if (locationFetched.current && userLocation) {
        const locationFilters: LawyerFilterOptions = {
          ...filters,
          location: undefined,
          clientPincode: undefined,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        };
        const distanceFilters = buildDistanceFilters(locationFilters);
        setFilters(distanceFilters);
        setQuickFilters((prev) => ({ ...prev, nearme: true }));
        fetchLawyers({ ...distanceFilters, search });
      } else if (locationFetched.current && profilePincode) {
        const profileFilters: LawyerFilterOptions = {
          ...filters,
          location: undefined,
          latitude: undefined,
          longitude: undefined,
          clientPincode: profilePincode,
        };
        setNearMeSource('profile');
        const distanceFilters = buildDistanceFilters(profileFilters);
        setFilters(distanceFilters);
        setQuickFilters((prev) => ({ ...prev, nearme: true }));
        fetchLawyers({ ...distanceFilters, search });
      } else {
        await handleUseMyLocation();
      }
    } else {
      setQuickFilters((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const displayedLawyers = React.useMemo(() => {
    const list = [...lawyers];
    list.sort((a: any, b: any) => {
      if (quickFilters.verifiedTop && Boolean(a.isVerified) !== Boolean(b.isVerified)) {
        return a.isVerified ? -1 : 1;
      }

      if (quickFilters.nearme) {
        const ad = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
        const bd = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
        if (ad !== bd) return ad - bd;
      }

      if (quickFilters.fee) {
        const af = Number(a.fee ?? Number.POSITIVE_INFINITY);
        const bf = Number(b.fee ?? Number.POSITIVE_INFINITY);
        if (af !== bf) return af - bf;
      }

      if (quickFilters.experience) {
        const ae = Number(a.experienceYears ?? 0);
        const be = Number(b.experienceYears ?? 0);
        if (ae !== be) return be - ae;
      }

      if (quickFilters.rating) {
        const ar = Number(a.rating ?? 0);
        const br = Number(b.rating ?? 0);
        if (ar !== br) return br - ar;
      }

      if (quickFilters.availability) {
        const aa = Boolean(a.isAvailable);
        const ba = Boolean(b.isAvailable);
        if (aa !== ba) return aa ? -1 : 1;
      }

      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return list;
  }, [lawyers, quickFilters]);

  const hasActiveQuickFilters = React.useMemo(
    () => Object.values(quickFilters).some(Boolean),
    [quickFilters],
  );

  const clearQuickFilters = () => {
    const nextFilters = { ...filters };
    delete nextFilters.latitude;
    delete nextFilters.longitude;
    delete nextFilters.radius;
    delete nextFilters.clientPincode;

    setQuickFilters({
      verifiedTop: false,
      nearme: false,
      fee: false,
      experience: false,
      rating: false,
      availability: false,
    });
    setNearMeSource(null);
    setProfilePincode(null);
    setUserLocation(null);
    setFilters(nextFilters);
    fetchLawyers({ ...nextFilters, search });
  };

  const handleLawyerPress = (lawyer: Lawyer) => {
    navigation.navigate('LawyerDetail', { lawyerId: lawyer.id });
  };

  const handleLoadMore = () => {
    if (loading) return;

    if (lawyers.length < total) {
      if (quickFilters.nearme && userLocation) {
        const distanceFilters = buildDistanceFilters(filters);
        fetchLawyers({
          ...distanceFilters,
          search,
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        }, page + 1);
        return;
      }

      if (quickFilters.nearme && profilePincode) {
        const distanceFilters = buildDistanceFilters(filters);
        fetchLawyers({
          ...distanceFilters,
          search,
          clientPincode: profilePincode,
        }, page + 1);
        return;
      }

      fetchLawyers({ ...filters, search }, page + 1);
    }
  };

  const renderSubHeader = () => (
    <View style={styles.subHeader}>
      <View style={styles.sortRow}>
        {([
          { key: 'nearme', label: 'Near Me' },
          { key: 'verifiedTop', label: 'Verified Top' },
          { key: 'fee', label: 'Fee' },
          { key: 'experience', label: 'Experience' },
          { key: 'rating', label: 'Rating' },
          { key: 'availability', label: 'Availability' },
        ] as const).map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.sortChip, quickFilters[item.key] && styles.sortChipActive]}
            onPress={() => toggleQuickFilter(item.key)}
          >
            {item.key === 'nearme' ? (
              <View style={styles.nearMeChipInner}>
                <Ionicons
                  name="location"
                  size={13}
                  color={quickFilters[item.key] ? COLORS.white : COLORS.textSecondary}
                />
                <Text style={[styles.sortText, quickFilters[item.key] && styles.sortTextActive]}>
                  {locationLoading ? 'Locating...' : 'Near Me'}
                </Text>
              </View>
            ) : (
              <Text style={[styles.sortText, quickFilters[item.key] && styles.sortTextActive]}>
                {item.label}
              </Text>
            )}
          </TouchableOpacity>
        ))}

        {hasActiveQuickFilters && (
          <TouchableOpacity style={styles.clearChip} onPress={clearQuickFilters}>
            <Ionicons name="close" size={13} color={COLORS.error} />
            <Text style={styles.clearChipText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {quickFilters.nearme && (
        <TouchableOpacity style={styles.locationActionButton} onPress={handleUseMyLocation} disabled={locationLoading}>
          <Ionicons name="navigate" size={14} color={COLORS.white} />
          <Text style={styles.locationActionText}>{locationLoading ? 'Fetching location...' : 'Use my location'}</Text>
        </TouchableOpacity>
      )}

      {quickFilters.nearme && userLocation?.city && (
        <View style={styles.locationBanner}>
          <Ionicons name="location" size={14} color={COLORS.primary} />
          <Text style={styles.locationBannerText}>
            Showing nearest lawyers in ascending distance from{' '}
            <Text style={{ fontWeight: '700' }}>{userLocation.city}</Text>
          </Text>
        </View>
      )}
      {quickFilters.nearme && !userLocation?.city && !!userLocation && (
        <View style={styles.locationBanner}>
          <Ionicons name="location" size={14} color={COLORS.primary} />
          <Text style={styles.locationBannerText}>
            Showing nearest lawyers in ascending distance from your current location
          </Text>
        </View>
      )}
      {quickFilters.nearme && nearMeSource === 'profile' && !!profilePincode && (
        <View style={styles.locationBanner}>
          <Ionicons name="home" size={14} color={COLORS.primary} />
          <Text style={styles.locationBannerText}>
            Location permission denied. Showing nearest lawyers from your saved address ({profilePincode}) in ascending distance.
          </Text>
        </View>
      )}
      {quickFilters.nearme && !userLocation && !locationLoading && !profilePincode && (
        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
          <Text style={[styles.locationBannerText, { color: COLORS.textMuted }]}>
            Could not detect location. Saved profile address will be used when available.
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
        data={displayedLawyers}
        renderItem={({ item }) => {
          const isNearMe = quickFilters.nearme;
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
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.error + '12',
    borderWidth: 1,
    borderColor: COLORS.error + '55',
  },
  clearChipText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.error,
  },
  nearMeChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  sortTextActive: { color: COLORS.white },
  locationActionButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  locationActionText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
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

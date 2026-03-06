import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING } from '../../constants';
import { LawyerCard } from '../../components/LawyerCard';
import { useLawyerStore } from '../../stores/lawyerStore';
import { Lawyer, LawyerFilterOptions } from '../../types';
import { BottomSheet } from '../../components/Modals';
import { ChipGroup } from '../../components/TabBar';

export const SearchScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { lawyers, loading, total, page, filterOptions, fetchLawyers } = useLawyerStore();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<LawyerFilterOptions>({});
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('rating');

  useEffect(() => {
    fetchLawyers({ ...filters, search, sortBy, sortOrder: 'desc' });
  }, []);

  const handleSearch = useCallback(() => {
    fetchLawyers({ ...filters, search, sortBy, sortOrder: 'desc' });
  }, [search, filters, sortBy]);

  const handleLawyerPress = (lawyer: Lawyer) => {
    navigation.navigate('LawyerDetail', { lawyerId: lawyer.id });
  };

  const handleLoadMore = () => {
    if (lawyers.length < total) {
      fetchLawyers({ ...filters, search, sortBy, sortOrder: 'desc' }, page + 1);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
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
            <TouchableOpacity onPress={() => { setSearch(''); fetchLawyers({ ...filters, search: '', sortBy, sortOrder: 'desc' }); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, Object.keys(filters).length > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={22} color={Object.keys(filters).length > 0 ? COLORS.white : COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.sortRow}>
        {['rating', 'experience', 'fee'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.sortChip, sortBy === s && styles.sortChipActive]}
            onPress={() => { setSortBy(s); fetchLawyers({ ...filters, search, sortBy: s, sortOrder: 'desc' }); }}
          >
            <Text style={[styles.sortText, sortBy === s && styles.sortTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.resultCount}>{total} lawyer{total !== 1 ? 's' : ''} found</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={lawyers}
        renderItem={({ item }) => (
          <LawyerCard lawyer={item} onPress={() => handleLawyerPress(item)} />
        )}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading ? <ActivityIndicator color={COLORS.primary} style={{ padding: SPACING.lg }} /> : null}
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

      <BottomSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filters"
      >
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
            onPress={() => { setShowFilters(false); handleSearch(); }}
          >
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingBottom: SPACING.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
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
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
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
  sortText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  sortTextActive: { color: COLORS.white },
  resultCount: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  list: { padding: SPACING.lg, paddingTop: SPACING.huge + SPACING.lg },
  empty: { alignItems: 'center', paddingVertical: SPACING.huge },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginTop: SPACING.lg },
  emptyDesc: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, marginTop: SPACING.xs },
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

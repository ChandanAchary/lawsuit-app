import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, StatusBar,
} from 'react-native';
import { FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { casesApi } from '../../services/api';
import { Case, ResolutionMethod } from '../../types';
import { CaseCard } from '../../components/CaseCard';
import { Loading, EmptyState } from '../../components/Common';
import { TabBar } from '../../components/TabBar';

const RESOLUTION_TABS = [
  { key: 'all', label: 'All Cases' },
  { key: ResolutionMethod.TRIAL, label: 'Trial' },
  { key: ResolutionMethod.MEDIATION, label: 'Mediation' },
  { key: ResolutionMethod.ARBITRATION, label: 'Arbitration' },
];

export const CasesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState<string>('all');
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCases = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await casesApi.getAll();
      setAllCases(data.items || data.cases || []);
    } catch {
      setAllCases([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  useEffect(() => {
    if (tab === 'all') {
      setCases(allCases);
      return;
    }
    setCases(allCases.filter((c) => String(c.resolutionMethod || '').toUpperCase() === tab));
  }, [tab, allCases]);

  const tabsWithCounts = RESOLUTION_TABS.map((item) => {
    const count = item.key === 'all'
      ? allCases.length
      : allCases.filter((c) => String(c.resolutionMethod || '').toUpperCase() === item.key).length;
    return { ...item, label: `${item.label}  ${count}` };
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Cases</Text>
        <Text style={styles.headerSubtitle}>View and manage all your legal cases</Text>
        <TabBar tabs={tabsWithCounts} active={tab} onSelect={setTab} variant="filter" onDarkBg />
      </View>
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={cases}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <CaseCard
              caseItem={item}
              onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCases(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="📋" title="No Cases" message="No cases found in this category" />}
        />
      )}
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.white },
  headerSubtitle: { fontSize: FONT_SIZE.md, color: 'rgba(255,255,255,0.82)', marginBottom: SPACING.md },
  list: { padding: SPACING.xl, paddingBottom: 100 },
});

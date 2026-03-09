import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
} from 'react-native';
import { COLORS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { casesApi } from '../../services/api';
import { Case, CaseStatus } from '../../types';
import { CaseCard } from '../../components/CaseCard';
import { Loading, EmptyState } from '../../components/Common';
import { TabBar } from '../../components/TabBar';

const TABS = [
  { key: 'all', label: 'All' },
  { key: CaseStatus.OPEN, label: 'Open' },
  { key: CaseStatus.IN_PROGRESS, label: 'In Progress' },
  { key: CaseStatus.CLOSED, label: 'Closed' },
  { key: CaseStatus.RESOLVED, label: 'Resolved' },
];

export const CasesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [tab, setTab] = useState('all');
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCases = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params: any = {};
      if (tab !== 'all') params.status = tab;
      const { data } = await casesApi.getAll(params);
      setCases(data.items || data.cases || []);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>My Cases</Text>
        <TabBar tabs={TABS} active={tab} onSelect={setTab} variant="filter" />
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
          ListEmptyComponent={<EmptyState icon="📋" title="No Cases" message="Your legal cases will appear here" />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge,
    paddingBottom: 0,
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
});

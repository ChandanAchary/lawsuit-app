import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { mediationApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { MediatorProfile } from '../../types';
import { formatErrorMessage } from '../../utils/formatError';

export const MediationMediatorsScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const mediationId: string | undefined = route.params?.id;
  const [list, setList] = useState<MediatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickingId, setPickingId] = useState<string | null>(null);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await mediationApi.listMediators();
      setList(data.data || data.items || []);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load mediators');
      setList([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pick = async (med: MediatorProfile) => {
    if (!mediationId) return;
    Alert.alert(
      'Pick Mediator',
      `Select ${med.name}? Both parties must pick the same mediator.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setPickingId(med.id);
            try {
              await mediationApi.pickMediator(mediationId, med.id);
              Alert.alert('Selected', `You picked ${med.name}.`, [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err: any) {
              Alert.alert('Error', formatErrorMessage(err) || 'Failed to pick mediator');
            } finally { setPickingId(null); }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: MediatorProfile }) => {
    const specs = item.mediationSpecializations || item.specializations || [];
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            {item.email && <Text style={styles.sub}>{item.email}</Text>}
          </View>
          {typeof item.mediationFee === 'number' && (
            <Text style={styles.fee}>₹{Number(item.mediationFee).toLocaleString('en-IN')}</Text>
          )}
        </View>
        {!!item.mediatorBio && <Text style={styles.bio} numberOfLines={3}>{item.mediatorBio}</Text>}
        {specs.length > 0 && (
          <View style={styles.chipsRow}>
            {specs.slice(0, 4).map((s) => (
              <View key={s} style={styles.chip}><Text style={styles.chipText}>{s}</Text></View>
            ))}
          </View>
        )}
        {mediationId && (
          <TouchableOpacity
            style={[styles.pickBtn, pickingId === item.id && { opacity: 0.6 }]}
            onPress={() => pick(item)}
            disabled={pickingId === item.id}
          >
            <Text style={styles.pickBtnText}>{pickingId === item.id ? 'Picking…' : 'Pick Mediator'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mediators</Text>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={list}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="🧑‍⚖️" title="No Mediators" message="No available mediators right now." />}
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
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text },
  sub: { fontSize: FONT_SIZE.xs, color: C.textMuted },
  fee: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.primary },
  bio: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: SPACING.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  chip: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full, backgroundColor: C.surfaceAlt },
  chipText: { fontSize: FONT_SIZE.xs, color: C.textSecondary, fontWeight: '700' },
  pickBtn: { marginTop: SPACING.md, backgroundColor: C.primary, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.full, alignItems: 'center' },
  pickBtnText: { color: '#FFF', fontWeight: '800' },
});

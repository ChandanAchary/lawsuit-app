import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useThemeStore, useColors } from '../../stores/themeStore';
import { legalUpdatesApi } from '../../services/api';

const CATEGORIES = ['All', 'Corporate', 'Technology', 'Criminal', 'Civil', 'Property', 'Tax', 'Labour'];
const CAT_COLORS: Record<string, string> = {
  Corporate: '#6366F1', Technology: '#0EA5E9', Criminal: '#EF4444', Civil: '#F59E0B',
  Property: '#10B981', Tax: '#8B5CF6', Labour: '#EC4899',
};

type LegalUpdate = { id: string; title: string; content: string; category: string; createdAt: string };

export const LegalUpdatesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const C = useColors();
  const styles = React.useMemo(() => getStyles(C), [isDark]);

  const [updates, setUpdates] = useState<LegalUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selCat, setSelCat] = useState('All');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const p: any = {};
      if (selCat !== 'All') p.category = selCat;
      if (search.trim()) p.search = search.trim();
      const { data } = await legalUpdatesApi.getAll(p);
      const list = data?.updates || data?.data?.updates || data?.data || [];
      setUpdates(Array.isArray(list) ? list : []);
    } catch { /* keep prior */ } finally { setLoading(false); setRefreshing(false); }
  }, [selCat, search]);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); void load(); };
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[C.primary, C.midnight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hdr}>
        <View style={styles.hdrDecor} />
        <View style={styles.hdrRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Text style={styles.hdrTitle}>Legal Updates</Text>
            <Text style={styles.hdrSub}>Latest law changes & amendments</Text>
          </View>
          <View style={styles.hdrIcon}><Ionicons name="newspaper" size={24} color="rgba(255,255,255,0.8)" /></View>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={C.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search legal updates..." placeholderTextColor={C.textMuted} value={search} onChangeText={setSearch} returnKeyType="search" />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={C.textMuted} /></TouchableOpacity>}
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: SPACING.sm }}>
        {CATEGORIES.map(c => {
          const on = selCat === c;
          return <TouchableOpacity key={c} onPress={() => setSelCat(c)} style={[styles.chip, on && { backgroundColor: C.primary, borderColor: C.primary }]} activeOpacity={0.7}><Text style={[styles.chipTxt, on && { color: '#fff' }]}>{c}</Text></TouchableOpacity>;
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /><Text style={styles.loadTxt}>Loading updates...</Text></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}>
          {updates.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIco}><Ionicons name="newspaper-outline" size={48} color={C.textMuted} /></View>
              <Text style={styles.emptyT}>No Updates Found</Text>
              <Text style={styles.emptyD}>{search || selCat !== 'All' ? 'Try changing your filters or search query.' : 'Legal updates will appear here once published.'}</Text>
            </View>
          ) : updates.map((item, idx) => {
            const cc = CAT_COLORS[item.category] || C.primary;
            return (
              <View key={item.id || idx} style={styles.card}>
                <View style={styles.cardHdr}>
                  <View style={[styles.badge, { backgroundColor: cc + '18' }]}>
                    <View style={[styles.dot, { backgroundColor: cc }]} />
                    <Text style={[styles.badgeTxt, { color: cc }]}>{item.category}</Text>
                  </View>
                  <Text style={styles.date}>{fmtDate(item.createdAt)}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody} numberOfLines={4}>{item.content}</Text>
                <View style={styles.cardFoot}>
                  <View style={styles.readMore}><Ionicons name="book-outline" size={14} color={C.primary} /><Text style={styles.readMoreTxt}>Read full update</Text></View>
                </View>
              </View>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  hdr: { paddingTop: SPACING.huge, paddingBottom: SPACING.xxl, paddingHorizontal: SPACING.xl, borderBottomLeftRadius: BORDER_RADIUS.xxl, borderBottomRightRadius: BORDER_RADIUS.xxl, overflow: 'hidden' },
  hdrDecor: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)', top: -30, right: -20 },
  hdrRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: '#fff' },
  hdrSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  hdrIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.sm },
  searchInput: { flex: 1, fontSize: FONT_SIZE.md, color: C.text, paddingVertical: 0 },
  chipRow: { paddingVertical: SPACING.lg, maxHeight: 56 },
  chip: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, borderRadius: BORDER_RADIUS.full, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  chipTxt: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.textSecondary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadTxt: { fontSize: FONT_SIZE.md, color: C.textMuted, fontWeight: '600' },
  list: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },
  empty: { alignItems: 'center', paddingTop: SPACING.huge * 2, paddingHorizontal: SPACING.xl },
  emptyIco: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl },
  emptyT: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text, marginBottom: SPACING.sm },
  emptyD: { fontSize: FONT_SIZE.md, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
  card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.lg, ...SHADOWS.md },
  cardHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 1, borderRadius: BORDER_RADIUS.full },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeTxt: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  date: { fontSize: FONT_SIZE.xs, color: C.textMuted, fontWeight: '600' },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text, lineHeight: 24, marginBottom: SPACING.sm },
  cardBody: { fontSize: FONT_SIZE.md, color: C.textSecondary, lineHeight: 22 },
  cardFoot: { marginTop: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: C.borderLight },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  readMoreTxt: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.primary },
});

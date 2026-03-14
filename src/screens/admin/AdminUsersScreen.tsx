import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminApi } from '../../services/api';
import { User, UserRole } from '../../types';
import { TabBar } from '../../components/TabBar';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';

const TABS = [
  { key: 'all', label: 'All' },
  { key: UserRole.CLIENT, label: 'Clients' },
  { key: UserRole.LAWYER, label: 'Lawyers' },
  { key: 'pending', label: 'Pending KYC' },
];

export const AdminUsersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [tab, setTab] = useState('all');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params: any = {};
      if (tab === UserRole.CLIENT || tab === UserRole.LAWYER) params.role = tab;
      if (tab === 'pending') params.verified = false;
      const { data } = await adminApi.getUsers(params);
      setUsers(data.users || data || []);
    } catch { setUsers([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleVerify = async (userId: string, role: UserRole) => {
    try {
      if (role === UserRole.CLIENT) {
        await adminApi.verifyClient(userId);
      } else {
        await adminApi.verifyLawyer(userId);
      }
      Alert.alert('Success', 'User verified');
      fetchUsers(false);
    } catch { Alert.alert('Error', 'Verification failed'); }
  };

  const renderItem = ({ item }: { item: User }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPH]}>
            <Ionicons name="person" size={20} color={COLORS.textMuted} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardEmail}>{item.email}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: item.role === UserRole.LAWYER ? COLORS.accent + '20' : COLORS.primary + '20' }]}>
          <Text style={[styles.roleText, { color: item.role === UserRole.LAWYER ? COLORS.accent : COLORS.primary }]}>
            {item.role}
          </Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.cardMeta}>
          <Ionicons name={item.isVerified ? 'checkmark-circle' : 'close-circle'} size={16} color={item.isVerified ? COLORS.success : COLORS.error} />
          <Text style={[styles.metaText, { color: item.isVerified ? COLORS.success : COLORS.error }]}>
            {item.isVerified ? 'Verified' : 'Unverified'}
          </Text>
        </View>
        {!item.isVerified && (
          <Button
            title="Verify"
            size="sm"
            onPress={() => handleVerify(item.id, item.role)}
            style={{ paddingHorizontal: SPACING.xl }}
          />
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Management</Text>
      </View>
      <TabBar tabs={TABS} active={tab} onSelect={setTab} />
      {loading ? <Loading /> : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="👥" title="No Users" message="No users found in this category" />}
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
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  cardEmail: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  roleBadge: { paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  roleText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
});

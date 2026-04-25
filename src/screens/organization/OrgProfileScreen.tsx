import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { Loading } from '../../components/Common';
import { formatDate } from '../../utils/date';
import { useAuthStore } from '../../stores/authStore';

export const OrgProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);
  const logout = useAuthStore((s) => s.logout);

  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    try {
      const { data } = await organizationsApi.getMine();
      setOrg(data.organization || data);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchProfile().finally(() => setRefreshing(false)); };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organization Profile</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarFallback}>
              <Ionicons name="business" size={40} color={COLORS.primary} />
            </View>
          </View>
          <Text style={styles.name}>{org?.name || 'Firm Name'}</Text>
          <Text style={styles.email}>{org?.email}</Text>

          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{org?.status || 'PENDING'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsCard}>
            <DetailRow label="Registration No" value={org?.registrationNumber} COLORS={COLORS} styles={styles} />
            <DetailRow label="Type" value={org?.type} COLORS={COLORS} styles={styles} />
            <DetailRow label="Phone" value={org?.phone} COLORS={COLORS} styles={styles} />
            <DetailRow label="City" value={org?.city} COLORS={COLORS} styles={styles} />
            <DetailRow label="State" value={org?.state} COLORS={COLORS} styles={styles} />
            <DetailRow label="Joined" value={org?.createdAt ? formatDate(org.createdAt) : undefined} COLORS={COLORS} styles={styles} />
          </View>
        </View>
        
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const DetailRow = ({ label, value, COLORS, styles }: any) => {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  scrollContent: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    alignItems: 'center', ...SHADOWS.md, marginBottom: SPACING.xl,
  },
  avatarContainer: { marginBottom: SPACING.md },
  avatarFallback: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.primaryLight + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  email: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  statusBadge: {
    marginTop: SPACING.md, backgroundColor: COLORS.surfaceAlt, paddingHorizontal: SPACING.lg,
    paddingVertical: 6, borderRadius: BORDER_RADIUS.full,
  },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: COLORS.text },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  detailsCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.md, ...SHADOWS.sm },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  detailLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  detailValue: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.error + '10', paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.xl,
  },
  logoutText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.error },
});

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

  const isVerified = org?.isVerified === true;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organization Profile</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('EditOrgProfile')}>
          <Ionicons name="create-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Profile Header Card */}
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarFallback}>
              <Ionicons name="business" size={40} color={COLORS.primary} />
            </View>
          </View>
          <Text style={styles.name}>{org?.name || 'Firm Name'}</Text>
          <Text style={styles.email}>{org?.email}</Text>

          <View style={[styles.statusBadge, { backgroundColor: isVerified ? '#D1FAE5' : '#FEF3C7' }]}>
            <Ionicons name={isVerified ? 'checkmark-circle' : 'time'} size={14} color={isVerified ? '#10B981' : '#D97706'} />
            <Text style={[styles.statusText, { color: isVerified ? '#10B981' : '#D97706' }]}>
              {isVerified ? 'Verified' : 'Not Verified'}
            </Text>
          </View>
        </View>

        {/* Verification Action */}
        {!isVerified && (
          <TouchableOpacity
            style={styles.verificationCard}
            onPress={() => navigation.navigate('OrgVerificationRequest')}
          >
            <View style={styles.verificationIcon}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.primary} />
            </View>
            <View style={styles.verificationInfo}>
              <Text style={styles.verificationTitle}>Get Verified</Text>
              <Text style={styles.verificationDesc}>Request verification from a court admin to unlock all features</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* About Section */}
        {org?.about && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.detailsCard}>
              <Text style={styles.aboutText}>{org.about}</Text>
            </View>
          </View>
        )}

        {/* Practice Areas */}
        {org?.practiceAreas?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Practice Areas</Text>
            <View style={styles.chipContainer}>
              {org.practiceAreas.map((area: string, i: number) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{area}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailsCard}>
            <DetailRow label="Registration No" value={org?.registrationNumber} COLORS={COLORS} styles={styles} />
            <DetailRow label="GST Number" value={org?.gstNumber} COLORS={COLORS} styles={styles} />
            <DetailRow label="PAN Number" value={org?.panNumber} COLORS={COLORS} styles={styles} />
            <DetailRow label="Phone" value={org?.phone} COLORS={COLORS} styles={styles} />
            <DetailRow label="Website" value={org?.website} COLORS={COLORS} styles={styles} />
            <DetailRow label="Consultation Fee" value={org?.consultationFee ? `₹${(org.consultationFee / 100).toFixed(0)}` : undefined} COLORS={COLORS} styles={styles} />
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.detailsCard}>
            <DetailRow label="Address" value={org?.address} COLORS={COLORS} styles={styles} />
            <DetailRow label="City" value={org?.city} COLORS={COLORS} styles={styles} />
            <DetailRow label="District" value={org?.district} COLORS={COLORS} styles={styles} />
            <DetailRow label="State" value={org?.state} COLORS={COLORS} styles={styles} />
            <DetailRow label="Pincode" value={org?.pincode} COLORS={COLORS} styles={styles} />
          </View>
        </View>

        <DetailRow label="Joined" value={org?.createdAt ? formatDate(org.createdAt) : undefined} COLORS={COLORS} styles={styles} />

        {/* Actions */}
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('EditOrgProfile')}>
          <Ionicons name="create-outline" size={20} color={COLORS.primary} />
          <Text style={styles.menuText}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
          <Text style={styles.menuText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

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
  headerTitle: { flex: 1, fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + '10', alignItems: 'center', justifyContent: 'center' },
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
    marginTop: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.lg, paddingVertical: 6, borderRadius: BORDER_RADIUS.full,
  },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '800' },
  verificationCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '08',
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.primary + '20',
  },
  verificationIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  verificationInfo: { flex: 1, marginLeft: SPACING.md },
  verificationTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  verificationDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2, lineHeight: 18 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  aboutText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, lineHeight: 22 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary + '12',
  },
  chipText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600' },
  detailsCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.md, ...SHADOWS.sm },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  detailLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  detailValue: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, maxWidth: '60%', textAlign: 'right' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  menuText: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.error + '10', paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.xl,
    marginTop: SPACING.md,
  },
  logoutText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.error },
});

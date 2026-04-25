import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { Loading } from '../../components/Common';
import { Button } from '../../components/Button';

export const OrgDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const orgId = route.params?.orgId;
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrg = async () => {
    try {
      const { data } = await organizationsApi.getPublicById(orgId);
      setOrg(data.organization || data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (orgId) fetchOrg(); }, [orgId]);

  const onRefresh = () => { setRefreshing(true); fetchOrg().finally(() => setRefreshing(false)); };

  if (loading) return <Loading />;
  if (!org) return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organization</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: COLORS.textMuted }}>Organization not found</Text>
      </View>
    </View>
  );

  const lawyers = org.lawyers || [];

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organization</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Profile Header */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            {org.avatarUrl ? (
              <Image source={{ uri: org.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="business" size={40} color={COLORS.primary} />
            )}
          </View>
          <View style={styles.nameRow}>
            <Text style={styles.orgName}>{org.name}</Text>
            {org.isVerified && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
          </View>
          {org.email && <Text style={styles.orgEmail}>{org.email}</Text>}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.locationText}>
              {[org.city, org.district, org.state].filter(Boolean).join(', ') || 'India'}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          {org.consultationFee != null && org.consultationFee > 0 && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>₹{Math.round(org.consultationFee / 100)}</Text>
              <Text style={styles.statLabel}>Consultation Fee</Text>
            </View>
          )}
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{lawyers.length}</Text>
            <Text style={styles.statLabel}>Lawyers</Text>
          </View>
          {org.pincode && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{org.pincode}</Text>
              <Text style={styles.statLabel}>Pincode</Text>
            </View>
          )}
        </View>

        {/* About */}
        {org.about && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.aboutText}>{org.about}</Text>
            </View>
          </View>
        )}

        {/* Practice Areas */}
        {org.practiceAreas?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Practice Areas</Text>
            <View style={styles.chipRow}>
              {org.practiceAreas.map((area: string, i: number) => (
                <View key={i} style={styles.areaChip}>
                  <Text style={styles.areaChipText}>{area}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <View style={styles.sectionCard}>
            {org.phone && (
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`tel:${org.phone}`)}>
                <Ionicons name="call-outline" size={18} color={COLORS.primary} />
                <Text style={styles.contactText}>{org.phone}</Text>
              </TouchableOpacity>
            )}
            {org.email && (
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${org.email}`)}>
                <Ionicons name="mail-outline" size={18} color={COLORS.primary} />
                <Text style={styles.contactText}>{org.email}</Text>
              </TouchableOpacity>
            )}
            {org.website && (
              <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL(org.website)}>
                <Ionicons name="globe-outline" size={18} color={COLORS.primary} />
                <Text style={styles.contactText}>{org.website}</Text>
              </TouchableOpacity>
            )}
            {org.address && (
              <View style={styles.contactRow}>
                <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                <Text style={styles.contactText}>{org.address}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Lawyers */}
        {lawyers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team Lawyers ({lawyers.length})</Text>
            {lawyers.map((lawyer: any) => (
              <TouchableOpacity
                key={lawyer.id}
                style={styles.lawyerCard}
                onPress={() => navigation.navigate('LawyerDetail', { lawyerId: lawyer.id })}
              >
                <View style={styles.lawyerAvatar}>
                  {lawyer.avatarUrl ? (
                    <Image source={{ uri: lawyer.avatarUrl }} style={styles.lawyerAvatarImg} />
                  ) : (
                    <Ionicons name="person" size={18} color={COLORS.primary} />
                  )}
                </View>
                <View style={styles.lawyerInfo}>
                  <Text style={styles.lawyerName}>{lawyer.name}</Text>
                  {lawyer.specializations?.length > 0 && (
                    <Text style={styles.lawyerSpec} numberOfLines={1}>
                      {lawyer.specializations.slice(0, 2).join(', ')}
                    </Text>
                  )}
                </View>
                {lawyer.isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                )}
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Book Appointment Button */}
        <Button
          title="Book Appointment"
          onPress={() => navigation.navigate('OrgBooking', { orgId: org.id, orgName: org.name })}
          size="lg"
          style={styles.bookBtn}
        />
      </ScrollView>
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
  scrollContent: { padding: SPACING.xl, paddingBottom: 120 },
  profileCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xxl, padding: SPACING.xxl,
    alignItems: 'center', ...SHADOWS.md, marginBottom: SPACING.xl,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryLight + '25',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
  },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  orgName: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  orgEmail: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  locationText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    ...SHADOWS.sm, marginBottom: SPACING.xl,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4 },
  section: { marginBottom: SPACING.xl },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md },
  sectionCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm },
  aboutText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  areaChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary + '12',
  },
  areaChipText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: '600' },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  contactText: { fontSize: FONT_SIZE.md, color: COLORS.text },
  lawyerCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  lawyerAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  lawyerAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  lawyerInfo: { flex: 1 },
  lawyerName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  lawyerSpec: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  bookBtn: { marginTop: SPACING.md },
});

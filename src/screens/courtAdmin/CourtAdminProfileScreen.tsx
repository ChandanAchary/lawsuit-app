import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { courtAdminApi } from '../../services/api';

type CourtAdminProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  registrationNumber?: string;
  status?: string;
  emailVerified?: boolean;
  courtId?: string;
  createdAt?: string;
  court?: {
    id: string;
    name?: string;
    code?: string;
    type?: string;
    pincode?: string;
    district?: string;
    state?: string;
    city?: string;
    address?: string;
  };
  stats?: {
    pendingVerifications?: number;
  };
};

export const CourtAdminProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState<CourtAdminProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data } = await courtAdminApi.getMe();
      setProfile((data?.courtAdmin || data) as CourtAdminProfile);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchProfile();
    }, []),
  );

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const display = profile || (user as any) || {};
  const avatarUrl = display?.avatarUrl || display?.avatar || '';
  const courtText = [display?.court?.city, display?.court?.district, display?.court?.state].filter(Boolean).join(', ');
  const joinedDate = display?.createdAt ? new Date(display.createdAt).toLocaleDateString('en-IN') : '—';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void fetchProfile()} colors={[COLORS.primary]} />}
    >
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary, COLORS.primaryLight]} style={styles.headerGradient}>
        <TouchableOpacity
          style={styles.avatarWrap}
          activeOpacity={0.85}
          onPress={() => {
            if (avatarUrl) setShowAvatarPreview(true);
          }}
        >
          {avatarUrl ? (
            <Image key={avatarUrl} source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="shield-checkmark" size={40} color={COLORS.white} />
          )}
        </TouchableOpacity>
        <Text style={styles.profileName}>{display?.name || 'Court Admin'}</Text>
        <Text style={styles.profileEmail}>{display?.email || ''}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>COURT ADMIN</Text>
        </View>
      </LinearGradient>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Ionicons name="hourglass-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.statValue}>{display?.stats?.pendingVerifications ?? 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="checkmark-done-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.statValue}>{display?.status || 'ACTIVE'}</Text>
          <Text style={styles.statLabel}>Status</Text>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>ACCOUNT DETAILS</Text>
        <TouchableOpacity style={styles.sectionEditBtn} onPress={() => navigation.navigate('EditCourtAdminProfile', { section: 'account' })}>
          <Ionicons name="create-outline" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <EmailRow email={display?.email || '—'} verified={!!display?.emailVerified} styles={styles} COLORS={COLORS} />
        <InfoRow icon="call-outline" label="Phone" value={display?.phone || '—'} styles={styles} COLORS={COLORS} />
        <InfoRow icon="id-card-outline" label="Registration Number" value={display?.registrationNumber || '—'} styles={styles} COLORS={COLORS} />
        <InfoRow icon="calendar-outline" label="Joined" value={joinedDate} styles={styles} COLORS={COLORS} />
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>COURT DETAILS</Text>
        <TouchableOpacity style={styles.sectionEditBtn} onPress={() => navigation.navigate('EditCourtAdminProfile', { section: 'court' })}>
          <Ionicons name="create-outline" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <InfoRow icon="business-outline" label="Court Name" value={display?.court?.name || '—'} styles={styles} COLORS={COLORS} />
        <InfoRow icon="layers-outline" label="Court Type" value={display?.court?.type || '—'} styles={styles} COLORS={COLORS} />
        <InfoRow icon="pin-outline" label="Pincode" value={display?.court?.pincode || '—'} styles={styles} COLORS={COLORS} />
        <InfoRow icon="location-outline" label="Location" value={courtText || '—'} styles={styles} COLORS={COLORS} />
        <InfoRow icon="map-outline" label="Address" value={display?.court?.address || '—'} styles={styles} COLORS={COLORS} />
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>OPTIONS</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.card}>
        <MenuItem icon="cash-outline" label="My Salary" onPress={() => navigation.navigate('MySalary')} styles={styles} COLORS={COLORS} />
        <MenuItem icon="card-outline" label="Bank & UPI Accounts" onPress={() => navigation.navigate('BankAccounts')} styles={styles} COLORS={COLORS} />
        <MenuItem icon="notifications-outline" label="Notifications" onPress={() => navigation.navigate('Notifications')} styles={styles} COLORS={COLORS} />
        <MenuItem icon="shield-checkmark-outline" label="Security & Account" onPress={() => navigation.navigate('Security')} styles={styles} COLORS={COLORS} />
        <MenuItem icon="help-circle-outline" label="Help Center" onPress={() => navigation.navigate('HelpCenter')} styles={styles} COLORS={COLORS} />
        <MenuItem icon="information-circle-outline" label="About" onPress={() => navigation.navigate('About')} styles={styles} COLORS={COLORS} />
        <MenuItem icon="document-text-outline" label="Privacy Policy & Terms" onPress={() => navigation.navigate('PrivacyTerms')} styles={styles} COLORS={COLORS} />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Modal
        visible={showAvatarPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarPreview(false)}
      >
        <TouchableOpacity style={styles.avatarPreviewOverlay} activeOpacity={1} onPress={() => setShowAvatarPreview(false)}>
          <View style={styles.avatarPreviewCard}>
            {!!avatarUrl && <Image source={{ uri: avatarUrl }} style={styles.avatarPreviewImage} />}
            <TouchableOpacity style={styles.avatarPreviewClose} onPress={() => setShowAvatarPreview(false)}>
              <Ionicons name="close" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const InfoRow = ({ icon, label, value, styles, COLORS }: any) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color={COLORS.primary} />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const EmailRow = ({ email, verified, styles, COLORS }: any) => (
  <View style={styles.infoRow}>
    <Ionicons name="mail-outline" size={18} color={COLORS.primary} />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>Email</Text>
      <View style={styles.infoValueRow}>
        <Text style={styles.infoValue}>{email}</Text>
        {verified ? <Ionicons name="checkmark-circle" size={14} color={COLORS.success || '#22c55e'} /> : null}
      </View>
    </View>
  </View>
);

const MenuItem = ({ icon, label, onPress, styles, COLORS }: any) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuIconWrap}>
      <Ionicons name={icon as any} size={20} color={COLORS.primary} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    headerGradient: {
      paddingTop: SPACING.huge,
      paddingBottom: SPACING.xxxl,
      alignItems: 'center',
      borderBottomLeftRadius: BORDER_RADIUS.xxl,
      borderBottomRightRadius: BORDER_RADIUS.xxl,
    },
    avatarWrap: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarPreviewOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xl,
    },
    avatarPreviewCard: {
      width: '100%',
      maxWidth: 380,
      borderRadius: BORDER_RADIUS.xl,
      overflow: 'hidden',
      backgroundColor: COLORS.black,
    },
    avatarPreviewImage: {
      width: '100%',
      aspectRatio: 1,
      resizeMode: 'cover',
    },
    avatarPreviewClose: {
      position: 'absolute',
      top: SPACING.sm,
      right: SPACING.sm,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileName: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.white },
    profileEmail: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    roleBadge: {
      marginTop: SPACING.sm,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: BORDER_RADIUS.full,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.xs,
    },
    roleBadgeText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.xs, letterSpacing: 1 },
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: COLORS.white,
      marginHorizontal: SPACING.xl,
      marginTop: -SPACING.xl,
      borderRadius: BORDER_RADIUS.xl,
      paddingVertical: SPACING.lg,
      ...SHADOWS.md,
    },
    statItem: { alignItems: 'center', flex: 1 },
    statValue: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text, marginTop: 4 },
    statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
    statDivider: { width: 1, height: 36, backgroundColor: COLORS.borderLight },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: SPACING.xl + SPACING.sm,
      marginTop: SPACING.xl,
      marginBottom: SPACING.sm,
    },
    sectionLabel: {
      fontSize: FONT_SIZE.xs,
      fontWeight: '700',
      color: COLORS.textMuted,
      letterSpacing: 1,
    },
    sectionEditBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.primaryLight + '16',
    },
    card: {
      backgroundColor: COLORS.white,
      marginHorizontal: SPACING.xl,
      borderRadius: BORDER_RADIUS.xl,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      ...SHADOWS.sm,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.borderLight,
    },
    infoContent: { flex: 1 },
    infoLabel: { color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
    infoValue: { color: COLORS.text, fontSize: FONT_SIZE.sm, fontWeight: '600', marginTop: 2 },
    infoValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.borderLight,
    },
    menuIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: COLORS.primaryLight + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuLabel: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '600' },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: COLORS.errorLight,
      marginHorizontal: SPACING.xl,
      marginTop: SPACING.xl,
      borderRadius: BORDER_RADIUS.xl,
      paddingVertical: SPACING.lg,
    },
    logoutText: { color: COLORS.error, fontWeight: '700', fontSize: FONT_SIZE.md },
  });

export default CourtAdminProfileScreen;

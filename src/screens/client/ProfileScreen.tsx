import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, Dimensions,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { usersApi, storageApi, dashboardApi } from '../../services/api';
import { useThemeStore } from '../../stores/themeStore';
import { Loading } from '../../components/Common';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user: authUser, logout } = useAuthStore();
  const { user, loading, getUser, updateUser } = useUserStore();
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();
  const [uploading, setUploading] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [stats, setStats] = useState({ cases: 0, appointments: 0, lawyers: 0 });

  const [showAppearance, setShowAppearance] = useState(false);

  useEffect(() => { getUser(); fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const { data } = await dashboardApi.clientDashboard();
      setStats({
        cases: data?.stats?.totalCases ?? data?.totalCases ?? 0,
        appointments: data?.stats?.totalAppointments ?? data?.totalAppointments ?? 0,
        lawyers: data?.stats?.totalLawyers ?? data?.totalLawyers ?? 0,
      });
    } catch {}
  };

  const getAvatarUrl = (): string | undefined => {
    const u = user || authUser;
    return (u as any)?.avatarUrl || u?.avatar;
  };

  const pickAndUploadAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) return;
      setUploading(true);
      const asset = result.assets[0];
      const { data: signData } = await storageApi.getCloudinarySignature('profiles');
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: asset.uri.split('/').pop() || 'photo.jpg' } as any);
      formData.append('timestamp', String(signData.timestamp));
      formData.append('signature', signData.signature);
      formData.append('api_key', signData.apiKey);
      formData.append('folder', signData.folder);
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signData.cloudName)}/image/upload`, { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (uploadData.secure_url) {
        await updateUser({ avatarUrl: uploadData.secure_url });
        await getUser();
      } else Alert.alert('Error', 'Upload failed');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload photo');
    } finally { setUploading(false); }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading && !user) return <Loading />;
  const displayUser = user || authUser;
  const avatarUrl = getAvatarUrl();

  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* ── Gradient Header with Avatar ── */}
        <LinearGradient colors={[COLORS.primaryDark, COLORS.primary, COLORS.primaryLight]} style={styles.headerGradient}>
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={() => avatarUrl ? setShowFullPhoto(true) : pickAndUploadAvatar()} style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPH]}>
                  <Ionicons name="person" size={44} color={COLORS.textMuted} />
                </View>
              )}
              <TouchableOpacity style={styles.cameraIcon} onPress={pickAndUploadAvatar}>
                {uploading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="camera" size={14} color={COLORS.white} />}
              </TouchableOpacity>
            </TouchableOpacity>
            <Text style={styles.profileName}>{displayUser?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{displayUser?.email || ''}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>CLIENT</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Stats Row ── */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Ionicons name="briefcase-outline" size={22} color={COLORS.textSecondary} />
            <Text style={styles.statValue}>{stats.cases}</Text>
            <Text style={styles.statLabel}>Cases</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.textSecondary} />
            <Text style={styles.statValue}>{stats.appointments}</Text>
            <Text style={styles.statLabel}>Appointments</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={22} color={COLORS.textSecondary} />
            <Text style={styles.statValue}>{stats.lawyers}</Text>
            <Text style={styles.statLabel}>Lawyers</Text>
          </View>
        </View>

        {/* ── ACCOUNT Section ── */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="person-outline" label="Edit Profile" subtitle="Name, phone, avatar"
            onPress={() => navigation.navigate('EditProfile')} />
          <MenuItem icon="wallet-outline" label="Wallet" subtitle="Balance & transactions"
            onPress={() => navigation.navigate('Wallet')} />
          <MenuItem icon="card-outline" label="Bank & UPI Accounts" subtitle="Manage withdrawal accounts"
            onPress={() => navigation.navigate('BankAccounts')} />
          <MenuItem icon="shield-checkmark-outline" label="Security" subtitle="Password, 2FA"
            onPress={() => navigation.navigate('Security')} />
          <MenuItem icon="gift-outline" label="Referral Program" subtitle="Earn ₹5,000 per referral"
            onPress={() => navigation.navigate('ReferralProgram')} last />
        </View>

        {/* ── PREFERENCES Section ── */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="notifications-outline" label="Notifications" subtitle="View alerts"
            onPress={() => navigation.navigate('Notifications')} />
          <MenuItem icon="contrast-outline" label="Appearance" subtitle={themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
            onPress={() => setShowAppearance(true)} />
          <MenuItem icon="language-outline" label="Language" subtitle="English"
            onPress={() => Alert.alert('Language', 'Currently only English is supported.')} last />
        </View>

        {/* ── SUPPORT Section ── */}
        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="help-circle-outline" label="Help Center"
            onPress={() => navigation.navigate('HelpCenter')} />
          <MenuItem icon="information-circle-outline" label="About LawSoft"
            onPress={() => navigation.navigate('About')} />
          <MenuItem icon="document-text-outline" label="Privacy Policy & Terms" subtitle="Legal information"
            onPress={() => navigation.navigate('PrivacyTerms')} last />
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>LawSoft v1.0.0</Text>
      </ScrollView>

      {/* ── Appearance Modal ── */}
      <Modal visible={showAppearance} transparent animationType="slide" onRequestClose={() => setShowAppearance(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Appearance</Text>
              <TouchableOpacity onPress={() => setShowAppearance(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: SPACING.xl }}>
              {([['light', 'sunny-outline', 'Light'], ['dark', 'moon-outline', 'Dark'], ['system', 'phone-portrait-outline', 'System Default']] as const).map(([mode, icon, label]) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.appearanceOption, themeMode === mode && styles.appearanceOptionActive]}
                  onPress={() => { setThemeMode(mode); setShowAppearance(false); }}
                >
                  <View style={styles.appearanceIconWrap}>
                    <Ionicons name={icon} size={22} color={themeMode === mode ? COLORS.primary : COLORS.textSecondary} />
                  </View>
                  <Text style={[styles.appearanceLabel, themeMode === mode && styles.appearanceLabelActive]}>{label}</Text>
                  {themeMode === mode && <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Full Photo Modal ── */}
      <Modal visible={showFullPhoto} transparent animationType="fade" onRequestClose={() => setShowFullPhoto(false)}>
        <View style={styles.fullPhotoOverlay}>
          <TouchableOpacity style={styles.fullPhotoClose} onPress={() => setShowFullPhoto(false)}>
            <Ionicons name="close" size={28} color={COLORS.white} />
          </TouchableOpacity>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.fullPhoto} resizeMode="contain" /> : null}
        </View>
      </Modal>
    </>
  );
};

/* ─── Menu Item ─── */
const MenuItem = ({ icon, label, subtitle, onPress, last }: { icon: string; label: string; subtitle?: string; onPress: () => void; last?: boolean }) => (
  <TouchableOpacity style={[styles.menuItem, !last && styles.menuItemBorder]} onPress={onPress}>
    <View style={styles.menuIconWrap}>
      <Ionicons name={icon as any} size={20} color={COLORS.primary} />
    </View>
    <View style={styles.menuContentArea}>
      <Text style={styles.menuLabel}>{label}</Text>
      {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header gradient
  headerGradient: {
    paddingTop: 50, paddingBottom: 30, alignItems: 'center',
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
  },
  avatarSection: { alignItems: 'center' },
  avatarWrap: { position: 'relative', marginBottom: SPACING.md },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.white },
  avatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cameraIcon: {
    position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  profileName: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.white, marginTop: SPACING.xs },
  profileEmail: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  roleBadge: {
    marginTop: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: BORDER_RADIUS.full,
  },
  roleBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.white, letterSpacing: 1 },

  // Stats
  statsCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginTop: -20,
    borderRadius: BORDER_RADIUS.xl, paddingVertical: SPACING.xl, ...SHADOWS.md,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text, marginTop: SPACING.xs },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: COLORS.borderLight },

  // Sections
  sectionLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textMuted,
    marginHorizontal: SPACING.xl + SPACING.sm, marginTop: SPACING.xl, marginBottom: SPACING.sm,
    letterSpacing: 1,
  },
  menuCard: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl, overflow: 'hidden', ...SHADOWS.sm,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryLight + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  menuContentArea: { flex: 1 },
  menuLabel: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  menuSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 1 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl, paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl, backgroundColor: COLORS.errorLight,
  },
  logoutText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.error },
  versionText: {
    textAlign: 'center', fontSize: FONT_SIZE.xs, color: COLORS.textMuted,
    marginTop: SPACING.lg, marginBottom: SPACING.xxl,
  },

  // Security Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '80%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  securityInfo: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.lg, marginBottom: SPACING.xl,
  },
  securityInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  securityInfoLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm },
  statusBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  securitySectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  securityHint: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.lg },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm, marginTop: SPACING.sm },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.lg, marginBottom: SPACING.xl },
  otpBox: {
    width: 56, height: 56, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt,
    fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.text, textAlign: 'center',
  },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight + '10' },
  appearanceOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.lg,
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  appearanceOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight + '10' },
  appearanceIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  appearanceLabel: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  appearanceLabelActive: { color: COLORS.primary },

  // Full photo
  fullPhotoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullPhotoClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  fullPhoto: { width: SCREEN_WIDTH - 40, height: SCREEN_WIDTH - 40, borderRadius: BORDER_RADIUS.lg },
});

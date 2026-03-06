import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { usersApi, storageApi, authApi } from '../../services/api';
import { useThemeStore } from '../../stores/themeStore';
import { Loading } from '../../components/Common';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const LawyerProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user: authUser, logout } = useAuthStore();
  const { user, loading, getUser, updateUser } = useUserStore();
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();
  const [uploading, setUploading] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [lawyerInfo, setLawyerInfo] = useState<Record<string, any> | null>(null);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);

  // Change password state
  const [pwOtpSent, setPwOtpSent] = useState(false);
  const [pwOtp, setPwOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => { getUser(); fetchLawyerInfo(); }, []);

  const fetchLawyerInfo = async () => {
    try {
      const { data } = await usersApi.getLawyerInformation();
      if (data.lawyer) setLawyerInfo(data.lawyer);
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
        Alert.alert('Success', 'Profile photo updated');
      } else Alert.alert('Error', 'Upload failed');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload photo');
    } finally { setUploading(false); }
  };

  const handleSendPwOtp = async () => {
    const email = (user || authUser)?.email;
    if (!email) return;
    setPwLoading(true);
    try {
      await authApi.requestOtp(email);
      setPwOtpSent(true);
      Alert.alert('OTP Sent', 'Check your email for the verification code');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send OTP');
    } finally { setPwLoading(false); }
  };

  const handleChangePassword = async () => {
    const email = (user || authUser)?.email;
    if (!email || !pwOtp || !newPassword) return;
    if (newPassword.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters'); return; }
    setPwLoading(true);
    try {
      await authApi.restorePassword(email, pwOtp, newPassword);
      Alert.alert('Success', 'Password changed successfully');
      setPwOtp(''); setNewPassword(''); setPwOtpSent(false); setShowSecurity(false);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to change password');
    } finally { setPwLoading(false); }
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
  const info = lawyerInfo;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => navigation.navigate('EditLawyerProfile')}>
            <Ionicons name="create-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity onPress={() => avatarUrl ? setShowFullPhoto(true) : pickAndUploadAvatar()} style={styles.avatarWrap}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            : <View style={[styles.avatar, styles.avatarPH]}><Ionicons name="person" size={36} color={COLORS.textMuted} /></View>}
            <View style={styles.cameraIcon}>
              {uploading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="camera" size={12} color={COLORS.white} />}
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayUser?.name || 'Lawyer'}</Text>
            <Text style={styles.profileEmail}>{displayUser?.email || ''}</Text>
            <View style={styles.verifiedBadge}>
              <Ionicons name={displayUser?.isVerified ? 'checkmark-circle' : 'alert-circle'} size={14}
                color={displayUser?.isVerified ? COLORS.success : COLORS.warning} />
              <Text style={[styles.verifiedText, { color: displayUser?.isVerified ? COLORS.success : COLORS.warning }]}>
                {displayUser?.isVerified ? 'Verified' : 'Pending Verification'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{info?.experienceYears || 0}</Text>
            <Text style={styles.statLabel}>Years Exp.</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{info?.totalReviews || 0}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.accent }]}>
              {info?.rating ? `${Number(info.rating).toFixed(1)}` : '—'}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* AVAILABILITY */}
        <Text style={styles.sectionLabel}>AVAILABILITY</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="cash-outline" label="Consultation Fees" subtitle={info?.feePerConsultation ? `₹${info.feePerConsultation}` : 'Set your fee'}
            onPress={() => navigation.navigate('EditLawyerProfile')} last />
        </View>

        {/* TOOLS */}
        <Text style={styles.sectionLabel}>TOOLS</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="document-text-outline" label="Agreement Templates"
            onPress={() => navigation.navigate('MainTabs', { screen: 'LawyerTemplates' })} />
          <MenuItem icon="gift-outline" label="Referral Program"
            onPress={() => navigation.navigate('ReferralProgram')} />
          <MenuItem icon="diamond-outline" label="Pro Subscription"
            onPress={() => navigation.navigate('ProSubscription')} last />
        </View>

        {/* ACCOUNT */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="person-outline" label="Edit Profile"
            onPress={() => navigation.navigate('EditLawyerProfile')} />
          <MenuItem icon="wallet-outline" label="Wallet"
            onPress={() => navigation.navigate('Wallet')} />
          <MenuItem icon="card-outline" label="Bank & UPI Accounts"
            onPress={() => navigation.navigate('BankAccounts')} />
          <MenuItem icon="shield-checkmark-outline" label="Security"
            onPress={() => setShowSecurity(true)} last />
        </View>

        {/* PREFERENCES */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="notifications-outline" label="Notifications"
            onPress={() => navigation.navigate('Notifications')} />
          <MenuItem icon="color-palette-outline" label="Appearance"
            onPress={() => setShowAppearance(!showAppearance)} last />
        </View>
        {showAppearance && (
          <View style={styles.themeCard}>
            {(['light', 'dark', 'system'] as const).map((m) => (
              <TouchableOpacity key={m} style={[styles.themeBtn, themeMode === m && styles.themeBtnActive]} onPress={() => setThemeMode(m)}>
                <Ionicons name={m === 'light' ? 'sunny-outline' : m === 'dark' ? 'moon-outline' : 'phone-portrait-outline'} size={20} color={themeMode === m ? COLORS.white : COLORS.textSecondary} />
                <Text style={[styles.themeBtnText, themeMode === m && styles.themeBtnTextActive]}>{m === 'system' ? 'System' : m.charAt(0).toUpperCase() + m.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* SUPPORT */}
        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="chatbubble-outline" label="AI Legal Assistant"
            onPress={() => navigation.navigate('AiChat')} />
          <MenuItem icon="help-circle-outline" label="Help Center"
            onPress={() => Alert.alert('Help Center', 'Contact support@lawsuit.app for assistance.')} />
          <MenuItem icon="information-circle-outline" label="About"
            onPress={() => Alert.alert('About', 'Lawsuit v1.0.0\nYour Legal Companion')} />
          <MenuItem icon="document-lock-outline" label="Privacy Policy"
            onPress={() => Alert.alert('Privacy Policy', 'View our privacy policy at lawsuit.app/privacy')} last />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Security Modal */}
      <Modal visible={showSecurity} transparent animationType="slide" onRequestClose={() => setShowSecurity(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Account Security</Text>
              <TouchableOpacity onPress={() => { setShowSecurity(false); setPwOtpSent(false); setPwOtp(''); setNewPassword(''); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: SPACING.xl }} contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
              {/* Verification Status */}
              <View style={styles.securityInfo}>
                <View style={styles.securityInfoRow}>
                  <Text style={styles.securityInfoLabel}>Verification Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: displayUser?.isVerified ? COLORS.successLight : COLORS.warningLight }]}>
                    <Text style={[styles.statusBadgeText, { color: displayUser?.isVerified ? COLORS.success : COLORS.warning }]}>
                      {displayUser?.isVerified ? 'Verified' : 'Pending'}
                    </Text>
                  </View>
                </View>
                <View style={styles.securityInfoRow}>
                  <Text style={styles.securityInfoLabel}>Email Verified</Text>
                  <Text style={[styles.securityInfoValue, { color: displayUser?.isVerified ? COLORS.success : COLORS.error }]}>
                    {displayUser?.isVerified ? 'Yes ✓' : 'No'}
                  </Text>
                </View>
                <View style={styles.securityInfoRow}>
                  <Text style={styles.securityInfoLabel}>Role</Text>
                  <Text style={styles.securityInfoValue}>LAWYER</Text>
                </View>
              </View>

              {/* Change Password */}
              <Text style={styles.securitySectionTitle}>Change Password</Text>
              <Text style={styles.securityHint}>We'll send a one-time code to your registered email to verify your identity.</Text>
              <Text style={styles.securityEmail}>{displayUser?.email || ''}</Text>

              {!pwOtpSent ? (
                <Button title="Send OTP" onPress={handleSendPwOtp} loading={pwLoading} size="lg" />
              ) : (
                <>
                  <Input label="OTP Code" value={pwOtp} onChangeText={setPwOtp} placeholder="Enter 6-digit OTP" keyboardType="number-pad" maxLength={6}
                    icon={<Ionicons name="key-outline" size={20} color={COLORS.textMuted} />} />
                  <Input label="New Password" value={newPassword} onChangeText={setNewPassword} placeholder="Min 8 characters" secureTextEntry
                    icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />} />
                  <Button title="Change Password" onPress={handleChangePassword} loading={pwLoading} size="lg" />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Full Photo Modal */}
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

/* ─── Menu Item Component ─── */
const MenuItem = ({ icon, label, subtitle, onPress, last }: { icon: string; label: string; subtitle?: string; onPress: () => void; last?: boolean }) => (
  <TouchableOpacity style={[styles.menuItem, !last && styles.menuItemBorder]} onPress={onPress}>
    <View style={styles.menuIconWrap}>
      <Ionicons name={icon as any} size={20} color={COLORS.primary} />
    </View>
    <View style={styles.menuContent}>
      <Text style={styles.menuLabel}>{label}</Text>
      {subtitle && <Text style={styles.menuSub}>{subtitle}</Text>}
    </View>
    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.lg,
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: COLORS.primary },
  avatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cameraIcon: {
    position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  profileEmail: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  verifiedText: { fontSize: FONT_SIZE.xs, fontWeight: '600' },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.xl, paddingVertical: SPACING.xl, ...SHADOWS.sm,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
  statDivider: { width: 1, height: 32, backgroundColor: COLORS.borderLight },

  // Section
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
  menuContent: { flex: 1 },
  menuLabel: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  menuSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 1 },

  // Theme
  themeCard: {
    flexDirection: 'row', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginTop: SPACING.sm,
  },
  themeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, gap: SPACING.xs,
  },
  themeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  themeBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textSecondary },
  themeBtnTextActive: { color: COLORS.white },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl, paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: COLORS.error,
  },
  logoutText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.error },

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
  securityInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  securityInfoLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  securityInfoValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.sm },
  statusBadgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  securitySectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  securityHint: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.md },
  securityEmail: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.lg },

  // Full photo
  fullPhotoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullPhotoClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  fullPhoto: { width: SCREEN_WIDTH - 40, height: SCREEN_WIDTH - 40, borderRadius: BORDER_RADIUS.lg },
});

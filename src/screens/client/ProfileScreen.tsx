import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Share, Modal, Dimensions,
  ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, GENDER_OPTIONS, CASTE_OPTIONS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { referralApi, usersApi, storageApi, authApi } from '../../services/api';
import { useThemeStore } from '../../stores/themeStore';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Common';
import { LocationPicker } from '../../components/LocationPicker';
import { MultiSelectChips } from '../../components/MultiSelectChips';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user: authUser, logout } = useAuthStore();
  const { user, loading, getUser, updateUser } = useUserStore();
  const { mode: themeMode, setMode: setThemeMode } = useThemeStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);
  const [clientInfo, setClientInfo] = useState<Record<string, any> | null>(null);
  const [editClientInfo, setEditClientInfo] = useState<Record<string, any>>({});

  // DOB picker
  const [showDobPicker, setShowDobPicker] = useState(false);

  // Change password
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwOtpSent, setPwOtpSent] = useState(false);
  const [pwOtp, setPwOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => { getUser(); fetchClientInfo(); }, []);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const fetchClientInfo = async () => {
    try {
      const { data } = await usersApi.getClientInformation();
      if (data.client) {
        setClientInfo(data.client);
        setEditClientInfo(data.client);
      }
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser({ name, phone });
      if (Object.keys(editClientInfo).length > 0) {
        const payload: Record<string, any> = { ...editClientInfo };
        // Clean up dob format
        if (payload.dob && typeof payload.dob === 'string' && !payload.dob.includes('T')) {
          payload.dob = new Date(payload.dob).toISOString();
        }
        if (payload.income) payload.income = Number(payload.income) || 0;
        await usersApi.postClientInformation(payload);
        await fetchClientInfo();
      }
      setEditing(false);
      Alert.alert('Success', 'Profile updated');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || err.response?.data?.message || 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleAvatarPress = () => {
    if (editing) pickAndUploadAvatar();
    else if (getAvatarUrl()) setShowFullPhoto(true);
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

  // Change password flow
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
      setPwOtp(''); setNewPassword(''); setPwOtpSent(false); setShowChangePassword(false);
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
  const locationData = {
    country: editClientInfo.country || 'India',
    state: editClientInfo.state || '',
    pincode: editClientInfo.pincode || '',
    district: editClientInfo.district || '',
    city: editClientInfo.city || '',
    postOfficeName: editClientInfo.postOfficeName || '',
    houseNameOrNumber: editClientInfo.houseNameOrNumber || '',
    streetName: editClientInfo.streetName || '',
  };
  const viewLocationData = {
    country: clientInfo?.country || 'India',
    state: clientInfo?.state || '',
    pincode: clientInfo?.pincode || '',
    district: clientInfo?.district || '',
    city: clientInfo?.city || '',
    postOfficeName: clientInfo?.postOfficeName || '',
    houseNameOrNumber: clientInfo?.houseNameOrNumber || '',
    streetName: clientInfo?.streetName || '',
  };

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Header with 3-dot menu */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>{' '}</Text>
          <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)}>
            <Ionicons name="ellipsis-vertical" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPH]}>
                <Ionicons name="person" size={40} color={COLORS.textMuted} />
              </View>
            )}
            <View style={styles.cameraIcon}>
              {uploading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="camera" size={14} color={COLORS.white} />}
            </View>
          </TouchableOpacity>
          {editing && <Text style={styles.tapHint}>Tap to change photo</Text>}
        </View>

        {/* Basic Information */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Basic Information</Text>
          {editing ? (
            <>
              <Input label="Full Name *" value={name} onChangeText={setName} icon={<Ionicons name="person-outline" size={20} color={COLORS.textMuted} />} />
              <Input label="Email" value={displayUser?.email || ''} editable={false} icon={<Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />} />
              <Input label="Phone" value={phone} onChangeText={setPhone} icon={<Ionicons name="call-outline" size={20} color={COLORS.textMuted} />} keyboardType="phone-pad" />
            </>
          ) : (
            <>
              <InfoItem icon="person-outline" label="Name" value={displayUser?.name || '—'} />
              <InfoItem icon="mail-outline" label="Email" value={displayUser?.email || '—'} />
              <InfoItem icon="call-outline" label="Phone" value={displayUser?.phone || '—'} />
            </>
          )}
        </View>

        {/* Address */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Address</Text>
          <LocationPicker
            value={editing ? locationData : viewLocationData}
            onChange={(partial) => setEditClientInfo((prev) => ({ ...prev, ...partial }))}
            editable={editing}
          />
        </View>

        {/* Personal Details */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Personal Details</Text>
          {editing ? (
            <>
              {/* Date of Birth */}
              <Text style={styles.fieldLabel}>Date of Birth</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowDobPicker(true)}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.textMuted} />
                <Text style={editClientInfo.dob ? styles.dropdownText : styles.dropdownPlaceholder}>
                  {editClientInfo.dob ? new Date(editClientInfo.dob).toLocaleDateString('en-IN') : 'Select date of birth'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
              {showDobPicker && (
                <DateTimePicker
                  value={editClientInfo.dob ? new Date(editClientInfo.dob) : new Date(2000, 0, 1)}
                  mode="date"
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDobPicker(false);
                    if (date) setEditClientInfo((prev) => ({ ...prev, dob: date.toISOString() }));
                  }}
                />
              )}

              {/* Gender */}
              <MultiSelectChips
                label="Gender"
                items={[...GENDER_OPTIONS]}
                selected={editClientInfo.gender ? [editClientInfo.gender] : []}
                onToggle={(g) => setEditClientInfo((prev) => ({ ...prev, gender: g === 'PREFER NOT TO SAY' ? 'PREFER_NOT_TO_SAY' : g }))}
              />

              {/* Annual Income */}
              <Input
                label="Annual Income (₹)"
                value={String(editClientInfo.income || '')}
                onChangeText={(v) => setEditClientInfo((prev) => ({ ...prev, income: v }))}
                placeholder="Enter annual income"
                icon={<Text style={{ fontSize: 16, color: COLORS.textMuted, paddingLeft: 2 }}>₹</Text>}
                keyboardType="number-pad"
              />

              {/* Caste */}
              <MultiSelectChips
                label="Caste Category"
                items={[...CASTE_OPTIONS]}
                selected={editClientInfo.caste ? [editClientInfo.caste] : []}
                onToggle={(c) => setEditClientInfo((prev) => ({ ...prev, caste: c }))}
              />
            </>
          ) : (
            <>
              <InfoItem icon="calendar-outline" label="Date of Birth" value={clientInfo?.dob ? new Date(clientInfo.dob).toLocaleDateString('en-IN') : '—'} />
              <InfoItem icon="people-outline" label="Gender" value={clientInfo?.gender?.replace('_', ' ') || '—'} />
              <InfoItem icon="cash-outline" label="Annual Income" value={clientInfo?.income ? `₹${Number(clientInfo.income).toLocaleString('en-IN')}` : '—'} />
              <InfoItem icon="ribbon-outline" label="Caste Category" value={clientInfo?.caste || '—'} />
            </>
          )}
        </View>

        {editing && (
          <View style={styles.saveRow}>
            <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" />
            <Button title="Cancel" variant="ghost" onPress={() => { setEditing(false); fetchClientInfo(); }} size="lg" />
          </View>
        )}

        {/* Change Password */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Change Password</Text>
          <Text style={styles.subText}>We'll send a one-time code to your registered email to verify your identity.</Text>
          <Text style={styles.emailDisplay}>{displayUser?.email || ''}</Text>
          {!pwOtpSent ? (
            <Button title="Send OTP" onPress={handleSendPwOtp} loading={pwLoading} size="lg" />
          ) : (
            <>
              <Input label="OTP Code" value={pwOtp} onChangeText={setPwOtp} placeholder="Enter 6-digit OTP" keyboardType="number-pad" maxLength={6} icon={<Ionicons name="key-outline" size={20} color={COLORS.textMuted} />} />
              <Input label="New Password" value={newPassword} onChangeText={setNewPassword} placeholder="Min 8 characters" secureTextEntry icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />} />
              <Button title="Change Password" onPress={handleChangePassword} loading={pwLoading} size="lg" />
            </>
          )}
        </View>

        {/* Account Security */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Account Security</Text>
          <SecurityRow label="Verification Status" value={displayUser?.isVerified ? 'Verified' : 'Pending'} color={displayUser?.isVerified ? COLORS.success : COLORS.warning} />
          <SecurityRow label="Email Verified" value={displayUser?.isVerified ? 'Yes ✓' : 'No'} color={displayUser?.isVerified ? COLORS.success : COLORS.error} />
          <SecurityRow label="Role" value={displayUser?.role || '—'} color={COLORS.text} />
        </View>

        {/* Appearance */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Appearance</Text>
          <View style={styles.themeRow}>
            {(['light', 'dark', 'system'] as const).map((m) => (
              <TouchableOpacity key={m} style={[styles.themeBtn, themeMode === m && styles.themeBtnActive]} onPress={() => setThemeMode(m)}>
                <Ionicons name={m === 'light' ? 'sunny-outline' : m === 'dark' ? 'moon-outline' : 'phone-portrait-outline'} size={20} color={themeMode === m ? COLORS.white : COLORS.textSecondary} />
                <Text style={[styles.themeBtnText, themeMode === m && styles.themeBtnTextActive]}>{m === 'system' ? 'System Default' : m.charAt(0).toUpperCase() + m.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.card}>
          <MenuItem icon="gift-outline" label="Referral Program" onPress={() => navigation.navigate('ReferralProgram')} />
          <MenuItem icon="card-outline" label="Bank & UPI Accounts" onPress={() => navigation.navigate('BankAccounts')} />
          <MenuItem icon="notifications-outline" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
          <MenuItem icon="wallet-outline" label="Wallet" onPress={() => navigation.navigate('Wallet')} />
          <MenuItem icon="chatbubble-outline" label="AI Legal Assistant" onPress={() => navigation.navigate('AiChat')} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

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

const InfoItem = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoItem}>
    <Ionicons name={icon as any} size={18} color={COLORS.textMuted} />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const MenuItem = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <Ionicons name={icon as any} size={20} color={COLORS.primary} />
    <Text style={styles.menuLabel}>{label}</Text>
    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const SecurityRow = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <View style={styles.securityRow}>
    <Text style={styles.securityLabel}>{label}</Text>
    <Text style={[styles.securityValue, { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 100 },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  avatarSection: { alignItems: 'center', paddingVertical: SPACING.xxl },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary },
  avatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cameraIcon: { position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  tapHint: { fontSize: FONT_SIZE.xs, color: COLORS.primary, marginTop: SPACING.sm },
  card: { backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginBottom: SPACING.lg, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm },
  sTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SPACING.md + 2, paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  dropdownText: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text },
  dropdownPlaceholder: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.textMuted },
  subText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: SPACING.md, lineHeight: 20 },
  emailDisplay: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.lg },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  infoValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  saveRow: { paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.lg },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  menuLabel: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  securityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  securityLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  securityValue: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  themeRow: { flexDirection: 'row', gap: SPACING.sm },
  themeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, gap: SPACING.xs,
  },
  themeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  themeBtnText: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textSecondary },
  themeBtnTextActive: { color: COLORS.white },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginTop: SPACING.md, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.error },
  logoutText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.error },
  fullPhotoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullPhotoClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  fullPhoto: { width: SCREEN_WIDTH - 40, height: SCREEN_WIDTH - 40, borderRadius: BORDER_RADIUS.lg },
});

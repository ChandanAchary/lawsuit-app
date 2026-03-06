import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Common';

export const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user: authUser, logout } = useAuthStore();
  const { user, loading, getUser, updateUser } = useUserStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { getUser(); }, []);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser({ name, phone });
      setEditing(false);
      Alert.alert('Success', 'Profile updated');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      // Upload avatar via storageApi in production
      Alert.alert('Avatar', 'Avatar uploaded (demo)');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading && !user) return <Loading />;

  const displayUser = user || authUser;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)}>
          <Text style={styles.editBtn}>{editing ? 'Save' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar section */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handleAvatar} style={styles.avatarWrap}>
          {displayUser?.avatar ? (
            <Image source={{ uri: displayUser.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={40} color={COLORS.textMuted} />
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Ionicons name="camera" size={14} color={COLORS.white} />
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{displayUser?.name}</Text>
        <Text style={styles.userEmail}>{displayUser?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{displayUser?.role}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        {editing ? (
          <>
            <Input label="Full Name" value={name} onChangeText={setName} icon="person-outline" />
            <Input label="Phone" value={phone} onChangeText={setPhone} icon="call-outline" keyboardType="phone-pad" />
          </>
        ) : (
          <>
            <InfoItem icon="person-outline" label="Name" value={displayUser?.name || '—'} />
            <InfoItem icon="mail-outline" label="Email" value={displayUser?.email || '—'} />
            <InfoItem icon="call-outline" label="Phone" value={displayUser?.phone || '—'} />
            <InfoItem icon="shield-checkmark-outline" label="Verified" value={displayUser?.isVerified ? 'Yes' : 'No'} />
          </>
        )}
      </View>

      {editing && (
        <View style={styles.saveRow}>
          <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" />
          <Button title="Cancel" variant="ghost" onPress={() => setEditing(false)} size="lg" />
        </View>
      )}

      {/* Menu items */}
      <View style={styles.card}>
        <MenuItem icon="notifications-outline" label="Notifications" onPress={() => navigation.navigate('Notifications')} />
        <MenuItem icon="wallet-outline" label="Wallet" onPress={() => navigation.navigate('Wallet')} />
        <MenuItem icon="chatbubble-outline" label="AI Legal Assistant" onPress={() => navigation.navigate('AiChat')} />
        <MenuItem icon="information-circle-outline" label="About" onPress={() => {}} />
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 100 },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  editBtn: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
  avatarSection: { alignItems: 'center', paddingVertical: SPACING.xxl },
  avatarWrap: { position: 'relative' },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: COLORS.primary },
  avatarPlaceholder: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cameraIcon: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  userName: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginTop: SPACING.md },
  userEmail: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  roleBadge: {
    backgroundColor: COLORS.primaryLight + '30', paddingHorizontal: SPACING.md, paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full, marginTop: SPACING.sm,
  },
  roleText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.primary },
  card: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm,
  },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  infoValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  saveRow: { paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.lg },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  menuLabel: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.xl, marginTop: SPACING.md, paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.error,
  },
  logoutText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.error },
});

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, LEGAL_CATEGORIES } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { usersApi } from '../../services/api';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Common';
import { ChipGroup } from '../../components/TabBar';

export const LawyerProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user: authUser, logout } = useAuthStore();
  const { user, loading, getUser, updateUser } = useUserStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', bio: '', fee: '', experienceYears: '',
    location: '', barCouncilId: '',
  });
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getUser(); }, []);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '', phone: user.phone || '',
        bio: (user as any).bio || '', fee: String((user as any).fee || ''),
        experienceYears: String((user as any).experienceYears || ''),
        location: (user as any).location || '', barCouncilId: (user as any).barCouncilId || '',
      });
      setSelectedSpecs((user as any).specialization || []);
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await usersApi.postLawyerInformation({
        ...form,
        fee: Number(form.fee),
        experienceYears: Number(form.experienceYears),
        specialization: selectedSpecs,
      });
      setEditing(false);
      getUser();
      Alert.alert('Success', 'Profile updated');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  const handleAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0]) { Alert.alert('Avatar', 'Uploaded (demo)'); }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  if (loading && !user) return <Loading />;
  const displayUser = user || authUser;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Lawyer Profile</Text>
        <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)}>
          <Text style={styles.editBtn}>{editing ? (saving ? 'Saving...' : 'Save') : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handleAvatar} style={styles.avatarWrap}>
          {displayUser?.avatar ? (
            <Image source={{ uri: displayUser.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPH]}>
              <Ionicons name="person" size={40} color={COLORS.textMuted} />
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Ionicons name="camera" size={14} color={COLORS.white} />
          </View>
        </TouchableOpacity>
        <Text style={styles.userName}>{displayUser?.name}</Text>
        <Text style={styles.userEmail}>{displayUser?.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sTitle}>Personal Details</Text>
        {editing ? (
          <>
            <Input label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} icon="person-outline" />
            <Input label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} icon="call-outline" keyboardType="phone-pad" />
            <Input label="Location" value={form.location} onChangeText={(v) => setForm({ ...form, location: v })} icon="location-outline" />
            <Input label="Bar Council ID" value={form.barCouncilId} onChangeText={(v) => setForm({ ...form, barCouncilId: v })} icon="id-card-outline" />
            <Input label="Fee (₹)" value={form.fee} onChangeText={(v) => setForm({ ...form, fee: v })} icon="cash-outline" keyboardType="number-pad" />
            <Input label="Experience (years)" value={form.experienceYears} onChangeText={(v) => setForm({ ...form, experienceYears: v })} icon="time-outline" keyboardType="number-pad" />
            <Input label="Bio" value={form.bio} onChangeText={(v) => setForm({ ...form, bio: v })} icon="document-text-outline" multiline />
          </>
        ) : (
          <>
            <InfoItem icon="person-outline" label="Name" value={displayUser?.name || '—'} />
            <InfoItem icon="mail-outline" label="Email" value={displayUser?.email || '—'} />
            <InfoItem icon="call-outline" label="Phone" value={displayUser?.phone || '—'} />
            <InfoItem icon="location-outline" label="Location" value={(displayUser as any)?.location || '—'} />
            <InfoItem icon="cash-outline" label="Fee" value={`₹${(displayUser as any)?.fee || '—'}`} />
            <InfoItem icon="time-outline" label="Experience" value={`${(displayUser as any)?.experienceYears || '—'} years`} />
            <InfoItem icon="id-card-outline" label="Bar Council" value={(displayUser as any)?.barCouncilId || '—'} />
          </>
        )}
      </View>

      {editing && (
        <View style={styles.card}>
          <Text style={styles.sTitle}>Specializations</Text>
          <ChipGroup
            items={LEGAL_CATEGORIES}
            selected={selectedSpecs[0] || ''}
            onSelect={(key) => {
              setSelectedSpecs((prev) =>
                prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
              );
            }}
          />
        </View>
      )}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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
  avatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  userName: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginTop: SPACING.md },
  userEmail: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  card: { backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginBottom: SPACING.lg, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm },
  sTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  infoValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginHorizontal: SPACING.xl, marginTop: SPACING.md, paddingVertical: SPACING.lg, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.error },
  logoutText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.error },
});

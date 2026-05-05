import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { storageApi, usersApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { requestMediaLibraryPermission } from '../../utils/permissions';
import { formatErrorMessage } from '../../utils/formatError';

export const EditAdminProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const authUser = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore((s) => s.setUser);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (authUser) {
      setName(authUser.name || '');
      setPhone(authUser.phone || '');
      setEmail(authUser.email || '');
      setAvatarUrl((authUser as any).avatarUrl || authUser.avatar || '');
    }
  }, [authUser]);

  const showPermissionSettingsAlert = (message: string) => {
    Alert.alert('Permission Required', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Go to Settings',
        onPress: () => {
          Linking.openSettings().catch(() => {
            Alert.alert('Error', 'Unable to open app settings');
          });
        },
      },
    ]);
  };

  const pickAndUploadAvatar = async () => {
    try {
      const granted = await requestMediaLibraryPermission();
      if (!granted) {
        showPermissionSettingsAlert('Please allow photos/media access to upload profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
      if (result.canceled || !result.assets[0]) return;

      setUploading(true);
      const asset = result.assets[0];
      const { data: signData } = await storageApi.getCloudinarySignature('profiles');
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.uri.split('/').pop() || 'profile.jpg',
      } as any);
      formData.append('timestamp', String(signData.timestamp));
      formData.append('signature', signData.signature);
      formData.append('api_key', signData.apiKey);
      formData.append('folder', signData.folder);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(signData.cloudName)}/image/upload`,
        { method: 'POST', body: formData },
      );
      const uploadData = await uploadRes.json();
      if (!uploadData?.secure_url) {
        Alert.alert('Error', 'Image upload failed.');
        return;
      }

      setAvatarUrl(uploadData.secure_url);
      await usersApi.updateMe({ avatarUrl: uploadData.secure_url });
      setAuthUser({ ...(authUser as any), avatar: uploadData.secure_url, avatarUrl: uploadData.secure_url } as any);
      Alert.alert('Success', 'Profile image updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Phone is required.');
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('Error', 'Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Error', 'Enter a valid email address.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name: name.trim(),
        phone: phone.trim(),
      };
      // Only send email if it actually changed — saves a uniqueness round-trip
      // and keeps the no-op case fast.
      if (trimmedEmail !== (authUser?.email || '').toLowerCase()) {
        payload.email = trimmedEmail;
      }
      const { data } = await usersApi.updateMe(payload);
      const updated = (data?.user || data) as any;

      setAuthUser({
        ...(authUser as any),
        name: updated?.name || name.trim(),
        phone: updated?.phone || phone.trim(),
        email: updated?.email || trimmedEmail,
        avatar: updated?.avatarUrl || (authUser as any)?.avatar,
        avatarUrl: updated?.avatarUrl || (authUser as any)?.avatarUrl,
      } as any);

      Alert.alert('Success', 'Profile updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Update Failed', formatErrorMessage(err) || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarWrap} onPress={pickAndUploadAvatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={40} color={COLORS.textMuted} />
                </View>
              )}
              <View style={styles.cameraIcon}>
                {uploading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="camera" size={14} color={COLORS.white} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.tapHint}>Tap to change profile photo</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account Details</Text>
            <Input
              label="Full Name"
              value={name}
              onChangeText={setName}
              icon={<Ionicons name="person-outline" size={20} color={COLORS.textMuted} />}
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              icon={<Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />}
            />
            <Input
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon={<Ionicons name="call-outline" size={20} color={COLORS.textMuted} />}
            />
          </View>

          <View style={styles.saveRow}>
            <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" />
            <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} size="lg" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    headerBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.huge,
      paddingBottom: SPACING.md,
      backgroundColor: COLORS.white,
      ...SHADOWS.sm,
    },
    headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
    avatarSection: { alignItems: 'center', paddingVertical: SPACING.xxl },
    avatarWrap: { position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary },
    avatarPlaceholder: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    cameraIcon: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: COLORS.white,
    },
    tapHint: { fontSize: FONT_SIZE.xs, color: COLORS.primary, marginTop: SPACING.sm },
    card: {
      backgroundColor: COLORS.white,
      marginHorizontal: SPACING.xl,
      marginBottom: SPACING.lg,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.xl,
      ...SHADOWS.sm,
    },
    sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
    saveRow: { paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.lg },
  });

export default EditAdminProfileScreen;

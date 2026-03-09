import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Dimensions,
  ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, GENDER_OPTIONS, CASTE_OPTIONS } from '../../constants';
import { formatErrorMessage } from '../../utils/formatError';
import { useAuthStore } from '../../stores/authStore';
import { useUserStore } from '../../stores/userStore';
import { usersApi, storageApi } from '../../services/api';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Common';
import { LocationPicker } from '../../components/LocationPicker';
import { MultiSelectChips } from '../../components/MultiSelectChips';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const EditProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user: authUser } = useAuthStore();
  const { user, loading, getUser, updateUser } = useUserStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<{ incomeProofUrl: boolean; casteProofUrl: boolean }>({ incomeProofUrl: false, casteProofUrl: false });
  const [clientInfo, setClientInfo] = useState<Record<string, any>>({});
  const [showDobPicker, setShowDobPicker] = useState(false);

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
      if (data.client) setClientInfo(data.client);
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
        Alert.alert('Success', 'Photo updated');
      } else Alert.alert('Error', 'Upload failed');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload');
    } finally { setUploading(false); }
  };

  const pickAndUploadDocument = async (field: 'incomeProofUrl' | 'casteProofUrl') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploadingDoc((prev) => ({ ...prev, [field]: true }));
      const { data: signData } = await storageApi.getCloudinarySignature('documents');
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType || 'application/octet-stream', name: asset.name || 'file' } as any);
      formData.append('timestamp', String(signData.timestamp));
      formData.append('signature', signData.signature);
      formData.append('api_key', signData.apiKey);
      formData.append('folder', signData.folder);
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signData.cloudName)}/auto/upload`, { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (uploadData.secure_url) {
        setClientInfo((prev) => ({ ...prev, [field]: uploadData.secure_url }));
        Alert.alert('Uploaded', 'Document uploaded. Save your profile to confirm.');
      } else {
        Alert.alert('Error', 'Upload failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload');
    } finally {
      setUploadingDoc((prev) => ({ ...prev, [field]: false }));
    }
  };

  const removeDocument = (field: 'incomeProofUrl' | 'casteProofUrl') => {
    Alert.alert('Remove Document', 'Are you sure you want to remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setClientInfo((prev) => ({ ...prev, [field]: '' })) },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setSaving(true);
    try {
      await updateUser({ name: name.trim(), phone: phone.trim() });
      if (Object.keys(clientInfo).length > 0) {
        const payload: Record<string, any> = { ...clientInfo };
        if (payload.dob && typeof payload.dob === 'string' && !payload.dob.includes('T')) {
          payload.dob = new Date(payload.dob).toISOString();
        }
        if (payload.income) payload.income = Number(payload.income) || 0;
        // sanitize payload: backend expects strings for many fields, avoid sending null
        Object.keys(payload).forEach((k) => {
          if (payload[k] === null || payload[k] === undefined) payload[k] = '';
          // ensure files / url fields are strings
          if (k.toLowerCase().includes('url') && payload[k] && typeof payload[k] !== 'string') payload[k] = String(payload[k]);
        });
        await usersApi.postClientInformation(payload);
      }
      Alert.alert('Success', 'Profile updated', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err.response?.data || err));
    } finally { setSaving(false); }
  };

  if (loading && !user) return <Loading />;
  const displayUser = user || authUser;
  const avatarUrl = getAvatarUrl();
  const locationData = {
    country: clientInfo.country || 'India',
    state: clientInfo.state || '',
    pincode: clientInfo.pincode || '',
    district: clientInfo.district || '',
    city: clientInfo.city || '',
    postOfficeName: clientInfo.postOfficeName || '',
    houseNameOrNumber: clientInfo.houseNameOrNumber || '',
    streetName: clientInfo.streetName || '',
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAndUploadAvatar} style={styles.avatarWrap}>
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
          <Text style={styles.tapHint}>Tap to change photo</Text>
        </View>

        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Basic Information</Text>
          <Input label="Full Name *" value={name} onChangeText={setName} icon={<Ionicons name="person-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="Email" value={displayUser?.email || ''} editable={false} icon={<Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="Phone" value={phone} onChangeText={setPhone} icon={<Ionicons name="call-outline" size={20} color={COLORS.textMuted} />} keyboardType="phone-pad" />
        </View>

        {/* Address */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Address</Text>
          <LocationPicker
            value={locationData}
            onChange={(partial) => setClientInfo((prev) => ({ ...prev, ...partial }))}
            editable={true}
          />
        </View>

        {/* Personal Details */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Personal Details</Text>

          <Text style={styles.fieldLabel}>Date of Birth</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowDobPicker(true)}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.textMuted} />
            <Text style={clientInfo.dob ? styles.dropdownText : styles.dropdownPlaceholder}>
              {clientInfo.dob ? new Date(clientInfo.dob).toLocaleDateString('en-IN') : 'Select date of birth'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          {showDobPicker && (
            <DateTimePicker
              value={clientInfo.dob ? new Date(clientInfo.dob) : new Date(2000, 0, 1)}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, date) => {
                setShowDobPicker(false);
                if (date) setClientInfo((prev) => ({ ...prev, dob: date.toISOString() }));
              }}
            />
          )}

          <MultiSelectChips
            label="Gender"
            items={[...GENDER_OPTIONS]}
            selected={clientInfo.gender ? [clientInfo.gender === 'PREFER_NOT_TO_SAY' ? 'PREFER NOT TO SAY' : clientInfo.gender] : []}
            onToggle={(g) => setClientInfo((prev) => ({ ...prev, gender: g === 'PREFER NOT TO SAY' ? 'PREFER_NOT_TO_SAY' : g }))}
          />

          <Input
            label="Annual Income (₹)"
            value={String(clientInfo.income || '')}
            onChangeText={(v) => setClientInfo((prev) => ({ ...prev, income: v }))}
            placeholder="Enter annual income"
            icon={<Text style={{ fontSize: 16, color: COLORS.textMuted, paddingLeft: 2 }}>₹</Text>}
            keyboardType="number-pad"
          />

          <MultiSelectChips
            label="Caste Category"
            items={[...CASTE_OPTIONS]}
            selected={clientInfo.caste ? [clientInfo.caste] : []}
            onToggle={(c) => setClientInfo((prev) => ({ ...prev, caste: c }))}
          />

          <View style={{ marginTop: SPACING.md }}>
            <Text style={styles.fieldLabel}>Income Proof</Text>
            <View style={styles.inlineDocRow}>
              <Text style={styles.inlineDocLabel}>PDF or image (optional)</Text>
              <View style={styles.inlineDocBtns}>
                {clientInfo.incomeProofUrl ? (
                  <>
                    <TouchableOpacity style={styles.viewDocBtn} onPress={() => Linking.openURL(clientInfo.incomeProofUrl)}>
                      <Ionicons name="eye-outline" size={13} color={COLORS.primary} />
                      <Text style={styles.viewDocBtnText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeDocBtn} onPress={() => removeDocument('incomeProofUrl')}>
                      <Ionicons name="trash-outline" size={13} color="#e74c3c" />
                      <Text style={styles.removeDocBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                <TouchableOpacity
                  style={[styles.inlineUploadBtn, clientInfo.incomeProofUrl ? styles.inlineUploadBtnDone : null]}
                  onPress={() => void pickAndUploadDocument('incomeProofUrl')}
                  disabled={uploadingDoc.incomeProofUrl}
                >
                  {uploadingDoc.incomeProofUrl
                    ? <ActivityIndicator size="small" color={COLORS.white} />
                    : <><Ionicons name={clientInfo.incomeProofUrl ? 'refresh-outline' : 'cloud-upload-outline'} size={13} color={COLORS.white} /><Text style={styles.inlineUploadBtnText}>{clientInfo.incomeProofUrl ? 'Re-upload' : 'Upload'}</Text></>
                  }
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>Caste Proof</Text>
            <View style={styles.inlineDocRow}>
              <Text style={styles.inlineDocLabel}>PDF or image (optional)</Text>
              <View style={styles.inlineDocBtns}>
                {clientInfo.casteProofUrl ? (
                  <>
                    <TouchableOpacity style={styles.viewDocBtn} onPress={() => Linking.openURL(clientInfo.casteProofUrl)}>
                      <Ionicons name="eye-outline" size={13} color={COLORS.primary} />
                      <Text style={styles.viewDocBtnText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeDocBtn} onPress={() => removeDocument('casteProofUrl')}>
                      <Ionicons name="trash-outline" size={13} color="#e74c3c" />
                      <Text style={styles.removeDocBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
                <TouchableOpacity
                  style={[styles.inlineUploadBtn, clientInfo.casteProofUrl ? styles.inlineUploadBtnDone : null]}
                  onPress={() => void pickAndUploadDocument('casteProofUrl')}
                  disabled={uploadingDoc.casteProofUrl}
                >
                  {uploadingDoc.casteProofUrl
                    ? <ActivityIndicator size="small" color={COLORS.white} />
                    : <><Ionicons name={clientInfo.casteProofUrl ? 'refresh-outline' : 'cloud-upload-outline'} size={13} color={COLORS.white} /><Text style={styles.inlineUploadBtnText}>{clientInfo.casteProofUrl ? 'Re-upload' : 'Upload'}</Text></>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Save */}
        <View style={styles.saveRow}>
          <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" />
          <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} size="lg" />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  avatarSection: { alignItems: 'center', paddingVertical: SPACING.xxl },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary },
  avatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cameraIcon: {
    position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  tapHint: { fontSize: FONT_SIZE.xs, color: COLORS.primary, marginTop: SPACING.sm },
  card: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm,
  },
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
  saveRow: { paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.lg },
  inlineDocRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xs, marginBottom: SPACING.md, paddingHorizontal: 2 },
  inlineDocLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, flex: 1 },
  inlineDocBtns: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap', justifyContent: 'flex-end' },
  viewDocBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 4, paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  viewDocBtnText: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '600' },
  removeDocBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: '#e74c3c', paddingVertical: 4, paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  removeDocBtnText: { color: '#e74c3c', fontSize: FONT_SIZE.xs, fontWeight: '600' },
  inlineUploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.primary, paddingVertical: 4, paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  inlineUploadBtnDone: { backgroundColor: '#27ae60' },
  inlineUploadBtnText: { color: COLORS.white, fontSize: FONT_SIZE.xs, fontWeight: '600' },
});

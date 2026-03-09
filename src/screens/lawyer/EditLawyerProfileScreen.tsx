import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, Dimensions,
  ActivityIndicator, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, LEGAL_CATEGORIES, INDIAN_LANGUAGES } from '../../constants';
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

export const EditLawyerProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user: authUser } = useAuthStore();
  const { user, loading, getUser, updateUser } = useUserStore();
  const [form, setForm] = useState({
    name: '', phone: '', bio: '', feePerConsultation: '',
    experienceYears: '', barCouncilId: '', licenseNumber: '', barCouncil: '',
    organisation: '', address: '',
  });
  const [locationData, setLocationData] = useState({
    country: 'India', state: '', pincode: '', district: '', city: '',
    postOfficeName: '', houseNameOrNumber: '', streetName: '',
  });
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [docUrls, setDocUrls] = useState<{ licenseProofUrl: string; barCouncilProofUrl: string }>({ licenseProofUrl: '', barCouncilProofUrl: '' });
  const [uploadingDoc, setUploadingDoc] = useState<{ licenseProofUrl: boolean; barCouncilProofUrl: boolean }>({ licenseProofUrl: false, barCouncilProofUrl: false });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);

  useEffect(() => { fetchLawyerInfo(); }, []);

  const fetchLawyerInfo = async () => {
    try {
      const { data } = await usersApi.getLawyerInformation();
      if (data.lawyer) {
        const l = data.lawyer;
        setForm({
          name: l.name || user?.name || '',
          phone: l.phone || user?.phone || '',
          bio: l.bio || '',
          // Always show fee in rupees
          feePerConsultation: l.feePerConsultation ? String(Math.round(Number(l.feePerConsultation) / 100)) : '',
          experienceYears: String(l.experienceYears || ''),
          barCouncilId: l.barCouncilId || '',
          licenseNumber: l.licenseNumber || '',
          barCouncil: l.barCouncil || '',
          organisation: l.organisation || '',
          address: l.address || '',
        });
        setLocationData({
          country: l.country || 'India',
          state: l.state || '',
          pincode: l.pincode || '',
          district: l.district || '',
          city: l.city || '',
          postOfficeName: l.postOfficeName || '',
          houseNameOrNumber: l.houseNameOrNumber || '',
          streetName: l.streetName || '',
        });
        setSelectedSpecs(l.specializations || []);
        setSelectedLangs(l.languages || []);
        setDocUrls({
          licenseProofUrl: l.licenseProofUrl || '',
          barCouncilProofUrl: l.barCouncilProofUrl || '',
        });
      }
    } catch {}
  };

  const uploadDocument = async (docKey: 'licenseProofUrl' | 'barCouncilProofUrl') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setUploadingDoc((prev) => ({ ...prev, [docKey]: true }));
      const asset = result.assets[0];
      const { data: signData } = await storageApi.getCloudinarySignature('lawyer-docs');
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType || 'application/octet-stream', name: asset.name || 'doc' } as any);
      formData.append('timestamp', String(signData.timestamp));
      formData.append('signature', signData.signature);
      formData.append('api_key', signData.apiKey);
      formData.append('folder', signData.folder);
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signData.cloudName)}/auto/upload`, { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (uploadData.secure_url) {
        setDocUrls((prev) => ({ ...prev, [docKey]: uploadData.secure_url }));
        Alert.alert('Uploaded', 'Document uploaded. Save your profile to confirm.');
      } else {
        Alert.alert('Error', 'Upload failed');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload document');
    } finally {
      setUploadingDoc((prev) => ({ ...prev, [docKey]: false }));
    }
  };

  const removeDocument = (docKey: 'licenseProofUrl' | 'barCouncilProofUrl') => {
    Alert.alert('Remove Document', 'Are you sure you want to remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setDocUrls((prev) => ({ ...prev, [docKey]: '' })) },
    ]);
  };

  const handleSave = async () => {
    if (!form.feePerConsultation || Number(form.feePerConsultation) < 10) {
      Alert.alert('Error', 'Please set a valid consultation fee (minimum ₹10)');
      return;
    }
    setSaving(true);
    try {
      await updateUser({ name: form.name, phone: form.phone });
      await usersApi.postLawyerInformation({
        bio: form.bio,
        // Always send fee in paise (multiply by 100)
        feePerConsultation: Math.round(Number(form.feePerConsultation) * 100) || 0,
        experienceYears: Number(form.experienceYears) || 0,
        barCouncilId: form.barCouncilId, licenseNumber: form.licenseNumber,
        barCouncil: form.barCouncil, organisation: form.organisation,
        address: form.address,
        licenseProofUrl: docUrls.licenseProofUrl || undefined,
        barCouncilProofUrl: docUrls.barCouncilProofUrl || undefined,
        country: locationData.country, state: locationData.state,
        pincode: locationData.pincode, district: locationData.district,
        city: locationData.city, postOfficeName: locationData.postOfficeName,
        houseNameOrNumber: locationData.houseNameOrNumber, streetName: locationData.streetName,
        specializations: selectedSpecs, languages: selectedLangs,
      });
      await getUser();
      Alert.alert('Success', 'Profile updated');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err.response?.data || err));
    } finally { setSaving(false); }
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

  const displayUser = user || authUser;
  const avatarUrl = getAvatarUrl();

  if (loading && !user) return <Loading />;

  return (
    <>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAndUploadAvatar} style={styles.avatarWrap}>
            {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            : <View style={[styles.avatar, styles.avatarPH]}><Ionicons name="person" size={40} color={COLORS.textMuted} /></View>}
            <View style={styles.cameraIcon}>
              {uploading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="camera" size={14} color={COLORS.white} />}
            </View>
          </TouchableOpacity>
          <Text style={styles.tapHint}>Tap to change photo</Text>
        </View>

        {/* Basic Information */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Basic Information</Text>
          <Input label="Full Name *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} icon={<Ionicons name="person-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="Email" value={displayUser?.email || ''} editable={false} icon={<Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} icon={<Ionicons name="call-outline" size={20} color={COLORS.textMuted} />} keyboardType="phone-pad" />
        </View>

        {/* Professional Details */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Professional Details</Text>
          <Input label="Bio" value={form.bio} onChangeText={(v) => setForm({ ...form, bio: v })} multiline icon={<Ionicons name="document-text-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="Bar Council ID" value={form.barCouncilId} onChangeText={(v) => setForm({ ...form, barCouncilId: v })} icon={<Ionicons name="id-card-outline" size={20} color={COLORS.textMuted} />} />
          <View style={styles.inlineDocRow}>
            <Text style={styles.inlineDocLabel}>Bar Council Certificate Proof</Text>
            <View style={styles.inlineDocBtns}>
              {docUrls.barCouncilProofUrl ? (
                <>
                  <TouchableOpacity style={styles.viewDocBtn} onPress={() => Linking.openURL(docUrls.barCouncilProofUrl)}>
                    <Ionicons name="eye-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.viewDocBtnText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeDocBtn} onPress={() => removeDocument('barCouncilProofUrl')}>
                    <Ionicons name="trash-outline" size={13} color="#e74c3c" />
                    <Text style={styles.removeDocBtnText}>Remove</Text>
                  </TouchableOpacity>
                </>
              ) : null}
              <TouchableOpacity
                style={[styles.inlineUploadBtn, docUrls.barCouncilProofUrl ? styles.inlineUploadBtnDone : null]}
                onPress={() => void uploadDocument('barCouncilProofUrl')}
                disabled={uploadingDoc.barCouncilProofUrl}
              >
                {uploadingDoc.barCouncilProofUrl
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <><Ionicons name={docUrls.barCouncilProofUrl ? 'refresh-outline' : 'cloud-upload-outline'} size={13} color={COLORS.white} /><Text style={styles.inlineUploadBtnText}>{docUrls.barCouncilProofUrl ? 'Re-upload' : 'Upload'}</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
          <Input label="License Number" value={form.licenseNumber} onChangeText={(v) => setForm({ ...form, licenseNumber: v })} icon={<Ionicons name="document-outline" size={20} color={COLORS.textMuted} />} />
          <View style={styles.inlineDocRow}>
            <Text style={styles.inlineDocLabel}>License / Registration Proof</Text>
            <View style={styles.inlineDocBtns}>
              {docUrls.licenseProofUrl ? (
                <>
                  <TouchableOpacity style={styles.viewDocBtn} onPress={() => Linking.openURL(docUrls.licenseProofUrl)}>
                    <Ionicons name="eye-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.viewDocBtnText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeDocBtn} onPress={() => removeDocument('licenseProofUrl')}>
                    <Ionicons name="trash-outline" size={13} color="#e74c3c" />
                    <Text style={styles.removeDocBtnText}>Remove</Text>
                  </TouchableOpacity>
                </>
              ) : null}
              <TouchableOpacity
                style={[styles.inlineUploadBtn, docUrls.licenseProofUrl ? styles.inlineUploadBtnDone : null]}
                onPress={() => void uploadDocument('licenseProofUrl')}
                disabled={uploadingDoc.licenseProofUrl}
              >
                {uploadingDoc.licenseProofUrl
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <><Ionicons name={docUrls.licenseProofUrl ? 'refresh-outline' : 'cloud-upload-outline'} size={13} color={COLORS.white} /><Text style={styles.inlineUploadBtnText}>{docUrls.licenseProofUrl ? 'Re-upload' : 'Upload'}</Text></>
                }
              </TouchableOpacity>
              {/* Styles for removeDocBtn are now in StyleSheet below */}
            </View>
          </View>
          <Input label="Bar Council" value={form.barCouncil} onChangeText={(v) => setForm({ ...form, barCouncil: v })} icon={<Ionicons name="ribbon-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="Organisation" value={form.organisation} onChangeText={(v) => setForm({ ...form, organisation: v })} icon={<Ionicons name="business-outline" size={20} color={COLORS.textMuted} />} />
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <Input label="Experience (years)" value={form.experienceYears} onChangeText={(v) => setForm({ ...form, experienceYears: v })} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Fee (₹)" value={form.feePerConsultation} onChangeText={(v) => setForm({ ...form, feePerConsultation: v })} keyboardType="number-pad" />
            </View>
          </View>
        </View>

        {/* Specializations */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Specializations</Text>
          <MultiSelectChips items={LEGAL_CATEGORIES} selected={selectedSpecs}
            onToggle={(item) => setSelectedSpecs((prev) => prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item])} />
        </View>

        {/* Languages */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Languages</Text>
          <MultiSelectChips items={INDIAN_LANGUAGES} selected={selectedLangs}
            onToggle={(item) => setSelectedLangs((prev) => prev.includes(item) ? prev.filter((l) => l !== item) : [...prev, item])} />
        </View>

        {/* Location */}
        <View style={styles.card}>
          <Text style={styles.sTitle}>Location</Text>
          <LocationPicker value={locationData} onChange={(partial) => setLocationData((prev) => ({ ...prev, ...partial }))} editable />
          <Input label="Office Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })}
            placeholder="e.g. Raja Rani Apartment" icon={<Ionicons name="business-outline" size={20} color={COLORS.textMuted} />} />
        </View>

        <View style={styles.saveRow}>
          <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" />
          <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} size="lg" />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

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

const styles = StyleSheet.create({
    removeDocBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: '#e74c3c', paddingVertical: 4, paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.md },
    removeDocBtnText: { color: '#e74c3c', fontSize: FONT_SIZE.xs, fontWeight: '600' },
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  avatarSection: { alignItems: 'center', paddingVertical: SPACING.xxl },
  avatarWrap: { position: 'relative' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary },
  avatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cameraIcon: { position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.white },
  tapHint: { fontSize: FONT_SIZE.xs, color: COLORS.primary, marginTop: SPACING.sm },
  card: { backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginBottom: SPACING.lg, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm },
  sTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  twoCol: { flexDirection: 'row', gap: SPACING.md },
  saveRow: { paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.lg },
  inlineDocRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -SPACING.sm, marginBottom: SPACING.md, paddingHorizontal: 2 },
  inlineDocLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, flex: 1 },
  inlineDocBtns: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  viewDocBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 4, paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  viewDocBtnText: { color: COLORS.primary, fontSize: FONT_SIZE.xs, fontWeight: '600' },
  inlineUploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: COLORS.primary, paddingVertical: 4, paddingHorizontal: SPACING.sm, borderRadius: BORDER_RADIUS.md },
  inlineUploadBtnDone: { backgroundColor: '#27ae60' },
  inlineUploadBtnText: { color: COLORS.white, fontSize: FONT_SIZE.xs, fontWeight: '600' },
  fullPhotoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullPhotoClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  fullPhoto: { width: SCREEN_WIDTH - 40, height: SCREEN_WIDTH - 40, borderRadius: BORDER_RADIUS.lg },
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { addressApi, authApi, courtAdminApi, storageApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { requestMediaLibraryPermission } from '../../utils/permissions';
import { loadStateOptions } from '../../utils/addressOptions';
import { formatErrorMessage } from '../../utils/formatError';

const COURT_TYPE_OPTIONS = [
  { label: 'Supreme Court', value: 'SUPREME_COURT' },
  { label: 'High Court', value: 'HIGH_COURT' },
  { label: 'District Courts', value: 'DISTRICT_COURT' },
  { label: 'Subordinate Courts (Civil / Criminal)', value: 'SUBORDINATE_COURT' },
  { label: 'Specialized Courts / Tribunals', value: 'SPECIALIZED_TRIBUNAL' },
  { label: 'ADR (Lok Adalat, Mediation)', value: 'ADR_LOK_ADALAT_MEDIATION' },
];

type PostOffice = {
  name: string;
  district: string;
  state: string;
};

type CourtAdminProfile = {
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  registrationNumber?: string;
  court?: {
    name?: string;
    type?: string;
    pincode?: string;
    state?: string;
    district?: string;
    city?: string;
    address?: string;
  };
};

export const EditCourtAdminProfileScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const section = route?.params?.section === 'court' ? 'court' : 'account';
  const authUser = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore((s) => s.setUser);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState('');
  const [initialEmail, setInitialEmail] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [courtName, setCourtName] = useState('');
  const [courtType, setCourtType] = useState('');
  const [courtPincode, setCourtPincode] = useState('');
  const [courtState, setCourtState] = useState('');
  const [courtDistrict, setCourtDistrict] = useState('');
  const [courtCity, setCourtCity] = useState('');
  const [courtAddress, setCourtAddress] = useState('');

  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [locations, setLocations] = useState<PostOffice[]>([]);

  const [showCourtTypeModal, setShowCourtTypeModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  const [districtLoading, setDistrictLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [lastLookupKey, setLastLookupKey] = useState('');

  const filteredStates = stateSearch
    ? states.filter((item) => item.toLowerCase().includes(stateSearch.toLowerCase()))
    : states;

  const filteredDistricts = districtSearch
    ? districts.filter((item) => item.toLowerCase().includes(districtSearch.toLowerCase()))
    : districts;

  const filteredLocations = locationSearch
    ? locations.filter((item) => item.name.toLowerCase().includes(locationSearch.toLowerCase()))
    : locations;

  const selectedCourtTypeLabel = COURT_TYPE_OPTIONS.find((item) => item.value === courtType)?.label || '';

  const loadDistricts = async (state: string) => {
    if (!state) {
      setDistricts([]);
      return;
    }
    setDistrictLoading(true);
    try {
      const { data } = await addressApi.getDistrictsByState(state);
      const list = data?.districts || data?.data?.districts || [];
      setDistricts(Array.isArray(list) ? list : []);
    } catch {
      setDistricts([]);
      Alert.alert('Error', 'Unable to fetch districts for selected state.');
    } finally {
      setDistrictLoading(false);
    }
  };

  const selectState = async (state: string) => {
    setCourtState(state);
    setCourtDistrict('');
    setCourtPincode('');
    setCourtCity('');
    setLocations([]);
    setLastLookupKey('');
    setShowStateModal(false);
    setStateSearch('');
    await loadDistricts(state);
  };

  const selectDistrict = (value: string) => {
    setCourtDistrict(value);
    setCourtPincode('');
    setCourtCity('');
    setLocations([]);
    setLastLookupKey('');
    setShowDistrictModal(false);
    setDistrictSearch('');
  };

  const lookupLocationsByPincode = async (pinFromArgs?: string) => {
    const pin = (pinFromArgs ?? courtPincode).trim();
    if (!/^\d{6}$/.test(pin)) {
      Alert.alert('Error', 'Please enter a valid 6-digit pincode.');
      return;
    }
    if (!courtState || !courtDistrict) {
      Alert.alert('Error', 'Please select state and district before searching pincode.');
      return;
    }

    setLocationLoading(true);
    try {
      const { data } = await addressApi.lookupPincode(pin);
      const postOffices = (data?.postOffices || data?.data?.postOffices || []) as PostOffice[];
      const matches = postOffices.filter(
        (item) =>
          item.state?.toLowerCase() === courtState.toLowerCase() &&
          item.district?.toLowerCase() === courtDistrict.toLowerCase(),
      );

      if (!matches.length) {
        setLocations([]);
        setCourtCity('');
        Alert.alert('No Locations Found', 'No matching location found for selected state, district, and pincode.');
        return;
      }

      setLocations(matches);
      if (matches.length === 1) {
        setCourtCity(matches[0].name);
      } else {
        setCourtCity('');
        setShowLocationModal(true);
      }
      setLastLookupKey(`${courtState}::${courtDistrict}::${pin}`);
    } catch {
      setLocations([]);
      setCourtCity('');
      Alert.alert('Error', 'Failed to fetch locations from pincode.');
    } finally {
      setLocationLoading(false);
    }
  };

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

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data } = await courtAdminApi.getMe();
      const profile = (data?.courtAdmin || data || {}) as CourtAdminProfile;

      setName(profile.name || '');
      const incomingEmail = profile.email || authUser?.email || '';
      setInitialEmail(incomingEmail);
      setEmail(incomingEmail);
      setPhone(profile.phone || '');
      setRegistrationNumber(profile.registrationNumber || '');
      setAvatarUrl(profile.avatarUrl || authUser?.avatar || '');

      setCourtName(profile.court?.name || '');
      setCourtType(profile.court?.type || '');
      setCourtPincode(profile.court?.pincode || '');
      setCourtState(profile.court?.state || '');
      setCourtDistrict(profile.court?.district || '');
      setCourtCity(profile.court?.city || '');
      setCourtAddress(profile.court?.address || '');
      if (profile.court?.state && profile.court?.district && profile.court?.pincode) {
        setLastLookupKey(`${profile.court.state}::${profile.court.district}::${profile.court.pincode}`);
      }
    } catch {
      Alert.alert('Error', 'Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  useEffect(() => {
    const loadStates = async () => {
      const resolved = await loadStateOptions();
      setStates(resolved);
    };
    void loadStates();
  }, []);

  useEffect(() => {
    if (section !== 'court') return;
    if (!courtState) {
      setDistricts([]);
      return;
    }
    void loadDistricts(courtState);
  }, [section, courtState]);

  useEffect(() => {
    if (section !== 'court') return;
    const pin = courtPincode.trim();
    if (pin.length !== 6) {
      setLocations([]);
      setCourtCity('');
      if (pin.length === 0) {
        setLastLookupKey('');
      }
      return;
    }
    if (!courtState || !courtDistrict) return;

    const currentKey = `${courtState}::${courtDistrict}::${pin}`;
    if (currentKey === lastLookupKey || locationLoading) return;

    void lookupLocationsByPincode(pin);
  }, [section, courtPincode, courtState, courtDistrict, lastLookupKey, locationLoading]);

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
      await courtAdminApi.updateMe({ avatarUrl: uploadData.secure_url });
      setAuthUser({ ...(authUser as any), avatar: uploadData.secure_url, avatarUrl: uploadData.secure_url } as any);
      Alert.alert('Success', 'Profile image updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const nextEmail = email.trim().toLowerCase();
    if (section === 'account') {
      if (!name.trim()) {
        Alert.alert('Error', 'Name is required.');
        return;
      }
      if (!nextEmail) {
        Alert.alert('Error', 'Email is required.');
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(nextEmail)) {
        Alert.alert('Error', 'Please enter a valid email address.');
        return;
      }
      if (!phone.trim()) {
        Alert.alert('Error', 'Phone is required.');
        return;
      }
      if (!registrationNumber.trim()) {
        Alert.alert('Error', 'Registration number is required.');
        return;
      }
    }

    if (section === 'court') {
      if (!courtName.trim() || !courtType.trim() || !courtAddress.trim()) {
        Alert.alert('Error', 'Court name, type and address are required.');
        return;
      }
      if (!courtState.trim() || !courtDistrict.trim()) {
        Alert.alert('Error', 'Please select state and district.');
        return;
      }
      if (courtPincode.trim() && !/^\d{6}$/.test(courtPincode.trim())) {
        Alert.alert('Error', 'Court pincode must be 6 digits.');
        return;
      }
      if (!courtCity.trim()) {
        Alert.alert('Error', 'Please choose location from pincode results.');
        return;
      }
    }

    setSaving(true);
    try {
      const emailChanged = nextEmail !== initialEmail.trim().toLowerCase();

      const mePromise =
        section === 'account'
          ? courtAdminApi.updateMe({
              name: name.trim(),
              email: nextEmail,
              phone: phone.trim(),
              registrationNumber: registrationNumber.trim(),
            })
          : Promise.resolve(null as any);

      const courtPromise =
        section === 'court'
          ? courtAdminApi.updateMyCourt({
              name: courtName.trim(),
              type: courtType.trim().toUpperCase(),
              pincode: courtPincode.trim() || undefined,
              state: courtState.trim() || undefined,
              district: courtDistrict.trim() || undefined,
              city: courtCity.trim() || undefined,
              address: courtAddress.trim(),
            })
          : Promise.resolve(null as any);

      const [meRes] = await Promise.all([mePromise, courtPromise]);

      const updated = (meRes?.data?.courtAdmin || meRes?.data) as any;
      if (updated?.name || updated?.avatarUrl || updated?.email) {
        setAuthUser({
          ...(authUser as any),
          name: updated?.name || authUser?.name,
          email: updated?.email || authUser?.email,
          phone: updated?.phone || authUser?.phone,
          emailVerified: typeof updated?.emailVerified === 'boolean' ? updated.emailVerified : (authUser as any)?.emailVerified,
          avatar: updated?.avatarUrl || (authUser as any)?.avatar,
          avatarUrl: updated?.avatarUrl || (authUser as any)?.avatarUrl,
        } as any);
      }

      if (section === 'account' && emailChanged) {
        await authApi.requestOtp(nextEmail);
        Alert.alert('Verify New Email', 'Your email was updated. Please verify the new email with OTP.', [
          {
            text: 'Verify Now',
            onPress: () => navigation.navigate('OtpVerify', { identifier: nextEmail }),
          },
          { text: 'Later', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      Alert.alert('Success', 'Court admin profile updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Update Failed', formatErrorMessage(err) || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{section === 'court' ? 'Edit Court Details' : 'Edit Account Details'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {section === 'account' ? (
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
          ) : null}

          {section === 'account' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Account Details</Text>
              <Input label="Full Name" value={name} onChangeText={setName} icon={<Ionicons name="person-outline" size={20} color={COLORS.textMuted} />} />
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon={<Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />} />
              <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon={<Ionicons name="call-outline" size={20} color={COLORS.textMuted} />} />
              <Input
                label="Registration Number"
                value={registrationNumber}
                onChangeText={setRegistrationNumber}
                autoCapitalize="characters"
                icon={<Ionicons name="id-card-outline" size={20} color={COLORS.textMuted} />}
              />
            </View>
          ) : null}

          {section === 'court' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Court Details</Text>
              <Input label="Court Name" value={courtName} onChangeText={setCourtName} icon={<Ionicons name="business-outline" size={20} color={COLORS.textMuted} />} />

              <Text style={styles.fieldLabel}>Court Type</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowCourtTypeModal(true)}>
                <View style={styles.dropdownLeft}>
                  <Ionicons name="layers-outline" size={20} color={COLORS.textMuted} />
                  <Text style={selectedCourtTypeLabel ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {selectedCourtTypeLabel || 'Select court type'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>State</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setShowStateModal(true)}>
                <View style={styles.dropdownLeft}>
                  <Ionicons name="flag-outline" size={20} color={COLORS.textMuted} />
                  <Text style={courtState ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {courtState || 'Select state'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>District</Text>
              <TouchableOpacity
                style={[styles.dropdown, !courtState && styles.dropdownDisabled]}
                disabled={!courtState}
                onPress={() => setShowDistrictModal(true)}
              >
                <View style={styles.dropdownLeft}>
                  <Ionicons name="location-outline" size={20} color={COLORS.textMuted} />
                  <Text style={courtDistrict ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {courtDistrict || (courtState ? 'Select district' : 'Select state first')}
                  </Text>
                </View>
                {districtLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                )}
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Court Pincode</Text>
              <View style={styles.pincodeRow}>
                <View style={styles.pincodeInputWrap}>
                  <Ionicons name="pin-outline" size={20} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.pincodeInput}
                    placeholder="Enter 6-digit pincode"
                    placeholderTextColor={COLORS.textMuted}
                    value={courtPincode}
                    onChangeText={(value) => {
                      setCourtPincode(value);
                      setCourtCity('');
                      if (value.trim().length < 6) {
                        setLocations([]);
                        setLastLookupKey('');
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.pincodeSearchBtn, locationLoading && styles.pincodeSearchBtnDisabled]}
                  onPress={() => void lookupLocationsByPincode()}
                  disabled={locationLoading}
                >
                  {locationLoading ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Ionicons name="search" size={18} color={COLORS.white} />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Location</Text>
              <TouchableOpacity
                style={[styles.dropdown, !locations.length && styles.dropdownDisabled]}
                disabled={!locations.length}
                onPress={() => setShowLocationModal(true)}
              >
                <View style={styles.dropdownLeft}>
                  <Ionicons name="home-outline" size={20} color={COLORS.textMuted} />
                  <Text style={courtCity ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {courtCity || (locations.length ? 'Choose location' : 'Fetch locations first')}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <Input label="Address" value={courtAddress} onChangeText={setCourtAddress} icon={<Ionicons name="map-outline" size={20} color={COLORS.textMuted} />} />
            </View>
          ) : null}

          <View style={styles.saveRow}>
            <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" />
            <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} size="lg" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {section === 'court' ? (
        <>
          <Modal visible={showCourtTypeModal} transparent animationType="slide" onRequestClose={() => setShowCourtTypeModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Court Type</Text>
                  <TouchableOpacity onPress={() => setShowCourtTypeModal(false)}>
                    <Ionicons name="close" size={22} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={COURT_TYPE_OPTIONS}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.listItem, item.value === courtType && styles.listItemActive]}
                      onPress={() => {
                        setCourtType(item.value);
                        setShowCourtTypeModal(false);
                      }}
                    >
                      <Text style={[styles.listItemText, item.value === courtType && styles.listItemTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>

          <Modal visible={showStateModal} transparent animationType="slide" onRequestClose={() => setShowStateModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select State</Text>
                  <TouchableOpacity onPress={() => setShowStateModal(false)}>
                    <Ionicons name="close" size={22} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search state"
                    placeholderTextColor={COLORS.textMuted}
                    value={stateSearch}
                    onChangeText={setStateSearch}
                  />
                </View>
                <FlatList
                  data={filteredStates}
                  keyExtractor={(item) => item}
                  style={styles.modalList}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={<Text style={styles.emptyText}>No states found</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={[styles.listItem, item === courtState && styles.listItemActive]} onPress={() => void selectState(item)}>
                      <Text style={[styles.listItemText, item === courtState && styles.listItemTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>

          <Modal visible={showDistrictModal} transparent animationType="slide" onRequestClose={() => setShowDistrictModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select District</Text>
                  <TouchableOpacity onPress={() => setShowDistrictModal(false)}>
                    <Ionicons name="close" size={22} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search district"
                    placeholderTextColor={COLORS.textMuted}
                    value={districtSearch}
                    onChangeText={setDistrictSearch}
                  />
                </View>
                <FlatList
                  data={filteredDistricts}
                  keyExtractor={(item) => item}
                  style={styles.modalList}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={<Text style={styles.emptyText}>No districts found</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={[styles.listItem, item === courtDistrict && styles.listItemActive]} onPress={() => selectDistrict(item)}>
                      <Text style={[styles.listItemText, item === courtDistrict && styles.listItemTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>

          <Modal visible={showLocationModal} transparent animationType="slide" onRequestClose={() => setShowLocationModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choose Location</Text>
                  <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                    <Ionicons name="close" size={22} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search location"
                    placeholderTextColor={COLORS.textMuted}
                    value={locationSearch}
                    onChangeText={setLocationSearch}
                  />
                </View>
                <FlatList
                  data={filteredLocations}
                  keyExtractor={(item, idx) => `${item.name}-${idx}`}
                  style={styles.modalList}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={<Text style={styles.emptyText}>No locations found</Text>}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.listItem, item.name === courtCity && styles.listItemActive]}
                      onPress={() => {
                        setCourtCity(item.name);
                        setShowLocationModal(false);
                        setLocationSearch('');
                      }}
                    >
                      <Text style={[styles.listItemText, item.name === courtCity && styles.listItemTextActive]}>{item.name}</Text>
                      <Text style={styles.listSubText}>{item.district}, {item.state}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          </Modal>
        </>
      ) : null}
    </View>
  );
};

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
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
    fieldLabel: {
      fontSize: FONT_SIZE.sm,
      color: COLORS.text,
      fontWeight: '700',
      marginBottom: SPACING.sm,
      marginTop: SPACING.sm,
    },
    dropdown: {
      minHeight: 54,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceAlt,
      paddingHorizontal: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.sm,
    },
    dropdownDisabled: { opacity: 0.55 },
    dropdownLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexShrink: 1 },
    dropdownText: { color: COLORS.text, fontSize: FONT_SIZE.md, fontWeight: '600', flexShrink: 1 },
    dropdownPlaceholder: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, flexShrink: 1 },
    pincodeRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm },
    pincodeInputWrap: {
      flex: 1,
      minHeight: 54,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surfaceAlt,
      paddingHorizontal: SPACING.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    pincodeInput: {
      flex: 1,
      color: COLORS.text,
      fontSize: FONT_SIZE.md,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    },
    pincodeSearchBtn: {
      width: 54,
      height: 54,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pincodeSearchBtnDisabled: { opacity: 0.7 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: COLORS.white,
      borderTopLeftRadius: BORDER_RADIUS.xl,
      borderTopRightRadius: BORDER_RADIUS.xl,
      maxHeight: '80%',
      padding: SPACING.lg,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.md,
      backgroundColor: COLORS.surfaceAlt,
    },
    searchInput: {
      flex: 1,
      color: COLORS.text,
      fontSize: FONT_SIZE.sm,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    },
    modalList: { maxHeight: 380 },
    listItem: {
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      borderRadius: BORDER_RADIUS.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.borderLight,
    },
    listItemActive: { backgroundColor: COLORS.primaryLight + '1A' },
    listItemText: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600' },
    listItemTextActive: { color: COLORS.primary },
    listSubText: { marginTop: 2, color: COLORS.textMuted, fontSize: FONT_SIZE.xs },
    emptyText: { textAlign: 'center', color: COLORS.textMuted, paddingVertical: SPACING.xl },
    saveRow: { paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.lg },
  });

export default EditCourtAdminProfileScreen;

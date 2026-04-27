import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput,
  KeyboardAvoidingView, Platform, FlatList, Modal, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi, addressApi } from '../../services/api';
import { loadStateOptions } from '../../utils/addressOptions';
import { Loading } from '../../components/Common';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

type PostOffice = {
  name: string;
  district: string;
  state: string;
};

const PRACTICE_AREAS = [
  'Criminal Law', 'Civil Law', 'Family Law', 'Corporate Law', 'Tax Law',
  'Labour Law', 'Property Law', 'Intellectual Property', 'Banking Law',
  'Constitutional Law', 'Consumer Protection', 'Environmental Law',
  'Cyber Law', 'Immigration Law', 'Insurance Law', 'Other',
];

export const EditOrgProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [about, setAbout] = useState('');
  const [website, setWebsite] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');

  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [locations, setLocations] = useState<PostOffice[]>([]);

  const [showStateModal, setShowStateModal] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  const [districtLoading, setDistrictLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [lastLookupKey, setLastLookupKey] = useState('');
  const [lastNoMatchKey, setLastNoMatchKey] = useState('');

  useEffect(() => {
    const loadStates = async () => {
      const resolved = await loadStateOptions();
      setStates(resolved);
    };
    void loadStates();
  }, []);

  const loadDistricts = async (stateVal: string) => {
    setDistrictLoading(true);
    try {
      const { data } = await addressApi.getDistrictsByState(stateVal);
      const list = data?.districts || [];
      setDistricts(Array.isArray(list) ? list : []);
    } catch {
      setDistricts([]);
      Alert.alert('Error', 'Unable to fetch districts for selected state.');
    } finally {
      setDistrictLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await organizationsApi.getMine();
        const org = data.organization || data;
        setName(org.name || '');
        setPhone(org.phone || '');
        setAbout(org.about || '');
        setWebsite(org.website || '');
        setRegistrationNumber(org.registrationNumber || '');
        setGstNumber(org.gstNumber || '');
        setPanNumber(org.panNumber || '');
        setConsultationFee(org.consultationFee ? String(org.consultationFee) : '');
        setPracticeAreas(org.practiceAreas || []);
        setCountry(org.country || 'India');
        setState(org.state || '');
        setDistrict(org.district || '');
        setCity(org.city || '');
        setPincode(org.pincode || '');
        setAddress(org.address || '');

        if (org.state) {
          void loadDistricts(org.state);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const selectState = async (stateVal: string) => {
    setState(stateVal);
    setDistrict('');
    setPincode('');
    setCity('');
    setLocations([]);
    setLastNoMatchKey('');
    setShowStateModal(false);
    setStateSearch('');
    await loadDistricts(stateVal);
  };

  const selectDistrict = (value: string) => {
    setDistrict(value);
    setPincode('');
    setCity('');
    setLocations([]);
    setLastLookupKey('');
    setLastNoMatchKey('');
    setShowDistrictModal(false);
    setDistrictSearch('');
  };

  const lookupLocationsByPincode = async (pinFromArgs?: string, manualTrigger = false) => {
    const pin = (pinFromArgs ?? pincode).trim();
    const lookupKey = `${state}::${district}::${pin}`;
    if (!/^\d{6}$/.test(pin)) {
      Alert.alert('Error', 'Please enter a valid 6-digit pincode.');
      return;
    }
    if (!state || !district) {
      Alert.alert('Error', 'Please select state and district before searching pincode.');
      return;
    }

    setLocationLoading(true);
    try {
      const { data } = await addressApi.lookupPincode(pin);
      const postOffices = (data?.postOffices || data?.data?.postOffices || []) as PostOffice[];
      const matches = postOffices.filter(
        (item) =>
          item.state?.toLowerCase() === state.toLowerCase() &&
          item.district?.toLowerCase() === district.toLowerCase(),
      );

      if (!matches.length) {
        setLocations([]);
        setCity('');
        setLastLookupKey(lookupKey);
        if (manualTrigger || lastNoMatchKey !== lookupKey) {
          Alert.alert('No Locations Found', 'No matching location found for selected state, district, and pincode.');
          setLastNoMatchKey(lookupKey);
        }
        return;
      }

      setLocations(matches);
      setLastNoMatchKey('');
      if (matches.length === 1) {
        setCity(matches[0].name);
      } else {
        setCity('');
        setShowLocationModal(true);
      }
      setLastLookupKey(lookupKey);
    } catch {
      setLocations([]);
      setCity('');
      setLastLookupKey(lookupKey);
      Alert.alert('Error', 'Failed to fetch locations from pincode.');
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    const pin = pincode.trim();
    if (pin.length !== 6) {
      setLocations([]);
      if (pin.length === 0) {
        setLastLookupKey('');
      }
      return;
    }
    if (!state || !district) return;

    const currentKey = `${state}::${district}::${pin}`;
    if (currentKey === lastLookupKey || locationLoading) return;

    void lookupLocationsByPincode(pin);
  }, [pincode, state, district, lastLookupKey, locationLoading]);

  const filteredStates = stateSearch
    ? states.filter((item) => item.toLowerCase().includes(stateSearch.toLowerCase()))
    : states;

  const filteredDistricts = districtSearch
    ? districts.filter((item) => item.toLowerCase().includes(districtSearch.toLowerCase()))
    : districts;

  const filteredLocations = locationSearch
    ? locations.filter((item) => item.name.toLowerCase().includes(locationSearch.toLowerCase()))
    : locations;

  const togglePracticeArea = (area: string) => {
    setPracticeAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) return Alert.alert('Required', 'Organization name is required');
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        about: about.trim() || undefined,
        website: website.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
        gstNumber: gstNumber.trim() || undefined,
        panNumber: panNumber.trim() || undefined,
        consultationFee: consultationFee ? parseInt(consultationFee, 10) : undefined,
        practiceAreas: practiceAreas.length > 0 ? practiceAreas : undefined,
        country: country.trim() || undefined,
        state: state.trim() || undefined,
        district: district.trim() || undefined,
        city: city.trim() || undefined,
        pincode: pincode.trim() || undefined,
        address: address.trim() || undefined,
      };
      // Remove undefined values
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
      await organizationsApi.updateMine(payload);
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 20}
    >
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Business Information */}
        <Text style={styles.sectionTitle}>Business Information</Text>
        <View style={styles.card}>
          <Input label="Organization Name" placeholder="Enter name" value={name} onChangeText={setName}
            icon={<Ionicons name="business-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="Phone" placeholder="Phone number" value={phone} onChangeText={setPhone}
            keyboardType="phone-pad" icon={<Ionicons name="call-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="Website" placeholder="https://example.com" value={website} onChangeText={setWebsite}
            keyboardType="url" autoCapitalize="none" icon={<Ionicons name="globe-outline" size={20} color={COLORS.textMuted} />} />
          <View style={styles.textAreaWrapper}>
            <Text style={styles.inputLabel}>About</Text>
            <TextInput style={styles.textArea} placeholder="Describe your organization..."
              value={about} onChangeText={setAbout} multiline numberOfLines={4}
              placeholderTextColor={COLORS.textMuted} textAlignVertical="top" />
          </View>
          <Input label="Consultation Fee (in paise)" placeholder="e.g. 50000 for ₹500"
            value={consultationFee} onChangeText={setConsultationFee} keyboardType="numeric"
            icon={<Ionicons name="cash-outline" size={20} color={COLORS.textMuted} />} />
        </View>

        {/* Legal Documents */}
        <Text style={styles.sectionTitle}>Legal Documents</Text>
        <View style={styles.card}>
          <Input label="Registration Number" placeholder="Firm registration number"
            value={registrationNumber} onChangeText={setRegistrationNumber}
            icon={<Ionicons name="document-text-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="GST Number" placeholder="GST number (optional)"
            value={gstNumber} onChangeText={setGstNumber}
            icon={<Ionicons name="receipt-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="PAN Number" placeholder="PAN number (optional)"
            value={panNumber} onChangeText={setPanNumber} autoCapitalize="characters"
            icon={<Ionicons name="card-outline" size={20} color={COLORS.textMuted} />} />
        </View>

        {/* Practice Areas */}
        <Text style={styles.sectionTitle}>Practice Areas</Text>
        <View style={styles.card}>
          <View style={styles.chipContainer}>
            {PRACTICE_AREAS.map((area) => (
              <TouchableOpacity
                key={area}
                style={[styles.chip, practiceAreas.includes(area) && styles.chipActive]}
                onPress={() => togglePracticeArea(area)}
              >
                <Text style={[styles.chipText, practiceAreas.includes(area) && styles.chipTextActive]}>{area}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location */}
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>State</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowStateModal(true)}>
            <View style={styles.dropdownLeft}>
              <Ionicons name="flag-outline" size={20} color={COLORS.textMuted} />
              <Text style={state ? styles.dropdownText : styles.dropdownPlaceholder}>
                {state || 'Select state'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>District</Text>
          <TouchableOpacity
            style={[styles.dropdown, !state && styles.dropdownDisabled]}
            disabled={!state}
            onPress={() => setShowDistrictModal(true)}
          >
            <View style={styles.dropdownLeft}>
              <Ionicons name="location-outline" size={20} color={COLORS.textMuted} />
              <Text style={district ? styles.dropdownText : styles.dropdownPlaceholder}>
                {district || (state ? 'Select district' : 'Select state first')}
              </Text>
            </View>
            {districtLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>

          <Text style={styles.fieldLabel}>Pincode</Text>
          <View style={styles.pincodeRow}>
            <View style={styles.pincodeInputWrap}>
              <Ionicons name="location-outline" size={20} color={COLORS.textMuted} />
              <TextInput
                style={styles.pincodeInput}
                placeholder="Enter 6-digit pincode"
                placeholderTextColor={COLORS.textMuted}
                value={pincode}
                onChangeText={(value) => {
                  setPincode(value);
                  setCity('');
                  setLastLookupKey('');
                  setLastNoMatchKey('');
                  if (value.trim().length < 6) {
                    setLocations([]);
                  }
                }}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <TouchableOpacity
              style={[styles.pincodeSearchBtn, locationLoading && styles.pincodeSearchBtnDisabled]}
              onPress={() => void lookupLocationsByPincode(undefined, true)}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="search" size={18} color={COLORS.white} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>City / Location</Text>
          <TouchableOpacity
            style={[styles.dropdown, !locations.length && styles.dropdownDisabled]}
            disabled={!locations.length}
            onPress={() => setShowLocationModal(true)}
          >
            <View style={styles.dropdownLeft}>
              <Ionicons name="home-outline" size={20} color={COLORS.textMuted} />
              <Text style={city ? styles.dropdownText : styles.dropdownPlaceholder}>
                {city || (locations.length ? 'Choose location' : 'Fetch locations first')}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.textAreaWrapper}>
            <Text style={styles.inputLabel}>Address Details</Text>
            <TextInput style={styles.textArea} placeholder="Full address..."
              value={address} onChangeText={setAddress} multiline numberOfLines={3}
              placeholderTextColor={COLORS.textMuted} textAlignVertical="top" />
          </View>
        </View>

        <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" style={{ marginTop: SPACING.md }} />
      </ScrollView>

      <Modal visible={showStateModal} transparent animationType="slide" onRequestClose={() => setShowStateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowStateModal(false)}>
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
              contentContainerStyle={styles.modalListContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>No states found</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.listItem, item === state && styles.listItemActive]} onPress={() => void selectState(item)}>
                  <Text style={[styles.listItemText, item === state && styles.listItemTextActive]}>{item}</Text>
                  {item === state ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
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
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDistrictModal(false)}>
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
              contentContainerStyle={styles.modalListContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>No districts found</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.listItem, item === district && styles.listItemActive]} onPress={() => selectDistrict(item)}>
                  <Text style={[styles.listItemText, item === district && styles.listItemTextActive]}>{item}</Text>
                  {item === district ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
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
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowLocationModal(false)}>
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
              keyExtractor={(item) => `${item.name}-${item.district}-${item.state}`}
              style={styles.modalList}
              contentContainerStyle={styles.modalListContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyText}>No locations found</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.listItem, item.name === city && styles.listItemActive]}
                  onPress={() => {
                    setCity(item.name);
                    setShowLocationModal(false);
                    setLocationSearch('');
                  }}
                >
                  <Text style={[styles.listItemText, item.name === city && styles.listItemTextActive]}>{item.name}</Text>
                  {item.name === city ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm, zIndex: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  scrollContent: { padding: SPACING.xl, paddingBottom: 120 },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.md, marginTop: SPACING.lg },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    ...SHADOWS.sm, marginBottom: SPACING.md,
  },
  inputLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  textAreaWrapper: { marginBottom: SPACING.md },
  textArea: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, minHeight: 80,
  },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: COLORS.white },
  fieldLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.xl,
    minHeight: 56,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    marginRight: SPACING.sm,
  },
  dropdownText: { color: COLORS.text, fontSize: FONT_SIZE.md, flexShrink: 1 },
  dropdownPlaceholder: { color: COLORS.textMuted, fontSize: FONT_SIZE.md, flexShrink: 1 },
  dropdownDisabled: { opacity: 0.6 },
  pincodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  pincodeInputWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 52,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pincodeInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    minHeight: 44,
  },
  pincodeSearchBtn: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  pincodeSearchBtnDisabled: {
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    minHeight: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalCloseBtn: {
    padding: SPACING.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    margin: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
  },
  modalList: {
    flex: 1,
  },
  modalListContent: {
    padding: SPACING.lg,
    paddingTop: 0,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
    marginTop: SPACING.xl,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  listItemActive: {
    backgroundColor: 'rgba(59,130,246,0.05)',
  },
  listItemText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    flex: 1,
  },
  listItemTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

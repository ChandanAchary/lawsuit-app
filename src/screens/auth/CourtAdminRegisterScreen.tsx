import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../stores/authStore';
import { addressApi } from '../../services/api';
import { loadStateOptions } from '../../utils/addressOptions';

type Step = 'info' | 'password';

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

export const CourtAdminRegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const { setMode: setThemeMode } = useThemeStore();
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [courtName, setCourtName] = useState('');
  const [courtType, setCourtType] = useState(COURT_TYPE_OPTIONS[2].value);
  const [courtAddress, setCourtAddress] = useState('');
  const [stateName, setStateName] = useState('');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');
  const [locationName, setLocationName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

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
  const [courtTypeSearch, setCourtTypeSearch] = useState('');

  const [districtLoading, setDistrictLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [lastLookupKey, setLastLookupKey] = useState('');
  const [lastNoMatchKey, setLastNoMatchKey] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { register, isLoading, clearError } = useAuthStore();

  const handleThemeToggle = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  useEffect(() => {
    const loadStates = async () => {
      const resolved = await loadStateOptions();
      setStates(resolved);
    };
    void loadStates();
  }, []);

  const selectedCourtTypeLabel = COURT_TYPE_OPTIONS.find((item) => item.value === courtType)?.label || '';

  const filteredStates = stateSearch
    ? states.filter((item) => item.toLowerCase().includes(stateSearch.toLowerCase()))
    : states;

  const filteredDistricts = districtSearch
    ? districts.filter((item) => item.toLowerCase().includes(districtSearch.toLowerCase()))
    : districts;

  const filteredLocations = locationSearch
    ? locations.filter((item) => item.name.toLowerCase().includes(locationSearch.toLowerCase()))
    : locations;

  const filteredCourtTypes = courtTypeSearch
    ? COURT_TYPE_OPTIONS.filter((item) => item.label.toLowerCase().includes(courtTypeSearch.toLowerCase()))
    : COURT_TYPE_OPTIONS;

  const loadDistricts = async (state: string) => {
    setDistrictLoading(true);
    try {
      const { data } = await addressApi.getDistrictsByState(state);
      const list = data?.districts || [];
      setDistricts(Array.isArray(list) ? list : []);
    } catch {
      setDistricts([]);
      Alert.alert('Error', 'Unable to fetch districts for selected state.');
    } finally {
      setDistrictLoading(false);
    }
  };

  const selectState = async (state: string) => {
    setStateName(state);
    setDistrict('');
    setPincode('');
    setLocationName('');
    setLocations([]);
    setLastNoMatchKey('');
    setShowStateModal(false);
    setStateSearch('');
    await loadDistricts(state);
  };

  const selectDistrict = (value: string) => {
    setDistrict(value);
    setPincode('');
    setLocationName('');
    setLocations([]);
    setLastLookupKey('');
    setLastNoMatchKey('');
    setShowDistrictModal(false);
    setDistrictSearch('');
  };

  const lookupLocationsByPincode = async (pinFromArgs?: string, manualTrigger = false) => {
    const pin = (pinFromArgs ?? pincode).trim();
    const lookupKey = `${stateName}::${district}::${pin}`;
    if (!/^\d{6}$/.test(pin)) {
      Alert.alert('Error', 'Please enter a valid 6-digit pincode.');
      return;
    }
    if (!stateName || !district) {
      Alert.alert('Error', 'Please select state and district before searching pincode.');
      return;
    }

    setLocationLoading(true);
    try {
      const { data } = await addressApi.lookupPincode(pin);
      const postOffices = (data?.postOffices || data?.data?.postOffices || []) as PostOffice[];
      const matches = postOffices.filter(
        (item) =>
          item.state?.toLowerCase() === stateName.toLowerCase() &&
          item.district?.toLowerCase() === district.toLowerCase(),
      );

      if (!matches.length) {
        setLocations([]);
        setLocationName('');
        // Mark this key as handled so auto-lookup doesn't keep alerting in a loop.
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
        setLocationName(matches[0].name);
      } else {
        setLocationName('');
        setShowLocationModal(true);
      }
      setLastLookupKey(lookupKey);
    } catch {
      setLocations([]);
      setLocationName('');
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
      setLocationName('');
      if (pin.length === 0) {
        setLastLookupKey('');
      }
      return;
    }
    if (!stateName || !district) return;

    const currentKey = `${stateName}::${district}::${pin}`;
    if (currentKey === lastLookupKey || locationLoading) return;

    void lookupLocationsByPincode(pin);
  }, [pincode, stateName, district, lastLookupKey, locationLoading]);

  const nextStep = () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please fill name, email, and phone.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    if (!selectedCourtTypeLabel) {
      Alert.alert('Error', 'Please select court type.');
      return;
    }

    if (!stateName) {
      Alert.alert('Error', 'Please select state.');
      return;
    }

    if (!district) {
      Alert.alert('Error', 'Please select district.');
      return;
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      Alert.alert('Error', 'Please enter a valid 6-digit court pincode.');
      return;
    }

    if (!locationName) {
      Alert.alert('Error', 'Please choose location from the pincode results.');
      return;
    }

    if (!courtName.trim() || !courtAddress.trim()) {
      Alert.alert('Error', 'Please enter court name and court address.');
      return;
    }

    if (!registrationNumber.trim()) {
      Alert.alert('Error', 'Please enter your court registration number.');
      return;
    }

    setStep('password');
  };

  const submit = async () => {
    if (!password || password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    clearError();
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role: 'COURT_ADMIN',
        courtDetails: {
          name: courtName.trim(),
          type: courtType.trim().toUpperCase(),
          address: `${courtAddress.trim()}, ${locationName}, ${district}, ${stateName} - ${pincode.trim()}`,
          pincode: pincode.trim(),
          state: stateName.trim(),
          district: district.trim(),
          city: locationName.trim() || undefined,
        },
        registrationNumber: registrationNumber.trim(),
      });

      navigation.navigate('OtpVerify', { identifier: email.trim() });
    } catch (err: any) {
      Alert.alert('Registration Failed', err?.response?.data?.error || 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.themeBtn} onPress={handleThemeToggle}>
          <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={COLORS.white} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={36} color={COLORS.accent} />
          </View>
          <Text style={styles.title}>Court Admin Registration</Text>
          <Text style={styles.subtitle}>Register by entering your court identification details</Text>
        </View>

        {step === 'info' ? (
          <View style={styles.card}>
            <Input
              label="Full Name"
              placeholder="Enter full name"
              value={name}
              onChangeText={setName}
              icon={<Ionicons name="person-outline" size={20} color={COLORS.textMuted} />}
            />
            <Input
              label="Email"
              placeholder="Enter email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              icon={<Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />}
            />
            <Input
              label="Phone"
              placeholder="Enter phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon={<Ionicons name="call-outline" size={20} color={COLORS.textMuted} />}
            />
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

            <Input
              label="Court Name"
              placeholder="e.g. District Court Bhubaneswar"
              value={courtName}
              onChangeText={setCourtName}
              icon={<Ionicons name="business-outline" size={20} color={COLORS.textMuted} />}
            />

            <Text style={styles.fieldLabel}>State</Text>
            <TouchableOpacity style={styles.dropdown} onPress={() => setShowStateModal(true)}>
              <View style={styles.dropdownLeft}>
                <Ionicons name="flag-outline" size={20} color={COLORS.textMuted} />
                <Text style={stateName ? styles.dropdownText : styles.dropdownPlaceholder}>
                  {stateName || 'Select state'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>District</Text>
            <TouchableOpacity
              style={[styles.dropdown, !stateName && styles.dropdownDisabled]}
              disabled={!stateName}
              onPress={() => setShowDistrictModal(true)}
            >
              <View style={styles.dropdownLeft}>
                <Ionicons name="location-outline" size={20} color={COLORS.textMuted} />
                <Text style={district ? styles.dropdownText : styles.dropdownPlaceholder}>
                  {district || (stateName ? 'Select district' : 'Select state first')}
                </Text>
              </View>
              {districtLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              )}
            </TouchableOpacity>

            <Input
              label="Court Address"
              placeholder="Enter full court address"
              value={courtAddress}
              onChangeText={setCourtAddress}
              icon={<Ionicons name="map-outline" size={20} color={COLORS.textMuted} />}
            />
            <Text style={styles.fieldLabel}>Court Pincode</Text>
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
                    setLocationName('');
                    // Re-enable warning when user edits pincode and force a fresh lookup cycle.
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

            <Text style={styles.fieldLabel}>Location</Text>
            <TouchableOpacity
              style={[styles.dropdown, !locations.length && styles.dropdownDisabled]}
              disabled={!locations.length}
              onPress={() => setShowLocationModal(true)}
            >
              <View style={styles.dropdownLeft}>
                <Ionicons name="home-outline" size={20} color={COLORS.textMuted} />
                <Text style={locationName ? styles.dropdownText : styles.dropdownPlaceholder}>
                  {locationName || (locations.length ? 'Choose location' : 'Fetch locations first')}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <Input
              label="Court Registration Number"
              placeholder="Enter registration number"
              value={registrationNumber}
              onChangeText={setRegistrationNumber}
              autoCapitalize="characters"
              icon={<Ionicons name="card-outline" size={20} color={COLORS.textMuted} />}
            />

            <Button title="Continue" onPress={nextStep} size="lg" />

            <TouchableOpacity style={styles.loginCta} onPress={() => navigation.navigate('CourtAdminLogin')}>
              <Text style={styles.loginCtaText}>Already have a court admin account? Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Input
              label="Password"
              placeholder="Create password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              }
            />
            <Input
              label="Confirm Password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowConfirmPassword((v) => !v)}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              }
            />

            <Button title="Register Court Admin" onPress={submit} loading={isLoading} size="lg" />
            <Button title="Back" onPress={() => setStep('info')} variant="ghost" size="md" />
          </View>
        )}

        <Modal visible={showCourtTypeModal} transparent animationType="slide" onRequestClose={() => setShowCourtTypeModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Court Type</Text>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowCourtTypeModal(false)}>
                  <Ionicons name="close" size={22} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search court type"
                  placeholderTextColor={COLORS.textMuted}
                  value={courtTypeSearch}
                  onChangeText={setCourtTypeSearch}
                />
              </View>
              <FlatList
                data={filteredCourtTypes}
                keyExtractor={(item) => item.value}
                style={styles.modalList}
                contentContainerStyle={styles.modalListContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.emptyText}>No court types found</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.listItem, item.value === courtType && styles.listItemActive]}
                    onPress={() => {
                      setCourtType(item.value);
                      setShowCourtTypeModal(false);
                      setCourtTypeSearch('');
                    }}
                  >
                    <Text style={[styles.listItemText, item.value === courtType && styles.listItemTextActive]}>{item.label}</Text>
                    {item.value === courtType ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
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
                  <TouchableOpacity style={[styles.listItem, item === stateName && styles.listItemActive]} onPress={() => void selectState(item)}>
                    <Text style={[styles.listItemText, item === stateName && styles.listItemTextActive]}>{item}</Text>
                    {item === stateName ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
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
                    style={[styles.listItem, item.name === locationName && styles.listItemActive]}
                    onPress={() => {
                      setLocationName(item.name);
                      setShowLocationModal(false);
                      setLocationSearch('');
                    }}
                  >
                    <Text style={[styles.listItemText, item.name === locationName && styles.listItemTextActive]}>{item.name}</Text>
                    {item.name === locationName ? <Ionicons name="checkmark" size={18} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.primaryDark },
    scroll: { paddingBottom: SPACING.xxxl },
    backBtn: {
      marginTop: SPACING.huge,
      marginLeft: SPACING.xl,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeBtn: {
      position: 'absolute',
      top: SPACING.huge,
      right: SPACING.xl,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    header: {
      alignItems: 'center',
      marginTop: SPACING.xl,
      marginBottom: SPACING.xl,
      paddingHorizontal: SPACING.xl,
    },
    iconWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    title: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.white, textAlign: 'center' },
    subtitle: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.75)', marginTop: SPACING.xs, textAlign: 'center' },
    card: {
      marginHorizontal: SPACING.xl,
      backgroundColor: COLORS.background,
      borderRadius: BORDER_RADIUS.xxl,
      padding: SPACING.xl,
      ...SHADOWS.md,
    },
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
      borderBottomLeftRadius: BORDER_RADIUS.xxl,
      borderBottomRightRadius: BORDER_RADIUS.xxl,
      maxHeight: '68%',
      minHeight: '44%',
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.md,
      overflow: 'hidden',
      marginHorizontal: SPACING.xs,
      marginBottom: SPACING.xs,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: SPACING.md,
      paddingHorizontal: SPACING.lg,
    },
    modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBox: {
      borderWidth: 1,
      borderColor: COLORS.borderLight,
      borderRadius: BORDER_RADIUS.xl,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      marginBottom: SPACING.md,
      backgroundColor: COLORS.surfaceAlt,
      marginHorizontal: SPACING.lg,
    },
    searchInput: {
      flex: 1,
      minHeight: 54,
      color: COLORS.text,
      marginLeft: SPACING.sm,
      fontSize: FONT_SIZE.md,
    },
    modalList: {
      minHeight: 220,
      paddingHorizontal: SPACING.lg,
    },
    modalListContent: {
      paddingBottom: SPACING.xl,
      flexGrow: 1,
    },
    emptyText: {
      textAlign: 'center',
      color: COLORS.textMuted,
      marginTop: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.borderLight,
      backgroundColor: COLORS.white,
    },
    listItemActive: {
      backgroundColor: COLORS.primaryLight + '16',
    },
    listItemText: { color: COLORS.text, fontSize: FONT_SIZE.lg, fontWeight: '500' },
    listItemTextActive: { color: COLORS.primary },
    loginCta: { marginTop: SPACING.md, alignItems: 'center' },
    loginCtaText: { color: COLORS.primary, fontWeight: '700', fontSize: FONT_SIZE.sm },
  });

export default CourtAdminRegisterScreen;

import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { Loading } from '../../components/Common';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

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
      } catch {}
      setLoading(false);
    })();
  }, []);

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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          <Input label="Pincode" placeholder="6-digit pincode" value={pincode} onChangeText={setPincode}
            keyboardType="numeric" maxLength={6}
            icon={<Ionicons name="location-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="State" placeholder="State" value={state} onChangeText={setState}
            icon={<Ionicons name="map-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="District" placeholder="District" value={district} onChangeText={setDistrict}
            icon={<Ionicons name="navigate-outline" size={20} color={COLORS.textMuted} />} />
          <Input label="City" placeholder="City" value={city} onChangeText={setCity}
            icon={<Ionicons name="home-outline" size={20} color={COLORS.textMuted} />} />
          <View style={styles.textAreaWrapper}>
            <Text style={styles.inputLabel}>Address</Text>
            <TextInput style={styles.textArea} placeholder="Full address..."
              value={address} onChangeText={setAddress} multiline numberOfLines={3}
              placeholderTextColor={COLORS.textMuted} textAlignVertical="top" />
          </View>
        </View>

        <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" style={{ marginTop: SPACING.md }} />
      </ScrollView>
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
});

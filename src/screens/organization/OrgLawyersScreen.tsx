import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal,
  TextInput, Alert, Image, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

const SPECIALIZATIONS = [
  'Criminal Law', 'Civil Law', 'Family Law', 'Corporate Law', 'Tax Law',
  'Labour Law', 'Property Law', 'Intellectual Property', 'Banking Law',
  'Constitutional Law', 'Consumer Protection', 'Cyber Law', 'Other',
];

export const OrgLawyersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [lawyers, setLawyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Lawyer Modal
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [barCouncilId, setBarCouncilId] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [feePerConsultation, setFeePerConsultation] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [adding, setAdding] = useState(false);

  const [org, setOrg] = useState<any>(null);

  const fetchLawyers = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [lawyersRes, orgRes] = await Promise.all([
        organizationsApi.listLawyers(),
        organizationsApi.getMine(),
      ]);
      setLawyers(lawyersRes.data.lawyers || lawyersRes.data.items || lawyersRes.data || []);
      setOrg(orgRes.data.organization || orgRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchLawyers(); }, []);

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setPassword('');
    setLicenseNumber(''); setBarCouncilId(''); setSpecializations([]);
    setFeePerConsultation(''); setPincode(''); setCity(''); setState('');
    setBio(''); setExperienceYears('');
  };

  const toggleSpecialization = (spec: string) => {
    setSpecializations((prev) =>
      prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]
    );
  };

  const handleAddPress = () => {
    const isVerified = org?.isVerified === true || org?.verificationStatus === 'APPROVED';
    if (!isVerified) {
      Alert.alert('Verification Required', 'Your organization must be verified by a Court Admin before you can add lawyers.');
      return;
    }
    setShowAdd(true);
  };

  const handleAddLawyer = async () => {
    if (!name.trim() || !email.trim()) return Alert.alert('Required', 'Name and email are required');
    if (!password || password.length < 8) return Alert.alert('Required', 'Password must be at least 8 characters');
    setAdding(true);
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      };
      if (licenseNumber.trim()) payload.licenseNumber = licenseNumber.trim();
      if (barCouncilId.trim()) payload.barCouncilId = barCouncilId.trim();
      if (specializations.length > 0) payload.specializations = specializations;
      if (feePerConsultation) payload.feePerConsultation = parseInt(feePerConsultation, 10) * 100;
      if (pincode.trim()) payload.pincode = pincode.trim();
      if (city.trim()) payload.city = city.trim();
      if (state.trim()) payload.state = state.trim();
      if (bio.trim()) payload.bio = bio.trim();
      if (experienceYears) payload.experienceYears = parseInt(experienceYears, 10);

      await organizationsApi.createLawyer(payload);
      setShowAdd(false);
      resetForm();
      Alert.alert('Success', 'Lawyer added successfully. An OTP has been sent to their email for verification.');
      fetchLawyers(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to add lawyer');
    } finally { setAdding(false); }
  };

  const renderLawyer = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {/* Salary entry — opens the org-side salary management surface for
            this lawyer. Visible only after the org is verified, since the
            backend rejects salary writes before then. */}
        <View style={styles.avatar}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="person" size={20} color={COLORS.primary} />
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardEmail}>{item.email}</Text>
        </View>
        <View style={styles.badgeRow}>
          {item.isVerified && (
            <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
              <Text style={[styles.statusText, { color: '#10B981' }]}>Verified</Text>
            </View>
          )}
          {!item.isVerified && (
            <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.statusText, { color: '#D97706' }]}>Pending</Text>
            </View>
          )}
        </View>
      </View>
      {/* Details Row */}
      <View style={styles.detailsRow}>
        {item.specializations?.length > 0 && (
          <View style={styles.detailChips}>
            {item.specializations.slice(0, 3).map((s: string, i: number) => (
              <View key={i} style={styles.specChip}>
                <Text style={styles.specChipText}>{s}</Text>
              </View>
            ))}
            {item.specializations.length > 3 && (
              <Text style={styles.moreText}>+{item.specializations.length - 3}</Text>
            )}
          </View>
        )}
        <View style={styles.metaRow}>
          {item.experienceYears != null && (
            <Text style={styles.metaText}>📅 {item.experienceYears} yrs</Text>
          )}
          {item.feePerConsultation != null && (
            <Text style={styles.metaText}>💰 ₹{Math.round(item.feePerConsultation / 100)}</Text>
          )}
          {item.rating != null && item.rating > 0 && (
            <Text style={styles.metaText}>⭐ {item.rating.toFixed(1)}</Text>
          )}
        </View>
      </View>
      {item.phone && <Text style={styles.phoneText}>📞 {item.phone}</Text>}

      {/* Salary management — only enabled once the org is verified. The
          backend route refuses earlier anyway, so we surface a helpful
          disabled state instead of a 403 mid-flow. */}
      <TouchableOpacity
        style={[styles.salaryBtn, !((org?.isVerified === true) || org?.verificationStatus === 'APPROVED') && styles.salaryBtnDisabled]}
        onPress={() => {
          const isVerified = org?.isVerified === true || org?.verificationStatus === 'APPROVED';
          if (!isVerified) {
            Alert.alert('Verification Required', 'Your organisation must be verified before you can manage lawyer salaries.');
            return;
          }
          navigation.navigate('OrgLawyerSalary', { lawyerId: item.id, name: item.name });
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
        <Text style={styles.salaryBtnText}>Salary & payouts</Text>
        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Lawyers</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddPress}>
          <Ionicons name="add" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={lawyers}
          keyExtractor={(l) => l.id}
          renderItem={renderLawyer}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLawyers(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="👥" title="No Lawyers" message="Add lawyers to your organization" />}
        />
      )}

      {/* Add Lawyer Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Lawyer</Text>
              <TouchableOpacity onPress={() => { setShowAdd(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Required Fields */}
              <Text style={styles.fieldGroupTitle}>Required Information</Text>
              <Input label="Full Name" placeholder="Lawyer's full name" value={name} onChangeText={setName}
                icon={<Ionicons name="person-outline" size={18} color={COLORS.textMuted} />} />
              <Input label="Email" placeholder="Email address" value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none"
                icon={<Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />} />
              <Input label="Phone" placeholder="Phone number" value={phone} onChangeText={setPhone}
                keyboardType="phone-pad"
                icon={<Ionicons name="call-outline" size={18} color={COLORS.textMuted} />} />
              <Input label="Password (min 8 chars)" placeholder="Set initial password" value={password}
                onChangeText={setPassword} secureTextEntry={!showPassword}
                icon={<Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                }
              />

              {/* Optional Fields */}
              <Text style={styles.fieldGroupTitle}>Professional Details (Optional)</Text>
              <Input label="License Number" placeholder="Lawyer license number" value={licenseNumber}
                onChangeText={setLicenseNumber}
                icon={<Ionicons name="document-text-outline" size={18} color={COLORS.textMuted} />} />
              <Input label="Bar Council ID" placeholder="Bar council registration" value={barCouncilId}
                onChangeText={setBarCouncilId}
                icon={<Ionicons name="shield-outline" size={18} color={COLORS.textMuted} />} />
              <Input label="Experience (years)" placeholder="Years of experience" value={experienceYears}
                onChangeText={setExperienceYears} keyboardType="numeric"
                icon={<Ionicons name="time-outline" size={18} color={COLORS.textMuted} />} />
              <Input label="Fee per Consultation (₹)" placeholder="Consultation fee" value={feePerConsultation}
                onChangeText={setFeePerConsultation} keyboardType="numeric"
                icon={<Ionicons name="cash-outline" size={18} color={COLORS.textMuted} />} />

              {/* Specializations */}
              <Text style={styles.fieldGroupTitle}>Specializations</Text>
              <View style={styles.specContainer}>
                {SPECIALIZATIONS.map((spec) => (
                  <TouchableOpacity
                    key={spec}
                    style={[styles.specChipSelect, specializations.includes(spec) && styles.specChipSelectActive]}
                    onPress={() => toggleSpecialization(spec)}
                  >
                    <Text style={[styles.specChipSelectText, specializations.includes(spec) && styles.specChipSelectTextActive]}>{spec}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Location */}
              <Text style={styles.fieldGroupTitle}>Location (Optional)</Text>
              <Input label="Pincode" placeholder="6-digit pincode" value={pincode}
                onChangeText={setPincode} keyboardType="numeric" maxLength={6}
                icon={<Ionicons name="location-outline" size={18} color={COLORS.textMuted} />} />
              <Input label="City" placeholder="City" value={city} onChangeText={setCity}
                icon={<Ionicons name="home-outline" size={18} color={COLORS.textMuted} />} />
              <Input label="State" placeholder="State" value={state} onChangeText={setState}
                icon={<Ionicons name="map-outline" size={18} color={COLORS.textMuted} />} />

              {/* Bio */}
              <View style={styles.bioWrapper}>
                <Text style={styles.bioLabel}>Bio (Optional)</Text>
                <TextInput style={styles.bioInput} placeholder="Brief bio..." value={bio}
                  onChangeText={setBio} multiline numberOfLines={3}
                  placeholderTextColor={COLORS.textMuted} textAlignVertical="top" />
              </View>

              <Button title="Add Lawyer" onPress={handleAddLawyer} loading={adding} size="lg" style={{ marginBottom: SPACING.xxl }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, marginLeft: SPACING.md, fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight + '20', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  cardInfo: { flex: 1, marginLeft: SPACING.md },
  cardName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  cardEmail: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: SPACING.xs },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  statusText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  detailsRow: {
    marginTop: SPACING.md, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  detailChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  specChip: {
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary + '10',
  },
  specChipText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '600' },
  moreText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: '600', alignSelf: 'center' },
  metaRow: { flexDirection: 'row', gap: SPACING.lg },
  metaText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  phoneText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.sm },
  salaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary + '0E',
  },
  salaryBtnDisabled: { opacity: 0.45 },
  salaryBtnText: { flex: 1, fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.primary },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: SPACING.xl, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  modalBody: { padding: SPACING.xl, paddingBottom: SPACING.xxl },
  fieldGroupTitle: {
    fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text,
    marginTop: SPACING.md, marginBottom: SPACING.sm,
  },
  specContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  specChipSelect: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  specChipSelectActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  specChipSelectText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, fontWeight: '600' },
  specChipSelectTextActive: { color: COLORS.white },
  bioWrapper: { marginBottom: SPACING.lg },
  bioLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  bioInput: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, minHeight: 70,
  },
});

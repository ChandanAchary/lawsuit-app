import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, CASTE_OPTIONS, GENDER_OPTIONS } from '../../constants';
import { teleLawApi } from '../../services/api';
import { loadStateOptions } from '../../utils/addressOptions';

export const TeleLawScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [income, setIncome] = useState('');
  const [caste, setCaste] = useState('');
  const [gender, setGender] = useState('');
  const [stateName, setStateName] = useState('');
  const [useProfile, setUseProfile] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [activePicker, setActivePicker] = useState<'caste' | 'gender' | 'state' | null>(null);
  const [stateSearch, setStateSearch] = useState('');

  const normalizeStringOptions = (input: unknown): string[] => {
    if (!Array.isArray(input)) return [];
    const normalized = input
      .map((item: any) => (typeof item === 'string' ? item : item?.name || item?.label || ''))
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0);
    return [...new Set(normalized)];
  };

  const resolveCasteOptions = (): string[] => {
    const infoOptions = normalizeStringOptions(
      info?.casteOptions || info?.castes || info?.categories?.castes || info?.options?.castes,
    );
    if (infoOptions.length > 0) return infoOptions;
    return [...CASTE_OPTIONS];
  };

  const resolveGenderOptions = (): string[] => {
    const infoOptions = normalizeStringOptions(
      info?.genderOptions || info?.genders || info?.categories?.genders || info?.options?.genders,
    );
    if (infoOptions.length > 0) return infoOptions;
    return [...GENDER_OPTIONS].filter((option) => option !== 'PREFER NOT TO SAY');
  };

  const resolveStateOptions = (): string[] => {
    const infoOptions = normalizeStringOptions(
      info?.stateOptions || info?.states || info?.categories?.states || info?.options?.states,
    );
    if (infoOptions.length > 0) return infoOptions;
    return stateOptions;
  };

  const casteOptions = resolveCasteOptions();
  const genderOptions = resolveGenderOptions();
  const availableStateOptions = resolveStateOptions();

  const pickerTitle =
    activePicker === 'caste' ? 'Select Caste Category' :
    activePicker === 'gender' ? 'Select Gender' :
    activePicker === 'state' ? 'Select State' : '';

  const pickerOptions =
    activePicker === 'caste' ? casteOptions :
    activePicker === 'gender' ? genderOptions :
    activePicker === 'state' ? availableStateOptions : [];

  const filteredPickerOptions =
    activePicker === 'state' && stateSearch.trim().length > 0
      ? pickerOptions.filter((item) => item.toLowerCase().includes(stateSearch.trim().toLowerCase()))
      : pickerOptions;

  const selectedPickerValue =
    activePicker === 'caste' ? caste :
    activePicker === 'gender' ? gender :
    activePicker === 'state' ? stateName : '';

  useEffect(() => {
    fetchInfo();
  }, []);

  useEffect(() => {
    void loadStateOptions().then((resolved) => setStateOptions(resolved)).catch(() => setStateOptions([]));
  }, []);

  const fetchInfo = async () => {
    try {
      setLoading(true);
      const res = await teleLawApi.getInfo();
      setInfo(res.data?.data || res.data);
    } catch (err: any) {
      console.log('Failed to fetch tele-law info');
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    try {
      setChecking(true);
      const res = await teleLawApi.checkEligibility({
        income: income ? Number(income) : undefined,
        caste: caste || undefined,
        gender: gender || undefined,
        state: stateName || undefined,
        useProfile,
      });
      setEligibilityResult(res.data?.data || res.data);
    } catch (err: any) {
      console.log('Failed to check eligibility');
      Alert.alert('Error', err.response?.data?.error || 'Failed to check eligibility');
    } finally {
      setChecking(false);
    }
  };

  const selectPickerOption = (value: string) => {
    if (activePicker === 'caste') setCaste(value);
    if (activePicker === 'gender') setGender(value);
    if (activePicker === 'state') setStateName(value);
    setStateSearch('');
    setActivePicker(null);
  };

  if (loading && !info) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.primary, COLORS.midnight]} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="scale" size={32} color={COLORS.accent} />
          <Text style={styles.headerTitle}>Tele-Law</Text>
          <Text style={styles.headerSub}>Free Legal Aid & Advice</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll}>
        {info && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{info.title || 'About Tele-Law Scheme'}</Text>
            <Text style={styles.description}>{info.description || 'Provides free legal assistance.'}</Text>
            
            {(info.eligibleCategories || []).length > 0 && (
              <View style={styles.categoriesSection}>
                <Text style={styles.categoriesTitle}>Auto-Eligible Categories:</Text>
                {info.eligibleCategories.map((cat: string, i: number) => (
                  <Text key={i} style={styles.categoryItem}>• {cat}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Check Eligibility</Text>
          <Text style={styles.description}>Find out if you qualify for free legal aid.</Text>
          
          <TouchableOpacity 
            style={styles.checkboxContainer} 
            onPress={() => setUseProfile(!useProfile)}
          >
            <Ionicons name={useProfile ? "checkbox" : "square-outline"} size={22} color={COLORS.primary} />
            <Text style={styles.checkboxLabel}>Use my profile data</Text>
          </TouchableOpacity>

          {!useProfile && (
            <>
              <Text style={styles.inputLabel}>Annual Income (₹)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 50000"
                keyboardType="numeric"
                value={income}
                onChangeText={setIncome}
              />
              
              <Text style={styles.inputLabel}>Caste Category</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setActivePicker('caste')}>
                <Text style={caste ? styles.dropdownText : styles.dropdownPlaceholder}>
                  {caste || 'Select caste category'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Gender</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setActivePicker('gender')}>
                <Text style={gender ? styles.dropdownText : styles.dropdownPlaceholder}>
                  {gender || 'Select gender'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>State</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setActivePicker('state')}>
                <Text style={stateName ? styles.dropdownText : styles.dropdownPlaceholder}>
                  {stateName || 'Select state'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleCheck} disabled={checking}>
            {checking ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>Check Now</Text>}
          </TouchableOpacity>

          {eligibilityResult && (
            <View style={[styles.resultContainer, { backgroundColor: eligibilityResult.eligible ? '#D1FAE5' : '#FEE2E2' }]}>
              <Text style={[styles.resultText, { color: eligibilityResult.eligible ? '#065F46' : '#991B1B' }]}>
                {eligibilityResult.eligible ? '✅ You are eligible for free legal aid!' : '❌ You may not be eligible for free legal aid.'}
              </Text>
              {eligibilityResult.reasons && eligibilityResult.reasons.length > 0 && (
                <Text style={styles.reasons}>Reason: {eligibilityResult.reasons.join(', ')}</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={activePicker !== null} transparent animationType="slide" onRequestClose={() => setActivePicker(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={() => {
                setStateSearch('');
                setActivePicker(null);
              }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {activePicker === 'state' && (
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search state..."
                  placeholderTextColor={COLORS.textMuted}
                  value={stateSearch}
                  onChangeText={setStateSearch}
                />
              </View>
            )}
            <FlatList
              data={filteredPickerOptions}
              keyExtractor={(item) => item}
              ListEmptyComponent={<Text style={styles.emptyText}>No options available</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.listItem, item === selectedPickerValue && styles.listItemActive]}
                  onPress={() => selectPickerOption(item)}
                >
                  <Text style={[styles.listItemText, item === selectedPickerValue && styles.listItemTextActive]}>{item}</Text>
                  {item === selectedPickerValue && <Ionicons name="checkmark" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: SPACING.huge + 10,
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg,
  },
  headerContent: { alignItems: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xxl + 2, fontWeight: '900', color: COLORS.white, marginTop: SPACING.sm },
  headerSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: SPACING.xs },
  scroll: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  description: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  categoriesSection: { marginTop: SPACING.md },
  categoriesTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.xs },
  categoryItem: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: 2 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  checkboxLabel: { marginLeft: SPACING.sm, fontSize: FONT_SIZE.md, color: COLORS.text },
  inputLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  input: {
    borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, fontSize: FONT_SIZE.md, marginBottom: SPACING.md, color: COLORS.text,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: { fontSize: FONT_SIZE.md, color: COLORS.text },
  dropdownPlaceholder: { fontSize: FONT_SIZE.md, color: COLORS.textMuted },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md,
    alignItems: 'center', marginTop: SPACING.sm,
  },
  submitBtnText: { color: COLORS.white, fontSize: FONT_SIZE.md, fontWeight: '700' },
  resultContainer: { marginTop: SPACING.lg, padding: SPACING.md, borderRadius: BORDER_RADIUS.md },
  resultText: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  reasons: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs, color: COLORS.textSecondary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '70%',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  modalTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  searchBox: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
    paddingVertical: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  listItemActive: { backgroundColor: COLORS.surfaceAlt },
  listItemText: { fontSize: FONT_SIZE.md, color: COLORS.text },
  listItemTextActive: { color: COLORS.primary, fontWeight: '700' },
  emptyText: { textAlign: 'center', color: COLORS.textSecondary, paddingVertical: SPACING.lg },
});

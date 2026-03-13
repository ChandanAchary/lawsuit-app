import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { teleLawApi } from '../../services/api';

export const TeleLawScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [income, setIncome] = useState('');
  const [caste, setCaste] = useState('');
  const [gender, setGender] = useState('');
  const [stateName, setStateName] = useState('');
  const [useProfile, setUseProfile] = useState(false);
  const [eligibilityResult, setEligibilityResult] = useState<any>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchInfo();
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
              <TextInput
                style={styles.input}
                placeholder="e.g. SC, ST, GENERAL"
                value={caste}
                autoCapitalize="characters"
                onChangeText={setCaste}
              />

              <Text style={styles.inputLabel}>Gender</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. MALE, FEMALE, OTHER"
                value={gender}
                autoCapitalize="characters"
                onChangeText={setGender}
              />

              <Text style={styles.inputLabel}>State</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Maharashtra"
                value={stateName}
                onChangeText={setStateName}
              />
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
    </View>
  );
};

const styles = StyleSheet.create({
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
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md,
    alignItems: 'center', marginTop: SPACING.sm,
  },
  submitBtnText: { color: COLORS.white, fontSize: FONT_SIZE.md, fontWeight: '700' },
  resultContainer: { marginTop: SPACING.lg, padding: SPACING.md, borderRadius: BORDER_RADIUS.md },
  resultText: { fontSize: FONT_SIZE.md, fontWeight: '700' },
  reasons: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs, color: COLORS.textSecondary },
});

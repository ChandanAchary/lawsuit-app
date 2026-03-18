import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuthStore } from '../../stores/authStore';

type Step = 'info' | 'password';

const getPasswordStrength = (pw: string, COLORS: any): { label: string; color: string; width: string } => {
  if (!pw) return { label: '', color: COLORS.border, width: '0%' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: 'Weak', color: COLORS.error, width: '33%' };
  if (score <= 3) return { label: 'Medium', color: COLORS.warning, width: '66%' };
  return { label: 'Strong', color: COLORS.success, width: '100%' };
};

export const RegisterScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const { setMode: setThemeMode } = useThemeStore();
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [step, setStep] = useState<Step>('info');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'CLIENT' | 'LAWYER'>('CLIENT');
  const [referralCode, setReferralCode] = useState('');
  const [showReferral, setShowReferral] = useState(false);
  const [showReferralCode, setShowReferralCode] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register, requestOtp, applyReferral, isLoading, clearError } = useAuthStore();

  const handleThemeToggle = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  // Auto-fill referral code from deep link params
  useEffect(() => {
    const refCode = route.params?.referralCode;
    if (refCode) {
      setReferralCode(refCode);
      setShowReferral(true);
    }
  }, [route.params?.referralCode]);

  // Also handle incoming deep links
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const url = event.url;
      const match = url.match(/[?&]ref=([^&]+)/);
      if (match) {
        setReferralCode(match[1]);
        setShowReferral(true);
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    // Check initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        const match = url.match(/[?&]ref=([^&]+)/);
        if (match) {
          setReferralCode(match[1]);
          setShowReferral(true);
        }
      }
    });
    return () => sub.remove();
  }, []);

  const handleNext = () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    setStep('password');
  };

  const handleRegister = async () => {
    if (!password || password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    clearError();
    try {
      await register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password, role });

      // Pass referral code to OTP screen — it will be applied after verification when auth token exists
      navigation.navigate('OtpVerify', { identifier: email.trim(), referralCode: referralCode.trim() || undefined });
    } catch (err: any) {
      Alert.alert('Registration Failed', err.response?.data?.message || err.response?.data?.error || 'Please try again');
    }
  };

  const strength = getPasswordStrength(password, COLORS);

  // ─── Step 1: Personal Info ────────────────────────────
  if (step === 'info') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.themeBtn} onPress={handleThemeToggle}>
            <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={COLORS.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Lawsuit to access legal services</Text>
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
          </View>

          {/* Role selector */}
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[styles.roleBtn, role === 'CLIENT' && styles.roleBtnActive]}
              onPress={() => setRole('CLIENT')}
            >
              <Ionicons
                name="person"
                size={20}
                color={role === 'CLIENT' ? COLORS.white : COLORS.textSecondary}
              />
              <Text style={[styles.roleText, role === 'CLIENT' && styles.roleTextActive]}>
                Client
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, role === 'LAWYER' && styles.roleBtnActive]}
              onPress={() => setRole('LAWYER')}
            >
              <Ionicons
                name="briefcase"
                size={20}
                color={role === 'LAWYER' ? COLORS.white : COLORS.textSecondary}
              />
              <Text style={[styles.roleText, role === 'LAWYER' && styles.roleTextActive]}>
                Lawyer
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              icon={<Ionicons name="person-outline" size={20} color={COLORS.textMuted} />}
            />
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />}
            />
            <Input
              label="Phone"
              placeholder="Enter your phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon={<Ionicons name="call-outline" size={20} color={COLORS.textMuted} />}
            />

            {/* Referral Code Toggle */}
            {!showReferral ? (
              <TouchableOpacity
                style={styles.referralToggle}
                onPress={() => setShowReferral(true)}
              >
                <Ionicons name="gift-outline" size={16} color={COLORS.primary} />
                <Text style={styles.referralToggleText}>Click here, if you have a referral code?</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.referralSection}>
                <View style={styles.referralHeader}>
                  <View style={styles.referralBadge}>
                    <Ionicons name="gift" size={14} color={COLORS.primary} />
                    <Text style={styles.referralBadgeText}>Referral Code</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setShowReferral(false); setReferralCode(''); }}>
                    <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
                <Input
                  placeholder="Enter referral code"
                  value={referralCode}
                  onChangeText={setReferralCode}
                  autoCapitalize="characters"
                  secureTextEntry={!showReferralCode}
                  icon={<Ionicons name="ticket-outline" size={20} color={COLORS.textMuted} />}
                  rightIcon={
                    <TouchableOpacity onPress={() => setShowReferralCode(!showReferralCode)}>
                      <Ionicons
                        name={showReferralCode ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={COLORS.textMuted}
                      />
                    </TouchableOpacity>
                  }
                />
              </View>
            )}

            <Button title="Continue" onPress={handleNext} size="lg" />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─── Step 2: Set Password ─────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.themeBtn} onPress={handleThemeToggle}>
          <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.backBtn} onPress={() => setStep('info')}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <Text style={styles.title}>Set Password</Text>
          <Text style={styles.subtitle}>Create a strong password for your account</Text>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, styles.stepDotDone]}>
            <Ionicons name="checkmark" size={12} color={COLORS.white} />
          </View>
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
        </View>

        <View style={styles.form}>
          <Input
            label="Password"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            }
          />

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <View style={styles.strengthSection}>
              <View style={styles.strengthBar}>
                <View style={[styles.strengthFill, { width: strength.width as any, backgroundColor: strength.color }]} />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}

          <Input
            label="Confirm Password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
            icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
            rightIcon={
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            }
            error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
          />

          {/* Password requirements */}
          <View style={styles.requirements}>
            {[
              { met: password.length >= 8, text: 'At least 8 characters' },
              { met: /[A-Z]/.test(password), text: 'One uppercase letter' },
              { met: /[a-z]/.test(password), text: 'One lowercase letter' },
              { met: /[0-9]/.test(password), text: 'One number' },
              { met: /[^A-Za-z0-9]/.test(password), text: 'One special character' },
            ].map((req, i) => (
              <View key={i} style={styles.reqRow}>
                <Ionicons
                  name={req.met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={req.met ? COLORS.success : COLORS.textMuted}
                />
                <Text style={[styles.reqText, req.met && styles.reqTextMet]}>{req.text}</Text>
              </View>
            ))}
          </View>

          <Button title="Create Account" onPress={handleRegister} loading={isLoading} size="lg" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.xxl, paddingBottom: SPACING.xxxl },
  themeBtn: {
    marginTop: SPACING.huge,
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  backBtn: {
    marginTop: SPACING.md,
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSection: { marginTop: SPACING.xxl, marginBottom: SPACING.lg },
  title: { fontSize: FONT_SIZE.hero, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: FONT_SIZE.lg, color: COLORS.textSecondary, marginTop: SPACING.sm },
  // ── Step indicator ──
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xxl,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '15',
  },
  stepDotDone: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
  },
  stepLineDone: {
    backgroundColor: COLORS.success,
  },
  // ── Role selector ──
  roleSelector: {
    flexDirection: 'row',
    marginBottom: SPACING.xxl,
    gap: SPACING.md,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md + 2,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  roleBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  roleTextActive: {
    color: COLORS.white,
  },
  // ── Referral ──
  referralToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xxl,
    paddingVertical: SPACING.sm,
  },
  referralToggleText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
  referralSection: {
    backgroundColor: COLORS.primary + '06',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  referralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  referralBadgeText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // ── Form ──
  form: {},
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.xxl,
  },
  footerText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  footerLink: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
  // ── Password strength ──
  strengthSection: {
    marginTop: -SPACING.sm,
    marginBottom: SPACING.lg,
  },
  strengthBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 3,
  },
  strengthLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    marginTop: SPACING.xs,
    textAlign: 'right',
  },
  // ── Requirements ──
  requirements: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xxl,
    gap: SPACING.sm,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  reqText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textMuted,
  },
  reqTextMet: {
    color: COLORS.success,
  },
});

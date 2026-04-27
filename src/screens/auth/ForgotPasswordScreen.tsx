import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, COLORS as STATIC_COLORS } from '../../constants';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../services/api';
import { safeGoBack } from '../../utils/navigation';
import { formatErrorMessage } from '../../utils/formatError';

type Step = 'email' | 'otp' | 'newPassword';

const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
  if (!pw) return { label: '', color: STATIC_COLORS.border, width: '0%' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: 'Weak', color: STATIC_COLORS.error, width: '33%' };
  if (score <= 3) return { label: 'Medium', color: STATIC_COLORS.warning, width: '66%' };
  return { label: 'Strong', color: STATIC_COLORS.success, width: '100%' };
};

export const ForgotPasswordScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [timer, setTimer] = useState(0);
  const inputs = useRef<(TextInput | null)[]>([]);
  const { requestOtp, resetPassword, isLoading } = useAuthStore();

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  const handleSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    try {
      await requestOtp(email.trim());
      setTimer(30);
      setStep('otp');
      Alert.alert('Success', 'OTP sent to your email');
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to send OTP');
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) text = text[text.length - 1];
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      Alert.alert('Error', 'Please enter the complete OTP');
      return;
    }
    try {
      // Verify OTP server-side before proceeding to password step
      await authApi.verifyOtp(email.trim(), code);
      setStep('newPassword');
    } catch (err: any) {
      Alert.alert('Invalid OTP', formatErrorMessage(err) || 'The OTP you entered is incorrect');
    }
  };

  const handleResendOtp = async () => {
    try {
      await requestOtp(email.trim());
      setTimer(30);
      setOtp(['', '', '', '', '', '']);
      Alert.alert('Success', 'OTP resent successfully');
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to resend OTP');
    }
  };

  const handleResetPassword = async () => {
    if (!password || password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    const code = otp.join('');
    try {
      await resetPassword(email.trim(), code, password);
      Alert.alert('Success', 'Password has been reset successfully', [
        { text: 'Sign In', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to reset password');
    }
  };

  const strength = getPasswordStrength(password);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (step === 'newPassword') setStep('otp');
            else if (step === 'otp') setStep('email');
            else safeGoBack(navigation, 'Login');
          }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {/* ── Step 1: Enter Email ── */}
        {step === 'email' && (
          <View>
            <View style={styles.iconSection}>
              <View style={styles.iconBg}>
                <Ionicons name="lock-open-outline" size={36} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you an OTP to reset your password.
            </Text>

            <View style={styles.formSection}>
              <Input
                label="Email"
                placeholder="Enter your registered email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                icon={<Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />}
              />
              <Button title="Send OTP" onPress={handleSendOtp} loading={isLoading} size="lg" />
            </View>
          </View>
        )}

        {/* ── Step 2: Enter OTP ── */}
        {step === 'otp' && (
          <View>
            <View style={styles.iconSection}>
              <View style={styles.iconBg}>
                <Ionicons name="shield-checkmark" size={36} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={styles.identifier}>{email}</Text>
            </Text>

            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { inputs.current[i] = ref; }}
                  style={[styles.otpInput, digit ? styles.otpInputFilled : undefined]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, i)}
                  onKeyPress={(e) => handleOtpKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            <Button title="Verify & Continue" onPress={handleVerifyOtp} size="lg" />

            <View style={styles.resendRow}>
              {timer > 0 ? (
                <Text style={styles.timerText}>Resend OTP in {timer}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResendOtp}>
                  <Text style={styles.resendBtn}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Step 3: New Password ── */}
        {step === 'newPassword' && (
          <View>
            <View style={styles.iconSection}>
              <View style={styles.iconBg}>
                <Ionicons name="key-outline" size={36} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>Create a strong password for your account.</Text>

            <View style={styles.formSection}>
              <Input
                label="New Password"
                placeholder="Enter new password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
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
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                    <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                }
                error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
              />

              <Button title="Reset Password" onPress={handleResetPassword} loading={isLoading} size="lg" />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, paddingHorizontal: SPACING.xxl, paddingBottom: SPACING.xxxl },
  backBtn: {
    marginTop: SPACING.huge,
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSection: { alignItems: 'center', marginTop: SPACING.xxxl },
  iconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZE.xxxl,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  identifier: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  formSection: {
    marginTop: SPACING.xxxl,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginVertical: SPACING.xxxl,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    textAlign: 'center',
    fontSize: FONT_SIZE.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  timerText: { fontSize: FONT_SIZE.md, color: COLORS.textMuted },
  resendBtn: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary },
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
});

import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useAuthStore } from '../../stores/authStore';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { formatErrorMessage } from '../../utils/formatError';

type Step = 'send' | 'reset';

export const SecurityScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const { user, requestOtp, resetPassword } = useAuthStore();

  const [step, setStep] = useState<Step>('send');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Toast state
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const toastOpacity = useState(new Animated.Value(0))[0];

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast({ message: '', visible: false }));
  };

  // Start resend countdown when entering reset step
  useEffect(() => {
    if (step === 'reset') setResendTimer(30);
  }, [step]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleSendOtp = async () => {
    if (!user?.email) return;
    setError('');
    setLoading(true);
    try {
      await requestOtp(user.email);
      showToast('OTP sent to your email');
      setStep('reset');
    } catch (err: any) {
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!user?.email) return;
    setError('');
    setLoading(true);
    try {
      await requestOtp(user.email);
      setResendTimer(30);
      showToast('OTP resent to your email');
    } catch (err: any) {
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setError('');
    if (!otp.trim() || otp.length < 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(user.email, otp.trim(), newPassword);
      showToast('Password changed successfully!');
      setStep('send');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(formatErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const verificationColor =
    user?.isVerified === true
      ? COLORS.success
      : user?.isVerified === false
      ? COLORS.warning
      : COLORS.warning;
  const verificationLabel =
    user?.isVerified === true ? 'Verified' : 'Pending';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Toast */}
      {toast.visible && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <View style={styles.toastInner}>
            <View style={styles.toastIcon}>
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
            </View>
            <Text style={styles.toastText}>{toast.message}</Text>
            <TouchableOpacity onPress={() => setToast({ message: '', visible: false })}>
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Change Password Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Change Password</Text>

          {step === 'send' ? (
            <>
              <Text style={styles.cardDesc}>
                We'll send a one-time code to your registered email to verify your identity.
              </Text>
              <Text style={styles.emailText}>{user?.email}</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Button
                title="Send OTP"
                onPress={handleSendOtp}
                loading={loading}
                size="lg"
              />
            </>
          ) : (
            <>
              <Text style={styles.cardDesc}>
                Enter the OTP sent to{' '}
                <Text style={styles.emailInline}>{user?.email}</Text>
                {' '}and set your new password.
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Input
                label="OTP"
                value={otp}
                onChangeText={setOtp}
                placeholder="Enter 6-digit OTP"
                keyboardType="number-pad"
                maxLength={6}
                icon={<Ionicons name="key-outline" size={20} color={COLORS.textMuted} />}
              />

              <Input
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Min 8 characters"
                secureTextEntry={!showNewPw}
                icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowNewPw((v) => !v)}>
                    <Ionicons
                      name={showNewPw ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                }
              />

              <Input
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                secureTextEntry={!showConfirmPw}
                icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowConfirmPw((v) => !v)}>
                    <Ionicons
                      name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                }
              />

              {/* Resend OTP */}
              <View style={styles.resendRow}>
                {resendTimer > 0 ? (
                  <Text style={styles.resendTimerText}>Resend OTP in {resendTimer}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.btnRow}>
                <Button
                  title="Back"
                  variant="outline"
                  onPress={() => { setStep('send'); setError(''); setOtp(''); setNewPassword(''); setConfirmPassword(''); }}
                  style={styles.btnHalf}
                />
                <Button
                  title="Reset Password"
                  onPress={handleResetPassword}
                  loading={loading}
                  style={styles.btnHalf}
                />
              </View>
            </>
          )}
        </View>

        {/* Account Security Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Security</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Verification Status</Text>
            <Text style={[styles.infoValue, { color: verificationColor }]}>
              {verificationLabel}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email Verified</Text>
            <Text style={[styles.infoValue, { color: COLORS.success }]}>
              {user?.isEmailVerified ? 'Yes ✓' : 'No ✗'}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={[styles.infoValue, { color: COLORS.text }]}>
              {user?.role ?? '—'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    ...SHADOWS.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },

  toast: {
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.md,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F0FDF4',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  toastIcon: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.success,
    alignItems: 'center', justifyContent: 'center',
  },
  toastText: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '500' },

  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.xl, gap: SPACING.lg, paddingBottom: SPACING.xxxl },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  cardDesc: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, lineHeight: 22, marginBottom: SPACING.lg },
  emailText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xl },
  emailInline: { fontWeight: '600', color: COLORS.text },
  errorText: { fontSize: FONT_SIZE.sm, color: COLORS.error, marginBottom: SPACING.md },

  btnRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  btnHalf: { flex: 1 },

  resendRow: { alignItems: 'center', marginTop: SPACING.sm, marginBottom: SPACING.md },
  resendTimerText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  resendLink: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.primary },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  divider: { height: 1, backgroundColor: COLORS.border },
  infoLabel: { fontSize: FONT_SIZE.md, color: COLORS.textMuted },
  infoValue: { fontSize: FONT_SIZE.md, fontWeight: '700' },
});

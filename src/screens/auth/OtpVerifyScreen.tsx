import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING } from '../../constants';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../stores/authStore';

export const OtpVerifyScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const identifier = route.params?.identifier || '';
  const referralCode = route.params?.referralCode;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const inputs = useRef<(TextInput | null)[]>([]);
  const { verifyOtp, requestOtp, applyReferral, isLoading } = useAuthStore();

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  const handleChange = (text: string, index: number) => {
    if (text.length > 1) text = text[text.length - 1];
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      Alert.alert('Error', 'Please enter the complete OTP');
      return;
    }
    try {
      await verifyOtp(identifier, code);
      // Apply referral code after successful verification (user is now authenticated)
      if (referralCode) {
        try { await applyReferral(referralCode); } catch {}
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err.response?.data?.message || err.response?.data?.error || 'Invalid OTP');
    }
  };

  const handleResend = async () => {
    try {
      await requestOtp(identifier);
      setTimer(30);
      setOtp(['', '', '', '', '', '']);
      Alert.alert('Success', 'OTP sent successfully');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to resend OTP');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.iconSection}>
          <View style={styles.iconBg}>
            <Ionicons name="shield-checkmark" size={40} color={COLORS.primary} />
          </View>
        </View>

        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.identifier}>{identifier}</Text>
        </Text>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputs.current[i] = ref; }}
              style={[styles.otpInput, digit ? styles.otpInputFilled : undefined]}
              value={digit}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>
        <TouchableOpacity style={styles.resendBtn} onPress={handleResendOtp}>
          <Text style={styles.resendText}>Resend OTP</Text>
        </TouchableOpacity>

        <Button title="Verify" onPress={handleVerify} loading={isLoading} size="lg" />

        <View style={styles.resendRow}>
          {timer > 0 ? (
            <Text style={styles.timerText}>Resend OTP in {timer}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendBtn}>Resend OTP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: SPACING.xxl },
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
  timerText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
  },
  resendBtn: {
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

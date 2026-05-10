import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { ekycApi } from '../../services/api';
import { Button } from '../../components/Button';
import { formatErrorMessage } from '../../utils/formatError';
import { ekycProviderLabel } from '../../utils/ekycProvider';
import { useAuthStore } from '../../stores/authStore';

// 2-step Aadhaar OTP form, plus a temporary email-OTP fallback path.
//
// Resume params (from EkycStatusScreen):
//   - { resumeSubmissionId, resumeExpiresAt } — jump straight to OTP entry
//     when the user already has a PENDING submission (server returns 409 if
//     they try to initiate a new one while ekycVerified=true; if a PENDING
//     row exists they should resume rather than burn another provider call).
//
// Stages:
//   aadhaar   — step 1 of the Aadhaar path; also hosts the OR-alternative
//               card that switches the flow to the email-OTP fallback.
//   otp       — step 2 of the Aadhaar path.
//   emailOtp  — step 2 of the temporary email-OTP fallback.
//
// `path` tracks which lane the user is on so the OTP submit handler can
// hit the right endpoint and the success copy can flag the temporary
// status (ekycVerifiedVia=EMAIL_OTP).
type Stage = 'aadhaar' | 'otp' | 'emailOtp';
type Path = 'AADHAAR' | 'EMAIL_OTP';

const formatAadhaarDisplay = (digits: string) =>
  digits.replace(/\s/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();

const remainingSeconds = (iso?: string | null): number => {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
};

export const EkycAadhaarScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);

  const resumeSubmissionId = route.params?.resumeSubmissionId as string | null | undefined;
  const resumeExpiresAt = route.params?.resumeExpiresAt as string | null | undefined;

  const [stage, setStage] = useState<Stage>(resumeSubmissionId ? 'otp' : 'aadhaar');
  // Which lane is currently active. Resumes default to AADHAAR — the
  // legacy resume contract didn't carry docType, and Aadhaar is the
  // canonical path. (If we ever resume into the email path, the resume
  // params can be extended to pass it explicitly.)
  const [path, setPath] = useState<Path>('AADHAAR');
  const [aadhaar, setAadhaar] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [submissionId, setSubmissionId] = useState<string | null>(resumeSubmissionId ?? null);
  const [expiresAt, setExpiresAt] = useState<string | null>(resumeExpiresAt ?? null);
  // Masked recipient ("a***@gmail.com") returned by the server on email-OTP
  // initiate — surfaced on the email-OTP stage so the user knows which
  // inbox to check.
  const [sentToEmailMasked, setSentToEmailMasked] = useState<string | null>(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [secondsLeft, setSecondsLeft] = useState(remainingSeconds(resumeExpiresAt));
  const otpInputs = useRef<(TextInput | null)[]>([]);

  // Live countdown to expiresAt. Covers both OTP stages (aadhaar + email).
  // When it hits zero, the OTP is unusable — server returns 410 GONE on
  // submit. We pre-empt that by forcing the user back to stage 1.
  useEffect(() => {
    if ((stage !== 'otp' && stage !== 'emailOtp') || !expiresAt) return;
    const tick = setInterval(() => {
      const left = remainingSeconds(expiresAt);
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(tick);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [stage, expiresAt]);

  const handleAadhaarChange = (text: string) => {
    // Strip non-digits and clamp at 12. Display formatter adds spaces for
    // readability, but the network call sends only digits.
    const digits = text.replace(/\D/g, '').slice(0, 12);
    setAadhaar(digits);
  };

  const handleInitiate = async () => {
    if (aadhaar.length !== 12) {
      Alert.alert('Invalid Aadhaar', 'Aadhaar must be 12 digits.');
      return;
    }
    if (!consent) {
      Alert.alert('Consent required', 'Please confirm you understand how Aadhaar OTP is used.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await ekycApi.initiateAadhaar(aadhaar);
      const payload = data?.data || data;
      setSubmissionId(payload.id);
      setExpiresAt(payload.expiresAt ?? null);
      setSecondsLeft(remainingSeconds(payload.expiresAt));
      setOtp(['', '', '', '', '', '']);
      setStage('otp');
    } catch (err: any) {
      // Surfaces server-side errors directly: "Invalid Aadhaar", "Too many
      // OTP requests, try again in an hour", "eKYC already completed", etc.
      Alert.alert('Could not send OTP', formatErrorMessage(err) || 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) text = text[text.length - 1];
    const next = [...otp];
    next[index] = text.replace(/\D/g, '');
    setOtp(next);
    if (text && index < 5) otpInputs.current[index + 1]?.focus();
  };

  const handleOtpKey = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  // Shared OTP submitter — branches between the Aadhaar path and the
  // temporary email-OTP fallback based on `path` state.
  const handleSubmitOtp = async () => {
    if (!submissionId) return;
    const code = otp.join('');
    if (code.length < 6) {
      Alert.alert('Enter OTP', 'Please enter the complete 6-digit OTP.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = path === 'EMAIL_OTP'
        ? await ekycApi.submitEmailOtp(submissionId, code)
        : await ekycApi.submitOtp(submissionId, code);
      // Mirror the verified flag onto the auth-store user so other screens
      // (ProfileScreen tile, EditProfile field-locks) reflect it without
      // requiring a /auth/me roundtrip. The email-OTP path doesn't carry
      // aadhaar* fields back — those stay null and the FE keys off
      // ekycVerifiedVia for the temporary-fallback badge.
      const verified = data?.data;
      if (user && verified?.ekycVerified) {
        setUser({
          ...user,
          ekycVerified: true,
          ekycVerifiedAt: verified.ekycVerifiedAt,
          ekycVerifiedVia: verified.ekycVerifiedVia ?? path,
          aadhaarLast4: verified.aadhaarLast4 ?? user.aadhaarLast4 ?? null,
          aadhaarName: verified.aadhaarName ?? user.aadhaarName ?? null,
        });
      }
      Alert.alert(
        path === 'EMAIL_OTP' ? 'Verified (temporary)' : 'Verified',
        path === 'EMAIL_OTP'
          ? 'Your identity has been temporarily verified via email OTP. We will ask you to upgrade to Aadhaar verification once that flow is live.'
          : 'Your identity has been verified.',
        [{ text: 'OK', onPress: () => navigation.replace('EkycStatus') }],
      );
    } catch (err: any) {
      // 400 with body { data: submission, error: '...' } means OTP was
      // wrong. 410 means it expired. Format helper unwraps both shapes.
      Alert.alert('Verification failed', formatErrorMessage(err) || 'Please try again');
      // Clear OTP so the user can re-enter without backspace-spamming.
      setOtp(['', '', '', '', '', '']);
      otpInputs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  // Temporary email-OTP fallback: triggered from the OR-alternative card on
  // the Aadhaar stage. No input from the user — server uses the registered
  // email and replies with a masked version we display on the OTP stage.
  const handleInitiateEmailOtp = async () => {
    setSubmitting(true);
    try {
      const { data } = await ekycApi.initiateEmailOtp();
      const payload = data?.data || data;
      setPath('EMAIL_OTP');
      setSubmissionId(payload.id);
      setExpiresAt(payload.expiresAt ?? null);
      setSentToEmailMasked(payload.sentToEmailMasked ?? null);
      setSecondsLeft(remainingSeconds(payload.expiresAt));
      setOtp(['', '', '', '', '', '']);
      setStage('emailOtp');
    } catch (err: any) {
      Alert.alert(
        "Couldn't send email OTP",
        formatErrorMessage(err) || 'Please try again in a moment.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = () => {
    // "Resend" = restart from the chooser screen. Server rate-limits each
    // initiate call (5/hr per IP) for both Aadhaar and email paths.
    setStage('aadhaar');
    setPath('AADHAAR');
    setOtp(['', '', '', '', '', '']);
    setSubmissionId(null);
    setExpiresAt(null);
    setSentToEmailMasked(null);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.hero}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Ionicons
          name={
            stage === 'aadhaar'
              ? 'finger-print'
              : stage === 'emailOtp'
                ? 'mail-outline'
                : 'mail-unread-outline'
          }
          size={32}
          color={COLORS.accent}
        />
        <Text style={styles.heroTitle}>
          {stage === 'aadhaar'
            ? 'Identity Verification'
            : stage === 'emailOtp'
              ? 'Enter Email OTP'
              : 'Enter OTP'}
        </Text>
        <Text style={styles.heroSub}>
          {stage === 'aadhaar'
            ? 'Step 1 of 2 — Aadhaar or email OTP (temporary)'
            : stage === 'emailOtp'
              ? 'Step 2 of 2 — Enter the OTP sent to your registered email'
              : 'Step 2 of 2 — Enter the OTP sent to your Aadhaar-linked phone'}
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {stage === 'aadhaar' && (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Aadhaar Number</Text>
              <TextInput
                style={styles.aadhaarInput}
                value={formatAadhaarDisplay(aadhaar)}
                onChangeText={handleAadhaarChange}
                placeholder="1234 5678 9012"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={14}
                autoFocus
              />

              <TouchableOpacity
                style={styles.consentRow}
                activeOpacity={0.8}
                onPress={() => setConsent((c) => !c)}
              >
                <View style={[styles.checkbox, consent && styles.checkboxOn]}>
                  {consent && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                </View>
                <Text style={styles.consentText}>
                  I authorise NyayaX to verify my identity through Aadhaar OTP. My Aadhaar number is hashed
                  and never stored in full; only the last four digits are kept.
                </Text>
              </TouchableOpacity>

              <Button
                title={submitting && path === 'AADHAAR' ? '' : 'Send OTP'}
                onPress={handleInitiate}
                loading={submitting && path === 'AADHAAR'}
                size="lg"
              />

              {/* Mid-flow escape hatch — lets the user defer verification
                  without needing to rotate through the OTP step. The user can
                  always return via the Profile → Identity Verification tile. */}
              <TouchableOpacity
                onPress={() => navigation.navigate('EkycStatus')}
                style={styles.skipBtn}
              >
                <Text style={styles.skipText}>Skip for now — verify later</Text>
              </TouchableOpacity>

              <Text style={styles.helperText}>
                An OTP will be sent to the mobile number registered with this Aadhaar.
              </Text>
              <Text style={styles.poweredByText}>
                Powered by <Text style={styles.poweredByName}>{ekycProviderLabel('sandbox')}</Text>
              </Text>
            </View>

            {/* ── OR — Temporary alternative (email OTP) ─────────────────
                Shown while the Aadhaar provider API key is not yet active.
                Sends a 6-digit OTP to the email registered on the account
                and grants the same `ekycVerified=true` flag (tagged as
                EMAIL_OTP so the badge / super-admin filter can distinguish
                it from a full Aadhaar verification). */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.altCard}>
              <View style={styles.altHeader}>
                <View style={styles.altIcon}>
                  <Ionicons name="mail-outline" size={18} color="#B45309" />
                </View>
                <Text style={styles.altTitle}>
                  Temporary alternative — Email OTP
                </Text>
              </View>
              <Text style={styles.altBody}>
                The Aadhaar provider isn't connected yet. As a temporary
                measure, you can verify with a 6-digit OTP sent to your
                registered email
                {user?.email ? <Text style={styles.altEmail}> ({user.email})</Text> : null}.
                You'll be marked verified for now; we'll ask you to upgrade
                to Aadhaar verification once that flow is live.
              </Text>
              <TouchableOpacity
                style={[styles.altBtn, submitting && path === 'EMAIL_OTP' && styles.altBtnDisabled]}
                onPress={handleInitiateEmailOtp}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting && path === 'EMAIL_OTP'
                  ? <ActivityIndicator size="small" color="#92400E" />
                  : <Ionicons name="mail-outline" size={16} color="#92400E" />}
                <Text style={styles.altBtnText}>
                  {submitting && path === 'EMAIL_OTP' ? 'Sending…' : 'Send email OTP instead'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {stage === 'otp' && (
          <View style={styles.card}>
            <Text style={styles.label}>6-digit OTP</Text>
            <View style={styles.otpRow}>
              {otp.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { otpInputs.current[i] = ref; }}
                  style={styles.otpBox}
                  value={d}
                  onChangeText={(t) => handleOtpChange(t, i)}
                  onKeyPress={(e) => handleOtpKey(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  autoFocus={i === 0}
                />
              ))}
            </View>

            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.timerText}>
                {secondsLeft > 0
                  ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
                  : 'OTP expired — request a new one'}
              </Text>
            </View>

            {secondsLeft > 0 ? (
              <Button
                title="Verify & Continue"
                onPress={handleSubmitOtp}
                loading={submitting}
                size="lg"
              />
            ) : (
              <Button title="Restart" onPress={handleResend} size="lg" />
            )}

            {secondsLeft > 0 && (
              <TouchableOpacity onPress={handleResend} style={styles.resendBtn}>
                <Text style={styles.resendText}>Didn't receive it? Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Step 2 of the temporary email-OTP fallback. Same OTP input as the
            Aadhaar step; copy + colour cues mark this as the temporary route. */}
        {stage === 'emailOtp' && (
          <View style={styles.card}>
            <View style={styles.tempBanner}>
              <Ionicons name="alert-circle-outline" size={14} color="#92400E" />
              <Text style={styles.tempBannerText}>
                Temporary verification — using email OTP while the Aadhaar
                provider is unavailable.
              </Text>
            </View>
            <Text style={styles.label}>
              Enter the 6-digit OTP sent to{' '}
              <Text style={styles.altEmail}>
                {sentToEmailMasked || user?.email || 'your registered email'}
              </Text>
            </Text>
            <View style={styles.otpRow}>
              {otp.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { otpInputs.current[i] = ref; }}
                  style={styles.otpBox}
                  value={d}
                  onChangeText={(t) => handleOtpChange(t, i)}
                  onKeyPress={(e) => handleOtpKey(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  autoFocus={i === 0}
                />
              ))}
            </View>

            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.timerText}>
                {secondsLeft > 0
                  ? `Expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
                  : 'OTP expired — request a new one'}
              </Text>
            </View>

            {secondsLeft > 0 ? (
              <Button
                title="Verify & Continue"
                onPress={handleSubmitOtp}
                loading={submitting}
                size="lg"
              />
            ) : (
              <Button title="Restart" onPress={handleResend} size="lg" />
            )}

            <TouchableOpacity onPress={handleResend} style={styles.resendBtn}>
              <Text style={styles.resendText}>Back to Aadhaar option</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { padding: SPACING.xl, paddingBottom: 100 },

  hero: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge + SPACING.md,
    paddingBottom: SPACING.xxxl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute', top: SPACING.huge, left: SPACING.xl,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.white, marginTop: SPACING.sm },
  heroSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.78)', marginTop: 2, textAlign: 'center', paddingHorizontal: SPACING.lg },

  card: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginTop: SPACING.lg, ...SHADOWS.sm,
  },
  label: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text, marginBottom: SPACING.sm },

  aadhaarInput: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg,
    fontSize: FONT_SIZE.xl, fontWeight: '700', color: C.text,
    letterSpacing: 2, textAlign: 'center',
    marginBottom: SPACING.lg,
  },

  consentRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, marginTop: 2,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.white,
  },
  checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
  consentText: { flex: 1, fontSize: FONT_SIZE.xs, color: C.textSecondary, lineHeight: 18 },

  helperText: {
    fontSize: FONT_SIZE.xs, color: C.textMuted,
    marginTop: SPACING.md, textAlign: 'center',
  },
  // Provider attribution — sourced from utils/ekycProvider so a provider
  // swap touches one file. Smaller + slightly faded so it reads as
  // metadata, not a primary CTA.
  poweredByText: {
    fontSize: FONT_SIZE.xs - 1, color: C.textMuted,
    marginTop: 2, textAlign: 'center',
  },
  poweredByName: { fontWeight: '700', color: C.textSecondary },

  otpRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  otpBox: {
    width: 46, height: 56, borderRadius: BORDER_RADIUS.lg,
    backgroundColor: C.surfaceAlt,
    fontSize: FONT_SIZE.xxl, fontWeight: '800', color: C.text,
    textAlign: 'center',
  },

  timerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginBottom: SPACING.lg,
  },
  timerText: { fontSize: FONT_SIZE.xs, color: C.textMuted, fontWeight: '600' },

  resendBtn: { alignItems: 'center', marginTop: SPACING.md },
  resendText: { color: C.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' },

  skipBtn: { alignItems: 'center', marginTop: SPACING.md },
  skipText: { color: C.textMuted, fontSize: FONT_SIZE.sm, fontWeight: '600' },

  // ── OR-alternative (email OTP) — amber/warning palette so it reads as
  // distinctly secondary to the primary Aadhaar card.
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: SPACING.md, marginVertical: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: {
    fontSize: FONT_SIZE.xs, fontWeight: '700',
    color: C.textMuted, letterSpacing: 2,
  },
  altCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1, borderColor: '#FCD34D',
  },
  altHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  altIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center', justifyContent: 'center',
  },
  altTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', color: '#92400E' },
  altBody: {
    fontSize: FONT_SIZE.xs, color: '#78350F',
    lineHeight: 18, marginBottom: SPACING.md,
  },
  altEmail: { fontWeight: '700', color: '#78350F' },
  altBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: C.white, borderWidth: 1, borderColor: '#FCD34D',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  altBtnDisabled: { opacity: 0.6 },
  altBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: '#92400E' },

  tempBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#FFFBEB',
    borderWidth: 1, borderColor: '#FCD34D',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tempBannerText: {
    flex: 1, fontSize: FONT_SIZE.xs - 1, fontWeight: '600',
    color: '#92400E', lineHeight: 16,
  },
});

export default EkycAadhaarScreen;

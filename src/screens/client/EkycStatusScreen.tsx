import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { ekycApi } from '../../services/api';
import { EkycStatusResponse } from '../../types';
import { Button } from '../../components/Button';

// Identity-verification landing for the CLIENT role. Pulls /ekyc/status and
// renders one of four states:
//   - VERIFIED:   green card with masked Aadhaar + verified-on date
//   - PENDING:    yellow card with submission id + countdown to expiresAt;
//                 "Continue" jumps back into EkycAadhaarScreen with the
//                 same submissionId so the user resumes at OTP entry
//   - FAILED / EXPIRED: red card with reason + "Try again" CTA (fresh init)
//   - none yet:   intro card explaining Aadhaar OTP + "Verify with Aadhaar"
export const EkycStatusScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [data, setData] = useState<EkycStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const resp = await ekycApi.getStatus();
      // Server wraps in { data: ... }
      const payload = (resp.data?.data || resp.data) as EkycStatusResponse;
      setData(payload);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void fetchStatus(); }, [fetchStatus]));

  const onRefresh = () => {
    setRefreshing(true);
    void fetchStatus(false);
  };

  const verified = !!data?.client?.ekycVerified;
  const sub = data?.latestSubmission;
  const isPending =
    !verified && sub?.status === 'PENDING' && (!sub.expiresAt || new Date(sub.expiresAt).getTime() > Date.now());
  const isFailed = !verified && (sub?.status === 'FAILED' || sub?.status === 'EXPIRED');

  const handleStart = (resumeSubmissionId?: string, resumeExpiresAt?: string | null) => {
    navigation.navigate('EkycAadhaar', {
      resumeSubmissionId: resumeSubmissionId ?? null,
      resumeExpiresAt: resumeExpiresAt ?? null,
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.hero}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Ionicons name="shield-checkmark" size={32} color={COLORS.accent} />
        <Text style={styles.heroTitle}>Identity Verification</Text>
        <Text style={styles.heroSub}>Verify your identity with Aadhaar OTP</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xxxl }} />
        ) : verified ? (
          <View style={[styles.card, styles.cardVerified]}>
            <View style={styles.cardHeader}>
              <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
              <Text style={[styles.cardTitle, { color: COLORS.success }]}>Identity Verified</Text>
            </View>
            <InfoRow label="Name" value={data?.client?.aadhaarName || '—'} styles={styles} />
            <InfoRow
              label="Aadhaar"
              value={data?.client?.aadhaarLast4 ? `XXXX XXXX ${data.client.aadhaarLast4}` : '—'}
              styles={styles}
            />
            <InfoRow
              label="Verified on"
              value={data?.client?.ekycVerifiedAt ? new Date(data.client.ekycVerifiedAt).toLocaleDateString('en-IN') : '—'}
              styles={styles}
            />
            <Text style={styles.helperText}>
              Your identity is locked to your Aadhaar profile. You cannot change name, date of birth, or
              gender without contacting support.
            </Text>
          </View>
        ) : isPending ? (
          <View style={[styles.card, styles.cardPending]}>
            <View style={styles.cardHeader}>
              <Ionicons name="hourglass-outline" size={28} color={COLORS.warning} />
              <Text style={[styles.cardTitle, { color: COLORS.warning }]}>Verification In Progress</Text>
            </View>
            <Text style={styles.cardBody}>
              We sent a 6-digit OTP to your Aadhaar-linked mobile number. Continue where you left off to
              complete verification.
            </Text>
            <Button
              title="Continue Verification"
              onPress={() => handleStart(sub?.id, sub?.expiresAt)}
              size="lg"
            />
          </View>
        ) : isFailed ? (
          <View style={[styles.card, styles.cardFailed]}>
            <View style={styles.cardHeader}>
              <Ionicons name="alert-circle" size={28} color={COLORS.error} />
              <Text style={[styles.cardTitle, { color: COLORS.error }]}>
                {sub?.status === 'EXPIRED' ? 'OTP Expired' : 'Verification Failed'}
              </Text>
            </View>
            {!!sub?.failureReason && <Text style={styles.cardBody}>{sub.failureReason}</Text>}
            <Button title="Try Again" onPress={() => handleStart()} size="lg" />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="finger-print" size={28} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Get Verified</Text>
            </View>
            <Text style={styles.cardBody}>
              Verify your identity in under a minute using Aadhaar OTP. We never store your full Aadhaar
              number — only the last four digits and a one-way hash for de-duplication.
            </Text>
            <View style={styles.bullets}>
              <Bullet icon="phone-portrait-outline" text="OTP delivered to your Aadhaar-linked phone" styles={styles} />
              <Bullet icon="lock-closed-outline" text="Aadhaar number is hashed, never stored" styles={styles} />
              <Bullet icon="time-outline" text="Takes about 60 seconds" styles={styles} />
            </View>
            <Button title="Verify with Aadhaar" onPress={() => handleStart()} size="lg" />
            {/* Skip lets the client defer verification — the tile remains
                in the Profile screen so they can come back any time. */}
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip for now — verify later</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const InfoRow = ({ label, value, styles }: any) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const Bullet = ({ icon, text, styles }: any) => (
  <View style={styles.bulletRow}>
    <Ionicons name={icon} size={18} color={styles.__primaryColor} />
    <Text style={styles.bulletText}>{text}</Text>
  </View>
);

const getStyles = (C: any) => {
  const s: any = StyleSheet.create({
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
    heroSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.78)', marginTop: 2 },

    card: {
      backgroundColor: C.white,
      borderRadius: BORDER_RADIUS.xl,
      padding: SPACING.xl,
      marginTop: SPACING.lg,
      ...SHADOWS.sm,
    },
    cardVerified: { borderLeftWidth: 4, borderLeftColor: C.success },
    cardPending: { borderLeftWidth: 4, borderLeftColor: C.warning },
    cardFailed: { borderLeftWidth: 4, borderLeftColor: C.error },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      marginBottom: SPACING.lg,
    },
    cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text },
    cardBody: { fontSize: FONT_SIZE.sm, color: C.textSecondary, lineHeight: 21, marginBottom: SPACING.lg },

    infoRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      paddingVertical: SPACING.md,
      borderBottomWidth: 1, borderBottomColor: C.borderLight,
    },
    infoLabel: { fontSize: FONT_SIZE.sm, color: C.textMuted },
    infoValue: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },

    helperText: {
      fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: SPACING.lg,
      lineHeight: 17, fontStyle: 'italic',
    },

    bullets: { gap: SPACING.md, marginBottom: SPACING.xl },
    bulletRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    bulletText: { flex: 1, fontSize: FONT_SIZE.sm, color: C.textSecondary, lineHeight: 20 },

    skipBtn: { alignItems: 'center', marginTop: SPACING.lg },
    skipText: { color: C.textMuted, fontSize: FONT_SIZE.sm, fontWeight: '600' },
  });
  // Smuggle the primary color out of the StyleSheet so the Bullet helper can
  // match the icon tint without reaching back into useColors.
  s.__primaryColor = C.primary;
  return s;
};

export default EkycStatusScreen;

import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert,
  ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { referralApi } from '../../services/api';
import { formatErrorMessage } from '../../utils/formatError';

interface PendingReferral {
  id: string;
  referredUserId: string;
  completedConsultations: number;
  requiredConsultations: number;
  progress: number; // 0..100
}

interface ReferralInfo {
  totalReferred: number;
  rewardsPaid: number;
  totalEarnings: number;
  pendingReferrals: PendingReferral[];
  referrals: any[];
}

export const ReferralScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [code, setCode] = useState('');
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [referredBy, setReferredBy] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const codeRes = await referralApi.getCode();
      const referralCode = codeRes.data?.data?.referralCode || codeRes.data?.referralCode || '';
      setCode(referralCode);
    } catch {
      setCode('');
    }
    try {
      const infoRes = await referralApi.getInfo();
      const d = infoRes.data?.data || infoRes.data || {};
      setInfo({
        totalReferred: d.totalReferred || 0,
        rewardsPaid: d.rewardsPaid || 0,
        totalEarnings: d.totalEarnings ? d.totalEarnings / 100 : 0,
        pendingReferrals: Array.isArray(d.pendingReferrals) ? d.pendingReferrals : [],
        referrals: Array.isArray(d.referrals) ? d.referrals : [],
      });
      setReferredBy(d.referredBy || d.referredByCode || null);
    } catch {
      setInfo({ totalReferred: 0, rewardsPaid: 0, totalEarnings: 0, pendingReferrals: [], referrals: [] });
    } finally { setLoading(false); }
  };

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', 'Referral code copied to clipboard');
  };

  const handleApply = async () => {
    const trimmed = applyCode.trim().toUpperCase();
    if (!trimmed) return Alert.alert('Error', 'Enter a referral code');
    if (trimmed === String(code).toUpperCase()) return Alert.alert('Error', 'You cannot use your own code');
    setApplying(true);
    try {
      await referralApi.apply(trimmed);
      Alert.alert('Applied', 'Referral code applied successfully');
      setApplyCode('');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to apply code');
    } finally { setApplying(false); }
  };

  const handleShare = async () => {
    if (!code) return;
    await Share.share({
      message: `Join NyayaX - Your Legal Companion! Use my referral code: ${code}\n\nDownload and sign up to get started!`,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Referral Program</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroInner}>
          <View style={styles.giftIcon}>
            <Ionicons name="gift" size={36} color={COLORS.accent} />
          </View>
          <Text style={styles.heroTitle}>Earn ₹5,000</Text>
          <Text style={styles.heroSub}>
            Refer a friend and earn ₹5,000 when they{'\n'}complete 10 consultations
          </Text>
        </View>
      </View>

      {/* Referral Code */}
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Your Referral Code</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeText}>{code || '—'}</Text>
          <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
            <Ionicons name="copy-outline" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={18} color={COLORS.white} />
          <Text style={styles.shareBtnText}>Share Code</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{info?.totalReferred || 0}</Text>
          <Text style={styles.statLabel}>Referrals</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{info?.rewardsPaid || 0}</Text>
          <Text style={styles.statLabel}>Rewards Paid</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>₹{info?.totalEarnings || 0}</Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
      </View>

      {/* Pending referrals — surfaces server-returned pendingReferrals so the
          referrer can see how close each invitee is to the 10-consultation
          milestone. Empty state is hidden so first-time users aren't shown
          a sad zero-row table. */}
      {(info?.pendingReferrals?.length ?? 0) > 0 && (
        <View style={styles.referralsCard}>
          <Text style={styles.referralsTitle}>Pending Rewards</Text>
          <Text style={styles.referralsSub}>
            Referrals who haven't yet completed their 10 consultations.
          </Text>
          {(info?.pendingReferrals || []).map((r) => (
            <View key={r.id} style={styles.refRow}>
              <View style={styles.refRowHeader}>
                <Ionicons name="person-circle-outline" size={20} color={COLORS.textMuted} />
                <Text style={styles.refRowText}>
                  {r.completedConsultations} / {r.requiredConsultations} consultations
                </Text>
                <Text style={styles.refRowPct}>{r.progress}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, r.progress)}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Apply a referral code */}
      {!referredBy ? (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Have a referral code?</Text>
          <TextInput
            style={styles.applyInput}
            value={applyCode}
            onChangeText={(t) => setApplyCode(t.toUpperCase())}
            placeholder="Enter code"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.shareBtn, { opacity: applying ? 0.6 : 1 }]}
            onPress={handleApply}
            disabled={applying}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
            <Text style={styles.shareBtnText}>{applying ? 'Applying…' : 'Apply Code'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Referred by</Text>
          <Text style={[styles.codeText, { fontSize: FONT_SIZE.xl }]}>{referredBy}</Text>
        </View>
      )}

      {/* How it works */}
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How It Works</Text>
        {[
          { step: 1, text: 'Share your referral code with friends' },
          { step: 2, text: 'They sign up and enter your code' },
          { step: 3, text: 'They complete 10 consultations' },
          { step: 4, text: 'You earn ₹5,000 in your wallet!' },
        ].map((item) => (
          <View key={item.step} style={styles.howStep}>
            <View style={styles.howStepNum}>
              <Text style={styles.howStepNumText}>{item.step}</Text>
            </View>
            <Text style={styles.howStepText}>{item.text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge, paddingBottom: SPACING.xl,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.white },
  heroCard: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl, borderWidth: 2, borderColor: COLORS.accent + '40',
    backgroundColor: COLORS.warningLight, overflow: 'hidden',
  },
  heroInner: { alignItems: 'center', paddingVertical: SPACING.xxl, paddingHorizontal: SPACING.xl },
  giftIcon: { marginBottom: SPACING.md },
  heroTitle: { fontSize: FONT_SIZE.xxxl, fontWeight: '900', color: COLORS.text, marginBottom: SPACING.sm },
  heroSub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  codeCard: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl, backgroundColor: COLORS.white,
    padding: SPACING.xl, alignItems: 'center', ...SHADOWS.sm,
  },
  codeLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: SPACING.md },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.xl },
  codeText: { fontSize: FONT_SIZE.xxxl, fontWeight: '900', color: COLORS.text, letterSpacing: 2 },
  copyBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl, borderRadius: BORDER_RADIUS.full,
  },
  shareBtnText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.white },
  applyInput: {
    width: '100%', backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.lg, color: COLORS.text, marginBottom: SPACING.md,
    textAlign: 'center', letterSpacing: 2, fontWeight: '700',
  },
  statsRow: { flexDirection: 'row', gap: SPACING.md, marginHorizontal: SPACING.xl, marginTop: SPACING.xl },
  statCard: {
    flex: 1, alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, paddingVertical: SPACING.xl, ...SHADOWS.sm,
  },
  statValue: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
  howCard: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl, backgroundColor: COLORS.white,
    padding: SPACING.xl, ...SHADOWS.sm,
  },
  howTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.xl },
  howStep: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginBottom: SPACING.lg },
  howStepNum: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  howStepNumText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.white },
  howStepText: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text, lineHeight: 22 },

  referralsCard: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl, backgroundColor: COLORS.white,
    padding: SPACING.xl, ...SHADOWS.sm,
  },
  referralsTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  referralsSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4, marginBottom: SPACING.lg },
  refRow: { paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  refRowHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 6 },
  refRowText: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600' },
  refRowPct: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: '700' },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: COLORS.borderLight, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { referralApi } from '../../services/api';

interface ReferralInfo {
  totalReferred: number;
  rewardsPaid: number;
  totalEarnings: number;
}

export const ReferralScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [code, setCode] = useState('');
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);

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
      });
    } catch {
      setInfo({ totalReferred: 0, rewardsPaid: 0, totalEarnings: 0 });
    } finally { setLoading(false); }
  };

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', 'Referral code copied to clipboard');
  };

  const handleShare = async () => {
    if (!code) return;
    await Share.share({
      message: `Join Lawsuit - Your Legal Companion! Use my referral code: ${code}\n\nDownload and sign up to get started!`,
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

const styles = StyleSheet.create({
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
});

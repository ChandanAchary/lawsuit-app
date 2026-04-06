import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { subscriptionApi } from '../../services/api';
import { useWalletStore } from '../../stores/walletStore';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';
import { RazorpayCheckout } from '../../components/RazorpayCheckout';
import { RazorpayOrderOptions, RazorpayPaymentResult } from '../../utils/razorpay';

const PRO_FEATURES = [
  { icon: 'star', title: 'Priority Listing', desc: 'Appear at the top of search results' },
  { icon: 'analytics', title: 'Advanced Analytics', desc: 'Detailed performance insights' },
  { icon: 'shield-checkmark', title: 'Verified Badge', desc: 'Pro badge on your profile' },
  { icon: 'megaphone', title: 'More Visibility', desc: 'Featured in recommendations' },
  { icon: 'people', title: 'Unlimited Clients', desc: 'No cap on monthly consultations' },
  { icon: 'notifications', title: 'Priority Support', desc: '24/7 dedicated support' },
];

export const ProSubscriptionScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const { balance, fetchBalance } = useWalletStore();
  const user = useAuthStore((s) => s.user);
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrderOptions | null>(null);
  const [subscriptionPaymentId, setSubscriptionPaymentId] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
    fetchBalance();
  }, []);

  const fetchSubscription = async () => {
    setLoading(true);
    try {
      const res = await subscriptionApi.get();
      setSubscription(res.data?.data || null);
    } catch { setSubscription(null); }
    finally { setLoading(false); }
  };

  const isPro = subscription?.plan === 'PRO' && subscription?.status === 'ACTIVE';
  const subscriptionExpiryRaw = subscription?.expiresAt || subscription?.endDate || null;
  const subscriptionExpiryDate = subscriptionExpiryRaw ? new Date(subscriptionExpiryRaw) : null;
  const subscriptionExpiryLabel =
    subscriptionExpiryDate && !Number.isNaN(subscriptionExpiryDate.getTime())
      ? format(subscriptionExpiryDate, 'dd MMMM yyyy')
      : '—';

  const handleSubscribeWallet = async () => {
    Alert.alert(
      'Subscribe with Wallet',
      'Pay ₹999/month from your wallet balance?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Subscribe',
          onPress: async () => {
            setSubscribing(true);
            try {
              const res = await subscriptionApi.subscribeFromWallet();
              setSubscription(res.data?.data || subscription);
              fetchBalance();
              Alert.alert('Success', 'You are now a Pro member!');
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Subscription failed');
            } finally { setSubscribing(false); }
          },
        },
      ],
    );
  };

  const handleSubscribeRazorpay = async () => {
    setSubscribing(true);
    try {
      const res = await subscriptionApi.subscribe();
      const data = res.data?.data || res.data;
      const paymentId = data?.payment?.id || data?.paymentId || null;
      const orderId = data?.payment?.razorpayOrderId || data?.orderId || data?.order?.id;
      if (!orderId) {
        Alert.alert('Error', 'Could not create payment order');
        return;
      }
      setSubscriptionPaymentId(paymentId);
      setRazorpayOrder({
        orderId,
        amount: 999 * 100,
        name: 'NyayaX Pro',
        description: 'Pro Subscription - ₹999/month',
        prefillEmail: user?.email || '',
        prefillPhone: user?.phone || '',
        prefillName: user?.name || '',
      });
      setShowRazorpay(true);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to initiate payment');
    } finally { setSubscribing(false); }
  };

  const handleRazorpaySuccess = async (result: RazorpayPaymentResult) => {
    setShowRazorpay(false);
    try {
      if (!subscriptionPaymentId) {
        Alert.alert('Error', 'Missing subscription payment ID. Please try again.');
        return;
      }
      await subscriptionApi.confirm({
        paymentId: subscriptionPaymentId,
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
      Alert.alert('Success', 'You are now a Pro member!');
      fetchSubscription();
      fetchBalance();
      setSubscriptionPaymentId(null);
    } catch {
      Alert.alert('Error', 'Payment received but verification failed. Contact support.');
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel Subscription', 'Are you sure? You will lose Pro benefits.', [
      { text: 'Keep Pro', style: 'cancel' },
      {
        text: 'Cancel', style: 'destructive',
        onPress: async () => {
          try {
            await subscriptionApi.cancel();
            setSubscription(null);
            Alert.alert('Cancelled', 'Pro subscription has been cancelled');
          } catch { Alert.alert('Error', 'Failed to cancel'); }
        },
      },
    ]);
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
        <Text style={styles.headerTitle}>Pro Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Hero */}
      <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Ionicons name="diamond" size={48} color="#FCD34D" />
        <Text style={styles.heroTitle}>NyayaX Pro</Text>
        <Text style={styles.heroPrice}>₹999<Text style={styles.heroPeriod}>/month</Text></Text>
        <Text style={styles.heroDesc}>Unlock premium features and grow your practice</Text>
      </LinearGradient>

      {/* Status */}
      {isPro && (
        <View style={styles.activeBox}>
          <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.activeTitle}>Active Subscription</Text>
            <Text style={styles.activeSub}>
              Expires {subscriptionExpiryLabel}
            </Text>
          </View>
        </View>
      )}

      {/* Features */}
      <View style={styles.featuresSection}>
        <Text style={styles.featuresTitle}>What you get</Text>
        {PRO_FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={f.icon as any} size={20} color="#7C3AED" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          </View>
        ))}
      </View>

      {/* Action Buttons */}
      {!isPro ? (
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.walletPayBtn}
            onPress={handleSubscribeWallet}
            disabled={subscribing}
          >
            {subscribing ? <ActivityIndicator color={COLORS.white} /> : (
              <>
                <Ionicons name="wallet" size={18} color={COLORS.white} />
                <Text style={styles.walletPayText}>Pay from Wallet (₹{balance.toLocaleString('en-IN')} available)</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.razorpayBtn} onPress={handleSubscribeRazorpay} disabled={subscribing}>
            <Ionicons name="card" size={18} color="#7C3AED" />
            <Text style={styles.razorpayText}>Pay with Razorpay</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelText}>Cancel Subscription</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Razorpay Checkout */}
      {razorpayOrder && (
        <RazorpayCheckout
          visible={showRazorpay}
          orderOptions={razorpayOrder}
          onSuccess={handleRazorpaySuccess}
          onCancel={() => { setShowRazorpay(false); Alert.alert('Cancelled', 'Payment was cancelled'); }}
          onError={(err) => { setShowRazorpay(false); Alert.alert('Payment Failed', err.description || 'Please try again'); }}
        />
      )}
    </ScrollView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#7C3AED', paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge, paddingBottom: SPACING.xl,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.white },
  heroCard: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl, padding: SPACING.xxl,
    alignItems: 'center',
  },
  heroTitle: { fontSize: FONT_SIZE.xxxl, fontWeight: '900', color: COLORS.white, marginTop: SPACING.md },
  heroPrice: { fontSize: 36, fontWeight: '900', color: COLORS.white, marginTop: SPACING.sm },
  heroPeriod: { fontSize: FONT_SIZE.lg, fontWeight: '400', color: 'rgba(255,255,255,0.7)' },
  heroDesc: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.sm, textAlign: 'center' },
  activeBox: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    backgroundColor: COLORS.successLight, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
  },
  activeTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.success },
  activeSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  featuresSection: { marginHorizontal: SPACING.xl, marginTop: SPACING.xxl },
  featuresTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.lg },
  featureRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  featureIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  featureTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  featureDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  actionSection: { marginHorizontal: SPACING.xl, marginTop: SPACING.xxl },
  walletPayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: '#7C3AED', paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full, marginBottom: SPACING.md,
  },
  walletPayText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.white },
  razorpayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    borderWidth: 1.5, borderColor: '#7C3AED', paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
  },
  razorpayText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: '#7C3AED' },
  cancelBtn: {
    alignItems: 'center', paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.error,
  },
  cancelText: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.error },
});

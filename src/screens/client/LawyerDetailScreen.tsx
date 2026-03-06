import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Dimensions, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { Lawyer, AvailabilitySlot } from '../../types';
import { lawyersApi, appointmentsApi } from '../../services/api';
import { useWalletStore } from '../../stores/walletStore';
import { format, addDays } from 'date-fns';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/Modals';

const { width } = Dimensions.get('window');

export const LawyerDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { lawyerId } = route.params;
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [booking, setBooking] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'razorpay'>('wallet');
  const balance = useWalletStore((s) => s.balance);

  useEffect(() => {
    fetchLawyer();
  }, [lawyerId]);

  useEffect(() => {
    if (lawyer) fetchSlots();
  }, [selectedDate, lawyer]);

  const fetchLawyer = async () => {
    try {
      const { data } = await lawyersApi.getById(lawyerId);
      setLawyer(data.lawyer || data);
    } catch {
      Alert.alert('Error', 'Failed to load lawyer details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async () => {
    if (!lawyer) return;
    setSlotsLoading(true);
    try {
      const { data } = await appointmentsApi.availability({
        lawyerId: lawyer.id,
        date: format(selectedDate, 'yyyy-MM-dd'),
      });
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot || !lawyer) return;
    setBooking(true);
    try {
      const scheduledAt = `${format(selectedDate, 'yyyy-MM-dd')}T${selectedSlot}:00`;
      if (paymentMethod === 'wallet') {
        await appointmentsApi.book({ lawyerId: lawyer.id, scheduledAt });
        Alert.alert('Success', 'Appointment booked successfully!');
        setShowBooking(false);
        navigation.goBack();
      } else {
        const { data } = await appointmentsApi.book({ lawyerId: lawyer.id, scheduledAt });
        // Razorpay flow would open here in production
        Alert.alert('Booking Created', 'Complete payment to confirm your appointment');
        setShowBooking(false);
      }
    } catch (err: any) {
      Alert.alert('Booking Failed', err.response?.data?.error || err.response?.data?.message || 'Please try again');
    } finally {
      setBooking(false);
    }
  };

  const dates = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i));

  if (loading || !lawyer) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={[COLORS.primary, COLORS.midnight]}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>

          <View style={styles.profileSection}>
            {lawyer.avatar ? (
              <Image source={{ uri: lawyer.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={40} color={COLORS.textMuted} />
              </View>
            )}
            <Text style={styles.name}>{lawyer.name}</Text>
            {lawyer.specialization?.length > 0 && (
              <Text style={styles.spec}>{lawyer.specialization.join(' · ')}</Text>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{lawyer.rating?.toFixed(1) || '0.0'}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{lawyer.experienceYears}y</Text>
                <Text style={styles.statLabel}>Experience</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{lawyer.reviewsCount}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Info cards */}
        <View style={styles.content}>
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Ionicons name="location-outline" size={18} color={COLORS.primary} />
              <Text style={styles.infoText}>{lawyer.location || 'N/A'}</Text>
            </View>
            <View style={styles.infoCard}>
              <Ionicons name="cash-outline" size={18} color={COLORS.success} />
              <Text style={styles.infoText}>₹{lawyer.fee?.toLocaleString('en-IN')}/session</Text>
            </View>
          </View>

          {lawyer.languages?.length > 0 && (
            <View style={styles.languagesRow}>
              <Text style={styles.langLabel}>Languages:</Text>
              <View style={styles.langChips}>
                {lawyer.languages.map((l, i) => (
                  <View key={i} style={styles.langChip}>
                    <Text style={styles.langChipText}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {lawyer.bio && (
            <View style={styles.bioSection}>
              <Text style={styles.bioTitle}>About</Text>
              <Text style={styles.bioText}>{lawyer.bio}</Text>
            </View>
          )}

          {/* Date picker */}
          <View style={styles.bookingSection}>
            <Text style={styles.bookingTitle}>Book Appointment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
              {dates.map((d, i) => {
                const isSelected = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                    onPress={() => { setSelectedDate(d); setSelectedSlot(null); }}
                  >
                    <Text style={[styles.dateDay, isSelected && styles.dateDaySelected]}>
                      {format(d, 'EEE')}
                    </Text>
                    <Text style={[styles.dateNum, isSelected && styles.dateNumSelected]}>
                      {format(d, 'dd')}
                    </Text>
                    <Text style={[styles.dateMonth, isSelected && styles.dateMonthSelected]}>
                      {format(d, 'MMM')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Time slots */}
            {slotsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ padding: SPACING.xl }} />
            ) : (
              <View style={styles.slotsGrid}>
                {slots.length > 0 ? slots.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.slotChip,
                      !s.available && styles.slotDisabled,
                      selectedSlot === s.time && styles.slotSelected,
                    ]}
                    onPress={() => s.available && setSelectedSlot(s.time)}
                    disabled={!s.available}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        !s.available && styles.slotTextDisabled,
                        selectedSlot === s.time && styles.slotTextSelected,
                      ]}
                    >
                      {s.time}
                    </Text>
                  </TouchableOpacity>
                )) : (
                  <Text style={styles.noSlots}>No slots available for this date</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom booking bar */}
      {selectedSlot && (
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomFee}>₹{lawyer.fee?.toLocaleString('en-IN')}</Text>
            <Text style={styles.bottomSlot}>{format(selectedDate, 'dd MMM')} at {selectedSlot}</Text>
          </View>
          <Button
            title="Book Now"
            onPress={() => setShowBooking(true)}
            size="md"
            fullWidth={false}
            style={{ paddingHorizontal: SPACING.xxl }}
          />
        </View>
      )}

      {/* Booking confirmation */}
      <BottomSheet visible={showBooking} onClose={() => setShowBooking(false)} title="Confirm Booking">
        <View style={styles.confirmContent}>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Lawyer</Text>
            <Text style={styles.confirmValue}>{lawyer.name}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Date</Text>
            <Text style={styles.confirmValue}>{format(selectedDate, 'dd MMM yyyy')}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Time</Text>
            <Text style={styles.confirmValue}>{selectedSlot}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Fee</Text>
            <Text style={styles.confirmValue}>₹{lawyer.fee?.toLocaleString('en-IN')}</Text>
          </View>

          <Text style={styles.paymentTitle}>Payment Method</Text>
          <View style={styles.paymentOptions}>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'wallet' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('wallet')}
            >
              <Ionicons name="wallet" size={22} color={paymentMethod === 'wallet' ? COLORS.white : COLORS.primary} />
              <Text style={[styles.paymentText, paymentMethod === 'wallet' && styles.paymentTextActive]}>
                Wallet (₹{balance.toLocaleString('en-IN')})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'razorpay' && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod('razorpay')}
            >
              <Ionicons name="card" size={22} color={paymentMethod === 'razorpay' ? COLORS.white : COLORS.primary} />
              <Text style={[styles.paymentText, paymentMethod === 'razorpay' && styles.paymentTextActive]}>
                Razorpay
              </Text>
            </TouchableOpacity>
          </View>

          <Button title="Confirm & Pay" onPress={handleBook} loading={booking} size="lg" />
        </View>
      </BottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: SPACING.huge + 10,
    paddingBottom: SPACING.xxxl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl + 4,
    borderBottomRightRadius: BORDER_RADIUS.xxl + 4,
  },
  backBtn: {
    marginLeft: SPACING.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: { alignItems: 'center', marginTop: SPACING.xl },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarPlaceholder: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.white, marginTop: SPACING.md },
  spec: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.xs },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    marginTop: SPACING.xl,
    gap: SPACING.xl,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.white },
  statLabel: { fontSize: FONT_SIZE.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
  content: { padding: SPACING.xl },
  infoRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.lg },
  infoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  infoText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  languagesRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg, flexWrap: 'wrap' },
  langLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary, marginRight: SPACING.sm },
  langChips: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  langChip: { backgroundColor: COLORS.surfaceAlt, paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  langChipText: { fontSize: FONT_SIZE.xs, fontWeight: '500', color: COLORS.textSecondary },
  bioSection: { marginBottom: SPACING.xl },
  bioTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  bioText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, lineHeight: 22 },
  bookingSection: { marginTop: SPACING.md },
  bookingTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.lg },
  dateScroll: { marginBottom: SPACING.lg },
  dateCard: {
    width: 64,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateCardSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dateDay: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.textMuted },
  dateDaySelected: { color: 'rgba(255,255,255,0.7)' },
  dateNum: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text, marginVertical: 2 },
  dateNumSelected: { color: COLORS.white },
  dateMonth: { fontSize: FONT_SIZE.xs, fontWeight: '500', color: COLORS.textMuted },
  dateMonthSelected: { color: 'rgba(255,255,255,0.7)' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingBottom: 120 },
  slotChip: {
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slotSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  slotDisabled: { opacity: 0.35 },
  slotText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  slotTextSelected: { color: COLORS.white },
  slotTextDisabled: { color: COLORS.textMuted },
  noSlots: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.xl, width: '100%' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xxl,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    ...SHADOWS.lg,
  },
  bottomFee: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  bottomSlot: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  confirmContent: { paddingBottom: SPACING.xl },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  confirmLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  confirmValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  paymentTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginTop: SPACING.xl, marginBottom: SPACING.md },
  paymentOptions: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.xxl },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  paymentOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  paymentText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  paymentTextActive: { color: COLORS.white },
});

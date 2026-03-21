import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Dimensions, Linking, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { formatErrorMessage } from '../../utils/formatError';
import { Lawyer, AvailabilitySlot } from '../../types';
import { lawyersApi, appointmentsApi } from '../../services/api';
import { API_URL } from '../../constants';
import { useWalletStore } from '../../stores/walletStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore, useColors } from '../../stores/themeStore';
import { format, addDays } from 'date-fns';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/Modals';
import { RazorpayCheckout } from '../../components/RazorpayCheckout';
import { RazorpayOrderOptions, RazorpayPaymentResult } from '../../utils/razorpay';

const { width } = Dimensions.get('window');

export const LawyerDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { lawyerId } = route.params;
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [booking, setBooking] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'razorpay'>('wallet');
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const balance = useWalletStore((s) => s.balance);
  const user = useAuthStore((s) => s.user);
  // Razorpay state
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrderOptions | null>(null);
  const [pendingAppointmentId, setPendingAppointmentId] = useState<string | null>(null);

  useEffect(() => {
    fetchLawyer();
    fetchReviews();
  }, [lawyerId]);

  useEffect(() => {
    if (lawyer) fetchSlots();
  }, [selectedDate, lawyer]);

  const fetchLawyer = async () => {
    try {
      const { data } = await lawyersApi.getById(lawyerId);
      const raw = data.lawyer || data;
      // normalize avatar fields and ensure full URL
      const avatarRaw = raw.avatar || raw.avatarUrl || raw.user?.avatar || raw.user?.avatarUrl;
      let avatar = avatarRaw;
      if (avatar && typeof avatar === 'string') {
        if (avatar.startsWith('/')) avatar = `${API_URL}${avatar}`;
        else if (!avatar.startsWith('http')) avatar = `${API_URL}/${avatar}`;
      }
      // normalize common fields so UI shows fee, specialization, location consistently
      const normalizedLawyer: any = {
        ...raw,
        avatar,
        specialization: raw.specializations || raw.specialization || [],
        location: [raw.city, raw.state].filter(Boolean).join(', ') || raw.location || raw.address || '',
        // feePerConsultation is stored in paise — convert to rupees
        fee: (raw.feePerConsultation != null ? Number(raw.feePerConsultation) : (raw.fee || 0)) / 100,
        reviewsCount: raw.stats?.totalReviews ?? raw.totalReviews ?? raw.reviewsCount ?? 0,
        experienceYears: raw.experienceYears || 0,
        rating: raw.stats?.averageRating ?? raw.rating ?? raw.avgRating ?? 0,
        isVerified: raw.isVerified || false,
        organisation: raw.organisation || null,
        barCouncil: raw.barCouncil || null,
        licenseNumber: raw.licenseNumber || null,
        stats: raw.stats || null,
        education: raw.education || null,
        experience: raw.experience || null,
      };
      setLawyer(normalizedLawyer as Lawyer);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err?.response?.data || err) || 'Failed to load lawyer details');
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
      // support multiple possible response shapes
      let slotsData: any = [];
      if (Array.isArray(data)) slotsData = data;
      else if (Array.isArray(data.slots)) slotsData = data.slots;
      else if (Array.isArray(data.availability)) slotsData = data.availability;
      else if (Array.isArray(data.timeSlots)) slotsData = data.timeSlots;
      else if (Array.isArray(data.data)) slotsData = data.data;
      else if (Array.isArray(data.availableSlots)) slotsData = data.availableSlots;
      else if (data && typeof data === 'object') {
        if (Array.isArray(data.data?.slots)) slotsData = data.data.slots;
        else if (Array.isArray(data.data)) slotsData = data.data;
      }

      const normalized = (slotsData || []).map((s: any) => {
        if (!s) return null;
        if (typeof s === 'string') {
          try {
            return { time: s, available: true, display: format(new Date(s), 'hh:mm a') } as any;
          } catch {
            return { time: s, available: true, display: s } as any;
          }
        }
        // try to get an ISO time if available
        const rawTime = s.time || s.slot || s.start || s.label || s.from || s.to || String(s);
        let iso = rawTime;
        // if rawTime looks like HH:mm, keep as-is for display but build iso later
        const looksLikeTime = /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime);
        if (!looksLikeTime && Date.parse(String(rawTime))) {
          try { iso = new Date(rawTime).toISOString(); } catch { iso = String(rawTime); }
        }
        const available = typeof s.available === 'boolean' ? s.available : s.isAvailable ?? true;
        const display = looksLikeTime ? rawTime : (Date.parse(String(iso)) ? format(new Date(iso), 'hh:mm a') : String(rawTime));
        return { time: iso, available, display } as any;
      }).filter(Boolean) as AvailabilitySlot[];

      setSlots(normalized.map((s: any) => ({ time: s.time, available: s.available, display: s.display })) as any);
    } catch (err: any) {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const { data } = await lawyersApi.getReviews(lawyerId, { page: 1, limit: 5 });
      setReviews(data.items || data.reviews || data.data || []);
    } catch {
      setReviews([]);
    }
  };

  const submitReview = async () => {
    if (rating < 1 || rating > 5) return;
    setSubmittingReview(true);
    try {
      await lawyersApi.postReview(lawyerId, { rating, comment: reviewComment.trim() || undefined });
      setShowReviewSheet(false);
      setRating(5);
      setReviewComment('');
      fetchReviews();
      Alert.alert('Success', 'Review submitted successfully');
    } catch (err: any) {
      Alert.alert('Review Failed', formatErrorMessage(err.response?.data || err) || 'Could not submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot || !lawyer) return;
    setBooking(true);
    try {
      let scheduledAt = '';
      if (selectedSlot.includes('T') && !/^\d{2}:\d{2}$/.test(selectedSlot)) {
        try { scheduledAt = new Date(selectedSlot).toISOString(); } catch { scheduledAt = selectedSlot; }
      } else {
        scheduledAt = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedSlot}`).toISOString();
      }
      const { data } = await appointmentsApi.book({ lawyerId: lawyer.id, scheduledAt, paymentMethod });
      const appointment = data.appointment || data.data || data;
      const appointmentId = appointment?.id || data?.id;

      if (paymentMethod === 'wallet') {
        Alert.alert('Success', 'Appointment booked successfully!');
        setShowBooking(false);
        navigation.goBack();
      } else {
        // Razorpay payment flow
        const payment = data?.payment || appointment?.payment || {};
        const orderId =
          payment?.providerOrderId ||
          payment?.razorpayOrderId ||
          payment?.metadata?.providerOrder?.id ||
          data?.orderId ||
          data?.order?.id;
        if (!orderId) {
          Alert.alert('Booked', 'Appointment created. Payment order unavailable — pay from wallet or try again.');
          setShowBooking(false);
          return;
        }
        setPendingAppointmentId(appointmentId);
        setRazorpayOrder({
          orderId,
          amount: (lawyer.fee || 0) * 100,
          name: 'NyayaX',
          description: `Consultation with ${lawyer.name}`,
          prefillEmail: user?.email || '',
          prefillPhone: user?.phone || '',
          prefillName: user?.name || '',
        });
        setShowBooking(false);
        setShowRazorpay(true);
      }
    } catch (err: any) {
      Alert.alert('Booking Failed', formatErrorMessage(err.response?.data || err) || 'Please try again');
    } finally {
      setBooking(false);
    }
  };

  const handleRazorpaySuccess = async (result: RazorpayPaymentResult) => {
    setShowRazorpay(false);
    try {
      if (pendingAppointmentId) {
        await appointmentsApi.confirmRazorpay(pendingAppointmentId, {
          appointmentId: pendingAppointmentId,
          razorpay_order_id: result.razorpay_order_id,
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_signature: result.razorpay_signature,
        });
      } else {
        await appointmentsApi.confirmPayment({
          appointmentId: pendingAppointmentId || '',
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_order_id: result.razorpay_order_id,
          razorpay_signature: result.razorpay_signature,
        });
      }
      Alert.alert('Success', 'Payment confirmed! Appointment booked.');
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Payment received but verification failed. Contact support.');
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.name}>{lawyer.name}</Text>
              {lawyer.isVerified && (
                <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
              )}
            </View>
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
              <Text style={styles.infoText}>₹{lawyer.fee?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/session</Text>
            </View>
          </View>

          {/* Professional details card */}
          {((lawyer as any).organisation || (lawyer as any).barCouncil || lawyer.licenseNumber) && (
            <View style={styles.proDetailCard}>
              {(lawyer as any).organisation && (
                <View style={styles.proDetailRow}>
                  <Ionicons name="business-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.proDetailText}>{(lawyer as any).organisation}</Text>
                </View>
              )}
              {(lawyer as any).barCouncil && (
                <View style={styles.proDetailRow}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.proDetailText}>Bar Council: {(lawyer as any).barCouncil}</Text>
                </View>
              )}
              {lawyer.licenseNumber && (
                <View style={styles.proDetailRow}>
                  <Ionicons name="document-text-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.proDetailText}>License: {lawyer.licenseNumber}</Text>
                </View>
              )}
            </View>
          )}

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

          {/* Reviews */}
          <View style={styles.reviewSection}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>Client Reviews</Text>
              <TouchableOpacity style={styles.addReviewBtn} onPress={() => setShowReviewSheet(true)}>
                <Ionicons name="star-outline" size={14} color={COLORS.primary} />
                <Text style={styles.addReviewBtnText}>Write Review</Text>
              </TouchableOpacity>
            </View>
            {reviews.length === 0 ? (
              <Text style={styles.noReviewText}>No reviews yet. Be the first to review.</Text>
            ) : (
              reviews.map((r, i) => (
                <View key={r.id || i} style={styles.reviewCard}>
                  <View style={styles.reviewTopRow}>
                    <Text style={styles.reviewName}>{r.client?.name || 'Client'}</Text>
                    <View style={styles.reviewStars}>
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Ionicons
                          key={idx}
                          name={idx < Number(r.rating || 0) ? 'star' : 'star-outline'}
                          size={12}
                          color={COLORS.accent}
                        />
                      ))}
                    </View>
                  </View>
                  {!!r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                </View>
              ))
            )}
          </View>

          {/* Case Statistics */}
          {(lawyer as any).stats && (
            <View style={styles.statsSection}>
              <Text style={styles.statsSectionTitle}>Case Statistics</Text>
              <View style={styles.statsCardsRow}>
                <View style={styles.statsCard}>
                  <Text style={styles.statsCardValue}>{(lawyer as any).stats.totalCases ?? 0}</Text>
                  <Text style={styles.statsCardLabel}>Total Cases</Text>
                </View>
                <View style={styles.statsCard}>
                  <Text style={styles.statsCardValue}>{(lawyer as any).stats.completedConsultations ?? 0}</Text>
                  <Text style={styles.statsCardLabel}>Consultations</Text>
                </View>
                <View style={styles.statsCard}>
                  <Text style={styles.statsCardValue}>{(lawyer as any).stats.successRate ?? 0}%</Text>
                  <Text style={styles.statsCardLabel}>Success Rate</Text>
                </View>
              </View>
            </View>
          )}

          {/* Education */}
          {(lawyer as any).education && (() => {
            try {
              const raw = (lawyer as any).education;
              const eds = typeof raw === 'string' ? JSON.parse(raw) : raw;
              const eduArr: any[] = Array.isArray(eds) ? eds : (eds ? [eds] : []);
              if (!eduArr.length) return null;
              return (
                <View style={styles.eduSection}>
                  <Text style={styles.eduTitle}>Education</Text>
                  {eduArr.map((e: any, i: number) => (
                    <View key={i} style={styles.eduCard}>
                      <Text style={styles.eduDegree}>{e.degree || e.title || String(e)}</Text>
                      {e.institution && <Text style={styles.eduInstitution}>{e.institution}</Text>}
                      {e.year && <Text style={styles.eduYear}>{e.year}</Text>}
                    </View>
                  ))}
                </View>
              );
            } catch { return null; }
          })()}

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
                      {(s as any).display || s.time}
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
            <Text style={styles.bottomFee}>₹{lawyer.fee?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            <Text style={styles.bottomSlot}>{format(selectedDate, 'dd MMM')} at {(() => {
              const found = slots.find((x) => x.time === selectedSlot) as any;
              if (found && found.display) return found.display;
              try {
                if (!selectedSlot) return '';
                return format(new Date(selectedSlot), 'hh:mm a');
              } catch { return selectedSlot || ''; }
            })()}</Text>
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
            <Text style={styles.confirmValue}>{(() => {
              const found = slots.find((x) => x.time === selectedSlot) as any;
              if (found && found.display) return found.display;
              try { if (!selectedSlot) return ''; return format(new Date(selectedSlot), 'hh:mm a'); } catch { return selectedSlot || ''; }
            })()}</Text>
          </View>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Fee</Text>
            <Text style={styles.confirmValue}>₹{lawyer.fee?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
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

      {/* Razorpay Checkout */}
      {razorpayOrder && (
        <RazorpayCheckout
          visible={showRazorpay}
          orderOptions={razorpayOrder}
          onSuccess={handleRazorpaySuccess}
          onCancel={() => { setShowRazorpay(false); Alert.alert('Cancelled', 'Payment was cancelled. Appointment is pending payment.'); }}
          onError={(err) => { setShowRazorpay(false); Alert.alert('Payment Failed', err.description || 'Please try again'); }}
        />
      )}

      <BottomSheet visible={showReviewSheet} onClose={() => setShowReviewSheet(false)} title="Write Review">
        <View style={styles.reviewForm}>
          <Text style={styles.reviewFormLabel}>Rating</Text>
          <View style={styles.ratingRow}>
            {Array.from({ length: 5 }).map((_, idx) => (
              <TouchableOpacity key={idx} onPress={() => setRating(idx + 1)}>
                <Ionicons name={idx < rating ? 'star' : 'star-outline'} size={28} color={COLORS.accent} />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.reviewInput}
            value={reviewComment}
            onChangeText={setReviewComment}
            placeholder="Share your experience (optional)"
            placeholderTextColor={COLORS.textMuted}
            multiline
          />
          <Button title={submittingReview ? 'Submitting...' : 'Submit Review'} onPress={submitReview} disabled={submittingReview} size="lg" />
        </View>
      </BottomSheet>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
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
  reviewSection: { marginBottom: SPACING.xl },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  reviewTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  addReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  addReviewBtnText: { fontSize: FONT_SIZE.xs, color: COLORS.primary, fontWeight: '700' },
  noReviewText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
  reviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    ...SHADOWS.sm,
  },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewName: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 6 },
  reviewForm: { paddingBottom: SPACING.xl },
  reviewFormLabel: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  ratingRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  reviewInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    minHeight: 96,
    textAlignVertical: 'top',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
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
  // Professional details
  proDetailCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  proDetailRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: SPACING.sm },
  proDetailText: { fontSize: FONT_SIZE.sm, color: COLORS.text, flex: 1 },
  // Case stats section
  statsSection: { marginBottom: SPACING.xl },
  statsSectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  statsCardsRow: { flexDirection: 'row' as const, gap: SPACING.md },
  statsCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center' as const,
    ...SHADOWS.sm,
  },
  statsCardValue: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.primary },
  statsCardLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' as const },
  // Education section
  eduSection: { marginBottom: SPACING.xl },
  eduTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md },
  eduCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  eduDegree: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  eduInstitution: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  eduYear: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
});

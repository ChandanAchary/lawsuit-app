import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi, storageApi } from '../../services/api';
import { Button } from '../../components/Button';
import { formatErrorMessage } from '../../utils/formatError';
import { RazorpayCheckout } from '../../components/RazorpayCheckout';
import { RazorpayOrderOptions, RazorpayPaymentResult } from '../../utils/razorpay';
import { useAuthStore } from '../../stores/authStore';
import { useWalletStore } from '../../stores/walletStore';
import { safeGoBack } from '../../utils/navigation';

const DURATIONS = [15, 30, 45, 60, 90, 120];
const MEETING_TYPES = [
  { key: 'AUDIO_CALL', label: 'Audio Call', icon: 'call-outline' },
  { key: 'VIDEO_CALL', label: 'Video Call', icon: 'videocam-outline' },
  { key: 'OFFICE_VISIT', label: 'Office Visit', icon: 'business-outline' },
];

export const OrgBookingScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const orgId = route.params?.orgId;
  const orgName = route.params?.orgName || 'Organization';

  // Single Date holds both the calendar day and the wall-clock time. Two
  // pickers (date + time mode) update different fields on the same Date.
  // Initialised to "tomorrow at 10:00" — a future-bias keeps the form
  // valid by default and matches how lawyers typically schedule.
  const [scheduledAt, setScheduledAt] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [duration, setDuration] = useState(30);
  const [meetingType, setMeetingType] = useState('AUDIO_CALL');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pull the org's consultation fee on mount so the booking sheet can show
  // the price up front and we can validate the amount the server returns
  // matches what the client agreed to. consultationFee is in PAISE.
  const [orgFeePaise, setOrgFeePaise] = useState<number | null>(null);
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await organizationsApi.getPublicById(orgId);
        const org = data?.organization || data?.data || data;
        if (!cancelled && typeof org?.consultationFee === 'number') {
          setOrgFeePaise(org.consultationFee);
        }
      } catch {
        // Non-fatal — server still validates fee at request time.
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);
  const feeRupees = orgFeePaise != null ? Math.max(1, Math.round(orgFeePaise / 100)) : null;

  // Pay-at-booking-time. Default razorpay matches the lawyer-direct flow.
  // Wallet is only offered when the client's balance is enough.
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'razorpay'>('razorpay');
  const walletBalance = useWalletStore((s) => s.balance);
  const user = useAuthStore((s) => s.user);

  // Razorpay checkout state — populated after server returns the order id.
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrderOptions | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingDocs, setPendingDocs] = useState<{ requestId: string } | null>(null);
  // Optional supporting documents the client wants the org head to review
  // before assigning a lawyer. Held locally; uploaded after the request
  // POST returns the new requestId. PDF / image / DOCX accepted to match
  // the server's OCR pipeline.
  type PickedDoc = { uri: string; name: string; mimeType: string; size?: number };
  const [pickedDocs, setPickedDocs] = useState<PickedDoc[]>([]);

  const handlePickDocs = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (pick.canceled || !pick.assets?.length) return;
      setPickedDocs((prev) => [
        ...prev,
        ...pick.assets.map((a) => ({
          uri: a.uri,
          name: a.name || 'attachment',
          mimeType: a.mimeType || 'application/octet-stream',
          size: a.size,
        })),
      ]);
    } catch (err: any) {
      Alert.alert('Could not pick files', formatErrorMessage(err) || 'Try again');
    }
  };

  const removePickedDoc = (index: number) => {
    setPickedDocs((prev) => prev.filter((_, i) => i !== index));
  };

  // Best-effort upload loop after the request is created. Failures are
  // reported in the success alert so the client knows to attach via chat
  // or AppointmentDetailScreen later.
  async function uploadDocsForRequest(requestId: string) {
    if (pickedDocs.length === 0) return { uploaded: 0, failed: 0 };
    let uploaded = 0;
    let failed = 0;
    const { data: signData } = await storageApi.getCloudinarySignature('org-request-docs');
    for (const doc of pickedDocs) {
      try {
        const formData = new FormData();
        formData.append('file', { uri: doc.uri, type: doc.mimeType, name: doc.name } as any);
        formData.append('timestamp', String(signData.timestamp));
        formData.append('signature', signData.signature);
        formData.append('api_key', signData.apiKey);
        formData.append('folder', signData.folder);
        const resourceType = doc.mimeType.startsWith('image/') ? 'image' : 'raw';
        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(signData.cloudName)}/${resourceType}/upload`,
          { method: 'POST', body: formData },
        );
        const uploadData = await uploadRes.json();
        if (!uploadData?.secure_url) throw new Error(uploadData?.error?.message || 'Upload failed');
        await organizationsApi.attachRequestDocument(requestId, {
          fileurl: uploadData.secure_url,
          fileName: doc.name,
          mimeType: doc.mimeType,
          size: doc.size,
        });
        uploaded += 1;
      } catch {
        failed += 1;
      }
    }
    return { uploaded, failed };
  }

  const handleBook = async () => {
    // Mirror the lawyer-direct booking flow — the org assigner needs at
    // least a paragraph of context to pick the right lawyer for the case.
    const trimmedNotes = notes.trim();
    if (trimmedNotes.length < 20) {
      return Alert.alert(
        'Describe your case',
        'Please write at least 20 characters about the legal issue. The organization needs this context to assign the right lawyer.',
      );
    }

    // Date/time come from the picker so they're always valid. Just check
    // it's in the future — the picker's minimumDate handles "today" but a
    // user could still pick today + a past time.
    if (scheduledAt.getTime() <= Date.now()) {
      return Alert.alert('Invalid time', 'Please pick a future date and time.');
    }

    // Wallet shortcut — block if the client doesn't have enough balance
    // before we hit the server, so the failure surfaces with a useful
    // message instead of a server-side wallet-debit error.
    if (paymentMethod === 'wallet' && feeRupees != null && walletBalance < feeRupees) {
      return Alert.alert(
        'Insufficient wallet balance',
        `You need ₹${feeRupees.toLocaleString('en-IN')} in your wallet to pay this way. Top up or pay online with Razorpay.`,
      );
    }

    setSubmitting(true);
    try {
      const { data } = await organizationsApi.createAppointmentRequest(orgId, {
        scheduledAt: scheduledAt.toISOString(),
        durationMins: duration,
        meetingType: meetingType as any,
        notes: notes.trim() || undefined,
        paymentMethod,
      });
      // Server returns { request, payment, paidVia } — different
      // post-conditions per payment path.
      const created = data?.request || data?.data || data;
      const requestId = created?.id;
      const payment = data?.payment;
      const paidVia: 'wallet' | 'razorpay' = data?.paidVia || paymentMethod;

      // Always upload picked docs first (regardless of payment path) so
      // the org head can read them while triaging.
      let docResult = { uploaded: 0, failed: 0 };
      if (requestId && pickedDocs.length > 0) {
        docResult = await uploadDocsForRequest(requestId);
      }
      const docMsg = pickedDocs.length === 0
        ? ''
        : docResult.failed === 0
          ? `\n${docResult.uploaded} document${docResult.uploaded === 1 ? '' : 's'} attached.`
          : `\n${docResult.uploaded}/${pickedDocs.length} attached, ${docResult.failed} failed — share the missing files via chat after assignment.`;

      if (paidVia === 'wallet') {
        Alert.alert(
          'Booking Submitted',
          `Payment of ₹${(payment?.amount ?? feeRupees ?? 0).toLocaleString('en-IN')} taken from your wallet. The organisation will assign a lawyer to your request.${docMsg}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        return;
      }

      // Razorpay path — open the in-app checkout. The post-success
      // handler calls /confirm-payment to verify the signature.
      const orderId =
        payment?.providerOrderId ||
        payment?.razorpayOrderId ||
        payment?.metadata?.providerOrder?.id;
      if (!orderId) {
        Alert.alert(
          'Payment unavailable',
          'Could not create a payment order. Please try again or pay from wallet.',
        );
        return;
      }
      const amountRupees = Number(payment?.amount ?? feeRupees ?? 0);
      setPendingRequestId(requestId);
      setRazorpayOrder({
        orderId,
        amount: Math.round(amountRupees * 100),
        name: 'NyayaX',
        description: `Consultation with ${orgName}`,
        prefillEmail: user?.email || '',
        prefillPhone: user?.phone || '',
        prefillName: user?.name || '',
      });
      setPendingDocs(docResult.failed > 0 || docResult.uploaded > 0 ? { requestId } : null);
      setShowRazorpay(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to submit booking request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRazorpaySuccess = async (result: RazorpayPaymentResult) => {
    setShowRazorpay(false);
    if (!pendingRequestId) {
      Alert.alert('Error', 'Missing request reference for payment confirmation.');
      return;
    }
    try {
      await organizationsApi.confirmRequestPayment(pendingRequestId, {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
      setPendingRequestId(null);
      setRazorpayOrder(null);
      Alert.alert(
        'Booking Confirmed',
        'Payment received. The organisation will assign a lawyer to your request.',
        [{ text: 'OK', onPress: () => safeGoBack(navigation, 'MainTabs') }],
      );
    } catch (err: any) {
      Alert.alert(
        'Payment verification failed',
        formatErrorMessage(err) || 'Payment was received but server verification failed. Contact support.',
      );
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Org Info */}
        <View style={styles.orgInfoCard}>
          <View style={styles.orgIcon}>
            <Ionicons name="business" size={24} color={COLORS.primary} />
          </View>
          <Text style={styles.orgName}>{orgName}</Text>
          <Text style={styles.orgDesc}>An available lawyer from this organization will be assigned to you.</Text>
        </View>

        {/* Date & Time — native pickers. Tapping the date pill opens the
            calendar; tapping the time pill opens the clock. Both update
            different parts of the same `scheduledAt` Date, so the form
            always carries a fully-formed timestamp. */}
        <Text style={styles.sectionTitle}>Date & Time</Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.pickerPill}
              activeOpacity={0.75}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerLabel}>Date</Text>
                <Text style={styles.pickerValue}>{format(scheduledAt, 'EEE, dd MMM yyyy')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pickerPill}
              activeOpacity={0.75}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={18} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickerLabel}>Time</Text>
                <Text style={styles.pickerValue}>{format(scheduledAt, 'hh:mm a')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={scheduledAt}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, picked) => {
              setShowDatePicker(false);
              if (!picked) return;
              // Preserve the existing time component when the user changes
              // the day, so we don't reset to midnight on every date pick.
              const next = new Date(picked);
              next.setHours(scheduledAt.getHours(), scheduledAt.getMinutes(), 0, 0);
              setScheduledAt(next);
            }}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={scheduledAt}
            mode="time"
            minuteInterval={15}
            onChange={(_, picked) => {
              setShowTimePicker(false);
              if (!picked) return;
              const next = new Date(scheduledAt);
              next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
              setScheduledAt(next);
            }}
          />
        )}

        {/* Duration */}
        <Text style={styles.sectionTitle}>Duration (minutes)</Text>
        <View style={styles.chipRow}>
          {DURATIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.durationChip, duration === d && styles.durationChipActive]}
              onPress={() => setDuration(d)}
            >
              <Text style={[styles.durationText, duration === d && styles.durationTextActive]}>{d} min</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Meeting Type */}
        <Text style={styles.sectionTitle}>Meeting Type</Text>
        <View style={styles.meetingRow}>
          {MEETING_TYPES.map((mt) => (
            <TouchableOpacity
              key={mt.key}
              style={[styles.meetingCard, meetingType === mt.key && styles.meetingCardActive]}
              onPress={() => setMeetingType(mt.key)}
            >
              <View style={[styles.meetingIcon, meetingType === mt.key && styles.meetingIconActive]}>
                <Ionicons name={mt.icon as any} size={22} color={meetingType === mt.key ? COLORS.white : COLORS.primary} />
              </View>
              <Text style={[styles.meetingLabel, meetingType === mt.key && styles.meetingLabelActive]}>
                {mt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notes — required so the org assigner has enough context to route
            the request to the right specialist. */}
        <Text style={styles.sectionTitle}>What's your case about?</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.notesInput}
            placeholder="Describe the legal issue. Include parties involved, jurisdiction, what you've already tried, and what outcome you're hoping for."
            value={notes}
            onChangeText={(t) => setNotes(t.slice(0, 500))}
            multiline
            numberOfLines={5}
            placeholderTextColor={COLORS.textMuted}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text
            style={[
              styles.notesCounter,
              notes.trim().length < 20 && { color: COLORS.error },
            ]}
          >
            {notes.length} / 500
            {notes.trim().length < 20
              ? ` · ${20 - notes.trim().length} more required`
              : ''}
          </Text>
        </View>

        {/* Supporting documents — uploaded after the request is created.
            The org head sees + OCRs these while choosing which lawyer to
            assign. Carries over to the assigned Appointment automatically. */}
        <Text style={styles.sectionTitle}>Supporting documents (optional)</Text>
        <View style={styles.card}>
          <Text style={styles.docHint}>
            Attach contracts, court notices, photos, or anything that helps explain your case. The
            organisation can run OCR + AI summary on these before assigning a lawyer.
          </Text>
          {pickedDocs.length > 0 && (
            <View style={styles.docList}>
              {pickedDocs.map((doc, i) => (
                <View key={`${doc.uri}-${i}`} style={styles.docItem}>
                  <Ionicons
                    name={doc.mimeType.startsWith('image/') ? 'image-outline' : 'document-outline'}
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                  <TouchableOpacity onPress={() => removePickedDoc(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.docPickBtn} onPress={handlePickDocs}>
            <Ionicons name="attach" size={18} color={COLORS.primary} />
            <Text style={styles.docPickText}>
              {pickedDocs.length === 0 ? 'Attach documents' : 'Add more documents'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Fee + Payment method — payment is taken at booking time, like
            the direct lawyer flow. The org head only assigns a lawyer
            after the booking is paid. */}
        <Text style={styles.sectionTitle}>Consultation fee</Text>
        <View style={styles.feeCard}>
          {feeRupees != null ? (
            <>
              <Text style={styles.feeAmount}>₹{feeRupees.toLocaleString('en-IN')}</Text>
              <Text style={styles.feeHint}>
                Set by {orgName}. Charged now to confirm the booking; the organisation will assign
                a lawyer once payment is received.
              </Text>
            </>
          ) : (
            <Text style={styles.feeHint}>Loading consultation fee…</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Payment method</Text>
        <View style={styles.payRow}>
          <TouchableOpacity
            style={[styles.payOpt, paymentMethod === 'wallet' && styles.payOptActive]}
            onPress={() => setPaymentMethod('wallet')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="wallet"
              size={22}
              color={paymentMethod === 'wallet' ? COLORS.white : COLORS.primary}
            />
            <Text style={[styles.payOptText, paymentMethod === 'wallet' && styles.payOptTextActive]}>
              Wallet (₹{walletBalance.toLocaleString('en-IN')})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.payOpt, paymentMethod === 'razorpay' && styles.payOptActive]}
            onPress={() => setPaymentMethod('razorpay')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="card"
              size={22}
              color={paymentMethod === 'razorpay' ? COLORS.white : COLORS.primary}
            />
            <Text style={[styles.payOptText, paymentMethod === 'razorpay' && styles.payOptTextActive]}>
              Razorpay
            </Text>
          </TouchableOpacity>
        </View>

        <Button
          title={
            feeRupees != null
              ? `Pay ₹${feeRupees.toLocaleString('en-IN')} & Submit`
              : 'Submit Booking Request'
          }
          onPress={handleBook}
          loading={submitting}
          size="lg"
          disabled={feeRupees == null}
          style={{ marginTop: SPACING.lg }}
        />
      </ScrollView>

      {/* Razorpay checkout — only mounts when an order exists. On success
          we call confirmRequestPayment which verifies the signature and
          marks the payment COMPLETED + escrow HELD on the server. */}
      {razorpayOrder && (
        <RazorpayCheckout
          visible={showRazorpay}
          orderOptions={razorpayOrder}
          onSuccess={handleRazorpaySuccess}
          onCancel={() => {
            setShowRazorpay(false);
            Alert.alert(
              'Payment cancelled',
              'Your request has been submitted but is unpaid. Pay later from your appointment requests list to confirm.',
              [{ text: 'OK', onPress: () => navigation.goBack() }],
            );
          }}
          onError={(err) => {
            setShowRazorpay(false);
            Alert.alert('Payment failed', err.description || 'Please try again.');
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm, zIndex: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: FONT_SIZE.xl, fontWeight: '900', color: COLORS.text },
  scrollContent: { padding: SPACING.xl, paddingBottom: 120 },
  orgInfoCard: {
    backgroundColor: COLORS.primary + '08', borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.primary + '15',
  },
  orgIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
  },
  orgName: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  orgDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 20 },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.md, marginTop: SPACING.md },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    ...SHADOWS.sm, marginBottom: SPACING.md,
  },
  inputRow: { flexDirection: 'row', gap: SPACING.md },
  pickerPill: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  pickerLabel: { fontSize: FONT_SIZE.xs - 1, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' },
  pickerValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  durationChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  durationChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  durationText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  durationTextActive: { color: COLORS.white },
  meetingRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  meetingCard: {
    flex: 1, alignItems: 'center', backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg, ...SHADOWS.sm,
    borderWidth: 2, borderColor: 'transparent',
  },
  meetingCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '04' },
  meetingIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight + '20',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
  },
  meetingIconActive: { backgroundColor: COLORS.primary },
  meetingLabel: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center' },
  meetingLabelActive: { color: COLORS.primary },
  notesInput: {
    fontSize: FONT_SIZE.md, color: COLORS.text, minHeight: 110,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  notesCounter: {
    fontSize: FONT_SIZE.xs - 1, color: COLORS.textMuted,
    textAlign: 'right', marginTop: SPACING.xs,
  },
  docHint: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 17, marginBottom: SPACING.md },
  docList: { gap: SPACING.sm, marginBottom: SPACING.md },
  docItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  docName: { flex: 1, fontSize: FONT_SIZE.sm, color: COLORS.text },
  docPickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary + '0E', borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1, borderColor: COLORS.primary + '30',
    borderStyle: 'dashed' as any,
  },
  docPickText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' },

  feeCard: {
    backgroundColor: COLORS.primary + '0E',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderLeftWidth: 4, borderLeftColor: COLORS.primary,
    marginBottom: SPACING.md,
  },
  feeAmount: { fontSize: FONT_SIZE.xxxl, fontWeight: '900', color: COLORS.text },
  feeHint: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, lineHeight: 18, marginTop: 4 },

  payRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  payOpt: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  payOptActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  payOptText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  payOptTextActive: { color: COLORS.white },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Dimensions, Linking, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { formatErrorMessage } from '../../utils/formatError';
import { Lawyer, AvailabilitySlot } from '../../types';
import { lawyersApi, appointmentsApi, storageApi } from '../../services/api';
import { useWalletStore } from '../../stores/walletStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore, useColors } from '../../stores/themeStore';
import { getRuntimeApiUrl } from '../../services/runtimeApiConfig';
import { format, addDays, parse } from 'date-fns';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/Modals';
import { RazorpayCheckout } from '../../components/RazorpayCheckout';
import { RazorpayOrderOptions, RazorpayPaymentResult } from '../../utils/razorpay';
import { safeGoBack } from '../../utils/navigation';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

type SlotState = 'AVAILABLE' | 'BOOKED' | 'PASSED' | 'LAWYER_OFF';

interface DisplaySlot extends AvailabilitySlot {
  status: SlotState;
  reason?: string;
}

interface AvailabilityConfig {
  isAvailable: boolean;
  startTime: string;
  endTime: string;
  workingDays: string[];
  hasCustomWindow: boolean;
}

const DEFAULT_AVAILABILITY: AvailabilityConfig = {
  isAvailable: true,
  startTime: '06:00',
  endTime: '19:00',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  hasCustomWindow: false,
};

const normalizeWeekday = (weekday: string) => {
  const raw = String(weekday || '').trim().toLowerCase();
  const map: Record<string, string> = {
    monday: 'Monday', mon: 'Monday',
    tuesday: 'Tuesday', tue: 'Tuesday', tues: 'Tuesday',
    wednesday: 'Wednesday', wed: 'Wednesday',
    thursday: 'Thursday', thu: 'Thursday', thurs: 'Thursday',
    friday: 'Friday', fri: 'Friday',
    saturday: 'Saturday', sat: 'Saturday',
    sunday: 'Sunday', sun: 'Sunday',
  };
  return map[raw] || weekday;
};

const extractAvailabilityConfig = (lawyer: any): AvailabilityConfig => {
  const config: AvailabilityConfig = {
    ...DEFAULT_AVAILABILITY,
    isAvailable: lawyer?.isAvailable !== false,
  };

  const exp = lawyer?.experience;
  if (Array.isArray(exp)) {
    const availabilityEntry = exp.find((e: any) =>
      e?.title === 'Availability' || String(e?.description || '').includes('workingDays'),
    );
    if (availabilityEntry) {
      if (typeof availabilityEntry.from === 'string' && availabilityEntry.from.trim()) {
        config.startTime = availabilityEntry.from.trim();
        config.hasCustomWindow = true;
      }
      if (typeof availabilityEntry.to === 'string' && availabilityEntry.to.trim()) {
        config.endTime = availabilityEntry.to.trim();
        config.hasCustomWindow = true;
      }
      try {
        const parsed = typeof availabilityEntry.description === 'string'
          ? JSON.parse(availabilityEntry.description)
          : availabilityEntry.description;
        if (Array.isArray(parsed?.workingDays) && parsed.workingDays.length > 0) {
          config.workingDays = parsed.workingDays.map(normalizeWeekday);
        }
      } catch {
        // Ignore malformed legacy availability descriptions.
      }
    }
  } else if (exp && typeof exp === 'object') {
    if (typeof exp.startTime === 'string' && exp.startTime.trim()) {
      config.startTime = exp.startTime.trim();
      config.hasCustomWindow = true;
    }
    if (typeof exp.endTime === 'string' && exp.endTime.trim()) {
      config.endTime = exp.endTime.trim();
      config.hasCustomWindow = true;
    }
    if (Array.isArray(exp.workingDays) && exp.workingDays.length > 0) {
      config.workingDays = exp.workingDays.map(normalizeWeekday);
    }
  }

  return config;
};

const parseHHMM = (timeText: string): { h: number; m: number } | null => {
  const match = String(timeText || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return { h, m };
};

const parseTimeToMinutes = (value: unknown): number | null => {
  if (value == null) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes();
  }

  const text = String(value).trim();
  if (!text) return null;

  const hhmmss = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmmss) {
    const h = Number(hhmmss[1]);
    const m = Number(hhmmss[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return h * 60 + m;
  }

  const ampm = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const period = ampm[3].toUpperCase();
    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getHours() * 60 + parsed.getMinutes();
  }

  return null;
};

const formatMinutesAsDisplay = (baseDate: Date, minutes: number): string => {
  const d = new Date(baseDate);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return format(d, 'hh:mm a');
};

export const LawyerDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { lawyerId } = route.params;
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<DisplaySlot[]>([]);
  const [slotNotice, setSlotNotice] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [booking, setBooking] = useState(false);
  const [availabilityWindow, setAvailabilityWindow] = useState<{ start: string; end: string } | null>(null);
  const [showSlotDatePicker, setShowSlotDatePicker] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'razorpay'>('wallet');
  // Free-text problem description sent as `notes` on the booking. Lawyers
  // see this on the queue card + appointment detail before accepting, so a
  // 20-char floor keeps blank descriptions out of the queue.
  const [problemNotes, setProblemNotes] = useState('');
  const NOTES_MIN = 20;
  const NOTES_MAX = 500;

  // Optional supporting documents the client wants the lawyer to review
  // before accepting. We collect picks locally; bytes are uploaded to
  // Cloudinary AFTER the booking POST succeeds (so we have an
  // appointmentId to attach them to). PDF / image / DOCX accepted to
  // match the server's OCR pipeline.
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

  // Cloudinary signed-upload + appointmentsApi.attachDocument loop. Best-
  // effort — a failed attachment doesn't roll back the booking, but the
  // user is warned. The lawyer can ask for missing docs via chat.
  async function uploadDocsForAppointment(appointmentId: string) {
    if (pickedDocs.length === 0) return { uploaded: 0, failed: 0 };
    let uploaded = 0;
    let failed = 0;
    const { data: signData } = await storageApi.getCloudinarySignature('appointment-docs');
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
        await appointmentsApi.attachDocument(appointmentId, {
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
  const [reviews, setReviews] = useState<any[]>([]);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewEligibilityLoading, setReviewEligibilityLoading] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewEligibilityMessage, setReviewEligibilityMessage] = useState('Book and complete a consultation with this lawyer before reviewing');
  const balance = useWalletStore((s) => s.balance);
  const user = useAuthStore((s) => s.user);
  // Razorpay state
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrderOptions | null>(null);
  const [pendingPaymentReference, setPendingPaymentReference] = useState<string | null>(null);

  useEffect(() => {
    fetchLawyer();
    fetchReviews();
    fetchReviewEligibility();
  }, [lawyerId]);

  useEffect(() => {
    if (lawyer) fetchSlots();
  }, [selectedDate, lawyer]);

  useEffect(() => {
    if (!selectedSlot) return;
    const selected = slots.find((s) => s.time === selectedSlot || s.display === selectedSlot);
    if (!selected || selected.status !== 'AVAILABLE') {
      setSelectedSlot(null);
    }
  }, [slots, selectedSlot]);

  const normalizeScheduledAt = (slot: string, date: Date): string | null => {
    try {
      const trimmed = String(slot || '').trim();
      if (!trimmed) return null;

      if (trimmed.includes('T') && !Number.isNaN(Date.parse(trimmed))) {
        return new Date(trimmed).toISOString();
      }

      if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
        return new Date(`${format(date, 'yyyy-MM-dd')}T${trimmed}`).toISOString();
      }

      if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(trimmed)) {
        return parse(trimmed.toUpperCase(), 'hh:mm a', date).toISOString();
      }

      if (!Number.isNaN(Date.parse(trimmed))) {
        return new Date(trimmed).toISOString();
      }
      return null;
    } catch {
      return null;
    }
  };

  const isSlotAlreadyBookedError = (err: any): boolean => {
    const raw = String(
      err?.response?.data?.error || err?.response?.data?.message || err?.message || '',
    ).toLowerCase();
    return raw.includes('unique constraint failed') && raw.includes('lawyerid') && raw.includes('scheduledat');
  };

  const fetchLawyer = async () => {
    try {
      const { data } = await lawyersApi.getById(lawyerId);
      const raw = data.lawyer || data;
      // normalize avatar fields and ensure full URL
      const avatarRaw = raw.avatar || raw.avatarUrl || raw.user?.avatar || raw.user?.avatarUrl;
      let avatar = avatarRaw;
      const apiUrl = getRuntimeApiUrl();
      if (avatar && typeof avatar === 'string') {
        if (avatar.startsWith('/')) avatar = `${apiUrl}${avatar}`;
        else if (!avatar.startsWith('http')) avatar = `${apiUrl}/${avatar}`;
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
      safeGoBack(navigation, 'MainTabs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async () => {
    if (!lawyer) return;
    setSlotsLoading(true);
    try {
      const availabilityConfig = extractAvailabilityConfig(lawyer as any);
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

      const normalizedAvailable = (slotsData || []).map((s: any) => {
        if (!s) return null;
        if (typeof s === 'string') {
          const mins = parseTimeToMinutes(s);
          if (mins != null) {
            return { time: s, available: true, display: formatMinutesAsDisplay(selectedDate, mins) } as any;
          }
          return { time: s, available: true, display: s } as any;
        }
        // try to get an ISO time if available
        const rawTime = s.time || s.slot || s.start || s.label || s.from || s.to || String(s);
        let iso = rawTime;
        const parsedMins = parseTimeToMinutes(rawTime);
        if (parsedMins == null && Date.parse(String(rawTime))) {
          try { iso = new Date(rawTime).toISOString(); } catch { iso = String(rawTime); }
        }
        const available = typeof s.available === 'boolean' ? s.available : s.isAvailable ?? true;
        const display = parsedMins != null
          ? formatMinutesAsDisplay(selectedDate, parsedMins)
          : (Date.parse(String(iso)) ? format(new Date(iso), 'hh:mm a') : String(rawTime));
        return { time: iso, available, display } as any;
      }).filter(Boolean) as AvailabilitySlot[];

      const availableMinuteSet = new Set(
        normalizedAvailable
          .filter((s: any) => s.available !== false)
          .map((s: any) => parseTimeToMinutes((s as any).display || (s as any).time))
          .filter((m: any) => Number.isFinite(m)),
      );

      const parsedStart = parseHHMM(availabilityConfig.startTime) || parseHHMM(DEFAULT_AVAILABILITY.startTime)!;
      const parsedEnd = parseHHMM(availabilityConfig.endTime) || parseHHMM(DEFAULT_AVAILABILITY.endTime)!;

      if (!availabilityConfig.hasCustomWindow && normalizedAvailable.length > 0) {
        const minuteValues = normalizedAvailable
          .map((slot: any) => parseTimeToMinutes(String((slot as any).display || (slot as any).time || '')))
          .filter((m): m is number => typeof m === 'number' && Number.isFinite(m))
          .sort((a: number, b: number) => a - b);
        if (minuteValues.length > 0) {
          const first = minuteValues[0];
          const last = minuteValues[minuteValues.length - 1];
          parsedStart.h = Math.floor(first / 60);
          parsedStart.m = first % 60;
          // Include last slot as part of visible working range.
          const lastEnd = last + 30;
          parsedEnd.h = Math.floor(lastEnd / 60);
          parsedEnd.m = lastEnd % 60;
        }
      }

      const dayStart = new Date(selectedDate);
      dayStart.setHours(parsedStart.h, parsedStart.m, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(parsedEnd.h, parsedEnd.m, 0, 0);
      setAvailabilityWindow({
        start: format(dayStart, 'hh:mm a'),
        end: format(dayEnd, 'hh:mm a'),
      });

      const weekdayName = normalizeWeekday(format(selectedDate, 'EEEE'));
      const isWorkingDay = availabilityConfig.workingDays.includes(weekdayName);
      if (!availabilityConfig.isAvailable) {
        setSlotNotice('Lawyer is currently not available for consultations.');
      } else if (!isWorkingDay) {
        setSlotNotice(`Lawyer does not accept appointments on ${weekdayName}.`);
      } else {
        setSlotNotice(null);
      }
      const now = new Date();
      const generatedSlots: DisplaySlot[] = [];

      let cursor = new Date(dayStart);
      while (cursor < dayEnd) {
        const slotEnd = new Date(cursor);
        slotEnd.setMinutes(slotEnd.getMinutes() + 30);
        if (slotEnd > dayEnd) break;

        const display = format(cursor, 'hh:mm a');
        const isPast = format(selectedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd') && slotEnd <= now;
        const cursorMins = cursor.getHours() * 60 + cursor.getMinutes();
        const isAvailable = availableMinuteSet.has(cursorMins);

        let status: SlotState = 'BOOKED';
        let reason: string | undefined;

        if (!availabilityConfig.isAvailable) {
          status = 'LAWYER_OFF';
          reason = 'Lawyer not available';
        } else if (!isWorkingDay) {
          status = 'LAWYER_OFF';
          reason = 'Lawyer not available on this day';
        } else if (isPast) {
          status = 'PASSED';
          reason = 'Time passed';
        } else if (isAvailable) {
          status = 'AVAILABLE';
        } else {
          status = 'BOOKED';
          reason = 'Already booked';
        }

        generatedSlots.push({
          time: display,
          display,
          available: status === 'AVAILABLE',
          status,
          reason,
        });

        cursor.setMinutes(cursor.getMinutes() + 30);
      }

      setSlots(generatedSlots);
    } catch (err: any) {
      setSlots([]);
      setSlotNotice(null);
      setAvailabilityWindow(null);
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

  const fetchReviewEligibility = async () => {
    setReviewEligibilityLoading(true);
    try {
      const { data } = await lawyersApi.getReviewEligibility(lawyerId);
      setCanReview(Boolean(data?.canReview));
      if (typeof data?.message === 'string' && data.message.trim()) {
        setReviewEligibilityMessage(data.message);
      } else if (data?.canReview) {
        setReviewEligibilityMessage('You can submit a review');
      } else {
        setReviewEligibilityMessage('Book and complete a consultation with this lawyer before reviewing');
      }
    } catch {
      setCanReview(false);
      setReviewEligibilityMessage('Book and complete a consultation with this lawyer before reviewing');
    } finally {
      setReviewEligibilityLoading(false);
    }
  };

  const submitReview = async () => {
    if (!canReview) {
      Alert.alert('Review Not Allowed', reviewEligibilityMessage);
      return;
    }
    if (rating < 1 || rating > 5) return;
    setSubmittingReview(true);
    try {
      await lawyersApi.postReview(lawyerId, { rating, comment: reviewComment.trim() || undefined });
      setShowReviewSheet(false);
      setRating(5);
      setReviewComment('');
      fetchReviews();
      fetchReviewEligibility();
      Alert.alert('Success', 'Review submitted successfully');
    } catch (err: any) {
      Alert.alert('Review Failed', formatErrorMessage(err.response?.data || err) || 'Could not submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleBook = async () => {
    if (!selectedSlot || !lawyer) return;
    const trimmedNotes = problemNotes.trim();
    if (trimmedNotes.length < NOTES_MIN) {
      Alert.alert(
        'Describe your case',
        `Please write at least ${NOTES_MIN} characters about the legal issue. The lawyer needs this context to accept the consultation.`,
      );
      return;
    }
    setBooking(true);
    try {
      const scheduledAt = normalizeScheduledAt(selectedSlot, selectedDate);
      if (!scheduledAt) {
        Alert.alert('Invalid Slot', 'Please select a valid time slot.');
        return;
      }
      const { data } = await appointmentsApi.book({
        lawyerId: lawyer.id,
        scheduledAt,
        paymentMethod,
        notes: trimmedNotes,
      });
      const appointment = data.appointment || data.data || data;
      const appointmentId = appointment?.id || data?.id;

      // Upload supporting documents (if any) before navigating away. The
      // upload loop is best-effort; failures are reported in the success
      // toast so the user knows to re-attach via chat or detail screen.
      let docResult = { uploaded: 0, failed: 0 };
      if (appointmentId && pickedDocs.length > 0) {
        docResult = await uploadDocsForAppointment(appointmentId);
      }

      if (paymentMethod === 'wallet') {
        const docMsg = pickedDocs.length === 0
          ? ''
          : docResult.failed === 0
            ? `\n${docResult.uploaded} document${docResult.uploaded === 1 ? '' : 's'} attached.`
            : `\n${docResult.uploaded}/${pickedDocs.length} documents attached, ${docResult.failed} failed — you can retry from the appointment detail screen.`;
        Alert.alert('Success', `Appointment booked successfully!${docMsg}`);
        setShowBooking(false);
        setPickedDocs([]);
        safeGoBack(navigation, 'MainTabs');
      } else {
        // Razorpay payment flow
        const payment = data?.payment || appointment?.payment || {};
        const expectedFeeRupees = Number(lawyer.fee || 0);
        const backendAmountRupees = Number(payment?.amount || 0);
        const effectiveAmountRupees = backendAmountRupees || expectedFeeRupees;

        if (
          expectedFeeRupees > 0 &&
          backendAmountRupees > 0 &&
          (backendAmountRupees > expectedFeeRupees * 2 || backendAmountRupees < expectedFeeRupees / 2)
        ) {
          Alert.alert(
            'Payment Amount Mismatch',
            `Expected consultation fee ₹${expectedFeeRupees.toLocaleString('en-IN')}, but payment request is ₹${backendAmountRupees.toLocaleString('en-IN')}. Please try again later.`,
          );
          setShowBooking(false);
          return;
        }

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
        const paymentReference = appointmentId || orderId;
        setPendingPaymentReference(paymentReference);
        setRazorpayOrder({
          orderId,
          amount: Math.round(effectiveAmountRupees * 100),
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
      if (isSlotAlreadyBookedError(err)) {
        setSelectedSlot(null);
        await fetchSlots();
        Alert.alert('Slot Unavailable', 'This time slot was just booked by another user. Please select another slot.');
        return;
      }
      Alert.alert('Booking Failed', formatErrorMessage(err.response?.data || err) || 'Please try again');
    } finally {
      setBooking(false);
    }
  };

  const handleRazorpaySuccess = async (result: RazorpayPaymentResult) => {
    setShowRazorpay(false);
    try {
      const paymentReference = pendingPaymentReference || result.razorpay_order_id;
      if (!paymentReference) {
        Alert.alert('Error', 'Missing appointment reference for payment confirmation.');
        return;
      }

      await appointmentsApi.confirmRazorpay(paymentReference, {
        appointmentId: paymentReference,
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });

      setPendingPaymentReference(null);
      Alert.alert('Success', 'Payment confirmed! Appointment booked.');
      safeGoBack(navigation, 'MainTabs');
    } catch {
      Alert.alert('Error', 'Payment received but verification failed. Contact support.');
    }
  };

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const selectedDateInWeek = dates.some((d) => format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd'));

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
          <TouchableOpacity style={styles.backBtn} onPress={() => safeGoBack(navigation, 'MainTabs')}>
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
            {!lawyer.isVerified && (
              <View style={styles.unverifiedTag}>
                <Ionicons name="alert-circle-outline" size={13} color={COLORS.warning} />
                <Text style={styles.unverifiedTagText}>Not Verified by Any Court</Text>
              </View>
            )}
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
              <TouchableOpacity
                style={[styles.addReviewBtn, (!canReview || reviewEligibilityLoading) && styles.addReviewBtnDisabled]}
                onPress={() => {
                  if (!canReview) {
                    Alert.alert('Review Not Allowed', reviewEligibilityMessage);
                    return;
                  }
                  setShowReviewSheet(true);
                }}
                disabled={reviewEligibilityLoading}
              >
                <Ionicons name="star-outline" size={14} color={COLORS.primary} />
                <Text style={styles.addReviewBtnText}>Write Review</Text>
              </TouchableOpacity>
            </View>
            {!canReview && (
              <Text style={styles.reviewEligibilityHint}>{reviewEligibilityMessage}</Text>
            )}
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
            {!!availabilityWindow && (
              <Text style={styles.bookingWindowText}>
                Availability: {availabilityWindow.start} - {availabilityWindow.end}
              </Text>
            )}
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
              <TouchableOpacity style={styles.datePickerCard} onPress={() => setShowSlotDatePicker(true)}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                <Text style={styles.datePickerCardText}>Pick date</Text>
              </TouchableOpacity>
            </ScrollView>
            {!selectedDateInWeek && (
              <Text style={styles.selectedCustomDateText}>Selected: {format(selectedDate, 'EEE, dd MMM yyyy')}</Text>
            )}

            {showSlotDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                minimumDate={new Date()}
                onChange={(_, date) => {
                  setShowSlotDatePicker(false);
                  if (date) {
                    setSelectedDate(date);
                    setSelectedSlot(null);
                  }
                }}
              />
            )}

            {/* Time slots */}
            {slotsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ padding: SPACING.xl }} />
            ) : (
              <View style={styles.slotsGrid}>
                {!!slotNotice && <Text style={styles.slotNotice}>{slotNotice}</Text>}
                {slots.length > 0 ? slots.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.slotChip,
                      s.status !== 'AVAILABLE' && styles.slotDisabled,
                      s.status === 'PASSED' && styles.slotPassed,
                      s.status === 'LAWYER_OFF' && styles.slotUnavailable,
                      selectedSlot === s.time && styles.slotSelected,
                    ]}
                    onPress={() => s.status === 'AVAILABLE' && setSelectedSlot(s.time)}
                    disabled={s.status !== 'AVAILABLE'}
                  >
                    <View style={styles.slotContent}>
                      <Text
                        style={[
                          styles.slotText,
                          s.status !== 'AVAILABLE' && styles.slotTextDisabled,
                          s.status === 'PASSED' && styles.slotTextPassed,
                          selectedSlot === s.time && styles.slotTextSelected,
                        ]}
                      >
                        {(s as any).display || s.time}
                      </Text>
                      {s.status !== 'AVAILABLE' && (
                        <Text
                          style={[
                            styles.slotBookedLabel,
                            s.status === 'PASSED' && styles.slotPassedLabel,
                            s.status === 'LAWYER_OFF' && styles.slotUnavailableLabel,
                          ]}
                        >
                          {s.status === 'BOOKED' ? 'Booked' : s.status === 'PASSED' ? 'Passed' : 'Unavailable'}
                        </Text>
                      )}
                    </View>
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

          <Text style={styles.paymentTitle}>What's your case about?</Text>
          <Text style={styles.notesHint}>
            Briefly describe your legal issue. This helps the lawyer understand your case before
            accepting the consultation.
          </Text>
          <TextInput
            style={styles.notesInput}
            value={problemNotes}
            onChangeText={(t) => setProblemNotes(t.slice(0, NOTES_MAX))}
            placeholder="e.g. I'm dealing with a property dispute over inherited land in Pune. The other party..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={NOTES_MAX}
          />
          <Text
            style={[
              styles.notesCounter,
              problemNotes.trim().length < NOTES_MIN && { color: COLORS.error },
            ]}
          >
            {problemNotes.length} / {NOTES_MAX}
            {problemNotes.trim().length < NOTES_MIN
              ? ` · ${NOTES_MIN - problemNotes.trim().length} more required`
              : ''}
          </Text>

          {/* Optional supporting documents — PDF, images, DOCX. Uploaded
              after booking succeeds; the lawyer can run OCR + AI on them
              from the appointment detail screen before accepting. */}
          <Text style={styles.paymentTitle}>Supporting documents (optional)</Text>
          <Text style={styles.notesHint}>
            Attach contracts, court notices, photos, or anything that helps explain your case. The
            lawyer can run OCR and AI summary on these from the appointment detail screen.
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

          <Button
            title="Confirm & Pay"
            onPress={handleBook}
            loading={booking}
            size="lg"
            disabled={problemNotes.trim().length < NOTES_MIN}
          />
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
  unverifiedTag: {
    marginTop: SPACING.xs,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  addReviewBtnDisabled: {
    opacity: 0.5,
  },
  unverifiedTagText: {
    color: '#FCD34D',
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
  reviewEligibilityHint: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
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
  bookingWindowText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    fontWeight: '600',
  },
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
  datePickerCard: {
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 6,
  },
  datePickerCardText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: COLORS.primary,
  },
  selectedCustomDateText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
    fontWeight: '600',
  },
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
  slotPassed: {
    backgroundColor: COLORS.surfaceAlt,
  },
  slotUnavailable: {
    backgroundColor: COLORS.surfaceAlt,
  },
  slotText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text },
  slotTextSelected: { color: COLORS.white },
  slotTextDisabled: { color: COLORS.textMuted },
  slotTextPassed: {
    textDecorationLine: 'line-through',
  },
  slotContent: { alignItems: 'center' },
  slotBookedLabel: {
    marginTop: 2,
    fontSize: FONT_SIZE.xs - 1,
    fontWeight: '700',
    color: COLORS.error,
    textTransform: 'uppercase',
  },
  slotPassedLabel: {
    color: COLORS.textMuted,
  },
  slotUnavailableLabel: {
    color: COLORS.warning,
  },
  slotNotice: {
    width: '100%',
    fontSize: FONT_SIZE.sm,
    color: COLORS.warning,
    marginBottom: SPACING.sm,
  },
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
  notesHint: {
    fontSize: FONT_SIZE.xs, color: COLORS.textMuted,
    marginBottom: SPACING.sm, lineHeight: 17,
  },
  notesInput: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.sm, color: COLORS.text,
    minHeight: 110, lineHeight: 20,
  },
  notesCounter: {
    fontSize: FONT_SIZE.xs - 1, color: COLORS.textMuted,
    textAlign: 'right', marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
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
    paddingVertical: SPACING.md, marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.primary + '30',
    borderStyle: 'dashed' as any,
  },
  docPickText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: '700' },
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

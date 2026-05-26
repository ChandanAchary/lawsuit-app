import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  Image, ActivityIndicator, Alert, Linking, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, APPOINTMENT_STATUS_COLORS } from '../../constants';
import { appointmentsApi, paymentsApi, storageApi } from '../../services/api';
import { Appointment, AppointmentStatus } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/Button';
import { useWalletStore } from '../../stores/walletStore';
import { formatErrorMessage } from '../../utils/formatError';

interface Props {
  navigation: any;
  route: { params: { appointmentId: string; appointment?: Appointment } };
}

export const AppointmentDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const { appointmentId, appointment: passedAppt } = route.params;
  const role = useAuthStore((s) => s.user?.role);
  const { fetchBalance, fetchTransactions } = useWalletStore();

  const [appointment, setAppointment] = useState<Appointment | null>(passedAppt || null);
  const [paymentDetails, setPaymentDetails] = useState<any | null>((passedAppt as any)?.payment || null);
  const [loading, setLoading] = useState(!passedAppt);
  const [refreshing, setRefreshing] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  // Reschedule uses a single Date for both day + time. Two pickers update
  // different parts of it. Initialised to "tomorrow at 10:00" when the
  // modal opens (see openReschedule below) so the user always lands on a
  // valid future timestamp.
  const [rescheduleAt, setRescheduleAt] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showRescheduleDate, setShowRescheduleDate] = useState(false);
  const [showRescheduleTime, setShowRescheduleTime] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [uploadingAgreement, setUploadingAgreement] = useState(false);
  const [supportDocs, setSupportDocs] = useState<any[]>([]);
  const [uploadingSupport, setUploadingSupport] = useState(false);

  const fetchSupportingDocs = useCallback(async () => {
    try {
      const { data } = await appointmentsApi.listDocuments(appointmentId);
      setSupportDocs(data?.items || data?.documents || data || []);
    } catch {
      setSupportDocs([]);
    }
  }, [appointmentId]);

  useEffect(() => { fetchSupportingDocs(); }, [fetchSupportingDocs]);

  // Either party can attach more documents at any time (e.g. the client
  // forgot a contract, the lawyer wants a counter-document attached for
  // reference). Same Cloudinary signed-upload pattern as the booking
  // sheet. After upload we re-pull the docs list so the OCR row appears.
  const handleAttachSupportingDoc = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (pick.canceled || !pick.assets?.[0]) return;
      const asset = pick.assets[0];
      setUploadingSupport(true);
      const { data: signData } = await storageApi.getCloudinarySignature('appointment-docs');
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType || 'application/octet-stream', name: asset.name || 'attachment' } as any);
      formData.append('timestamp', String(signData.timestamp));
      formData.append('signature', signData.signature);
      formData.append('api_key', signData.apiKey);
      formData.append('folder', signData.folder);
      const resourceType = (asset.mimeType || '').startsWith('image/') ? 'image' : 'raw';
      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(signData.cloudName)}/${resourceType}/upload`,
        { method: 'POST', body: formData },
      );
      const uploadData = await uploadRes.json();
      if (!uploadData?.secure_url) throw new Error(uploadData?.error?.message || 'Cloudinary upload failed');
      await appointmentsApi.attachDocument(appointmentId, {
        fileurl: uploadData.secure_url,
        fileName: asset.name || 'attachment',
        mimeType: asset.mimeType || 'application/octet-stream',
        size: asset.size,
      });
      await fetchSupportingDocs();
    } catch (err: any) {
      Alert.alert('Upload failed', formatErrorMessage(err) || 'Could not attach document');
    } finally {
      setUploadingSupport(false);
    }
  };

  const fetchAppointment = useCallback(async () => {
    try {
      const { data } = await appointmentsApi.getById(appointmentId);
      setAppointment(data?.appointment || data?.data || data || null);
    } catch {
      if (!appointment) Alert.alert('Error', 'Could not load appointment');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appointmentId]);

  useEffect(() => { fetchAppointment(); }, []);

  useEffect(() => {
    const inlinePayment = (appointment as any)?.payment;
    if (inlinePayment) {
      setPaymentDetails(inlinePayment);
      return;
    }

    const paymentId = (appointment as any)?.paymentId;
    if (!appointment || !paymentId) {
      setPaymentDetails(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await paymentsApi.getById(paymentId);
        const p = data?.payment || data?.data || data || null;
        if (!cancelled) setPaymentDetails(p);
      } catch {
        if (!cancelled) setPaymentDetails(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appointment?.id, (appointment as any)?.paymentId, (appointment as any)?.payment]);

  const onRefresh = () => { setRefreshing(true); fetchAppointment(); };

  const handleChat = () => {
    if (!appointment) return;
    const isClient = role === 'CLIENT';
    const otherId = isClient ? appointment.lawyerId : appointment.clientId;
    const other = isClient ? appointment.lawyer : appointment.client;
    const otherName = other?.name;
    navigation.navigate('ChatScreen', {
      appointmentId: appointment.id,
      otherUserId: otherId,
      name: otherName,
      otherUser: other,
    });
  };

  const handleCancel = () => {
    if (!appointment) return;
    Alert.alert('Cancel Appointment', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: async () => {
        try {
          await appointmentsApi.cancel(appointment.id);
          await Promise.allSettled([fetchBalance(), fetchTransactions(1)]);
          Alert.alert('Cancelled', 'Appointment has been cancelled.');
          fetchAppointment();
        } catch { Alert.alert('Error', 'Failed to cancel'); }
      }},
    ]);
  };

  const handleAccept = async () => {
    if (!appointment) return;
    try {
      await appointmentsApi.accept(appointment.id);
      Alert.alert('Accepted', 'Appointment confirmed.');
      fetchAppointment();
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed');
    }
  };

  const handleReject = () => {
    if (!appointment) return;
    Alert.alert('Reject', 'Are you sure?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: async () => {
        try {
          await appointmentsApi.reject(appointment.id);
          await Promise.allSettled([fetchBalance(), fetchTransactions(1)]);
          Alert.alert('Rejected', 'Appointment rejected. Payment refunded.');
          fetchAppointment();
        } catch (err: any) {
          Alert.alert('Error', formatErrorMessage(err) || 'Failed');
        }
      }},
    ]);
  };

  const submitReschedule = async () => {
    if (!appointment) return;
    if (rescheduleAt.getTime() <= Date.now()) {
      return Alert.alert('Invalid time', 'Please pick a future date and time.');
    }
    const iso = rescheduleAt.toISOString();
    setRescheduling(true);
    try {
      await appointmentsApi.reschedule(appointment.id, iso);
      Alert.alert('Rescheduled', 'Appointment rescheduled');
      setShowReschedule(false);
      fetchAppointment();
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to reschedule');
    } finally { setRescheduling(false); }
  };

  // Lawyer-only — pick a signed engagement letter (PDF or image), push to
  // Cloudinary, then attach the secure URL to the appointment via
  // /appointments/update-agreement-url. The same flow is used for both
  // "first-time attach" and "replace existing agreement" — the server just
  // overwrites Appointment.aggrementUrl. Re-fetches the appointment after
  // success so the View Agreement card appears (or refreshes) inline.
  const handleAttachAgreement = async () => {
    if (!appointment) return;
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (pick.canceled || !pick.assets?.[0]) return;
      const asset = pick.assets[0];

      setUploadingAgreement(true);
      const { data: signData } = await storageApi.getCloudinarySignature('appointment-agreements');

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'application/octet-stream',
        name: asset.name || 'agreement',
      } as any);
      formData.append('timestamp', String(signData.timestamp));
      formData.append('signature', signData.signature);
      formData.append('api_key', signData.apiKey);
      formData.append('folder', signData.folder);

      // PDFs hit /raw/upload, images hit /image/upload — Cloudinary rejects
      // mismatched resource types.
      const resourceType = (asset.mimeType || '').startsWith('image/') ? 'image' : 'raw';
      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(signData.cloudName)}/${resourceType}/upload`,
        { method: 'POST', body: formData },
      );
      const uploadData = await uploadRes.json();
      if (!uploadData?.secure_url) {
        throw new Error(uploadData?.error?.message || 'Cloudinary upload failed');
      }

      await appointmentsApi.updateAgreementUrl({
        appointmentId: appointment.id,
        agreementUrl: uploadData.secure_url,
      });
      await fetchAppointment();
      Alert.alert('Agreement attached', 'The signed agreement is now visible to the client.');
    } catch (err: any) {
      Alert.alert('Upload failed', formatErrorMessage(err) || 'Could not attach agreement');
    } finally {
      setUploadingAgreement(false);
    }
  };

  const handleComplete = () => {
    if (!appointment) return;
    Alert.alert('Mark Complete', 'Mark this appointment as completed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete', onPress: async () => {
          setCompleting(true);
          try {
            await appointmentsApi.complete(appointment.id);
            Alert.alert('Completed', 'Appointment marked as completed');
            fetchAppointment();
          } catch (err: any) {
            Alert.alert('Error', formatErrorMessage(err) || 'Failed to complete');
          } finally { setCompleting(false); }
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

  if (!appointment) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: COLORS.textMuted }}>Appointment not found</Text>
      </View>
    );
  }

  const isClient = role === 'CLIENT';
  const person = isClient ? appointment.lawyer : appointment.client;
  const personLabel = isClient ? 'Lawyer' : 'Client';
  const statusColor = APPOINTMENT_STATUS_COLORS[appointment.status] || APPOINTMENT_STATUS_COLORS.PENDING;
  const canChat = appointment.status === AppointmentStatus.CONFIRMED ||
    appointment.status === AppointmentStatus.ATTENDED ||
    appointment.status === 'COMPLETED' as any;
  const canCancel = appointment.status === AppointmentStatus.PENDING || appointment.status === AppointmentStatus.CONFIRMED;
  const canAcceptReject = !isClient && appointment.status === AppointmentStatus.PENDING;
  const canReschedule = isClient && (appointment.status === AppointmentStatus.PENDING || appointment.status === AppointmentStatus.CONFIRMED);
  const canComplete = !isClient && (appointment.status === AppointmentStatus.CONFIRMED || appointment.status === AppointmentStatus.ATTENDED);
  const effectivePayment = paymentDetails || (appointment as any).payment || null;
  const shouldShowPaymentCard = !!effectivePayment || !!(appointment as any).paymentId;
  const paymentAmount = Number((effectivePayment as any)?.amount ?? 0);
  const paymentAmountText = Number.isFinite(paymentAmount)
    ? `₹${paymentAmount.toLocaleString('en-IN')}`
    : 'N/A';
  const paymentStatusRaw = String((effectivePayment as any)?.status || '').trim();
  const paymentStatusText = paymentStatusRaw
    ? paymentStatusRaw.charAt(0) + paymentStatusRaw.slice(1).toLowerCase()
    : 'Unknown';
  const paymentIdText = String((effectivePayment as any)?.id || (appointment as any)?.paymentId || '').trim();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusText, { color: statusColor.text }]}>
            {appointment.status.charAt(0) + appointment.status.slice(1).toLowerCase()}
          </Text>
        </View>

        {/* Person Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{personLabel} Details</Text>
          <View style={styles.personRow}>
            <View style={styles.avatarBlock}>
              {(person?.avatar || (person as any)?.avatarUrl) ? (
                <Image source={{ uri: person?.avatar || (person as any)?.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={22} color={COLORS.textMuted} />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.personName}>{person?.name || 'Unknown'}</Text>
              {(person as any)?.email && <Text style={styles.personSub}>{(person as any).email}</Text>}
              {(person as any)?.phone && <Text style={styles.personSub}>{(person as any).phone}</Text>}
              {isClient && appointment.lawyer?.specialization?.[0] && (
                <Text style={styles.personSub}>{appointment.lawyer.specialization.join(', ')}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Schedule Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schedule</Text>
          <InfoRow icon="calendar" label="Date" value={format(new Date(appointment.scheduledAt), 'EEEE, dd MMMM yyyy')} />
          <InfoRow icon="time" label="Time" value={format(new Date(appointment.scheduledAt), 'hh:mm a')} />
          <InfoRow icon="timer" label="Duration" value={`${appointment.durationMins} minutes`} />
          {appointment.meetLink ? (
            <TouchableOpacity onPress={() => Linking.openURL(appointment.meetLink!)}>
              <InfoRow icon="videocam" label="Meet Link" value="Join Video Call" isLink />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Case description — promoted out of Schedule into its own card so
            the lawyer reads the full text before scrolling to Accept/Reject.
            On a PENDING request this is the most important block on the
            screen; we render it with a leading accent + clear "Case
            description" label and the full notes (no truncation). */}
        {appointment.notes ? (
          <View style={[styles.card, styles.notesCard]}>
            <View style={styles.notesHeader}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              <Text style={styles.notesTitle}>Case Description</Text>
              {!isClient && appointment.status === AppointmentStatus.PENDING && (
                <View style={styles.notesBadge}>
                  <Text style={styles.notesBadgeText}>READ FIRST</Text>
                </View>
              )}
            </View>
            <Text style={styles.notesBody}>{appointment.notes}</Text>
          </View>
        ) : null}

        {/* Payment Card */}
        {shouldShowPaymentCard && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment Details</Text>
            <InfoRow icon="cash" label="Amount" value={paymentAmountText} />
            <InfoRow
              icon="checkmark-circle"
              label="Payment Status"
              value={paymentStatusText}
            />
            {paymentIdText && (
              <InfoRow icon="receipt" label="Payment ID" value={paymentIdText} />
            )}
          </View>
        )}

        {/* Supporting documents — anything the client uploaded at booking
            time, plus anything either party adds later. Tapping a row opens
            the generic DocumentAiScreen which handles Extract / Summarize /
            Ask AI. Lawyer typically uses this to triage the case before
            accepting; the client can re-share files they forgot. */}
        <View style={styles.card}>
          <View style={styles.notesHeader}>
            <Ionicons name="folder-open-outline" size={20} color={COLORS.primary} />
            <Text style={styles.notesTitle}>Supporting Documents</Text>
            <Text style={styles.docCount}>{supportDocs.length}</Text>
          </View>
          {supportDocs.length === 0 ? (
            <Text style={styles.docEmpty}>
              {isClient
                ? 'No documents attached yet. Add contracts, court notices, or photos to help the lawyer understand your case.'
                : 'No documents attached. Ask the client to share supporting files via chat or this screen.'}
            </Text>
          ) : (
            <View style={styles.docsList}>
              {supportDocs.map((d: any) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.docRow}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('DocumentAi', {
                      documentId: d.id,
                      document: d,
                      contextLabel: 'Appointment doc',
                    })
                  }
                >
                  <Ionicons
                    name={d.mimeType?.startsWith('image/') ? 'image-outline' : 'document-text-outline'}
                    size={20}
                    color={COLORS.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docRowName} numberOfLines={1}>{d.filename}</Text>
                    <Text style={styles.docRowMeta} numberOfLines={1}>
                      {d.extractionStatus === 'COMPLETED'
                        ? 'OCR ready · tap to view extracted text or summary'
                        : d.extractionStatus === 'PROCESSING'
                          ? 'Extracting…'
                          : d.extractionStatus === 'FAILED'
                            ? 'Extraction failed — tap to retry'
                            : 'Tap to extract text + summarize with AI'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => navigation.navigate('DocumentPreview', {
                      url: d.url || d.fileUrl,
                      name: d.filename || d.fileName,
                      mimeType: d.mimeType,
                    })}
                  >
                    <Ionicons name="eye-outline" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Ionicons name="flash-outline" size={18} color={COLORS.primary} style={{ marginLeft: SPACING.md }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={[styles.attachBtn, { marginTop: SPACING.sm }]}
            onPress={handleAttachSupportingDoc}
            disabled={uploadingSupport}
            activeOpacity={0.85}
          >
            {uploadingSupport ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="attach" size={18} color={COLORS.white} />
                <Text style={styles.attachBtnText}>Attach a document</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Agreement — lawyer attaches the signed engagement letter; client
            sees the View link once attached. The lawyer can also replace an
            existing one (e.g., a re-signed addendum). */}
        {(appointment.agreementUrl || !isClient) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Agreement</Text>
            {appointment.agreementUrl ? (
              <TouchableOpacity
                style={styles.agreementBtn}
                onPress={() => Linking.openURL(appointment.agreementUrl!).catch(() => Alert.alert('Error', 'Could not open'))}
              >
                <Ionicons name="document-text" size={18} color={COLORS.primary} />
                <Text style={styles.agreementText}>View Agreement Document</Text>
                <Ionicons name="open-outline" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            ) : (
              <Text style={styles.agreementEmpty}>
                No agreement attached yet. Upload the signed engagement letter so the client can view it.
              </Text>
            )}
            {!isClient && (
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={handleAttachAgreement}
                disabled={uploadingAgreement}
                activeOpacity={0.85}
              >
                {uploadingAgreement ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons
                      name={appointment.agreementUrl ? 'refresh-outline' : 'cloud-upload-outline'}
                      size={18}
                      color={COLORS.white}
                    />
                    <Text style={styles.attachBtnText}>
                      {appointment.agreementUrl ? 'Replace Agreement' : 'Attach Signed Agreement'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsCard}>
          {canAcceptReject && (
            <View style={styles.actionsRow}>
              <Button title="Accept" onPress={handleAccept} size="lg" style={{ flex: 1, marginRight: 8 }} />
              <Button title="Reject" variant="outline" onPress={handleReject} size="lg" style={{ flex: 1, marginLeft: 8 }} />
            </View>
          )}
          {canChat && (
            <Button
              title="Chat"
              variant="outline"
              onPress={handleChat}
              size="lg"
              icon={<Ionicons name="chatbubble-ellipses" size={16} color={COLORS.primary} />}
            />
          )}
          {canReschedule && (
            <Button
              title="Reschedule"
              variant="outline"
              onPress={() => setShowReschedule(true)}
              size="lg"
              style={{ marginTop: 10 }}
            />
          )}
          {canComplete && (
            <Button
              title="Mark Complete"
              onPress={handleComplete}
              size="lg"
              loading={completing}
              style={{ marginTop: 10 }}
            />
          )}
          {canCancel && isClient && (
            <Button
              title="Cancel Appointment"
              variant="outline"
              onPress={handleCancel}
              size="lg"
              style={{ marginTop: 10, borderColor: COLORS.error }}
            />
          )}
        </View>

        <Modal visible={showReschedule} transparent animationType="slide" onRequestClose={() => setShowReschedule(false)}>
          <View style={styles.rmOverlay}>
            <View style={styles.rmContent}>
              <View style={styles.rmHeader}>
                <Text style={styles.rmTitle}>Reschedule Appointment</Text>
                <TouchableOpacity onPress={() => setShowReschedule(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.rmBody}>
                <Text style={styles.rmLabel}>New Date</Text>
                <TouchableOpacity
                  style={styles.rmPickerPill}
                  activeOpacity={0.75}
                  onPress={() => setShowRescheduleDate(true)}
                >
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.rmPickerValue}>{format(rescheduleAt, 'EEE, dd MMM yyyy')}</Text>
                </TouchableOpacity>
                <Text style={styles.rmLabel}>New Time</Text>
                <TouchableOpacity
                  style={styles.rmPickerPill}
                  activeOpacity={0.75}
                  onPress={() => setShowRescheduleTime(true)}
                >
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.rmPickerValue}>{format(rescheduleAt, 'hh:mm a')}</Text>
                </TouchableOpacity>
                {showRescheduleDate && (
                  <DateTimePicker
                    value={rescheduleAt}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(_, picked) => {
                      setShowRescheduleDate(false);
                      if (!picked) return;
                      const next = new Date(picked);
                      next.setHours(rescheduleAt.getHours(), rescheduleAt.getMinutes(), 0, 0);
                      setRescheduleAt(next);
                    }}
                  />
                )}
                {showRescheduleTime && (
                  <DateTimePicker
                    value={rescheduleAt}
                    mode="time"
                    minuteInterval={15}
                    onChange={(_, picked) => {
                      setShowRescheduleTime(false);
                      if (!picked) return;
                      const next = new Date(rescheduleAt);
                      next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                      setRescheduleAt(next);
                    }}
                  />
                )}
                <Button title="Confirm Reschedule" onPress={submitReschedule} loading={rescheduling} size="lg" />
              </View>
            </View>
          </View>
        </Modal>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

/* ── Info Row helper ── */
const InfoRow: React.FC<{ icon: string; label: string; value: string; isLink?: boolean }> = ({ icon, label, value, isLink }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={16} color={COLORS.textMuted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, marginLeft: SPACING.md }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, isLink && { color: COLORS.primary }]}>{value}</Text>
      </View>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  backBtn: { width: 22 },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.white },

  statusBanner: {
    marginHorizontal: SPACING.xl, marginTop: SPACING.xl,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl, alignItems: 'center',
  },
  statusText: { fontSize: FONT_SIZE.lg, fontWeight: '800' },

  card: {
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl, marginTop: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.lg },

  // Highlight the case-description block so it doesn't blend into the
  // surrounding Schedule / Payment cards — pending lawyers must scan it
  // before the Accept/Reject row at the bottom.
  notesCard: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  notesHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  notesTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text },
  notesBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  notesBadgeText: { fontSize: FONT_SIZE.xs - 2, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  notesBody: { fontSize: FONT_SIZE.md, color: COLORS.text, lineHeight: 22 },

  docCount: {
    fontSize: FONT_SIZE.xs - 1, fontWeight: '800',
    color: COLORS.primary,
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  docEmpty: {
    fontSize: FONT_SIZE.sm, color: COLORS.textMuted, lineHeight: 19,
  },
  docsList: { gap: SPACING.sm },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  docRowName: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: COLORS.text },
  docRowMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },


  personRow: { flexDirection: 'row', alignItems: 'center' },
  avatarBlock: { marginRight: SPACING.lg },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  personSub: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: 2 },

  infoRow: { flexDirection: 'row', marginBottom: SPACING.md },
  infoLabel: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  infoValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, marginTop: 1 },

  agreementBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary + '10', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  agreementText: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.primary },
  agreementEmpty: {
    fontSize: FONT_SIZE.sm, color: COLORS.textMuted, lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  attachBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  attachBtnText: { color: COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: '700' },

  actionsCard: { marginHorizontal: SPACING.xl, marginTop: SPACING.lg },
  actionsRow: { flexDirection: 'row', marginBottom: 10 },

  rmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  rmContent: { backgroundColor: COLORS.white, borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: SPACING.xxl },
  rmHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  rmTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  rmBody: { padding: SPACING.xl },
  rmLabel: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
  rmInput: { backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md },
  rmPickerPill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  rmPickerValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
});

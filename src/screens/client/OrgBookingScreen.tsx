import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi, storageApi } from '../../services/api';
import { Button } from '../../components/Button';
import { formatErrorMessage } from '../../utils/formatError';

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

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [meetingType, setMeetingType] = useState('AUDIO_CALL');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
    if (!date.trim()) return Alert.alert('Required', 'Please enter date');
    if (!time.trim()) return Alert.alert('Required', 'Please enter time');
    // Mirror the lawyer-direct booking flow — the org assigner needs at
    // least a paragraph of context to pick the right lawyer for the case.
    const trimmedNotes = notes.trim();
    if (trimmedNotes.length < 20) {
      return Alert.alert(
        'Describe your case',
        'Please write at least 20 characters about the legal issue. The organization needs this context to assign the right lawyer.',
      );
    }

    // Parse date and time
    const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) return Alert.alert('Invalid Date', 'Use format YYYY-MM-DD');

    const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) return Alert.alert('Invalid Time', 'Use format HH:MM (24-hour)');

    const scheduledAt = new Date(`${date}T${time.padStart(5, '0')}:00`);
    if (isNaN(scheduledAt.getTime())) return Alert.alert('Invalid', 'Invalid date or time');
    if (scheduledAt <= new Date()) return Alert.alert('Invalid', 'Please select a future date and time');

    setSubmitting(true);
    try {
      const { data } = await organizationsApi.createAppointmentRequest(orgId, {
        scheduledAt: scheduledAt.toISOString(),
        durationMins: duration,
        meetingType,
        notes: notes.trim() || undefined,
      });
      // Server returns the created request — pull the id so we can attach
      // any picked supporting docs in a best-effort follow-up loop.
      const created = data?.request || data?.data || data;
      const requestId = created?.id;

      let docResult = { uploaded: 0, failed: 0 };
      if (requestId && pickedDocs.length > 0) {
        docResult = await uploadDocsForRequest(requestId);
      }
      const docMsg = pickedDocs.length === 0
        ? ''
        : docResult.failed === 0
          ? `\n${docResult.uploaded} document${docResult.uploaded === 1 ? '' : 's'} attached.`
          : `\n${docResult.uploaded}/${pickedDocs.length} attached, ${docResult.failed} failed — share the missing files via chat after assignment.`;

      Alert.alert(
        'Booking Submitted',
        `Your appointment request has been submitted. The organization will review your case and assign a lawyer.${docMsg}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to submit booking request');
    } finally {
      setSubmitting(false);
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

        {/* Date & Time */}
        <Text style={styles.sectionTitle}>Date & Time</Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Date</Text>
              <View style={styles.inputBox}>
                <Ionicons name="calendar-outline" size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={date}
                  onChangeText={setDate}
                  keyboardType="numbers-and-punctuation"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Time (24h)</Text>
              <View style={styles.inputBox}>
                <Ionicons name="time-outline" size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM"
                  value={time}
                  onChangeText={setTime}
                  keyboardType="numbers-and-punctuation"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
            </View>
          </View>
        </View>

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

        <Button title="Submit Booking Request" onPress={handleBook} loading={submitting} size="lg" style={{ marginTop: SPACING.lg }} />
      </ScrollView>
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
  inputWrapper: { flex: 1 },
  inputLabel: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  input: { flex: 1, fontSize: FONT_SIZE.md, color: COLORS.text },
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
});

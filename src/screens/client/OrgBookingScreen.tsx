import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { organizationsApi } from '../../services/api';
import { Button } from '../../components/Button';

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

  const handleBook = async () => {
    if (!date.trim()) return Alert.alert('Required', 'Please enter date');
    if (!time.trim()) return Alert.alert('Required', 'Please enter time');

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
      await organizationsApi.createAppointmentRequest(orgId, {
        scheduledAt: scheduledAt.toISOString(),
        durationMins: duration,
        meetingType,
        notes: notes.trim() || undefined,
      });
      Alert.alert(
        'Booking Submitted',
        'Your appointment request has been submitted. The organization will assign a lawyer and confirm.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to submit booking request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

        {/* Notes */}
        <Text style={styles.sectionTitle}>Notes (Optional)</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.notesInput}
            placeholder="Describe your legal issue or topic..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholderTextColor={COLORS.textMuted}
            textAlignVertical="top"
          />
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
    fontSize: FONT_SIZE.md, color: COLORS.text, minHeight: 80,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
});

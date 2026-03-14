import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, StatusBar,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { formatErrorMessage } from '../../utils/formatError';
import { usersApi } from '../../services/api';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Common';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
];

export const AvailabilityScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [fee, setFee] = useState('');
  const [workingDays, setWorkingDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => { fetchInfo(); }, []);

  const fetchInfo = async () => {
    try {
      const { data } = await usersApi.getLawyerInformation();
      if (data.lawyer) {
        const l = data.lawyer;
        setIsAvailable(l.isAvailable !== false);
        // Always show fee in rupees
        setFee(String(l.feePerConsultation ? Math.round(Number(l.feePerConsultation) / 100) : ''));
        // support both legacy object-shaped `experience` and new array-shaped `experience`
        const exp = l.experience;
        if (Array.isArray(exp)) {
          const avail = exp.find((e: any) => e.title === 'Availability' || e.description?.includes?.('workingDays'));
          if (avail) {
            if (avail.from) setStartTime(String(avail.from));
            if (avail.to) setEndTime(String(avail.to));
            try {
              const parsed = typeof avail.description === 'string' ? JSON.parse(avail.description) : avail.description;
              if (parsed?.workingDays) setWorkingDays(parsed.workingDays);
            } catch (e) {}
          }
        } else if (exp && typeof exp === 'object') {
          if (exp.workingDays) setWorkingDays(exp.workingDays);
          if (exp.startTime) setStartTime(exp.startTime);
          if (exp.endTime) setEndTime(exp.endTime);
        }
      }
    } catch {} finally { setLoading(false); }
  };

  const toggleDay = (day: string) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (!fee.trim() || Number(fee) < 10) {
      Alert.alert('Error', 'Please set a valid consultation fee (minimum ₹10)');
      return;
    }
    setSaving(true);
    try {
      // send experience as an array entry so it passes backend validation
      const availabilityEntry = {
        title: 'Availability',
        organisation: '',
        from: startTime,
        to: endTime,
        description: JSON.stringify({ workingDays }),
      };
      // Always send fee in paise (multiply by 100)
      await usersApi.postLawyerInformation({
        isAvailable,
        feePerConsultation: Math.round(Number(fee) * 100),
        experience: [availabilityEntry],
      });
      Alert.alert('Success', 'Availability updated', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err.response?.data || err));
    } finally { setSaving(false); }
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Availability</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Availability Toggle */}
          <View style={styles.card}>
            <Text style={styles.sTitle}>Online Status</Text>
            <TouchableOpacity style={styles.toggleRow} onPress={() => setIsAvailable(!isAvailable)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Available for Consultations</Text>
                <Text style={styles.toggleDesc}>Clients can book appointments with you</Text>
              </View>
              <View style={[styles.toggle, isAvailable && styles.toggleActive]}>
                <View style={[styles.toggleDot, isAvailable && styles.toggleDotActive]} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Consultation Fee */}
          <View style={styles.card}>
            <Text style={styles.sTitle}>Consultation Fee</Text>
            <Input
              label="Fee per Consultation (₹)"
              value={fee}
              onChangeText={setFee}
              placeholder="e.g. 500"
              keyboardType="number-pad"
              icon={<Text style={{ fontSize: 18, color: COLORS.textMuted, fontWeight: '700' }}>₹</Text>}
            />
          </View>

          {/* Working Days */}
          <View style={styles.card}>
            <Text style={styles.sTitle}>Working Days</Text>
            <View style={styles.daysGrid}>
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, workingDays.includes(day) && styles.dayChipActive]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayChipText, workingDays.includes(day) && styles.dayChipTextActive]}>
                    {day.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Working Hours */}
          <View style={styles.card}>
            <Text style={styles.sTitle}>Working Hours</Text>
            <View style={styles.hoursRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Start Time</Text>
                <TouchableOpacity style={styles.timePicker} onPress={() => { setShowStartPicker(!showStartPicker); setShowEndPicker(false); }}>
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.timeText}>{startTime}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>End Time</Text>
                <TouchableOpacity style={styles.timePicker} onPress={() => { setShowEndPicker(!showEndPicker); setShowStartPicker(false); }}>
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.timeText}>{endTime}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {showStartPicker && (
              <View style={styles.timeSlotsWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSlots}>
                  {TIME_SLOTS.map((t) => (
                    <TouchableOpacity key={t} style={[styles.timeSlot, startTime === t && styles.timeSlotActive]}
                      onPress={() => { setStartTime(t); setShowStartPicker(false); }}>
                      <Text style={[styles.timeSlotText, startTime === t && styles.timeSlotTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            {showEndPicker && (
              <View style={styles.timeSlotsWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSlots}>
                  {TIME_SLOTS.map((t) => (
                    <TouchableOpacity key={t} style={[styles.timeSlot, endTime === t && styles.timeSlotActive]}
                      onPress={() => { setEndTime(t); setShowEndPicker(false); }}>
                      <Text style={[styles.timeSlotText, endTime === t && styles.timeSlotTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.saveRow}>
            <Button title="Save Changes" onPress={handleSave} loading={saving} size="lg" />
            <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} size="lg" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  content: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl,
    marginBottom: SPACING.lg, ...SHADOWS.sm,
  },
  sTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.lg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  toggleLabel: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  toggleDesc: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
  toggle: {
    width: 52, height: 30, borderRadius: 15, backgroundColor: COLORS.border,
    padding: 3, justifyContent: 'center',
  },
  toggleActive: { backgroundColor: COLORS.success },
  toggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.white },
  toggleDotActive: { alignSelf: 'flex-end' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  dayChip: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
  },
  dayChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayChipText: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.textSecondary },
  dayChipTextActive: { color: COLORS.white },
  fieldLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm },
  hoursRow: { flexDirection: 'row', gap: SPACING.md },
  timePicker: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SPACING.md + 2, paddingHorizontal: SPACING.lg,
  },
  timeText: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  timeSlotsWrap: { marginTop: SPACING.md },
  timeSlots: { gap: SPACING.sm },
  timeSlot: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
  },
  timeSlotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeSlotText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  timeSlotTextActive: { color: COLORS.white, fontWeight: '600' },
  saveRow: { gap: SPACING.sm, marginTop: SPACING.sm },
});

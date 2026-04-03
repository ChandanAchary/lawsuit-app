import {  useThemeStore , useColors } from '../stores/themeStore';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, APPOINTMENT_STATUS_COLORS } from '../constants';
import { Appointment, AppointmentStatus } from '../types';
import { formatDate, formatTime } from '../utils/date';

interface AppointmentCardProps {
  appointment: Appointment;
  role: 'CLIENT' | 'LAWYER';
  onPress?: () => void;
  onAttend?: () => void;
  onCancel?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onChat?: () => void;
  onViewAgreement?: () => void;
  onCreateCase?: () => void;
  onComplete?: () => void;
  onReschedule?: () => void;
  onJoinVideo?: () => void;
  onViewClient?: () => void;
  style?: ViewStyle;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  role,
  onPress,
  onAttend,
  onCancel,
  onAccept,
  onReject,
  onChat,
  onViewAgreement,
  onCreateCase,
  onComplete,
  onReschedule,
  onJoinVideo,
  onViewClient,
  style,
}) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const person = role === 'CLIENT' ? appointment.lawyer : appointment.client;
  const personAvatar = person?.avatar || (person as any)?.avatarUrl;
  const scheduledAtMs = Date.parse(String(appointment.scheduledAt || ''));
  const isPast = Number.isFinite(scheduledAtMs) && scheduledAtMs < Date.now();
  const effectiveStatus =
    (appointment.status === AppointmentStatus.PENDING || appointment.status === AppointmentStatus.CONFIRMED) && isPast
      ? AppointmentStatus.MISSED
      : appointment.status;
  const statusColor = APPOINTMENT_STATUS_COLORS[effectiveStatus] || APPOINTMENT_STATUS_COLORS.PENDING;
  const isUpcoming =
    effectiveStatus === AppointmentStatus.CONFIRMED ||
    effectiveStatus === AppointmentStatus.PENDING;
  const isAttended = effectiveStatus === AppointmentStatus.ATTENDED ||
    effectiveStatus === AppointmentStatus.COMPLETED;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.card, style]}
    >
      <View style={styles.header}>
        <View style={styles.personRow}>
          <View style={styles.avatarContainer}>
            {personAvatar ? (
              <Image source={{ uri: personAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={20} color={COLORS.textMuted} />
              </View>
            )}
            <View style={[styles.statusDot, { backgroundColor: statusColor.text }]} />
          </View>
          <View style={styles.personInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {person?.name || 'Unknown'}
            </Text>
            {role === 'CLIENT' && appointment.lawyer?.specialization?.[0] && (
              <Text style={styles.specialization}>{appointment.lawyer.specialization[0]}</Text>
            )}
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusText, { color: statusColor.text }]}>
            {effectiveStatus}
          </Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>{formatDate(appointment.scheduledAt)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>{formatTime(appointment.scheduledAt)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="timer-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>{appointment.durationMins} min</Text>
        </View>
      </View>

      {(isUpcoming || isAttended || effectiveStatus === AppointmentStatus.PENDING || effectiveStatus === AppointmentStatus.MISSED) && (
        <View style={styles.actions}>
          {effectiveStatus === AppointmentStatus.PENDING && role === 'LAWYER' && (
            <>
              {onAccept && (
                <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={onAccept}>
                  <Ionicons name="checkmark" size={14} color={COLORS.white} />
                  <Text style={styles.actionTextWhite}>Accept</Text>
                </TouchableOpacity>
              )}
              {onReject && (
                <TouchableOpacity style={[styles.actionBtn, styles.actionOutline]} onPress={onReject}>
                  <Text style={styles.actionTextPrimary}>Reject</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          {isUpcoming && onJoinVideo && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={onJoinVideo}>
              <Ionicons name="videocam" size={14} color={COLORS.white} />
              <Text style={styles.actionTextWhite}>Join</Text>
            </TouchableOpacity>
          )}
          {isUpcoming && onAttend && !onJoinVideo && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={onAttend}>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.white} />
              <Text style={styles.actionTextWhite}>Attend</Text>
            </TouchableOpacity>
          )}
          {isUpcoming && onReschedule && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionOutline]} onPress={onReschedule}>
              <Ionicons name="calendar" size={14} color={COLORS.primary} />
              <Text style={styles.actionTextPrimary}>Reschedule</Text>
            </TouchableOpacity>
          )}
          {isUpcoming && onCancel && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionOutline]} onPress={onCancel}>
              <Text style={styles.actionTextPrimary}>Cancel</Text>
            </TouchableOpacity>
          )}
          {isAttended && onViewAgreement && appointment.agreementUrl && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionOutline]} onPress={onViewAgreement}>
              <Ionicons name="document-text" size={14} color={COLORS.primary} />
              <Text style={styles.actionTextPrimary}>Agreement</Text>
            </TouchableOpacity>
          )}
          {isAttended && onChat && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionOutline]} onPress={onChat}>
              <Ionicons name="chatbubble" size={14} color={COLORS.primary} />
              <Text style={styles.actionTextPrimary}>Chat</Text>
            </TouchableOpacity>
          )}
          {isAttended && onCreateCase && role === 'LAWYER' && !appointment.caseId && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={onCreateCase}>
              <Ionicons name="briefcase" size={14} color={COLORS.white} />
              <Text style={styles.actionTextWhite}>Create Case</Text>
            </TouchableOpacity>
          )}
          {effectiveStatus === AppointmentStatus.ATTENDED && onComplete && role === 'LAWYER' && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={onComplete}>
              <Ionicons name="checkmark-done" size={14} color={COLORS.white} />
              <Text style={styles.actionTextWhite}>Complete</Text>
            </TouchableOpacity>
          )}
          {role === 'LAWYER' && onViewClient && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionOutline]} onPress={onViewClient}>
              <Ionicons name="person" size={14} color={COLORS.primary} />
              <Text style={styles.actionTextPrimary}>View Client</Text>
            </TouchableOpacity>
          )}
          {effectiveStatus === AppointmentStatus.MISSED && onReschedule && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={onReschedule}>
              <Ionicons name="calendar" size={14} color={COLORS.white} />
              <Text style={styles.actionTextWhite}>Reschedule</Text>
            </TouchableOpacity>
          )}
          {effectiveStatus === AppointmentStatus.MISSED && onCancel && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionOutline]} onPress={onCancel}>
              <Text style={styles.actionTextPrimary}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  personInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  name: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  specialization: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  actionPrimary: {
    backgroundColor: COLORS.primary,
  },
  actionOutline: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionTextWhite: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  actionTextPrimary: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

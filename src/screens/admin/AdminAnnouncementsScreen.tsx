import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { adminAnnouncementsApi, AnnouncementAudience } from '../../services/api';
import { Button } from '../../components/Button';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';

const AUDIENCES: { key: AnnouncementAudience; label: string; desc: string; icon: string }[] = [
  { key: 'ALL',          label: 'Everyone',     desc: 'Clients, lawyers, organizations, court admins', icon: 'globe-outline' },
  { key: 'CLIENT',       label: 'Clients',      desc: 'Only client accounts',                          icon: 'person-outline' },
  { key: 'LAWYER',       label: 'Lawyers',      desc: 'Only lawyer accounts',                          icon: 'briefcase-outline' },
  { key: 'ORGANIZATION', label: 'Organizations', desc: 'Only organization (law firm) accounts',        icon: 'business-outline' },
  { key: 'COURT_ADMIN',  label: 'Court Admins', desc: 'Only court admin accounts',                     icon: 'shield-outline' },
];

// Super-admin-only platform-wide announcement composer. Posts an
// in-app notification (type ANNOUNCEMENT) and best-effort push to every
// active user in the chosen audience. Banned and soft-deleted accounts
// are skipped server-side.
export const AdminAnnouncementsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<AnnouncementAudience>('ALL');
  const [submitting, setSubmitting] = useState(false);

  const send = async () => {
    if (!title.trim()) return Alert.alert('Required', 'A short headline is required.');
    if (!body.trim()) return Alert.alert('Required', 'The announcement body is required.');

    Alert.alert(
      'Broadcast?',
      `This will reach every active ${audience === 'ALL' ? 'user' : audience.replace('_', ' ').toLowerCase()} on the platform — both in-app and via push notification.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              const { data } = await adminAnnouncementsApi.broadcast({
                title: title.trim(),
                body: body.trim(),
                audience,
              });
              Alert.alert(
                'Sent',
                `Reached ${data?.recipientCount ?? 0} recipient${(data?.recipientCount ?? 0) === 1 ? '' : 's'}.`,
                [{ text: 'OK', onPress: () => { setTitle(''); setBody(''); } }],
              );
            } catch (err: any) {
              Alert.alert('Error', formatErrorMessage(err) || 'Failed to broadcast');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcement</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <Ionicons name="megaphone-outline" size={18} color={COLORS.primary} />
          <Text style={styles.noticeText}>
            Announcements appear in every recipient's notifications inbox AND fire a push notification.
            Use sparingly — there's no "undo".
          </Text>
        </View>

        <Text style={styles.label}>HEADLINE</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What's this about?"
          placeholderTextColor={COLORS.textMuted}
          maxLength={80}
        />
        <Text style={styles.charCount}>{title.length} / 80</Text>

        <Text style={styles.label}>MESSAGE</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={body}
          onChangeText={setBody}
          placeholder="The full message users will read in their notifications."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{body.length} / 500</Text>

        <Text style={styles.label}>AUDIENCE</Text>
        <View style={styles.audienceList}>
          {AUDIENCES.map((a) => {
            const active = audience === a.key;
            return (
              <TouchableOpacity
                key={a.key}
                style={[styles.audienceRow, active && styles.audienceRowActive]}
                onPress={() => setAudience(a.key)}
              >
                <View style={[styles.audienceIcon, active && styles.audienceIconActive]}>
                  <Ionicons name={a.icon as any} size={20} color={active ? '#FFFFFF' : COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.audienceLabel, active && { color: COLORS.primary }]}>{a.label}</Text>
                  <Text style={styles.audienceDesc}>{a.desc}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <Button title="Send broadcast" onPress={send} loading={submitting} size="lg" variant="primary" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },
  body: { padding: SPACING.xl, paddingBottom: 120 },

  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    padding: SPACING.md, backgroundColor: C.primaryLight + '15',
    borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.lg,
  },
  noticeText: { flex: 1, fontSize: FONT_SIZE.xs, color: C.textSecondary, lineHeight: 16 },

  label: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textMuted, letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: SPACING.xs },
  input: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text,
    borderWidth: 1, borderColor: C.borderLight,
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  charCount: { fontSize: FONT_SIZE.xs, color: C.textMuted, textAlign: 'right', marginTop: 2 },

  audienceList: { gap: SPACING.sm, marginBottom: SPACING.lg },
  audienceRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.borderLight,
  },
  audienceRowActive: { borderColor: C.primary, backgroundColor: C.primaryLight + '10' },
  audienceIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: C.primaryLight + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  audienceIconActive: { backgroundColor: C.primary },
  audienceLabel: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  audienceDesc: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
});

export default AdminAnnouncementsScreen;

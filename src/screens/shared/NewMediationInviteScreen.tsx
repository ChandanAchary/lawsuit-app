import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { mediationApi } from '../../services/api';
import { Button } from '../../components/Button';

export const NewMediationInviteScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return Alert.alert('Error', 'Enter a valid respondent email');
    }
    if (!title.trim() || title.trim().length < 3) {
      return Alert.alert('Error', 'Dispute title (min 3 chars)');
    }
    if (!description.trim() || description.trim().length < 10) {
      return Alert.alert('Error', 'Describe the dispute (min 10 chars)');
    }
    setSubmitting(true);
    try {
      const { data } = await mediationApi.createInvite({
        respondentEmail: email.trim(),
        respondentName: name.trim() || undefined,
        respondentPhone: phone.trim() || undefined,
        disputeTitle: title.trim(),
        disputeDescription: description.trim(),
      });
      Alert.alert('Invite Sent', 'The respondent has been invited to mediate.', [
        { text: 'OK', onPress: () => navigation.replace('Mediations') },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to create invite');
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
        <Text style={styles.headerTitle}>New Mediation Invite</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Respondent</Text>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input} value={email} onChangeText={setEmail}
          placeholder="respondent@example.com" placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none" keyboardType="email-address"
        />
        <Text style={styles.label}>Name (optional)</Text>
        <TextInput
          style={styles.input} value={name} onChangeText={setName}
          placeholder="Full name" placeholderTextColor={COLORS.textMuted}
        />
        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          style={styles.input} value={phone} onChangeText={setPhone}
          placeholder="+91..." placeholderTextColor={COLORS.textMuted}
          keyboardType="phone-pad"
        />

        <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>Dispute</Text>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input} value={title} onChangeText={setTitle}
          placeholder="Short title" placeholderTextColor={COLORS.textMuted}
        />
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription}
          placeholder="Explain the dispute (min 10 chars)" placeholderTextColor={COLORS.textMuted}
          multiline
        />

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.noteText}>The respondent will receive an email with a link to accept or decline.</Text>
        </View>

        <Button title="Send Invite" onPress={submit} loading={submitting} size="lg" />
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
  body: { padding: SPACING.xl, paddingBottom: 80 },
  sectionLabel: { fontSize: FONT_SIZE.sm, fontWeight: '800', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: SPACING.sm },
  label: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
  input: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text, borderWidth: 1, borderColor: C.border,
  },
  textarea: { height: 110, textAlignVertical: 'top' },
  note: {
    flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start',
    backgroundColor: C.surfaceAlt, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    marginVertical: SPACING.xl,
  },
  noteText: { flex: 1, fontSize: FONT_SIZE.sm, color: C.textSecondary },
});

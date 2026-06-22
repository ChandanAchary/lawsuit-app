import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { mediationApi, casesApi } from '../../services/api';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../stores/authStore';
import { UserRole } from '../../types';
import { formatErrorMessage, isEndpointMissing } from '../../utils/formatError';

export const NewMediationInviteScreen: React.FC<{ navigation: any; route?: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);
  const user = useAuthStore((s) => s.user);

  // Mediation is initiated ONLY by the case lawyer, from the Case
  // (Resolution = Mediation). The dispute is derived from the case and the
  // server auto-attaches the case lawyer as initiator lawyer + links
  // Mediation.caseId on accept. A client can never start one — they only
  // track and act on mediations from the list/detail screens.
  const caseId: string | undefined = route?.params?.caseId;
  const isLawyer = user?.role === UserRole.LAWYER;
  const blocked = !isLawyer || !caseId;

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    casesApi.getById(caseId)
      .then(({ data }) => {
        const c = data.case || data;
        if (c?.title && !title) setTitle(String(c.title));
        if (c?.description && !description) setDescription(String(c.description));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const submit = async () => {
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return Alert.alert('Error', 'Enter a valid respondent email');
    }
    // When linked to a case the server derives the dispute from it, so the
    // title/description fields are optional here.
    if (!caseId) {
      if (!title.trim() || title.trim().length < 3) {
        return Alert.alert('Error', 'Dispute title (min 3 chars)');
      }
      if (!description.trim() || description.trim().length < 10) {
        return Alert.alert('Error', 'Describe the dispute (min 10 chars)');
      }
    }
    setSubmitting(true);
    try {
      const { data } = await mediationApi.createInvite({
        respondentEmail: email.trim(),
        respondentName: name.trim() || undefined,
        respondentPhone: phone.trim() || undefined,
        disputeTitle: title.trim() || undefined,
        disputeDescription: description.trim() || undefined,
        caseId,
      });
      Alert.alert(
        'Invitation sent',
        'The other party has been emailed right now (and notified in-app if they already have a NyayaX account). They can accept or decline — the mediation begins the moment they accept.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      if (isEndpointMissing(err)) {
        Alert.alert('Feature Unavailable', 'Mediations are not enabled on the server yet.');
      } else {
        Alert.alert('Error', formatErrorMessage(err) || 'Failed to create invite');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (blocked) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mediation</Text>
        </View>
        <View style={styles.blockedBox}>
          <Ionicons name="lock-closed-outline" size={40} color={COLORS.textMuted} />
          <Text style={styles.blockedTitle}>Started by your lawyer</Text>
          <Text style={styles.blockedText}>
            A mediation is initiated by the lawyer assigned to the case — from the case
            itself (set Resolution = Mediation, then “Send mediation invitation”). You
            can't start one here; you'll see it and can act on it once the other party accepts.
          </Text>
          <Button title="Go back" onPress={() => navigation.goBack()} size="lg" style={{ marginTop: SPACING.lg }} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Mediation Invitation</Text>
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
          <Text style={styles.noteText}>
            Linked to this case — the dispute is prefilled and you (the case lawyer) are
            auto-attached as the initiator lawyer. Tapping “Send” emails the other party
            immediately and notifies them in-app if they already have a NyayaX account.
            There is no draft step — the invitation goes out on the first tap.
          </Text>
        </View>

        <Button title="Send invitation now" onPress={submit} loading={submitting} size="lg" />
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
  blockedBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl, gap: SPACING.sm },
  blockedTitle: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: C.text, marginTop: SPACING.sm },
  blockedText: { fontSize: FONT_SIZE.sm, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
});

import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { mediationApi } from '../../services/api';
import { Button } from '../../components/Button';
import { Loading } from '../../components/Common';
import { useAuthStore } from '../../stores/authStore';
import { MediationInvite } from '../../types';
import { formatDate } from '../../utils/date';
import { formatErrorMessage } from '../../utils/formatError';

export const MediationInviteAcceptScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);
  const user = useAuthStore((s) => s.user);

  const paramToken: string | undefined = route.params?.token;
  const [token, setToken] = useState(paramToken || '');
  const [invite, setInvite] = useState<MediationInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const preview = useCallback(async (t: string) => {
    if (!t.trim()) return;
    setLoading(true);
    try {
      const { data } = await mediationApi.getInviteByToken(t.trim());
      setInvite(data.data || data);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Invite not found');
      setInvite(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (paramToken) preview(paramToken); }, [paramToken, preview]);

  const accept = async () => {
    if (!user) {
      return Alert.alert(
        'Sign in required',
        'Please sign in or register as a client to accept this invite.',
        [
          { text: 'Cancel' },
          { text: 'Login', onPress: () => navigation.navigate('Login') },
          { text: 'Register', onPress: () => navigation.navigate('Register') },
        ],
      );
    }
    setSubmitting(true);
    try {
      const { data } = await mediationApi.acceptInvite(invite!.token);
      const mediationId = data?.data?.mediationId || data?.mediationId || data?.data?.id || data?.id;
      Alert.alert('Accepted', 'You have accepted the mediation invite.', [
        {
          text: 'OK',
          onPress: () => mediationId
            ? navigation.replace('MediationDetail', { id: mediationId })
            : navigation.replace('Mediations'),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to accept invite');
    } finally { setSubmitting(false); }
  };

  const decline = async () => {
    if (!invite) return;
    setSubmitting(true);
    try {
      await mediationApi.declineInvite(invite.token);
      Alert.alert('Declined', 'Invite declined.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to decline');
    } finally { setSubmitting(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mediation Invite</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {!paramToken && (
          <View style={styles.card}>
            <Text style={styles.label}>Invite Token</Text>
            <TextInput
              style={styles.input} value={token} onChangeText={setToken}
              placeholder="Paste invite token" placeholderTextColor={COLORS.textMuted} autoCapitalize="none"
            />
            <Button title="Load Invite" onPress={() => preview(token)} size="lg" variant="outline" />
          </View>
        )}
        {loading && <Loading fullScreen={false} />}
        {invite && (
          <>
            <View style={styles.card}>
              <Text style={styles.title}>{invite.disputeTitle}</Text>
              <Text style={styles.desc}>{invite.disputeDescription}</Text>
              <View style={styles.meta}>
                <Ionicons name="person-circle-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.metaText}>From: {invite.initiatorClient?.name || 'Initiator'}</Text>
              </View>
              <View style={styles.meta}>
                <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.metaText}>Expires: {formatDate(invite.expiresAt)}</Text>
              </View>
              <View style={styles.meta}>
                <Ionicons name="flag-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.metaText}>Status: {invite.status}</Text>
              </View>
            </View>

            {invite.status === 'PENDING' && (
              <View style={{ gap: SPACING.sm }}>
                <Button title="Accept Invite" onPress={accept} loading={submitting} size="lg" />
                <Button title="Decline" onPress={decline} loading={submitting} size="lg" variant="danger" />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
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
  body: { padding: SPACING.xl, gap: SPACING.md },
  card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: C.text },
  desc: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: SPACING.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  metaText: { fontSize: FONT_SIZE.sm, color: C.textMuted },
  label: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginBottom: 4 },
  input: { backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, color: C.text, marginBottom: SPACING.md },
});

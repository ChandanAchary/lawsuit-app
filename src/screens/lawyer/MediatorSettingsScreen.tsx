import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { mediationApi, usersApi } from '../../services/api';
import { Button } from '../../components/Button';
import { formatErrorMessage, isEndpointMissing } from '../../utils/formatError';

const DEFAULT_SPECS = ['Family', 'Commercial', 'Employment', 'Property', 'Consumer', 'Civil'];

export const MediatorSettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const [isMediator, setIsMediator] = useState(false);
  const [bio, setBio] = useState('');
  const [fee, setFee] = useState('');
  const [specs, setSpecs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await usersApi.getLawyerInformation();
        // Server returns `{ lawyer: {...} }` (matches AvailabilityScreen,
        // EditLawyerProfileScreen, etc.). The previous `data.data || data`
        // unwrap landed on the wrapper object, so info.isMediator was
        // always undefined → the toggle reverted to OFF on every reload
        // even though the save itself worked. Saving and navigating away
        // hid this until the user reopened the screen.
        const info = data?.lawyer || data?.data || data || {};
        setIsMediator(!!info?.isMediator);
        setBio(info?.mediatorBio || '');
        setFee(info?.mediationFee ? String(info.mediationFee) : '');
        setSpecs(info?.mediationSpecializations || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const toggleSpec = (s: string) => {
    setSpecs((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const save = async () => {
    setSubmitting(true);
    try {
      const { data } = await mediationApi.updateMediatorProfile({
        isMediator,
        mediatorBio: bio.trim() || undefined,
        mediationFee: fee.trim() ? Math.max(0, Math.floor(Number(fee))) : undefined,
        mediationSpecializations: specs,
      });
      // Server returns `{ data: <updated lawyer subset> }` — sync local
      // state from it so the toggle reflects what actually persisted,
      // not just what the user clicked. Belt-and-braces against any
      // future server-side defaulting.
      const persisted = (data as any)?.data || data;
      if (persisted && typeof persisted.isMediator === 'boolean') {
        setIsMediator(persisted.isMediator);
        setBio(persisted.mediatorBio || '');
        setFee(persisted.mediationFee ? String(persisted.mediationFee) : '');
        setSpecs(persisted.mediationSpecializations || []);
      }
      Alert.alert(
        'Saved',
        isMediator
          ? 'You are now listed as available for mediation.'
          : 'You have been removed from the mediator directory.',
      );
      navigation.goBack();
    } catch (err: any) {
      if (isEndpointMissing(err)) {
        Alert.alert(
          'Feature Unavailable',
          'Mediator settings are not enabled on the server yet. Please try again later.',
        );
      } else {
        Alert.alert('Error', formatErrorMessage(err) || 'Failed to save');
      }
    } finally { setSubmitting(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mediator Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Available as Mediator</Text>
              <Text style={styles.rowSub}>Show in mediator directory</Text>
            </View>
            <Switch value={isMediator} onValueChange={setIsMediator} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textarea]} value={bio} onChangeText={setBio}
            placeholder="Brief mediator bio" placeholderTextColor={COLORS.textMuted} multiline
          />

          <Text style={styles.label}>Fee per session (₹)</Text>
          <TextInput
            style={styles.input} value={fee} onChangeText={setFee}
            placeholder="e.g. 1500" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad"
          />

          <Text style={styles.label}>Specializations</Text>
          <View style={styles.chipsRow}>
            {DEFAULT_SPECS.map((s) => {
              const active = specs.includes(s);
              return (
                <TouchableOpacity key={s}
                  onPress={() => toggleSpec(s)}
                  style={[styles.chip, active && { backgroundColor: COLORS.primary }]}
                >
                  <Text style={[styles.chipText, active && { color: '#FFF' }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Button title="Save Settings" onPress={save} loading={submitting || loading} size="lg" />
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
  body: { padding: SPACING.xl, gap: SPACING.md, paddingBottom: 80 },
  card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, ...SHADOWS.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  rowSub: { fontSize: FONT_SIZE.xs, color: C.textMuted },
  label: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
  input: { backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, color: C.text, marginBottom: SPACING.sm },
  textarea: { height: 100, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, backgroundColor: C.surfaceAlt },
  chipText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, TextInput, Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { platformConfigApi } from '../../services/api';
import { Loading, EmptyState } from '../../components/Common';
import { Button } from '../../components/Button';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { formatErrorMessage } from '../../utils/formatError';
import { formatDate, formatTime } from '../../utils/date';

// Phase 1 ships these keys; the screen renders any other keys the server has
// dynamically since the value column is unstructured JSON.
const KNOWN_KEYS: { key: string; label: string; hint: string; suffix?: string; integer?: boolean }[] = [
  { key: 'COMMISSION_PCT', label: 'Platform commission', hint: 'Percent taken from each booking before payout. 0 = none, 100 = full.', suffix: '%', integer: false },
  { key: 'GST_PCT',        label: 'GST',                 hint: 'GST percent applied to taxable transactions.',                          suffix: '%', integer: false },
  { key: 'TDS_PCT',        label: 'TDS',                 hint: 'TDS percent withheld at payout time.',                                  suffix: '%', integer: false },
];

export const SuperAdminPlatformConfigScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState<any>(null);
  const [valueInput, setValueInput] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await platformConfigApi.list();
      const rows = (data?.items || []) as any[];
      // Surface KNOWN_KEYS first even if missing from the response, so super
      // admins always see a slot to set them.
      const map = new Map(rows.map((r) => [r.key, r]));
      const ordered: any[] = [];
      for (const k of KNOWN_KEYS) {
        ordered.push(map.get(k.key) || { key: k.key, value: null, missing: true });
        map.delete(k.key);
      }
      for (const r of map.values()) ordered.push(r);
      setItems(ordered);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load configuration');
      setItems([]);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const meta = (key: string) => KNOWN_KEYS.find((k) => k.key === key);

  const openEdit = (row: any) => {
    setEditing(row);
    const m = meta(row.key);
    const raw = row.value;
    if (m?.suffix === '%') {
      setValueInput(raw === null || raw === undefined ? '' : String(raw));
    } else if (typeof raw === 'object' && raw !== null) {
      setValueInput(JSON.stringify(raw, null, 2));
    } else {
      setValueInput(raw === null || raw === undefined ? '' : String(raw));
    }
    setReason('');
  };

  const submit = async () => {
    if (!editing) return;
    const m = meta(editing.key);
    let parsed: unknown;
    if (m?.suffix === '%') {
      const num = Number(valueInput);
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        return Alert.alert('Invalid', 'Enter a percent between 0 and 100.');
      }
      parsed = num;
    } else {
      // Try JSON, fall back to raw string. Server stores arbitrary JSON.
      try {
        parsed = JSON.parse(valueInput);
      } catch {
        parsed = valueInput;
      }
    }
    setSubmitting(true);
    try {
      await platformConfigApi.upsert(editing.key, { value: parsed, reason: reason.trim() || undefined });
      Alert.alert('Saved', `${editing.key} updated.`);
      setEditing(null); setValueInput(''); setReason('');
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRow = ({ item }: { item: any }) => {
    const m = meta(item.key);
    const valueStr = item.missing
      ? 'not set'
      : typeof item.value === 'object' && item.value !== null
      ? JSON.stringify(item.value)
      : String(item.value);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openEdit(item)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.key}>{m?.label || item.key}</Text>
          <Text style={styles.keyId} numberOfLines={1}>{item.key}</Text>
          <Text style={[styles.value, item.missing && { color: COLORS.textMuted, fontStyle: 'italic' }]}>
            {valueStr}{!item.missing && m?.suffix ? m.suffix : ''}
          </Text>
          {item.updatedAt ? (
            <Text style={styles.updated}>
              Updated {formatDate(item.updatedAt)} · {formatTime(item.updatedAt)}
              {item.updatedById ? ` · by ${String(item.updatedById).slice(0, 8)}…` : ''}
            </Text>
          ) : null}
        </View>
        <Ionicons name="create-outline" size={20} color={COLORS.primary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Platform Config</Text>
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.key}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="⚙️" title="No keys" message="Server returned no configuration keys." />}
        />
      )}

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{meta(editing?.key)?.label || editing?.key}</Text>
              <TouchableOpacity onPress={() => setEditing(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.keyId}>{editing?.key}</Text>
              {!!meta(editing?.key)?.hint && (
                <Text style={styles.hint}>{meta(editing?.key)?.hint}</Text>
              )}

              <Text style={styles.label}>VALUE{meta(editing?.key)?.suffix ? ` (${meta(editing?.key)?.suffix})` : ''}</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={valueInput}
                onChangeText={setValueInput}
                placeholder={meta(editing?.key)?.suffix === '%' ? 'e.g. 10' : 'string, number, or JSON'}
                placeholderTextColor={COLORS.textMuted}
                multiline={meta(editing?.key)?.suffix !== '%'}
                keyboardType={meta(editing?.key)?.suffix === '%' ? 'numeric' : 'default'}
              />

              <Text style={styles.label}>REASON FOR CHANGE (OPTIONAL)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={reason}
                onChangeText={setReason}
                placeholder="Goes into the audit log"
                placeholderTextColor={COLORS.textMuted}
                multiline
              />
              <Button title="Save change" onPress={submit} loading={submitting} size="lg" />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  list: { padding: SPACING.xl, paddingBottom: 100 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.lg,
    marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  key: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  keyId: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2, letterSpacing: 0.3 },
  value: { fontSize: FONT_SIZE.lg, fontWeight: '900', color: C.primary, marginTop: SPACING.xs },
  updated: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: C.white, borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl, maxHeight: '90%', paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text, flex: 1 },
  modalBody: { padding: SPACING.xl },
  hint: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginTop: SPACING.sm, lineHeight: 18 },
  label: {
    fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted,
    letterSpacing: 0.5, marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: C.text, marginBottom: SPACING.md,
  },
});

export default SuperAdminPlatformConfigScreen;

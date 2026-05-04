import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useThemeStore, useColors } from '../../stores/themeStore';
import { reportApi } from '../../services/api';

const REPORT_TYPES = ['Bug', 'Feature Request', 'Feedback', 'Other'] as const;
type ReportType = typeof REPORT_TYPES[number];
type Report = { id: string; title: string; description: string; type?: string; status?: string; createdAt: string };
type Tab = 'submit' | 'history';

const STATUS_MAP: Record<string, { bg: string; fg: string; icon: string }> = {
  OPEN: { bg: '#DBEAFE', fg: '#2563EB', icon: 'radio-button-on' },
  IN_REVIEW: { bg: '#FEF3C7', fg: '#D97706', icon: 'time' },
  RESOLVED: { bg: '#D1FAE5', fg: '#059669', icon: 'checkmark-circle' },
};

export const ReportIssueScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s) => s.isDark);
  const C = useColors();
  const styles = React.useMemo(() => getStyles(C), [isDark]);

  const [tab, setTab] = useState<Tab>('submit');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ReportType>('Bug');
  const [submitting, setSubmitting] = useState(false);

  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const { data } = await reportApi.getMyReports();
      const list = data?.reports || data?.data?.reports || data?.data || [];
      setReports(Array.isArray(list) ? list : []);
    } catch { /* keep prior */ } finally { setLoadingReports(false); }
  }, []);

  useEffect(() => { if (tab === 'history') void loadReports(); }, [tab, loadReports]);

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert('Required', 'Please enter a title.'); return; }
    if (!description.trim()) { Alert.alert('Required', 'Please enter a description.'); return; }
    setSubmitting(true);
    try {
      await reportApi.create({ type, title: title.trim(), description: description.trim() });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Report Submitted ✓', 'Thank you! Our team will review your report.', [
        { text: 'OK', onPress: () => { setTitle(''); setDescription(''); setType('Bug'); } },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally { setSubmitting(false); }
  };

  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return ''; } };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={[C.primary, C.midnight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hdr}>
        <View style={styles.hdrDecor} />
        <View style={styles.hdrRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Text style={styles.hdrTitle}>Report & Feedback</Text>
            <Text style={styles.hdrSub}>Help us improve NyayaX</Text>
          </View>
          <View style={styles.hdrIcon}><Ionicons name="bug" size={24} color="rgba(255,255,255,0.8)" /></View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => setTab('submit')} style={[styles.tabBtn, tab === 'submit' && styles.tabActive]} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={16} color={tab === 'submit' ? C.primary : '#fff'} />
            <Text style={[styles.tabTxt, tab === 'submit' && styles.tabTxtActive]}>Submit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('history')} style={[styles.tabBtn, tab === 'history' && styles.tabActive]} activeOpacity={0.7}>
            <Ionicons name="list-outline" size={16} color={tab === 'history' ? C.primary : '#fff'} />
            <Text style={[styles.tabTxt, tab === 'history' && styles.tabTxtActive]}>My Reports</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {tab === 'submit' ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Type Selector */}
            <View style={styles.card}>
              <Text style={styles.label}>Report Type</Text>
              <View style={styles.typeRow}>
                {REPORT_TYPES.map(t => {
                  const on = type === t;
                  const icons: Record<string, string> = { Bug: 'bug', 'Feature Request': 'bulb', Feedback: 'chatbox-ellipses', Other: 'ellipsis-horizontal' };
                  return (
                    <TouchableOpacity key={t} onPress={() => setType(t)} style={[styles.typeChip, on && { backgroundColor: C.primary, borderColor: C.primary }]} activeOpacity={0.7}>
                      <Ionicons name={icons[t] as any} size={16} color={on ? '#fff' : C.textSecondary} />
                      <Text style={[styles.typeTxt, on && { color: '#fff' }]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Title */}
            <View style={styles.card}>
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} placeholder="Brief summary of the issue..." placeholderTextColor={C.textMuted} value={title} onChangeText={setTitle} maxLength={120} />
              <Text style={styles.charCount}>{title.length}/120</Text>
            </View>

            {/* Description */}
            <View style={styles.card}>
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Describe the issue in detail..." placeholderTextColor={C.textMuted} value={description} onChangeText={setDescription} multiline numberOfLines={5} textAlignVertical="top" />
            </View>

            {/* Submit */}
            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitTxt}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {loadingReports ? (
            <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>
          ) : reports.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIco}><Ionicons name="document-text-outline" size={48} color={C.textMuted} /></View>
              <Text style={styles.emptyT}>No Reports Yet</Text>
              <Text style={styles.emptyD}>Reports you submit will appear here with their status.</Text>
            </View>
          ) : reports.map((r, i) => {
            const s = STATUS_MAP[r.status || 'OPEN'] || STATUS_MAP.OPEN;
            return (
              <View key={r.id || i} style={styles.card}>
                <View style={styles.rptHdr}>
                  <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                    <Ionicons name={s.icon as any} size={12} color={s.fg} />
                    <Text style={[styles.statusTxt, { color: s.fg }]}>{r.status || 'OPEN'}</Text>
                  </View>
                  <Text style={styles.date}>{fmtDate(r.createdAt)}</Text>
                </View>
                <Text style={styles.rptTitle}>{r.title}</Text>
                <Text style={styles.rptDesc} numberOfLines={3}>{r.description}</Text>
              </View>
            );
          })}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  hdr: { paddingTop: SPACING.huge, paddingBottom: SPACING.xxl, paddingHorizontal: SPACING.xl, borderBottomLeftRadius: BORDER_RADIUS.xxl, borderBottomRightRadius: BORDER_RADIUS.xxl, overflow: 'hidden' },
  hdrDecor: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.05)', top: -30, right: -20 },
  hdrRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  hdrTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: '#fff' },
  hdrSub: { fontSize: FONT_SIZE.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  hdrIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.xl, backgroundColor: 'rgba(255,255,255,0.12)' },
  tabActive: { backgroundColor: C.white },
  tabTxt: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: '#fff' },
  tabTxtActive: { color: C.primary },
  form: { padding: SPACING.xl },
  card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.lg, ...SHADOWS.sm },
  label: { fontSize: FONT_SIZE.md, fontWeight: '700', color: C.text, marginBottom: SPACING.md },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, borderRadius: BORDER_RADIUS.full, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surfaceAlt },
  typeTxt: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.textSecondary },
  input: { backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: C.border, padding: SPACING.lg, fontSize: FONT_SIZE.md, color: C.text },
  textArea: { minHeight: 120 },
  charCount: { fontSize: FONT_SIZE.xs, color: C.textMuted, textAlign: 'right', marginTop: SPACING.xs },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: C.primary, borderRadius: BORDER_RADIUS.xl, paddingVertical: SPACING.lg + 2 },
  submitTxt: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: '#fff' },
  list: { padding: SPACING.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: SPACING.huge * 2 },
  empty: { alignItems: 'center', paddingTop: SPACING.huge * 2, paddingHorizontal: SPACING.xl },
  emptyIco: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xl },
  emptyT: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text, marginBottom: SPACING.sm },
  emptyD: { fontSize: FONT_SIZE.md, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
  rptHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full },
  statusTxt: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  date: { fontSize: FONT_SIZE.xs, color: C.textMuted, fontWeight: '600' },
  rptTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text, marginBottom: SPACING.xs },
  rptDesc: { fontSize: FONT_SIZE.md, color: C.textSecondary, lineHeight: 22 },
});

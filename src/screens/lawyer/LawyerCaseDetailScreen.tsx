import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, CASE_STATUS_COLORS } from '../../constants';
import { Case, CaseStatus, TimelineEvent, Hearing } from '../../types';
import { casesApi, chatApi } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/date';
import { StatusBadge, Loading, EmptyState } from '../../components/Common';
import { ChatTab } from '../../components/ChatTab';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/Modals';

type Tab = 'info' | 'timeline' | 'hearings' | 'chat' | 'documents' | 'resolution';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'info', label: 'Info', icon: 'information-circle-outline' },
  { key: 'timeline', label: 'Timeline', icon: 'git-branch-outline' },
  { key: 'hearings', label: 'Hearings', icon: 'calendar-outline' },
  { key: 'chat', label: 'Chat', icon: 'chatbubble-outline' },
  { key: 'documents', label: 'Docs', icon: 'document-outline' },
  { key: 'resolution', label: 'Resolve', icon: 'checkmark-circle-outline' },
];

export const LawyerCaseDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { caseId } = route.params;
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);

  // Add event/hearing forms
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [showAddHearing, setShowAddHearing] = useState(false);
  const [hearingTitle, setHearingTitle] = useState('');
  const [hearingDate, setHearingDate] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [resolution, setResolution] = useState('');

  useEffect(() => { fetchCase(); }, [caseId]);

  useEffect(() => {
    if (caseData) {
      if (activeTab === 'timeline') fetchTimeline();
      if (activeTab === 'hearings') fetchHearings();
      if (activeTab === 'documents') fetchDocuments();
      if (activeTab === 'chat') fetchChat();
    }
  }, [activeTab, caseData]);

  const fetchCase = async () => {
    try { const { data } = await casesApi.getById(caseId); setCaseData(data.case || data); }
    catch { Alert.alert('Error', 'Failed to load case'); navigation.goBack(); }
    finally { setLoading(false); }
  };
  const fetchTimeline = async () => { try { const { data } = await casesApi.getTimeline(caseId); setTimeline(data.items || data.timeline || []); } catch {} };
  const fetchHearings = async () => { try { const { data } = await casesApi.getHearings(caseId); setHearings(data.items || data.hearings || []); } catch {} };
  const fetchDocuments = async () => { try { const { data } = await casesApi.getDocuments(caseId); setDocuments(data.items || data.documents || []); } catch {} };
  const fetchChat = async () => { try { const { data } = await chatApi.getChats(); const f = (data.items || data.chats || []).find((c: any) => c.caseId === caseId); if (f) setChatId(f.id); } catch {} };

  const addTimelineEvent = async () => {
    if (!eventTitle.trim()) return Alert.alert('Required', 'Please enter a title');
    try {
      await casesApi.addTimeline(caseId, { title: eventTitle, description: eventDesc, eventDate: new Date().toISOString() });
      setShowAddEvent(false); setEventTitle(''); setEventDesc('');
      fetchTimeline();
    } catch { Alert.alert('Error', 'Failed to add event'); }
  };

  const addHearing = async () => {
    if (!hearingTitle.trim() || !hearingDate.trim()) return Alert.alert('Required', 'Please enter title and date');
    try {
      await casesApi.addHearing(caseId, { purpose: hearingTitle, date: hearingDate });
      setShowAddHearing(false); setHearingTitle(''); setHearingDate('');
      fetchHearings();
    } catch { Alert.alert('Error', 'Failed to add hearing'); }
  };

  const resolveCase = async () => {
    if (!resolution.trim()) return Alert.alert('Required', 'Enter resolution details');
    try {
      await casesApi.updateResolution(caseId, 'SETTLEMENT');
      setShowResolve(false); fetchCase();
      Alert.alert('Success', 'Case resolved');
    } catch { Alert.alert('Error', 'Failed to resolve case'); }
  };

  if (loading || !caseData) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{caseData.title}</Text>
        <StatusBadge status={caseData.status} colors={CASE_STATUS_COLORS[caseData.status] || CASE_STATUS_COLORS.OPEN} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabStrip} contentContainerStyle={styles.tabStripContent}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tabItem, activeTab === t.key && styles.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Ionicons name={t.icon as any} size={16} color={activeTab === t.key ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Info */}
      {activeTab === 'info' && (
        <ScrollView contentContainerStyle={styles.tabPadding}>
          <Row label="Case Number" value={caseData.caseNumber || '—'} />
          <Row label="Category" value={caseData.category || '—'} />
          <Row label="Status" value={caseData.status} />
          <Row label="Filed" value={formatDate(caseData.createdAt)} />
          {caseData.description && <Text style={styles.desc}>{caseData.description}</Text>}
          {caseData.client && (
            <View style={styles.personRow}>
              <Ionicons name="person" size={18} color={COLORS.accent} />
              <Text style={styles.personText}>{caseData.client.name} (Client)</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Timeline */}
      {activeTab === 'timeline' && (
        <ScrollView contentContainerStyle={styles.tabPadding}>
          <Button title="Add Event" variant="outline" onPress={() => setShowAddEvent(true)} icon={<Ionicons name="add" size={18} color={COLORS.primary} />} size="sm" style={{ alignSelf: 'flex-end', marginBottom: SPACING.lg }} />
          {timeline.length === 0 ? <EmptyState icon="📜" title="Empty Timeline" message="Add events to track progress" /> :
            timeline.map((ev, i) => (
              <View key={ev.id || i} style={styles.tlItem}>
                <View style={styles.tlDot} />
                {i < timeline.length - 1 && <View style={styles.tlLine} />}
                <View style={styles.tlContent}>
                  <Text style={styles.tlTitle}>{ev.title}</Text>
                  {ev.description && <Text style={styles.tlDesc}>{ev.description}</Text>}
                  <Text style={styles.tlDate}>{formatDateTime(ev.createdAt)}</Text>
                </View>
              </View>
            ))
          }
        </ScrollView>
      )}

      {/* Hearings */}
      {activeTab === 'hearings' && (
        <ScrollView contentContainerStyle={styles.tabPadding}>
          <Button title="Add Hearing" variant="outline" onPress={() => setShowAddHearing(true)} icon={<Ionicons name="add" size={18} color={COLORS.primary} />} size="sm" style={{ alignSelf: 'flex-end', marginBottom: SPACING.lg }} />
          {hearings.length === 0 ? <EmptyState icon="🏛️" title="No Hearings" message="Schedule a hearing" /> :
            hearings.map((h, i) => (
              <View key={h.id || i} style={styles.hearCard}>
                <Text style={styles.hearTitle}>{h.purpose || 'Hearing'}</Text>
                <Text style={styles.hearDate}>{formatDate(h.date)}</Text>
                {h.notes && <Text style={styles.hearNotes}>{h.notes}</Text>}
              </View>
            ))
          }
        </ScrollView>
      )}

      {activeTab === 'chat' && (
        <View style={{ flex: 1 }}>
          {chatId ? <ChatTab chatId={chatId} /> : <EmptyState icon="💬" title="No Chat" message="Chat will start when case is active" />}
        </View>
      )}

      {activeTab === 'documents' && (
        <ScrollView contentContainerStyle={styles.tabPadding}>
          {documents.length === 0 ? <EmptyState icon="📄" title="No Documents" message="Upload documents to this case" /> :
            documents.map((d, i) => (
              <View key={d.id || i} style={styles.docItem}>
                <Ionicons name="document-text" size={20} color={COLORS.primary} />
                <Text style={styles.docName} numberOfLines={1}>{d.name}</Text>
              </View>
            ))
          }
        </ScrollView>
      )}

      {activeTab === 'resolution' && (
        <ScrollView contentContainerStyle={styles.tabPadding}>
          {caseData.status === CaseStatus.RESOLVED ? (
            <View style={styles.resolvedCard}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
              <Text style={styles.resolvedTitle}>Case Resolved</Text>
              <Text style={styles.resolvedDesc}>{caseData.resolutionMethod || 'Resolved'}</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.resolveInfo}>Mark this case as resolved by providing resolution details.</Text>
              <Button title="Resolve Case" onPress={() => setShowResolve(true)} size="lg" />
            </View>
          )}
        </ScrollView>
      )}

      {/* Add Event Modal */}
      <BottomSheet visible={showAddEvent} onClose={() => setShowAddEvent(false)} title="Add Timeline Event">
        <TextInput style={styles.modalInput} placeholder="Event Title" value={eventTitle} onChangeText={setEventTitle} placeholderTextColor={COLORS.textMuted} />
        <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Description (optional)" value={eventDesc} onChangeText={setEventDesc} multiline placeholderTextColor={COLORS.textMuted} />
        <Button title="Add Event" onPress={addTimelineEvent} size="lg" />
      </BottomSheet>

      {/* Add Hearing Modal */}
      <BottomSheet visible={showAddHearing} onClose={() => setShowAddHearing(false)} title="Add Hearing">
        <TextInput style={styles.modalInput} placeholder="Hearing Title" value={hearingTitle} onChangeText={setHearingTitle} placeholderTextColor={COLORS.textMuted} />
        <TextInput style={styles.modalInput} placeholder="Date (YYYY-MM-DD)" value={hearingDate} onChangeText={setHearingDate} placeholderTextColor={COLORS.textMuted} />
        <Button title="Add Hearing" onPress={addHearing} size="lg" />
      </BottomSheet>

      {/* Resolve Modal */}
      <BottomSheet visible={showResolve} onClose={() => setShowResolve(false)} title="Resolve Case">
        <TextInput style={[styles.modalInput, { height: 100 }]} placeholder="Resolution details..." value={resolution} onChangeText={setResolution} multiline placeholderTextColor={COLORS.textMuted} />
        <Button title="Resolve Case" onPress={resolveCase} size="lg" />
      </BottomSheet>
    </View>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingTop: SPACING.huge, paddingBottom: SPACING.md, paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  tabStrip: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, maxHeight: 50 },
  tabStripContent: { paddingHorizontal: SPACING.sm, gap: 2 },
  tabItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.xs, fontWeight: '500', color: COLORS.textMuted },
  tabTextActive: { fontWeight: '700', color: COLORS.primary },
  tabPadding: { padding: SPACING.xl, paddingBottom: 100 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  rowLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  rowValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  desc: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.xl, lineHeight: 22 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xl, backgroundColor: COLORS.white, padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, ...SHADOWS.sm },
  personText: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  tlItem: { flexDirection: 'row', marginBottom: SPACING.xl, position: 'relative' },
  tlDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.primary, marginTop: 4, marginRight: SPACING.md, zIndex: 1 },
  tlLine: { position: 'absolute', left: 5, top: 16, width: 2, height: '100%', backgroundColor: COLORS.borderLight },
  tlContent: { flex: 1 },
  tlTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  tlDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  tlDate: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4 },
  hearCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm },
  hearTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  hearDate: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  hearNotes: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.sm },
  docItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm },
  docName: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  resolvedCard: { alignItems: 'center', paddingVertical: SPACING.huge },
  resolvedTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.success, marginTop: SPACING.md },
  resolvedDesc: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.sm },
  resolveInfo: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.xl, lineHeight: 22 },
  modalInput: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md, textAlignVertical: 'top',
  },
});

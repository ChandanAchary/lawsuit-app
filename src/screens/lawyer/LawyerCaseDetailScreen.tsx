import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, CASE_STATUS_COLORS } from '../../constants';
import { Case, CaseStatus, TimelineEvent, Hearing } from '../../types';
import { casesApi, chatApi } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/date';
import { StatusBadge, Loading, EmptyState } from '../../components/Common';
import { ChatTab } from '../../components/ChatTab';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/Modals';
import { safeGoBack } from '../../utils/navigation';

interface CaseTask {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  dueDate?: string;
  assignedToId?: string;
  assignedById?: string;
}

type Tab = 'info' | 'timeline' | 'hearings' | 'tasks' | 'chat' | 'documents' | 'resolution';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'info', label: 'Info', icon: 'information-circle-outline' },
  { key: 'timeline', label: 'Timeline', icon: 'git-branch-outline' },
  { key: 'hearings', label: 'Hearings', icon: 'calendar-outline' },
  { key: 'tasks', label: 'Tasks', icon: 'checkbox-outline' },
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
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  // Add event/hearing forms
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [showAddHearing, setShowAddHearing] = useState(false);
  const [hearingTitle, setHearingTitle] = useState('');
  // Hearing date is captured via the native picker. Initialised to
  // "two weeks from today at 11:00" — sane default for a future hearing.
  const [hearingDate, setHearingDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    d.setHours(11, 0, 0, 0);
    return d;
  });
  const [showHearingDatePicker, setShowHearingDatePicker] = useState(false);
  const [showHearingTimePicker, setShowHearingTimePicker] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [closeStatus, setCloseStatus] = useState<'CLOSED' | 'SETTLED'>('CLOSED');
  const [closureNotes, setClosureNotes] = useState('');
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementTerms, setSettlementTerms] = useState('');

  useEffect(() => { fetchCase(); }, [caseId]);

  useEffect(() => {
    if (caseData) {
      if (activeTab === 'timeline') fetchTimeline();
      if (activeTab === 'hearings') fetchHearings();
      if (activeTab === 'tasks') fetchTasks();
      if (activeTab === 'documents') fetchDocuments();
      if (activeTab === 'chat') fetchChat();
    }
  }, [activeTab, caseData]);

  const fetchCase = async () => {
    try { const { data } = await casesApi.getById(caseId); setCaseData(data.case || data); }
    catch { Alert.alert('Error', 'Failed to load case'); safeGoBack(navigation, 'MainTabs'); }
    finally { setLoading(false); }
  };
  const fetchTimeline = async () => { try { const { data } = await casesApi.getTimeline(caseId); setTimeline(data.items || data.timeline || []); } catch {} };
  const fetchHearings = async () => { try { const { data } = await casesApi.getHearings(caseId); setHearings(data.items || data.hearings || []); } catch {} };
  const fetchDocuments = async () => { try { const { data } = await casesApi.getDocuments(caseId); setDocuments(data.items || data.documents || []); } catch {} };
  const fetchTasks = async () => { try { const { data } = await casesApi.getTasks(caseId); setTasks(data.tasks || data.items || data.data || []); } catch { setTasks([]); } };
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
    if (!hearingTitle.trim()) return Alert.alert('Required', 'Please enter a hearing title');
    if (hearingDate.getTime() <= Date.now()) {
      return Alert.alert('Invalid date', 'Hearing must be scheduled in the future.');
    }
    try {
      await casesApi.addHearing(caseId, { purpose: hearingTitle, date: hearingDate.toISOString() });
      setShowAddHearing(false);
      setHearingTitle('');
      // Reset to a fresh "two weeks out" default for the next add.
      const next = new Date();
      next.setDate(next.getDate() + 14);
      next.setHours(11, 0, 0, 0);
      setHearingDate(next);
      fetchHearings();
    } catch { Alert.alert('Error', 'Failed to add hearing'); }
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return Alert.alert('Required', 'Please enter task title');
    setCreatingTask(true);
    try {
      await casesApi.createTask(caseId, { title: taskTitle.trim(), description: taskDesc.trim() || undefined });
      setTaskTitle('');
      setTaskDesc('');
      fetchTasks();
    } catch {
      Alert.alert('Error', 'Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  };

  const setTaskStatus = async (taskId: string, status: CaseTask['status']) => {
    setUpdatingTaskId(taskId);
    try {
      await casesApi.updateTask(taskId, { status });
      fetchTasks();
    } catch {
      Alert.alert('Error', 'Failed to update task');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const resolveCase = async () => {
    if (!closureNotes.trim()) return Alert.alert('Required', 'Enter closure notes');
    try {
      await casesApi.closeCase(caseId, {
        status: closeStatus,
        closureNotes: closureNotes.trim(),
        settlementAmount: closeStatus === 'SETTLED' && settlementAmount ? Number(settlementAmount) : undefined,
        settlementTerms: closeStatus === 'SETTLED' ? (settlementTerms.trim() || undefined) : undefined,
      });
      setShowResolve(false);
      setClosureNotes('');
      setSettlementAmount('');
      setSettlementTerms('');
      fetchCase();
      Alert.alert('Success', `Case ${closeStatus.toLowerCase()} successfully`);
    } catch { Alert.alert('Error', 'Failed to resolve case'); }
  };

  if (loading || !caseData) return <Loading />;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => safeGoBack(navigation, 'MainTabs')} style={styles.backBtn}>
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

      {activeTab === 'tasks' && (
        <ScrollView contentContainerStyle={styles.tabPadding}>
          <View style={styles.taskComposer}>
            <TextInput style={styles.modalInput} placeholder="Task Title" value={taskTitle} onChangeText={setTaskTitle} placeholderTextColor={COLORS.textMuted} />
            <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Task Description (optional)" value={taskDesc} onChangeText={setTaskDesc} multiline placeholderTextColor={COLORS.textMuted} />
            <Button title={creatingTask ? 'Adding...' : 'Add Task'} onPress={addTask} size="sm" disabled={creatingTask} />
          </View>
          {tasks.length === 0 ? <EmptyState icon="✅" title="No Tasks" message="Create tasks to track progress" /> :
            tasks.map((t) => (
              <View key={t.id} style={styles.taskCard}>
                <Text style={styles.taskTitle}>{t.title}</Text>
                {!!t.description && <Text style={styles.taskDesc}>{t.description}</Text>}
                <Text style={styles.taskMeta}>Status: {t.status}</Text>
                <View style={styles.taskActions}>
                  {(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.taskStatusBtn, t.status === s && styles.taskStatusBtnActive]}
                      onPress={() => setTaskStatus(t.id, s)}
                      disabled={updatingTaskId === t.id || t.status === s}
                    >
                      <Text style={[styles.taskStatusBtnText, t.status === s && styles.taskStatusBtnTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                <TouchableOpacity onPress={() => navigation.navigate('DocumentAi', { caseId, document: d })}>
                  <Ionicons name="flash-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            ))
          }
        </ScrollView>
      )}

      {activeTab === 'resolution' && (
        <ScrollView contentContainerStyle={styles.tabPadding}>
          {['CLOSED', 'RESOLVED', 'DISMISSED', 'WON', 'LOST', 'SETTLED'].includes(String(caseData.status)) ? (
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

      {/* Add Hearing Modal — uses native pickers for date + time so the
          lawyer doesn't fight a free-text format and the value is always
          a valid future timestamp. */}
      <BottomSheet visible={showAddHearing} onClose={() => setShowAddHearing(false)} title="Add Hearing">
        <TextInput style={styles.modalInput} placeholder="Hearing Title" value={hearingTitle} onChangeText={setHearingTitle} placeholderTextColor={COLORS.textMuted} />
        <TouchableOpacity
          style={styles.hearingPickerPill}
          activeOpacity={0.75}
          onPress={() => setShowHearingDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.hearingPickerLabel}>Date</Text>
            <Text style={styles.hearingPickerValue}>{format(hearingDate, 'EEE, dd MMM yyyy')}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.hearingPickerPill}
          activeOpacity={0.75}
          onPress={() => setShowHearingTimePicker(true)}
        >
          <Ionicons name="time-outline" size={18} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.hearingPickerLabel}>Time</Text>
            <Text style={styles.hearingPickerValue}>{format(hearingDate, 'hh:mm a')}</Text>
          </View>
        </TouchableOpacity>
        {showHearingDatePicker && (
          <DateTimePicker
            value={hearingDate}
            mode="date"
            minimumDate={new Date()}
            onChange={(_, picked) => {
              setShowHearingDatePicker(false);
              if (!picked) return;
              const next = new Date(picked);
              next.setHours(hearingDate.getHours(), hearingDate.getMinutes(), 0, 0);
              setHearingDate(next);
            }}
          />
        )}
        {showHearingTimePicker && (
          <DateTimePicker
            value={hearingDate}
            mode="time"
            minuteInterval={15}
            onChange={(_, picked) => {
              setShowHearingTimePicker(false);
              if (!picked) return;
              const next = new Date(hearingDate);
              next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
              setHearingDate(next);
            }}
          />
        )}
        <Button title="Add Hearing" onPress={addHearing} size="lg" />
      </BottomSheet>

      {/* Resolve Modal */}
      <BottomSheet visible={showResolve} onClose={() => setShowResolve(false)} title="Resolve Case">
        <View style={styles.resolveTypeRow}>
          {(['CLOSED', 'SETTLED'] as const).map((s) => (
            <TouchableOpacity key={s} style={[styles.resolveTypeChip, closeStatus === s && styles.resolveTypeChipActive]} onPress={() => setCloseStatus(s)}>
              <Text style={[styles.resolveTypeText, closeStatus === s && styles.resolveTypeTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={[styles.modalInput, { height: 100 }]} placeholder="Closure notes..." value={closureNotes} onChangeText={setClosureNotes} multiline placeholderTextColor={COLORS.textMuted} />
        {closeStatus === 'SETTLED' && (
          <>
            <TextInput style={styles.modalInput} placeholder="Settlement amount (optional)" keyboardType="numeric" value={settlementAmount} onChangeText={setSettlementAmount} placeholderTextColor={COLORS.textMuted} />
            <TextInput style={[styles.modalInput, { height: 80 }]} placeholder="Settlement terms (optional)" value={settlementTerms} onChangeText={setSettlementTerms} multiline placeholderTextColor={COLORS.textMuted} />
          </>
        )}
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
  taskComposer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  taskCard: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm },
  taskTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  taskDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 4 },
  taskMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: SPACING.sm },
  taskActions: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.sm },
  taskStatusBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
  },
  taskStatusBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  taskStatusBtnText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600' },
  taskStatusBtnTextActive: { color: COLORS.white },
  docItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm },
  docName: { flex: 1, fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  resolvedCard: { alignItems: 'center', paddingVertical: SPACING.huge },
  resolvedTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.success, marginTop: SPACING.md },
  resolvedDesc: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.sm },
  resolveInfo: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginBottom: SPACING.xl, lineHeight: 22 },
  resolveTypeRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  resolveTypeChip: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.lg, borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt },
  resolveTypeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  resolveTypeText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textSecondary },
  resolveTypeTextActive: { color: COLORS.white },
  modalInput: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md, color: COLORS.text, marginBottom: SPACING.md, textAlignVertical: 'top',
  },
  hearingPickerPill: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  hearingPickerLabel: {
    fontSize: FONT_SIZE.xs - 1, fontWeight: '600',
    color: COLORS.textMuted, letterSpacing: 0.4, textTransform: 'uppercase',
  },
  hearingPickerValue: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, marginTop: 2 },
});

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS, CASE_STATUS_COLORS } from '../../constants';
import { Case, CaseStatus, Document as CaseDoc, TimelineEvent, Hearing } from '../../types';
import { casesApi, chatApi } from '../../services/api';
import { formatDate, formatTime, formatDateTime } from '../../utils/date';
import { StatusBadge, Loading, EmptyState } from '../../components/Common';
import { ChatTab } from '../../components/ChatTab';
import { Button } from '../../components/Button';

interface CaseTask {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  dueDate?: string;
  assignedToId?: string;
  assignedById?: string;
  createdAt?: string;
}

type Tab = 'info' | 'timeline' | 'hearings' | 'tasks' | 'chat' | 'documents';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'info', label: 'Info', icon: 'information-circle-outline' },
  { key: 'timeline', label: 'Timeline', icon: 'git-branch-outline' },
  { key: 'hearings', label: 'Hearings', icon: 'calendar-outline' },
  { key: 'tasks', label: 'Tasks', icon: 'checkbox-outline' },
  { key: 'chat', label: 'Chat', icon: 'chatbubble-outline' },
  { key: 'documents', label: 'Docs', icon: 'document-outline' },
];

export const CaseDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { caseId } = route.params;
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [hearings, setHearings] = useState<Hearing[]>([]);
  const [documents, setDocuments] = useState<CaseDoc[]>([]);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

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
    try {
      const { data } = await casesApi.getById(caseId);
      setCaseData(data.case || data);
    } catch {
      Alert.alert('Error', 'Failed to load case');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const { data } = await casesApi.getTimeline(caseId);
      setTimeline(data.items || data.timeline || []);
    } catch {}
  };

  const fetchHearings = async () => {
    try {
      const { data } = await casesApi.getHearings(caseId);
      setHearings(data.items || data.hearings || []);
    } catch {}
  };

  const fetchDocuments = async () => {
    try {
      const { data } = await casesApi.getDocuments(caseId);
      setDocuments(data.items || data.documents || []);
    } catch {}
  };

  const fetchTasks = async () => {
    try {
      const { data } = await casesApi.getTasks(caseId);
      setTasks(data.tasks || data.items || data.data || []);
    } catch {
      setTasks([]);
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Required', 'Please enter task title');
      return;
    }
    setCreatingTask(true);
    try {
      await casesApi.createTask(caseId, {
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || undefined,
      });
      setNewTaskTitle('');
      setNewTaskDesc('');
      fetchTasks();
    } catch {
      Alert.alert('Error', 'Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleTaskStatus = async (taskId: string, status: CaseTask['status']) => {
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

  const fetchChat = async () => {
    try {
      const { data } = await chatApi.getChats();
      const found = (data.items || data.chats || []).find((c: any) => c.caseId === caseId);
      if (found) setChatId(found.id);
    } catch {}
  };

  if (loading || !caseData) return <Loading />;

  const statusColor = CASE_STATUS_COLORS[caseData.status] || CASE_STATUS_COLORS[CaseStatus.OPEN];

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.topBarTitle}>
          <Text style={styles.topBarText} numberOfLines={1}>{caseData.title}</Text>
          <StatusBadge status={caseData.status} colors={statusColor} />
        </View>
      </View>

      {/* Tab strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabStrip} contentContainerStyle={styles.tabStripContent}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, activeTab === t.key && styles.tabItemActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Ionicons name={t.icon as any} size={18} color={activeTab === t.key ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      {activeTab === 'info' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabPadding}>
          <InfoRow label="Case Number" value={caseData.caseNumber || '—'} />
          <InfoRow label="Category" value={caseData.category || '—'} />
          <InfoRow label="Status" value={caseData.status} />
          <InfoRow label="Resolution" value={caseData.resolutionMethod || '—'} />
          <InfoRow label="Filed Date" value={formatDate(caseData.createdAt)} />
          {caseData.description && (
            <View style={styles.descSection}>
              <Text style={styles.descLabel}>Description</Text>
              <Text style={styles.descText}>{caseData.description}</Text>
            </View>
          )}
          {caseData.lawyer && (
            <View style={styles.personCard}>
              <Ionicons name="briefcase" size={20} color={COLORS.primary} />
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{caseData.lawyer.name}</Text>
                <Text style={styles.personRole}>Lawyer</Text>
              </View>
            </View>
          )}
          {caseData.client && (
            <View style={styles.personCard}>
              <Ionicons name="person" size={20} color={COLORS.accent} />
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{caseData.client.name}</Text>
                <Text style={styles.personRole}>Client</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'timeline' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabPadding}>
          {timeline.length === 0 ? (
            <EmptyState icon="📜" title="No Timeline" message="No events recorded yet" />
          ) : (
            timeline.map((ev, i) => (
              <View key={ev.id || i} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                {i < timeline.length - 1 && <View style={styles.timelineLine} />}
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{ev.title}</Text>
                  {ev.description && <Text style={styles.timelineDesc}>{ev.description}</Text>}
                  <Text style={styles.timelineDate}>{formatDateTime(ev.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {activeTab === 'hearings' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabPadding}>
          {hearings.length === 0 ? (
            <EmptyState icon="🏛️" title="No Hearings" message="No hearings scheduled" />
          ) : (
            hearings.map((h, i) => (
              <View key={h.id || i} style={styles.hearingCard}>
                <View style={styles.hearingHeader}>
                  <Text style={styles.hearingTitle}>{h.purpose || 'Hearing'}</Text>
                  <StatusBadge status={h.outcome || 'SCHEDULED'} colors={{ bg: COLORS.infoLight, text: COLORS.info }} />
                </View>
                <View style={styles.hearingDetails}>
                  <View style={styles.hearingDetailRow}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.hearingDetailText}>{formatDate(h.date)}</Text>
                  </View>
                  {h.notes && <Text style={styles.hearingNotes}>{h.notes}</Text>}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {activeTab === 'tasks' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabPadding}>
          <View style={styles.taskComposer}>
            <TextInput
              style={styles.taskInput}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder="Task title"
              placeholderTextColor={COLORS.textMuted}
            />
            <TextInput
              style={[styles.taskInput, styles.taskInputMultiline]}
              value={newTaskDesc}
              onChangeText={setNewTaskDesc}
              placeholder="Task description (optional)"
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
            <Button
              title={creatingTask ? 'Adding...' : 'Add Task'}
              onPress={handleCreateTask}
              disabled={creatingTask}
              size="sm"
            />
          </View>

          {tasks.length === 0 ? (
            <EmptyState icon="✅" title="No Tasks" message="Create tasks to track case work" />
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {!!task.description && <Text style={styles.taskDesc}>{task.description}</Text>}
                <Text style={styles.taskMeta}>Status: {task.status}</Text>
                <View style={styles.taskActions}>
                  {(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.taskStatusBtn, task.status === s && styles.taskStatusBtnActive]}
                      onPress={() => handleTaskStatus(task.id, s)}
                      disabled={updatingTaskId === task.id || task.status === s}
                    >
                      <Text style={[styles.taskStatusBtnText, task.status === s && styles.taskStatusBtnTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {activeTab === 'chat' && (
        <View style={styles.chatContainer}>
          {chatId ? (
            <ChatTab chatId={chatId} />
          ) : (
            <EmptyState icon="💬" title="No Chat" message="Chat will be available once the case is active" />
          )}
        </View>
      )}

      {activeTab === 'documents' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.tabPadding}>
          {documents.length === 0 ? (
            <EmptyState icon="📄" title="No Documents" message="No documents uploaded yet" />
          ) : (
            documents.map((doc, i) => (
              <View key={doc.id || i} style={styles.docRow}>
                <Ionicons name="document-text" size={22} color={COLORS.primary} />
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                  <Text style={styles.docMeta}>{formatDate(doc.createdAt)}</Text>
                </View>
                <TouchableOpacity>
                  <Ionicons name="download-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.xl, backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { flex: 1, marginLeft: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  topBarText: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, flex: 1 },
  tabStrip: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  tabStripContent: { paddingHorizontal: SPACING.md, gap: SPACING.xs },
  tabItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: FONT_SIZE.sm, fontWeight: '500', color: COLORS.textMuted },
  tabLabelActive: { fontWeight: '700', color: COLORS.primary },
  tabContent: { flex: 1 },
  tabPadding: { padding: SPACING.xl, paddingBottom: 100 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  infoLabel: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary },
  infoValue: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  descSection: { marginTop: SPACING.xl },
  descLabel: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
  descText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, lineHeight: 22 },
  personCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.md, ...SHADOWS.sm,
  },
  personInfo: { flex: 1 },
  personName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  personRole: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  timelineItem: { flexDirection: 'row', marginBottom: SPACING.xl, position: 'relative' },
  timelineDot: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.primary,
    marginTop: 4, marginRight: SPACING.md, zIndex: 1,
  },
  timelineLine: {
    position: 'absolute', left: 6, top: 18, width: 2, height: '100%',
    backgroundColor: COLORS.borderLight,
  },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  timelineDesc: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  timelineDate: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 4 },
  hearingCard: {
    backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg,
    marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  hearingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hearingTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, flex: 1 },
  hearingDetails: { marginTop: SPACING.sm },
  hearingDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hearingDetailText: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary },
  hearingNotes: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginTop: SPACING.sm, lineHeight: 20 },
  taskComposer: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  taskInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  taskInputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  taskCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
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
  chatContainer: { flex: 1 },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  docInfo: { flex: 1 },
  docName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  docMeta: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
});

import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { mediationApi } from '../../services/api';
import { Loading } from '../../components/Common';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../stores/authStore';
import { UserRole, Mediation, MediationOutcome } from '../../types';
import { formatDate, formatTime } from '../../utils/date';
import { formatErrorMessage } from '../../utils/formatError';

const statusColor: Record<string, { bg: string; fg: string }> = {
  AWAITING_RESPONDENT_LAWYER: { bg: '#FEF3C7', fg: '#B45309' },
  AWAITING_MEDIATOR_SELECTION: { bg: '#DBEAFE', fg: '#1D4ED8' },
  IN_SESSION: { bg: '#D1FAE5', fg: '#047857' },
  RESOLVED: { bg: '#DCFCE7', fg: '#166534' },
  ESCALATED_TO_CASE: { bg: '#FEE2E2', fg: '#B91C1C' },
  CANCELLED: { bg: '#E5E7EB', fg: '#374151' },
};

const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export const MediationDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);
  const user = useAuthStore((s) => s.user);

  const id: string = route.params?.id;
  const [m, setM] = useState<Mediation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lawyerIdInput, setLawyerIdInput] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [showConclude, setShowConclude] = useState(false);
  const [outcome, setOutcome] = useState<MediationOutcome>('RESOLVED');
  const [settlementTerms, setSettlementTerms] = useState('');
  const [closureNotes, setClosureNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const { data } = await mediationApi.getById(id);
      setM(data.data || data);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to load mediation');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading || !m) return <Loading />;

  const isClient = user?.role === UserRole.CLIENT;
  const isLawyer = user?.role === UserRole.LAWYER;
  const isInitiator = m.initiatorClientId === user?.id;
  const isMediator = m.mediatorId && user?.id === m.mediatorId;
  const badge = statusColor[m.status] || statusColor.CANCELLED;

  const canAttachRespondentLawyer =
    isClient && m.respondentClientId === user?.id && m.status === 'AWAITING_RESPONDENT_LAWYER';
  const canPickMediator =
    isClient && (isInitiator || m.respondentClientId === user?.id) && m.status === 'AWAITING_MEDIATOR_SELECTION';
  const canJoinRoom = m.status === 'IN_SESSION' && !!m.dailyRoomUrl;
  const canConclude = isLawyer && isMediator && m.status === 'IN_SESSION';

  const attach = async () => {
    if (!lawyerIdInput.trim()) return Alert.alert('Error', 'Enter a lawyer ID');
    setSubmitting(true);
    try {
      await mediationApi.attachRespondentLawyer(m.id, lawyerIdInput.trim());
      setShowAttach(false); setLawyerIdInput('');
      Alert.alert('Attached', 'Lawyer attached successfully');
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to attach lawyer');
    } finally { setSubmitting(false); }
  };

  const conclude = async () => {
    setSubmitting(true);
    try {
      await mediationApi.conclude(m.id, {
        outcome,
        settlementTerms: settlementTerms.trim() || undefined,
        closureNotes: closureNotes.trim() || undefined,
      });
      setShowConclude(false);
      Alert.alert('Concluded', 'Mediation concluded.');
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to conclude');
    } finally { setSubmitting(false); }
  };

  const joinRoom = () => navigation.navigate('MediationRoom', { id: m.id });
  const goPickMediator = () => navigation.navigate('MediationMediators', { id: m.id });

  const Party = ({ label, p, fallback }: { label: string; p?: any; fallback?: string }) => (
    <View style={styles.partyRow}>
      <Ionicons name="person-circle-outline" size={22} color={COLORS.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.partyLabel}>{label}</Text>
        <Text style={styles.partyName}>{p?.name || fallback || '—'}</Text>
        {p?.email && <Text style={styles.partySub}>{p.email}</Text>}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Mediation</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
      >
        <View style={styles.topCard}>
          <View style={styles.topRow}>
            <Text style={styles.title}>{m.disputeTitle}</Text>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.fg }]}>{pretty(m.status)}</Text>
            </View>
          </View>
          <Text style={styles.desc}>{m.disputeDescription}</Text>
          <Text style={styles.meta}>Created {formatDate(m.createdAt)} · {formatTime(m.createdAt)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parties</Text>
          <Party label="Initiator" p={m.initiatorClient} />
          <Party label="Respondent" p={m.respondentClient} />
          <Party label="Initiator's Lawyer" p={m.initiatorLawyer || undefined} fallback="Not attached" />
          <Party label="Respondent's Lawyer" p={m.respondentLawyer || undefined} fallback="Not attached" />
          <Party label="Mediator" p={m.mediator || undefined} fallback="Not selected" />
        </View>

        {m.status === 'RESOLVED' || m.status === 'ESCALATED_TO_CASE' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Outcome</Text>
            <Text style={styles.line}>Outcome: {pretty(m.outcome || m.status)}</Text>
            {m.settlementTerms && <Text style={styles.line}>Terms: {m.settlementTerms}</Text>}
            {m.closureNotes && <Text style={styles.line}>Notes: {m.closureNotes}</Text>}
            {m.escalatedCaseId && <Text style={styles.line}>Case ID: {m.escalatedCaseId}</Text>}
          </View>
        ) : null}

        <View style={styles.actions}>
          {canAttachRespondentLawyer && (
            <Button title="Attach My Lawyer" onPress={() => setShowAttach(true)} size="lg" variant="outline" />
          )}
          {canPickMediator && (
            <Button title="Pick Mediator" onPress={goPickMediator} size="lg" />
          )}
          {canJoinRoom && (
            <Button title="Join Mediation Room" onPress={joinRoom} size="lg" />
          )}
          {canConclude && (
            <Button title="Conclude Mediation" onPress={() => setShowConclude(true)} size="lg" variant="danger" />
          )}
        </View>
      </ScrollView>

      {/* Attach Lawyer Modal */}
      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attach Lawyer</Text>
              <TouchableOpacity onPress={() => setShowAttach(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Lawyer ID</Text>
              <TextInput
                style={styles.input} value={lawyerIdInput} onChangeText={setLawyerIdInput}
                placeholder="Lawyer user ID" placeholderTextColor={COLORS.textMuted} autoCapitalize="none"
              />
              <Button title="Attach" onPress={attach} loading={submitting} size="lg" />
            </View>
          </View>
        </View>
      </Modal>

      {/* Conclude Modal */}
      <Modal visible={showConclude} transparent animationType="slide" onRequestClose={() => setShowConclude(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Conclude Mediation</Text>
              <TouchableOpacity onPress={() => setShowConclude(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.label}>Outcome</Text>
              <View style={{ flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md }}>
                {(['RESOLVED', 'ESCALATED_TO_CASE'] as MediationOutcome[]).map((o) => (
                  <TouchableOpacity key={o}
                    style={[styles.pill, outcome === o && { backgroundColor: COLORS.primary }]}
                    onPress={() => setOutcome(o)}>
                    <Text style={[styles.pillText, outcome === o && { color: '#FFF' }]}>{pretty(o)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Settlement Terms</Text>
              <TextInput
                style={[styles.input, styles.textarea]} value={settlementTerms} onChangeText={setSettlementTerms}
                placeholder="Terms (optional)" placeholderTextColor={COLORS.textMuted} multiline
              />
              <Text style={styles.label}>Closure Notes</Text>
              <TextInput
                style={[styles.input, styles.textarea]} value={closureNotes} onChangeText={setClosureNotes}
                placeholder="Notes (optional)" placeholderTextColor={COLORS.textMuted} multiline
              />
              <Button title="Conclude" onPress={conclude} loading={submitting} size="lg" variant="danger" />
            </View>
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
  body: { padding: SPACING.xl, paddingBottom: 80 },
  topCard: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  title: { flex: 1, fontSize: FONT_SIZE.xl, fontWeight: '900', color: C.text },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: BORDER_RADIUS.full },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '800' },
  desc: { color: C.textSecondary, marginTop: SPACING.sm, fontSize: FONT_SIZE.sm },
  meta: { color: C.textMuted, marginTop: SPACING.sm, fontSize: FONT_SIZE.xs },
  card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text, marginBottom: SPACING.sm },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: C.borderLight },
  partyLabel: { fontSize: FONT_SIZE.xs, color: C.textMuted },
  partyName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: C.text },
  partySub: { fontSize: FONT_SIZE.xs, color: C.textMuted },
  line: { fontSize: FONT_SIZE.sm, color: C.text, marginTop: 4 },
  actions: { gap: SPACING.sm, marginTop: SPACING.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.white, borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: SPACING.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text },
  modalBody: { padding: SPACING.xl },
  label: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
  input: { backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, color: C.text, marginBottom: SPACING.md },
  textarea: { height: 90, textAlignVertical: 'top' },
  pill: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, backgroundColor: C.surfaceAlt },
  pillText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
});

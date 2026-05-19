import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { mediationApi, appointmentsApi, storageApi } from '../../services/api';
import { socketService } from '../../services/socket';
import { Loading } from '../../components/Common';
import { Button } from '../../components/Button';
import { RazorpayCheckout } from '../../components/RazorpayCheckout';
import type { RazorpayOrderOptions, RazorpayPaymentResult } from '../../utils/razorpay';
import { useAuthStore } from '../../stores/authStore';
import { UserRole, Mediation, MediationOutcome, MediatorProfile, Appointment, AppointmentStatus } from '../../types';
import { formatDate, formatTime } from '../../utils/date';
import { formatErrorMessage } from '../../utils/formatError';

const statusColor: Record<string, { bg: string; fg: string }> = {
  AWAITING_RESPONDENT_LAWYER: { bg: '#FEF3C7', fg: '#B45309' },
  AWAITING_MEDIATOR_SELECTION: { bg: '#DBEAFE', fg: '#1D4ED8' },
  IN_SESSION: { bg: '#D1FAE5', fg: '#047857' },
  RESOLVED: { bg: '#DCFCE7', fg: '#166534' },
  ESCALATED_TO_CASE: { bg: '#FEE2E2', fg: '#B91C1C' },
  CANCELLED: { bg: '#E5E7EB', fg: '#374151' },
  RESPONDENT_ACCEPTED: { bg: '#FEF3C7', fg: '#B45309' },
  RESPONDENT_SIDE_SUBMITTED: { bg: '#FEF3C7', fg: '#B45309' },
  MEDIATOR_SHORTLIST: { bg: '#DBEAFE', fg: '#1D4ED8' },
  MEDIATOR_CONVERGE: { bg: '#DBEAFE', fg: '#1D4ED8' },
  AWAITING_MEDIATION_FEE: { bg: '#EDE9FE', fg: '#6D28D9' },
  MEDIATOR_OFFERED: { bg: '#E0E7FF', fg: '#4338CA' },
  ACTIVE: { bg: '#D1FAE5', fg: '#047857' },
  SETTLED: { bg: '#DCFCE7', fg: '#166534' },
  NON_SETTLEMENT: { bg: '#FEE2E2', fg: '#B91C1C' },
};

const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const CANONICAL_STEPS: { key: string; label: string }[] = [
  { key: 'RESPONDENT_ACCEPTED', label: "Respondent's side" },
  { key: 'RESPONDENT_SIDE_SUBMITTED', label: "Respondent's lawyer" },
  { key: 'MEDIATOR_SHORTLIST', label: 'Shortlist' },
  { key: 'MEDIATOR_CONVERGE', label: 'Agree' },
  { key: 'AWAITING_MEDIATION_FEE', label: 'Fee' },
  { key: 'MEDIATOR_OFFERED', label: 'Mediator' },
  { key: 'ACTIVE', label: 'Session' },
];
const TERMINAL = ['RESOLVED', 'ESCALATED_TO_CASE', 'SETTLED', 'NON_SETTLEMENT', 'CANCELLED'];

export const MediationDetailScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);
  const user = useAuthStore((s) => s.user);

  const id: string = route.params?.id;
  const [m, setM] = useState<Mediation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Legacy
  const [lawyerIdInput, setLawyerIdInput] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [showConclude, setShowConclude] = useState(false);
  const [outcome, setOutcome] = useState<MediationOutcome>('RESOLVED');
  const [settlementTerms, setSettlementTerms] = useState('');
  const [closureNotes, setClosureNotes] = useState('');

  // Canonical
  const [statement, setStatement] = useState('');
  const [docUrls, setDocUrls] = useState<string[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [mediators, setMediators] = useState<MediatorProfile[]>([]);
  const [showShortlist, setShowShortlist] = useState(false);
  const [shortlistPick, setShortlistPick] = useState<string[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [payingFee, setPayingFee] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderOptions, setOrderOptions] = useState<RazorpayOrderOptions | null>(null);

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

  useEffect(() => {
    if (!id) return;
    const off = socketService.on('mediation:updated', (payload: unknown) => {
      const evtId = (payload as { mediationId?: string } | undefined)?.mediationId;
      if (evtId && evtId !== id) return;
      load(false);
    });
    return off;
  }, [id, load]);

  // Mediator directory — needed for shortlist + converge stages.
  useEffect(() => {
    if (m && (m.status === 'MEDIATOR_SHORTLIST' || m.status === 'MEDIATOR_CONVERGE') && mediators.length === 0) {
      mediationApi.listMediators()
        .then(({ data }) => setMediators(data.data || data || []))
        .catch(() => {});
    }
  }, [m, mediators.length]);

  // Respondent's accepted appointments — to attach a lawyer.
  useEffect(() => {
    if (m && m.status === 'RESPONDENT_SIDE_SUBMITTED') {
      appointmentsApi.getAll()
        .then(({ data }) => setAppts(data.items || data.appointments || data || []))
        .catch(() => {});
    }
  }, [m]);

  if (loading || !m) return <Loading />;

  const isClient = user?.role === UserRole.CLIENT;
  const isLawyer = user?.role === UserRole.LAWYER;
  const isInitiatorClient = m.initiatorClientId === user?.id;
  const isRespondentClient = m.respondentClientId === user?.id;
  const isInitiatorLawyer = !!m.initiatorLawyerId && m.initiatorLawyerId === user?.id;
  const isRespondentLawyer = !!m.respondentLawyerId && m.respondentLawyerId === user?.id;
  const isMediator = !!m.mediatorId && user?.id === m.mediatorId;
  const badge = statusColor[m.status] || statusColor.CANCELLED;

  // Who acts for each side: the side's lawyer if represented, else the client.
  const canActInitiator = isInitiatorLawyer || (isInitiatorClient && !m.initiatorLawyerId);
  const canActRespondent = isRespondentLawyer || (isRespondentClient && !m.respondentLawyerId);
  const actingSide: 'INITIATOR' | 'RESPONDENT' | null =
    canActInitiator ? 'INITIATOR' : canActRespondent ? 'RESPONDENT' : null;

  const myShortlist = actingSide === 'INITIATOR' ? m.initiatorMediatorShortlist : actingSide === 'RESPONDENT' ? m.respondentMediatorShortlist : [];
  const myShortlistDone = (myShortlist?.length ?? 0) > 0;
  const initiatorShortlistDone = (m.initiatorMediatorShortlist?.length ?? 0) > 0;
  const respondentShortlistDone = (m.respondentMediatorShortlist?.length ?? 0) > 0;
  const myFinal = actingSide === 'INITIATOR' ? m.initiatorFinalMediatorId : actingSide === 'RESPONDENT' ? m.respondentFinalMediatorId : null;
  const otherFinal = actingSide === 'INITIATOR' ? m.respondentFinalMediatorId : actingSide === 'RESPONDENT' ? m.initiatorFinalMediatorId : null;

  const myFeeSide: 'INITIATOR' | 'RESPONDENT' | null =
    isInitiatorClient ? 'INITIATOR' : isRespondentClient ? 'RESPONDENT' : null;
  const myFeePaid = myFeeSide === 'INITIATOR' ? !!m.initiatorFeePaidAt : myFeeSide === 'RESPONDENT' ? !!m.respondentFeePaidAt : false;
  const otherFeePaid = myFeeSide === 'INITIATOR' ? !!m.respondentFeePaidAt : myFeeSide === 'RESPONDENT' ? !!m.initiatorFeePaidAt : false;
  const feeTotal = m.mediationFeeTotal ?? 3000;
  const feeHalf = Math.round(feeTotal / 2);

  const CANCELLABLE = [
    'AWAITING_RESPONDENT_LAWYER', 'AWAITING_MEDIATOR_SELECTION',
    'RESPONDENT_ACCEPTED', 'RESPONDENT_SIDE_SUBMITTED',
    'MEDIATOR_SHORTLIST', 'MEDIATOR_CONVERGE', 'AWAITING_MEDIATION_FEE',
  ];
  const canCancel = (isInitiatorClient || isRespondentClient) && CANCELLABLE.includes(m.status);

  const mediatorName = (mid?: string | null) => {
    if (!mid) return null;
    return mediators.find((x) => x.id === mid)?.name || mid;
  };

  // ─── Handlers ───
  const submitSide = async () => {
    if (statement.trim().length < 10) return Alert.alert('Error', 'Please write at least a sentence (10+ characters).');
    setSubmitting(true);
    try {
      await mediationApi.submitRespondentSide(m.id, { statement: statement.trim(), documentUrls: docUrls });
      setStatement(''); setDocUrls([]);
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to submit your side');
    } finally { setSubmitting(false); }
  };

  const pickDocs = async () => {
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (pick.canceled || !pick.assets?.length) return;
      setUploadingDoc(true);
      const { data: signData } = await storageApi.getCloudinarySignature('documents');
      const urls: string[] = [];
      for (const asset of pick.assets) {
        const mimeType = asset.mimeType || 'application/octet-stream';
        const formData = new FormData();
        formData.append('file', { uri: asset.uri, type: mimeType, name: asset.name } as any);
        formData.append('timestamp', String(signData.timestamp));
        formData.append('signature', signData.signature);
        formData.append('api_key', signData.apiKey);
        formData.append('folder', signData.folder);
        const resourceType = mimeType.startsWith('image/') ? 'image' : 'raw';
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${encodeURIComponent(signData.cloudName)}/${resourceType}/upload`,
          { method: 'POST', body: formData },
        );
        const uploaded = await res.json();
        if (uploaded?.secure_url) urls.push(uploaded.secure_url);
      }
      if (urls.length) setDocUrls((prev) => [...prev, ...urls]);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Upload failed');
    } finally { setUploadingDoc(false); }
  };

  const attachFromAppt = async (appointmentId: string) => {
    setSubmitting(true);
    try {
      await mediationApi.attachRespondentLawyerFromAppointment(m.id, appointmentId);
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to attach lawyer from appointment');
    } finally { setSubmitting(false); }
  };

  const openShortlist = () => {
    setShortlistPick([]);
    setShowShortlist(true);
  };
  const toggleShortlistPick = (mid: string) => {
    setShortlistPick((p) => (p.includes(mid) ? p.filter((x) => x !== mid) : p.length >= 3 ? p : [...p, mid]));
  };
  const submitShortlist = async () => {
    if (shortlistPick.length < 1 || shortlistPick.length > 3) return Alert.alert('Error', 'Pick 1 to 3 mediators');
    setSubmitting(true);
    try {
      await mediationApi.submitMediatorShortlist(m.id, shortlistPick);
      setShowShortlist(false); setShortlistPick([]);
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to submit shortlist');
    } finally { setSubmitting(false); }
  };

  const submitFinal = async (mid: string) => {
    setSubmitting(true);
    try {
      await mediationApi.submitFinalMediator(m.id, mid);
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Failed to submit your final mediator');
    } finally { setSubmitting(false); }
  };

  const payFeeHalf = async () => {
    setPayingFee(true);
    try {
      const { data } = await mediationApi.startMediationFee(m.id);
      const payload = data.data || data;
      const payment = payload?.payment;
      const orderId = payment?.providerOrderId;
      if (!orderId) throw new Error('Payment order could not be created. Please try again later.');
      setOrderOptions({
        orderId,
        amount: (payment.amount ?? feeHalf) * 100,
        currency: payment.currency || 'INR',
        name: 'NyayaX',
        description: `Mediation fee (your half) — ${m.disputeTitle}`,
        prefillEmail: user?.email,
        prefillPhone: user?.phone,
        prefillName: user?.name,
      });
      setShowCheckout(true);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || err?.message || 'Could not start the fee payment');
    } finally { setPayingFee(false); }
  };

  const onRazorpaySuccess = async (result: RazorpayPaymentResult) => {
    setShowCheckout(false);
    setSubmitting(true);
    try {
      await mediationApi.confirmMediationFee(m.id, {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });
      Alert.alert('Payment received', 'Your half of the mediation fee is secured.');
      load(false);
    } catch (err: any) {
      Alert.alert('Error', formatErrorMessage(err) || 'Payment captured but confirmation failed. Contact support.');
    } finally { setSubmitting(false); }
  };

  const mediatorRespond = (accept: boolean) => {
    const go = async () => {
      setSubmitting(true);
      try {
        await mediationApi.respondToMediatorOffer(m.id, accept);
        load(false);
      } catch (err: any) {
        Alert.alert('Error', formatErrorMessage(err) || 'Failed to respond to the offer');
      } finally { setSubmitting(false); }
    };
    if (!accept) {
      Alert.alert('Decline mediation?', 'Both clients will be refunded and the parties must agree on another mediator.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: go },
      ]);
    } else { go(); }
  };

  const attach = async () => {
    if (!lawyerIdInput.trim()) return Alert.alert('Error', 'Enter a lawyer ID');
    setSubmitting(true);
    try {
      await mediationApi.attachRespondentLawyer(m.id, lawyerIdInput.trim());
      setShowAttach(false); setLawyerIdInput('');
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

  const cancelMediation = () => {
    Alert.alert('Cancel mediation?', 'This closes it for everyone. Any fee already paid is refunded.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel mediation', style: 'destructive', onPress: async () => {
          setSubmitting(true);
          try { await mediationApi.cancelMediation(m.id); load(false); }
          catch (err: any) { Alert.alert('Error', formatErrorMessage(err) || 'Failed to cancel'); }
          finally { setSubmitting(false); }
        },
      },
    ]);
  };

  const joinRoom = () => navigation.navigate('MediationRoom', { id: m.id });

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

  const stepIdx = CANONICAL_STEPS.findIndex((s) => s.key === m.status);
  const showStepper = stepIdx >= 0 || (TERMINAL.includes(m.status) && m.status !== 'CANCELLED');
  const attachableAppts = appts.filter(
    (a) => a.lawyerId && (a.status === AppointmentStatus.CONFIRMED || a.status === AppointmentStatus.COMPLETED),
  );
  const unionShortlist = Array.from(new Set([
    ...(m.initiatorMediatorShortlist || []),
    ...(m.respondentMediatorShortlist || []),
  ]));

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

          {showStepper && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SPACING.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {CANONICAL_STEPS.map((s, i) => {
                  const done = TERMINAL.includes(m.status) ? true : i < stepIdx;
                  const current = i === stepIdx;
                  return (
                    <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[
                        styles.stepChip,
                        current ? { backgroundColor: COLORS.primary } : done ? { backgroundColor: '#D1FAE5' } : { backgroundColor: COLORS.surfaceAlt },
                      ]}>
                        <Text style={[
                          styles.stepChipText,
                          current ? { color: '#FFF' } : done ? { color: '#047857' } : { color: COLORS.textMuted },
                        ]}>{s.label}</Text>
                      </View>
                      {i < CANONICAL_STEPS.length - 1 && <Text style={styles.stepArrow}>→</Text>}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parties</Text>
          <Party label="Initiator" p={m.initiatorClient} />
          <Party label="Respondent" p={m.respondentClient} />
          <Party label="Initiator's Lawyer" p={m.initiatorLawyer || undefined} fallback="Not attached" />
          <Party label="Respondent's Lawyer" p={m.respondentLawyer || undefined} fallback="Not attached" />
          <Party label="Mediator" p={m.mediator || undefined} fallback="Not selected" />
        </View>

        {/* Stage 1 · Respondent submits their side */}
        {m.status === 'RESPONDENT_ACCEPTED' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 1 · Respondent's side of the dispute</Text>
            {isRespondentClient ? (
              <>
                <Text style={styles.help}>
                  Share your account of the dispute and any supporting documents. The
                  mediator sees both sides only after the fee is secured.
                </Text>
                <TextInput
                  style={[styles.input, styles.textarea]} value={statement} onChangeText={setStatement}
                  placeholder="Describe the dispute from your perspective…" placeholderTextColor={COLORS.textMuted} multiline
                />
                <TouchableOpacity style={styles.attachBtn} onPress={pickDocs} disabled={uploadingDoc}>
                  <Ionicons name="attach" size={18} color={COLORS.primary} />
                  <Text style={styles.attachBtnText}>{uploadingDoc ? 'Uploading…' : 'Attach documents'}</Text>
                </TouchableOpacity>
                {docUrls.map((u, i) => (
                  <View key={u} style={styles.docChip}>
                    <Text style={styles.docChipText} numberOfLines={1}>Document {i + 1}</Text>
                    <TouchableOpacity onPress={() => setDocUrls((p) => p.filter((x) => x !== u))}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <Button title="Submit my side" onPress={submitSide} loading={submitting} size="lg" style={{ marginTop: SPACING.md }} />
              </>
            ) : (
              <Text style={styles.help}>Waiting for {m.respondentClient?.name || 'the respondent'} to submit their side.</Text>
            )}
          </View>
        )}

        {/* Stage 2 · Respondent appoints a lawyer */}
        {m.status === 'RESPONDENT_SIDE_SUBMITTED' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 2 · Respondent appoints a lawyer</Text>
            {isRespondentClient ? (
              <>
                <Text style={styles.help}>
                  Book an appointment with a lawyer of your choice. Once that lawyer
                  accepts, attach them here to move forward.
                </Text>
                <Button
                  title="Find a lawyer & book"
                  variant="outline"
                  size="md"
                  onPress={() => navigation.navigate('MainTabs')}
                  style={{ marginBottom: SPACING.md }}
                />
                <Text style={styles.subLabel}>Attach an accepted appointment</Text>
                {attachableAppts.length === 0 ? (
                  <Text style={styles.help}>No accepted appointments yet. After a lawyer confirms your booking, it appears here.</Text>
                ) : attachableAppts.map((a) => (
                  <View key={a.id} style={styles.apptRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partyName}>{a.lawyer?.name || 'Lawyer'}</Text>
                      <Text style={styles.partySub}>{formatDate(a.scheduledAt)} · {a.status}</Text>
                    </View>
                    <Button title="Attach" size="sm" loading={submitting} onPress={() => attachFromAppt(a.id)} />
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.help}>Waiting for {m.respondentClient?.name || 'the respondent'} to appoint their lawyer.</Text>
            )}
          </View>
        )}

        {/* Stage 3 · Shortlist 1–3 mediators */}
        {m.status === 'MEDIATOR_SHORTLIST' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 3 · Shortlist mediators (1–3)</Text>
            <Text style={styles.help}>
              Each side shortlists 1 to 3 mediators. Once both submit, you converge on
              one mutually-agreed mediator.
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusPill, initiatorShortlistDone ? styles.pillDone : styles.pillWait]}>
                <Text style={styles.statusPillText}>Initiator: {initiatorShortlistDone ? 'Done' : 'Pending'}</Text>
              </View>
              <View style={[styles.statusPill, respondentShortlistDone ? styles.pillDone : styles.pillWait]}>
                <Text style={styles.statusPillText}>Respondent: {respondentShortlistDone ? 'Done' : 'Pending'}</Text>
              </View>
            </View>
            {actingSide && !myShortlistDone && (
              <Button title="Choose mediators" size="lg" onPress={openShortlist} style={{ marginTop: SPACING.md }} />
            )}
            {actingSide && myShortlistDone && (
              <Text style={styles.okText}>Your shortlist is submitted. Waiting for the other side. ✓</Text>
            )}
            {!actingSide && (
              <Text style={styles.help}>Your side's lawyer is handling mediator selection.</Text>
            )}
          </View>
        )}

        {/* Stage 4 · Converge on ONE mediator */}
        {m.status === 'MEDIATOR_CONVERGE' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 4 · Agree on a single mediator</Text>
            <Text style={styles.help}>
              Each side picks exactly one mediator from the combined shortlist. The
              mediation proceeds only when both sides pick the same one.
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusPill, styles.pillWait]}>
                <Text style={styles.statusPillText}>You: {myFinal ? mediatorName(myFinal) : 'Not yet'}</Text>
              </View>
              <View style={[styles.statusPill, styles.pillWait]}>
                <Text style={styles.statusPillText}>Other: {otherFinal ? mediatorName(otherFinal) : 'Not yet'}</Text>
              </View>
            </View>
            {myFinal && otherFinal && myFinal !== otherFinal && (
              <View style={styles.errBox}>
                <Text style={styles.errText}>
                  To start the mediation, both parties must choose the same single mediator from the list.
                </Text>
              </View>
            )}
            {actingSide ? (
              unionShortlist.map((mid) => {
                const selected = myFinal === mid;
                const otherWants = otherFinal === mid;
                return (
                  <View key={mid} style={[styles.medRow, selected && styles.medRowSel]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partyName}>{mediatorName(mid)}</Text>
                      {otherWants && !selected && <Text style={styles.okText}>Other side picked this mediator.</Text>}
                    </View>
                    <Button title={selected ? 'Your pick' : 'Pick'} size="sm" disabled={submitting || selected} onPress={() => submitFinal(mid)} />
                  </View>
                );
              })
            ) : (
              <Text style={styles.help}>Your side's lawyer is converging on the mediator.</Text>
            )}
          </View>
        )}

        {/* Stage 5 · Pay the mediation fee (50/50) */}
        {m.status === 'AWAITING_MEDIATION_FEE' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 5 · Mediation fee</Text>
            <Text style={styles.help}>
              The flat mediation fee is ₹{feeTotal}, split 50/50 between the two clients
              (₹{feeHalf} each). The mediator is contacted only after both halves are in escrow.
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusPill, myFeePaid ? styles.pillDone : styles.pillWait]}>
                <Text style={styles.statusPillText}>Your half: {myFeePaid ? 'Paid ✓' : `₹${feeHalf} due`}</Text>
              </View>
              <View style={[styles.statusPill, otherFeePaid ? styles.pillDone : styles.pillWait]}>
                <Text style={styles.statusPillText}>Other half: {otherFeePaid ? 'Paid ✓' : 'Pending'}</Text>
              </View>
            </View>
            {myFeeSide && !myFeePaid && (
              <Button title={`Pay my half (₹${feeHalf})`} size="lg" loading={payingFee} onPress={payFeeHalf} style={{ marginTop: SPACING.md }} />
            )}
            {myFeeSide && myFeePaid && !otherFeePaid && (
              <Text style={styles.okText}>Your half is secured. Waiting for the other party.</Text>
            )}
            {!myFeeSide && <Text style={styles.help}>Only the disputing clients pay the mediation fee.</Text>}
          </View>
        )}

        {/* Stage 6 · Mediator accepts / declines */}
        {m.status === 'MEDIATOR_OFFERED' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 6 · Mediator's decision</Text>
            {isMediator ? (
              <>
                <Text style={styles.help}>
                  Both parties agreed to appoint you and the fee is secured. Review both
                  sides, then accept or decline.
                </Text>
                <View style={styles.sideBox}>
                  <Text style={styles.subLabel}>Initiator's side</Text>
                  <Text style={styles.line}>{m.disputeTitle}</Text>
                  <Text style={styles.line}>{m.disputeDescription}</Text>
                </View>
                <View style={styles.sideBox}>
                  <Text style={styles.subLabel}>Respondent's side</Text>
                  <Text style={styles.line}>{m.respondentStatement || '(no statement provided)'}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md }}>
                  <Button title="Accept" size="lg" loading={submitting} onPress={() => mediatorRespond(true)} style={{ flex: 1 }} />
                  <Button title="Decline" size="lg" variant="danger" onPress={() => mediatorRespond(false)} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <Text style={styles.help}>
                The fee is secured. {m.mediator?.name || 'The chosen mediator'} has been asked to
                accept. If they decline, both halves are refunded and you re-converge.
              </Text>
            )}
          </View>
        )}

        {/* Active session */}
        {(m.status === 'IN_SESSION' || m.status === 'ACTIVE') && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Mediation in session</Text>
            <Text style={styles.help}>
              Join the caucus video room with every participant. The mediator concludes
              the session when done.
            </Text>
            {!!m.dailyRoomUrl && (
              <Button title="Join Mediation Room" size="lg" onPress={joinRoom} style={{ marginTop: SPACING.md }} />
            )}
            {isLawyer && isMediator && (
              <Button title="Conclude Mediation" size="lg" variant="danger" onPress={() => setShowConclude(true)} style={{ marginTop: SPACING.sm }} />
            )}
          </View>
        )}

        {/* Concluded states */}
        {(m.status === 'RESOLVED' || m.status === 'ESCALATED_TO_CASE' || m.status === 'SETTLED' || m.status === 'NON_SETTLEMENT') && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {m.status === 'RESOLVED' || m.status === 'SETTLED' ? 'Mediation Resolved' : 'Mediation Escalated to Case'}
            </Text>
            {!!m.settlementTerms && <Text style={styles.line}>Terms: {m.settlementTerms}</Text>}
            {!!m.closureNotes && <Text style={styles.line}>Notes: {m.closureNotes}</Text>}
            {!!m.escalatedCaseId && <Text style={styles.line}>Case ID: {m.escalatedCaseId}</Text>}
          </View>
        )}

        {m.status === 'CANCELLED' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Mediation Cancelled</Text>
            <Text style={styles.help}>
              This mediation was closed before the session started. Any fee paid was refunded.
            </Text>
            {!!m.closureNotes && <Text style={styles.line}>Reason: {m.closureNotes}</Text>}
          </View>
        )}

        {/* Legacy actions */}
        <View style={styles.actions}>
          {isClient && isRespondentClient && m.status === 'AWAITING_RESPONDENT_LAWYER' && (
            <Button title="Attach My Lawyer" onPress={() => setShowAttach(true)} size="lg" variant="outline" />
          )}
          {isClient && (isInitiatorClient || isRespondentClient) && m.status === 'AWAITING_MEDIATOR_SELECTION' && (
            <Button title="Pick Mediator" onPress={() => navigation.navigate('MediationMediators', { id: m.id })} size="lg" />
          )}
          {canCancel && (
            <Button title="Cancel Mediation" onPress={cancelMediation} size="lg" variant="outline" loading={submitting} />
          )}
        </View>
      </ScrollView>

      {/* Attach Lawyer Modal (legacy) */}
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

      {/* Shortlist Modal */}
      <Modal visible={showShortlist} transparent animationType="slide" onRequestClose={() => setShowShortlist(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Shortlist mediators ({shortlistPick.length}/3)</Text>
              <TouchableOpacity onPress={() => setShowShortlist(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.modalBody}>
              {mediators.length === 0 ? (
                <Text style={styles.help}>No mediators available right now.</Text>
              ) : mediators.map((med) => {
                const sel = shortlistPick.includes(med.id);
                return (
                  <TouchableOpacity key={med.id} style={[styles.medRow, sel && styles.medRowSel]} onPress={() => toggleShortlistPick(med.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.partyName}>{med.name}</Text>
                      <Text style={styles.partySub}>
                        {(med.mediationSpecializations?.length ? med.mediationSpecializations : med.specializations || []).join(', ') || 'General mediation'}
                      </Text>
                    </View>
                    <Ionicons name={sel ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={sel ? COLORS.primary : COLORS.textMuted} />
                  </TouchableOpacity>
                );
              })}
              <Button title="Submit shortlist" onPress={submitShortlist} loading={submitting} size="lg" style={{ marginTop: SPACING.md }} />
            </ScrollView>
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

      {orderOptions && (
        <RazorpayCheckout
          visible={showCheckout}
          orderOptions={orderOptions}
          onSuccess={onRazorpaySuccess}
          onCancel={() => setShowCheckout(false)}
          onError={(e) => { setShowCheckout(false); Alert.alert('Payment failed', e?.description || 'Your fee share was not charged. You can try again.'); }}
        />
      )}
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
  stepChip: { paddingHorizontal: SPACING.sm, paddingVertical: 5, borderRadius: BORDER_RADIUS.full },
  stepChipText: { fontSize: FONT_SIZE.xs - 1, fontWeight: '800' },
  stepArrow: { color: C.textMuted, marginHorizontal: 4 },
  card: { backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm },
  sectionTitle: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text, marginBottom: SPACING.sm },
  help: { fontSize: FONT_SIZE.sm, color: C.textSecondary, lineHeight: 20, marginBottom: SPACING.sm },
  subLabel: { fontSize: FONT_SIZE.xs, fontWeight: '800', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.sm, marginBottom: 4 },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: C.borderLight },
  partyLabel: { fontSize: FONT_SIZE.xs, color: C.textMuted },
  partyName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: C.text },
  partySub: { fontSize: FONT_SIZE.xs, color: C.textMuted },
  line: { fontSize: FONT_SIZE.sm, color: C.text, marginTop: 4 },
  okText: { fontSize: FONT_SIZE.sm, color: '#047857', marginTop: SPACING.sm, fontWeight: '600' },
  actions: { gap: SPACING.sm, marginTop: SPACING.md },
  input: { backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZE.md, color: C.text, marginBottom: SPACING.md },
  textarea: { height: 110, textAlignVertical: 'top' },
  attachBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: C.primary, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  attachBtnText: { color: C.primary, fontWeight: '700', fontSize: FONT_SIZE.sm },
  docChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, marginTop: SPACING.sm },
  docChipText: { flex: 1, fontSize: FONT_SIZE.xs, color: C.textSecondary },
  removeText: { fontSize: FONT_SIZE.xs, color: '#B91C1C', fontWeight: '700' },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: C.border, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginTop: SPACING.sm },
  statusRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap' },
  statusPill: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg, borderWidth: 1 },
  pillDone: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  pillWait: { backgroundColor: C.surfaceAlt, borderColor: C.border },
  statusPillText: { fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.text },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: C.border, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginTop: SPACING.sm },
  medRowSel: { borderColor: C.primary, backgroundColor: C.primary + '10' },
  errBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginTop: SPACING.sm },
  errText: { color: '#B91C1C', fontSize: FONT_SIZE.sm, fontWeight: '600' },
  sideBox: { backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md, marginTop: SPACING.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.white, borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl, paddingBottom: SPACING.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  modalTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: C.text },
  modalBody: { padding: SPACING.xl },
  label: { fontSize: FONT_SIZE.sm, color: C.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
  pill: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, backgroundColor: C.surfaceAlt },
  pillText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
});

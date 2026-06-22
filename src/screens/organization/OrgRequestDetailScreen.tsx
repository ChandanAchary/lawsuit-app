import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { organizationsApi, paymentsApi } from '../../services/api';
import { formatErrorMessage } from '../../utils/formatError';
import { EmptyState } from '../../components/Common';

// =============================================================================
// OrgRequestDetailScreen — full lifecycle view of one OrgAppointmentRequest
// for the organisation head. Reachable by tapping a request card on
// OrgRequestsScreen.
//
// What the org head sees here:
//   1. Request meta — client, scheduled date/time, duration, meeting type.
//   2. Case description (notes) — full text, no truncation.
//   3. Supporting documents — every Document the client attached at booking
//      time. Each row drills into the generic OCR / AI screen for triage.
//   4. Assignment trail — who got assigned (if anyone), and when.
//   5. Appointment status — once assigned, the materialised Appointment
//      shows its current status (PENDING / CONFIRMED / ATTENDED / COMPLETED
//      / CANCELLED) so the org head can see how the lawyer-client flow is
//      progressing without leaving this surface.
//   6. Payment status — pulled from the linked Payment row when present.
//
// All data comes from the existing list endpoint (which embeds appointment
// + assignedLawyer) plus the per-request docs endpoint. No new server
// endpoints needed.
// =============================================================================

type RouteParams = {
  requestId: string;
  request?: any; // optional pre-loaded request for instant render
};

export const OrgRequestDetailScreen: React.FC<{ navigation: any; route: { params: RouteParams } }>
  = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const requestId = route.params?.requestId;
  const initialRequest = route.params?.request || null;

  const [request, setRequest] = useState<any>(initialRequest);
  const [docs, setDocs] = useState<any[]>([]);
  const [payment, setPayment] = useState<any | null>(null);
  const [loading, setLoading] = useState(!initialRequest);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      // The list endpoint is the only authoritative shape for this row.
      // We could add a /requests/:id endpoint but the list is small enough
      // that a single trip is fine and avoids new server work.
      const [reqRes, docsRes] = await Promise.all([
        organizationsApi.listOrgAppointmentRequests(),
        organizationsApi.listOrgRequestDocuments(requestId).catch(() => ({ data: { items: [] } })),
      ]);
      const list = reqRes.data?.requests || reqRes.data?.items || reqRes.data || [];
      const found = Array.isArray(list) ? list.find((r: any) => r.id === requestId) : null;
      if (found) setRequest(found);

      setDocs(docsRes.data?.items || []);

      // Pull payment details if the materialised appointment has a payment.
      const paymentId = found?.appointment?.paymentId;
      if (paymentId) {
        try {
          const { data } = await paymentsApi.getById(paymentId);
          setPayment(data?.payment || data?.data || data || null);
        } catch {
          setPayment(null);
        }
      } else {
        setPayment(null);
      }
    } catch (err: any) {
      // ignore — keep last-known state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestId]);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(false); }, [load]));

  const onRefresh = () => { setRefreshing(true); void load(false); };

  if (loading && !request) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  if (!request) {
    return (
      <View style={styles.container}>
        <Header title="Request" navigation={navigation} styles={styles} COLORS={COLORS} />
        <EmptyState icon="📋" title="Request not found" message="It may have been cancelled." />
      </View>
    );
  }

  const status: string = request.status || 'PENDING';
  const scheduledAt: Date | null = request.scheduledAt ? new Date(request.scheduledAt) : null;
  const apptStatus: string | null = request.appointment?.status || null;

  // Activity timeline derived from server fields. We don't have a dedicated
  // event log so we synthesise from createdAt / updatedAt / appointment.
  type Event = { icon: string; tone: 'info' | 'success' | 'warn' | 'danger'; title: string; sub?: string; at?: string };
  const events: Event[] = [];
  events.push({
    icon: 'calendar-outline', tone: 'info',
    title: 'Booking submitted by client',
    sub: request.client?.name || undefined,
    at: request.createdAt,
  });
  if (request.assignedLawyer) {
    events.push({
      icon: 'person-add-outline', tone: 'success',
      title: `Assigned to ${request.assignedLawyer.name}`,
      at: request.updatedAt,
    });
  }
  if (apptStatus) {
    const map: Record<string, { icon: string; tone: Event['tone']; title: string }> = {
      PENDING:   { icon: 'time-outline',         tone: 'warn',    title: 'Appointment pending lawyer acceptance' },
      CONFIRMED: { icon: 'checkmark-circle',     tone: 'success', title: 'Lawyer confirmed the appointment' },
      ATTENDED:  { icon: 'videocam-outline',     tone: 'success', title: 'Appointment attended' },
      COMPLETED: { icon: 'checkmark-done',       tone: 'success', title: 'Appointment completed' },
      CANCELLED: { icon: 'close-circle-outline', tone: 'danger',  title: 'Appointment cancelled' },
      MISSED:    { icon: 'alert-circle-outline', tone: 'warn',    title: 'Appointment missed' },
    };
    const e = map[apptStatus];
    if (e) events.push({ ...e });
  }
  if (status === 'REJECTED') {
    events.push({
      icon: 'close-circle-outline', tone: 'danger',
      title: 'Request rejected by organisation',
      sub: request.rejectionReason || undefined,
    });
  }
  if (payment) {
    const ps: string = String(payment.status || '').toUpperCase();
    if (ps) {
      events.push({
        icon: ps === 'PAID' ? 'cash' : 'card-outline',
        tone: ps === 'PAID' ? 'success' : ps === 'FAILED' ? 'danger' : 'info',
        title: ps === 'PAID' ? 'Client completed payment' : `Payment ${ps.toLowerCase()}`,
        sub: payment.amount != null ? `₹${Number(payment.amount).toLocaleString('en-IN')}` : undefined,
      });
    }
  }

  const statusBadge = (() => {
    if (status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED') {
      return { bg: '#FEE2E2', fg: '#B91C1C', label: status };
    }
    if (status === 'ASSIGNED') return { bg: '#D1FAE5', fg: '#047857', label: 'ASSIGNED' };
    return { bg: '#FEF3C7', fg: '#D97706', label: status };
  })();

  return (
    <View style={styles.container}>
      <Header title="Request Detail" navigation={navigation} styles={styles} COLORS={COLORS} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusBadge.bg }]}>
          <Text style={[styles.statusBannerText, { color: statusBadge.fg }]}>{statusBadge.label}</Text>
        </View>

        {/* Client */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Client</Text>
          <View style={styles.personRow}>
            {request.client?.avatarUrl ? (
              <Image source={{ uri: request.client.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPH]}>
                <Ionicons name="person" size={22} color={COLORS.textMuted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.personName}>{request.client?.name || '—'}</Text>
              {!!request.client?.email && <Text style={styles.personSub}>{request.client.email}</Text>}
              {!!request.client?.phone && <Text style={styles.personSub}>{request.client.phone}</Text>}
            </View>
            {(request.client?.id || request.clientId) && (
              <TouchableOpacity
                style={styles.msgIconBtn}
                onPress={() => navigation.navigate('ChatScreen', {
                  otherUserId: request.client?.id || request.clientId,
                  name: request.client?.name,
                  otherUser: request.client,
                })}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Schedule */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schedule</Text>
          {scheduledAt ? (
            <>
              <InfoRow icon="calendar-outline" label="Date" value={format(scheduledAt, 'EEEE, dd MMMM yyyy')} styles={styles} COLORS={COLORS} />
              <InfoRow icon="time-outline" label="Time" value={format(scheduledAt, 'hh:mm a')} styles={styles} COLORS={COLORS} />
            </>
          ) : null}
          {!!request.durationMins && <InfoRow icon="timer-outline" label="Duration" value={`${request.durationMins} minutes`} styles={styles} COLORS={COLORS} />}
          {!!request.meetingType && <InfoRow icon="videocam-outline" label="Meeting type" value={String(request.meetingType).replace('_', ' ')} styles={styles} COLORS={COLORS} />}
        </View>

        {/* Case description */}
        {!!request.notes && (
          <View style={[styles.card, styles.notesCard]}>
            <View style={styles.notesHeader}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Case Description</Text>
            </View>
            <Text style={styles.notesBody}>{request.notes}</Text>
          </View>
        )}

        {/* Documents */}
        <View style={styles.card}>
          <View style={styles.notesHeader}>
            <Ionicons name="folder-open-outline" size={20} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Supporting Documents</Text>
            <Text style={styles.docCount}>{docs.length}</Text>
          </View>
          {docs.length === 0 ? (
            <Text style={styles.emptyMuted}>No documents attached.</Text>
          ) : (
            <View style={styles.docList}>
              {docs.map((d: any) => (
                <TouchableOpacity
                  key={d.id}
                  style={styles.docRow}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('DocumentAi', {
                    documentId: d.id,
                    document: d,
                    contextLabel: 'Booking doc',
                  })}
                >
                  <Ionicons
                    name={d.mimeType?.startsWith('image/') ? 'image-outline' : 'document-outline'}
                    size={18}
                    color={COLORS.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docName} numberOfLines={1}>{d.filename}</Text>
                    <Text style={styles.docMeta} numberOfLines={1}>
                      {d.extractionStatus === 'COMPLETED'
                        ? 'OCR ready · tap to view extracted text or summary'
                        : 'Tap to extract text + summarise with AI'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    onPress={() => navigation.navigate('DocumentPreview', {
                      url: d.url || d.fileUrl,
                      name: d.filename || d.fileName,
                      mimeType: d.mimeType,
                    })}
                  >
                    <Ionicons name="eye-outline" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Ionicons name="flash-outline" size={18} color={COLORS.primary} style={{ marginLeft: SPACING.md }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Assignment + Appointment */}
        {request.assignedLawyer ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assigned Lawyer</Text>
            <View style={styles.personRow}>
              {request.assignedLawyer.avatarUrl ? (
                <Image source={{ uri: request.assignedLawyer.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPH]}>
                  <Ionicons name="briefcase" size={22} color={COLORS.textMuted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{request.assignedLawyer.name}</Text>
                {!!request.assignedLawyer.email && <Text style={styles.personSub}>{request.assignedLawyer.email}</Text>}
              </View>
              {(request.assignedLawyer.id || request.assignedLawyerId) && (
                <TouchableOpacity
                  style={styles.msgIconBtn}
                  onPress={() => navigation.navigate('ChatScreen', {
                    otherUserId: request.assignedLawyer.id || request.assignedLawyerId,
                    name: request.assignedLawyer.name,
                    otherUser: request.assignedLawyer,
                  })}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              )}
            </View>
            {apptStatus ? (
              <View style={styles.apptBlock}>
                <Text style={styles.apptLabel}>Appointment status</Text>
                <View style={[styles.apptStatusPill, { backgroundColor: apptStatusBg(apptStatus) }]}>
                  <Text style={[styles.apptStatusText, { color: apptStatusFg(apptStatus) }]}>{apptStatus}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Payment */}
        {payment ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment</Text>
            <InfoRow
              icon="cash-outline"
              label="Amount"
              value={payment.amount != null ? `₹${Number(payment.amount).toLocaleString('en-IN')}` : '—'}
              styles={styles} COLORS={COLORS}
            />
            <InfoRow
              icon="checkmark-circle-outline"
              label="Status"
              value={String(payment.status || '—').toUpperCase()}
              styles={styles} COLORS={COLORS}
            />
            {!!payment.providerPaymentId && (
              <InfoRow icon="receipt-outline" label="Provider ID" value={payment.providerPaymentId} styles={styles} COLORS={COLORS} />
            )}
          </View>
        ) : null}

        {/* Activity timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activity</Text>
          {events.length === 0 ? (
            <Text style={styles.emptyMuted}>No activity yet.</Text>
          ) : (
            <View style={styles.timeline}>
              {events.map((e, i) => (
                <View key={i} style={styles.timelineRow}>
                  <View style={[styles.timelineIcon, { backgroundColor: toneBg(e.tone) }]}>
                    <Ionicons name={e.icon as any} size={14} color={toneFg(e.tone)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>{e.title}</Text>
                    {!!e.sub && <Text style={styles.timelineSub}>{e.sub}</Text>}
                    {!!e.at && <Text style={styles.timelineDate}>{format(new Date(e.at), 'dd MMM yyyy · hh:mm a')}</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// Helpers --------------------------------------------------------------------

const Header = ({ title, navigation, styles, COLORS }: any) => (
  <View style={styles.headerBar}>
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
      <Ionicons name="arrow-back" size={22} color={COLORS.text} />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
  </View>
);

const InfoRow = ({ icon, label, value, styles, COLORS }: any) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={16} color={COLORS.primary} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
  </View>
);

function apptStatusBg(s: string) {
  if (s === 'CONFIRMED' || s === 'ATTENDED' || s === 'COMPLETED') return '#D1FAE5';
  if (s === 'CANCELLED' || s === 'MISSED') return '#FEE2E2';
  return '#FEF3C7';
}
function apptStatusFg(s: string) {
  if (s === 'CONFIRMED' || s === 'ATTENDED' || s === 'COMPLETED') return '#047857';
  if (s === 'CANCELLED' || s === 'MISSED') return '#B91C1C';
  return '#D97706';
}
function toneBg(t: string) {
  return t === 'success' ? '#D1FAE5' : t === 'warn' ? '#FEF3C7' : t === 'danger' ? '#FEE2E2' : '#DBEAFE';
}
function toneFg(t: string) {
  return t === 'success' ? '#047857' : t === 'warn' ? '#D97706' : t === 'danger' ? '#B91C1C' : '#1D4ED8';
}

// Styles ---------------------------------------------------------------------

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.xl, paddingBottom: 100 },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: '900', color: C.text },

  statusBanner: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.lg, paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.md,
  },
  statusBannerText: { fontSize: FONT_SIZE.xs, fontWeight: '800', letterSpacing: 0.5 },

  card: {
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl, marginBottom: SPACING.md, ...SHADOWS.sm,
  },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text },

  notesCard: { borderLeftWidth: 4, borderLeftColor: C.primary },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  notesBody: { fontSize: FONT_SIZE.md, color: C.text, lineHeight: 22 },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  msgIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.primaryLight + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPH: { backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  personName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: C.text },
  personSub: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  infoLabel: { fontSize: FONT_SIZE.sm, color: C.textMuted, width: 100 },
  infoValue: { flex: 1, fontSize: FONT_SIZE.sm, color: C.text, fontWeight: '600' },

  docCount: {
    marginLeft: 'auto',
    fontSize: FONT_SIZE.xs - 1, fontWeight: '800',
    color: C.primary,
    backgroundColor: C.primary + '18',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  docList: { gap: SPACING.sm },
  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: C.surfaceAlt, borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  docName: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
  docMeta: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },

  apptBlock: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: C.borderLight,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
  },
  apptLabel: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontWeight: '600' },
  apptStatusPill: {
    paddingHorizontal: SPACING.md, paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  apptStatusText: { fontSize: FONT_SIZE.xs, fontWeight: '800', letterSpacing: 0.5 },

  emptyMuted: { fontSize: FONT_SIZE.sm, color: C.textMuted, fontStyle: 'italic' },

  timeline: { gap: SPACING.lg },
  timelineRow: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  timelineIcon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  timelineTitle: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: C.text },
  timelineSub: { fontSize: FONT_SIZE.xs, color: C.textSecondary, marginTop: 2 },
  timelineDate: { fontSize: FONT_SIZE.xs, color: C.textMuted, marginTop: 2 },
});

export default OrgRequestDetailScreen;

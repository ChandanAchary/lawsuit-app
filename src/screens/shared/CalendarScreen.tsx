import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameDay, isSameMonth, isToday, addMonths, subMonths, parseISO, isValid,
} from 'date-fns';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { useColors, useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { appointmentsApi, organizationsApi } from '../../services/api';
import { formatTime } from '../../utils/date';

// =============================================================================
// CalendarScreen — month grid of the user's scheduled records. Mirrors the
// web app's CalendarPage: it aggregates events entirely on the client from
// the APIs the app already exposes (no backend changes):
//   - CLIENT / LAWYER → their appointments (consultations)
//   - ORGANIZATION    → the firm's incoming appointment requests
// Tapping an event deep-links into the right detail screen.
// =============================================================================

type CalEventType = 'appointment' | 'request';

interface CalEvent {
  id: string;
  date: string; // ISO datetime
  type: CalEventType;
  title: string;
  subtitle?: string;
  status?: string;
  raw?: any;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusTone = (COLORS: any, status?: string): { bg: string; fg: string } => {
  const s = (status || '').toUpperCase();
  if (s === 'CONFIRMED' || s === 'ASSIGNED') return { bg: '#DBEAFE', fg: '#1D4ED8' };
  if (s === 'COMPLETED') return { bg: '#D1FAE5', fg: '#047857' };
  if (s === 'CANCELLED' || s === 'REJECTED' || s === 'EXPIRED') return { bg: COLORS.surfaceAlt, fg: COLORS.textMuted };
  if (s === 'PENDING') return { bg: '#FEF3C7', fg: '#B45309' };
  return { bg: COLORS.surfaceAlt, fg: COLORS.textSecondary };
};

const dotColor = (COLORS: any, type: CalEventType, status?: string): string => {
  const s = (status || '').toUpperCase();
  if (s === 'CANCELLED' || s === 'REJECTED' || s === 'EXPIRED') return COLORS.border;
  return type === 'request' ? '#D97706' : COLORS.primary;
};

export const CalendarScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = useMemo(() => getStyles(COLORS), [isDark]);

  const role = useAuthStore((s) => (s.user as any)?.role) as string | undefined;

  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState(() => new Date()); // month in view
  const [selected, setSelected] = useState(() => new Date()); // chosen day

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    const out: CalEvent[] = [];
    try {
      if (role === 'ORGANIZATION') {
        const { data } = await organizationsApi.listOrgAppointmentRequests();
        const items = data?.items || data?.requests || data?.data || data || [];
        for (const r of Array.isArray(items) ? items : []) {
          if (!r?.scheduledAt) continue;
          out.push({
            id: String(r.id),
            date: r.scheduledAt,
            type: 'request',
            title: r.client?.name ? `Request · ${r.client.name}` : 'Appointment request',
            subtitle: r.meetingType || undefined,
            status: r.status,
            raw: r,
          });
        }
      } else {
        const { data } = await appointmentsApi.getAll();
        const items = data?.data || data?.items || data?.appointments || data || [];
        for (const a of Array.isArray(items) ? items : []) {
          if (!a?.scheduledAt) continue;
          const other = role === 'LAWYER' ? a.client?.name : a.lawyer?.name;
          out.push({
            id: String(a.id),
            date: a.scheduledAt,
            type: 'appointment',
            title: other ? `Consultation · ${other}` : 'Consultation',
            subtitle: a.meetingType || undefined,
            status: a.status,
            raw: a,
          });
        }
      }
      setEvents(out);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  useEffect(() => { load(); }, [load]);

  // Group events by yyyy-MM-dd, each day's list sorted by time.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const d = parseISO(e.date);
      if (!isValid(d)) continue;
      const key = format(d, 'yyyy-MM-dd');
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => +parseISO(a.date) - +parseISO(b.date));
    }
    return map;
  }, [events]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectedEvents = eventsByDay.get(format(selected, 'yyyy-MM-dd')) || [];

  const openEvent = (ev: CalEvent) => {
    if (ev.type === 'request') {
      if (role === 'ORGANIZATION') {
        navigation.navigate('OrgRequestDetail', { requestId: ev.id, request: ev.raw });
      } else {
        navigation.navigate('ClientOrgRequests');
      }
      return;
    }
    navigation.navigate('AppointmentDetail', { appointmentId: ev.id, appointment: ev.raw });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(false); }} colors={[COLORS.primary]} />}
        >
          {/* Month switcher */}
          <View style={styles.monthRow}>
            <TouchableOpacity style={styles.monthNavBtn} onPress={() => setCursor((c) => subMonths(c, 1))}>
              <Ionicons name="chevron-back" size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{format(cursor, 'MMMM yyyy')}</Text>
            <TouchableOpacity style={styles.monthNavBtn} onPress={() => setCursor((c) => addMonths(c, 1))}>
              <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekday}>{w}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.get(key) || [];
              const inMonth = isSameMonth(day, cursor);
              const isSel = isSameDay(day, selected);
              const today = isToday(day);
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.cell}
                  activeOpacity={0.7}
                  onPress={() => setSelected(day)}
                >
                  <View style={[
                    styles.cellInner,
                    isSel && styles.cellSelected,
                    today && !isSel && styles.cellToday,
                  ]}>
                    <Text style={[
                      styles.cellNum,
                      !inMonth && styles.cellNumMuted,
                      isSel && styles.cellNumSelected,
                    ]}>
                      {format(day, 'd')}
                    </Text>
                    <View style={styles.dotRow}>
                      {dayEvents.slice(0, 3).map((ev, i) => (
                        <View
                          key={i}
                          style={[
                            styles.dot,
                            { backgroundColor: isSel ? COLORS.white : dotColor(COLORS, ev.type, ev.status) },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected-day event list */}
          <View style={styles.dayHeaderRow}>
            <Text style={styles.dayHeader}>{format(selected, 'EEEE, d MMMM')}</Text>
            <Text style={styles.dayCount}>
              {selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'}
            </Text>
          </View>

          {selectedEvents.length === 0 ? (
            <View style={styles.emptyDay}>
              <Ionicons name="calendar-clear-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.emptyDayText}>Nothing scheduled for this day.</Text>
            </View>
          ) : (
            selectedEvents.map((ev) => {
              const tone = statusTone(COLORS, ev.status);
              const d = parseISO(ev.date);
              return (
                <TouchableOpacity key={ev.id} style={styles.eventCard} activeOpacity={0.7} onPress={() => openEvent(ev)}>
                  <View style={[styles.eventStripe, { backgroundColor: dotColor(COLORS, ev.type, ev.status) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
                    <View style={styles.eventMetaRow}>
                      <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />
                      <Text style={styles.eventMeta}>{isValid(d) ? formatTime(ev.date) : '—'}</Text>
                      {!!ev.subtitle && <Text style={styles.eventMeta}>· {ev.subtitle}</Text>}
                    </View>
                  </View>
                  {!!ev.status && (
                    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.statusPillText, { color: tone.fg }]}>{ev.status}</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const getStyles = (C: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.md,
    backgroundColor: C.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: C.text },
  scroll: { padding: SPACING.xl, paddingBottom: 120 },

  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  monthNavBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', ...SHADOWS.sm },
  monthLabel: { fontSize: FONT_SIZE.lg, fontWeight: '800', color: C.text },

  weekRow: { flexDirection: 'row', marginBottom: SPACING.xs },
  weekday: { flex: 1, textAlign: 'center', fontSize: FONT_SIZE.xs, fontWeight: '700', color: C.textMuted },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.xl, padding: SPACING.sm, ...SHADOWS.sm,
  },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  cellInner: { flex: 1, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', gap: 3 },
  cellSelected: { backgroundColor: C.primary },
  cellToday: { backgroundColor: C.primaryLight + '22' },
  cellNum: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: C.text },
  cellNumMuted: { color: C.textMuted, opacity: 0.5 },
  cellNumSelected: { color: C.white, fontWeight: '800' },
  dotRow: { flexDirection: 'row', gap: 2, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },

  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xl, marginBottom: SPACING.md },
  dayHeader: { fontSize: FONT_SIZE.md, fontWeight: '800', color: C.text },
  dayCount: { fontSize: FONT_SIZE.xs, color: C.textMuted, fontWeight: '600' },

  emptyDay: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xxl },
  emptyDayText: { fontSize: FONT_SIZE.sm, color: C.textMuted },

  eventCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: C.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.sm, ...SHADOWS.sm,
  },
  eventStripe: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  eventTitle: { fontSize: FONT_SIZE.md, fontWeight: '700', color: C.text },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  eventMeta: { fontSize: FONT_SIZE.xs, color: C.textMuted },
  statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
  statusPillText: { fontSize: FONT_SIZE.xs - 1, fontWeight: '800', letterSpacing: 0.3 },
});

export default CalendarScreen;

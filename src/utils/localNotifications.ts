import { Platform } from 'react-native';
import { Notification as AppNotification, NotificationType } from '../types';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: any;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch {
    Notifications = null;
  }
}

const recentNotificationKeys = new Map<string, number>();
const DEDUPE_WINDOW_MS = 12000;

type NotificationNavTarget = {
  name: string;
  params?: Record<string, unknown>;
};

const now = () => Date.now();

const shouldNotify = (key: string): boolean => {
  const ts = recentNotificationKeys.get(key);
  if (ts && now() - ts < DEDUPE_WINDOW_MS) return false;
  recentNotificationKeys.set(key, now());
  return true;
};

const normalizeData = (data?: Record<string, unknown>): Record<string, unknown> => {
  if (!data) return {};
  const normalized: Record<string, unknown> = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      normalized[k] = v;
    } else {
      normalized[k] = String(v);
    }
  });
  return normalized;
};

export async function presentLocalNotification(params: {
  dedupeKey: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  if (!Notifications) return;
  if (!shouldNotify(params.dedupeKey)) return;

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: normalizeData(params.data),
        sound: 'default',
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[LocalNotification] Failed to present:', err);
  }
}

export async function presentDomainNotification(n: AppNotification): Promise<void> {
  const key = `domain:${n.id}`;
  await presentLocalNotification({
    dedupeKey: key,
    title: n.title,
    body: n.body,
    data: {
      type: n.type,
      notificationId: n.id,
      appointmentId: n.data?.appointmentId,
      chatId: n.data?.chatId,
      caseId: n.data?.caseId,
      referenceId: n.data?.referenceId,
      mediationId: n.data?.mediationId,
      inviteId: n.data?.inviteId,
      token: n.data?.token,
      escalatedCaseId: n.data?.escalatedCaseId,
      requestId: n.data?.requestId,
      organizationId: n.data?.organizationId,
    },
  });
}

export async function presentChatMessageNotification(params: {
  chatId: string;
  senderName: string;
  text?: string | null;
  messageId?: string;
}): Promise<void> {
  const preview = (params.text || '').trim();
  const body = preview || 'You received a new message.';
  await presentLocalNotification({
    dedupeKey: `chat:${params.chatId}:${params.messageId || body}`,
    title: `Message from ${params.senderName}`,
    body,
    data: {
      type: NotificationType.NEW_MESSAGE,
      chatId: params.chatId,
    },
  });
}

export async function presentIncomingCallNotification(params: {
  callerName?: string;
  callType?: 'audio' | 'video';
  roomId?: string;
  chatId?: string;
}): Promise<void> {
  const label = params.callType === 'video' ? 'Video Call' : 'Audio Call';
  await presentLocalNotification({
    dedupeKey: `call:${params.roomId || params.chatId || label}`,
    title: `Incoming ${label}`,
    body: `${params.callerName || 'Someone'} is calling you.`,
    data: {
      type: NotificationType.VIDEO_CALL,
      chatId: params.chatId,
      roomId: params.roomId,
      callType: params.callType || 'audio',
    },
  });
}

export function resolveNotificationNavigationTarget(data: Record<string, unknown>): NotificationNavTarget | null {
  const type = String(data.type || '');
  const appointmentId = data.appointmentId ? String(data.appointmentId) : '';
  const chatId = data.chatId ? String(data.chatId) : '';
  const caseId = data.caseId ? String(data.caseId) : '';
  const mediationId = data.mediationId ? String(data.mediationId) : '';
  const inviteToken = data.token ? String(data.token) : '';
  const escalatedCaseId = data.escalatedCaseId ? String(data.escalatedCaseId) : '';

  switch (type) {
    case NotificationType.APPOINTMENT_BOOKED:
    case NotificationType.APPOINTMENT_CONFIRMED:
    case NotificationType.APPOINTMENT_CANCELLED:
    case NotificationType.APPOINTMENT_REMINDER:
    case NotificationType.APPOINTMENT_RESCHEDULED:
    case NotificationType.CONSULTATION_COMPLETED:
      return appointmentId ? { name: 'AppointmentDetail', params: { appointmentId } } : null;
    case NotificationType.NEW_MESSAGE:
      return chatId ? { name: 'ChatScreen', params: { chatId } } : null;
    case NotificationType.CASE_UPDATE:
    case NotificationType.DOCUMENT_UPLOADED:
    case NotificationType.TASK_ASSIGNED:
      return caseId ? { name: 'CaseDetail', params: { caseId } } : null;
    case NotificationType.VIDEO_CALL:
      return appointmentId ? { name: 'VideoCall', params: { appointmentId } } : null;
    case NotificationType.PAYMENT_RECEIVED:
    case NotificationType.WALLET_CREDIT:
    case NotificationType.WALLET_DEBIT:
      return { name: 'Wallet' };

    // Mediation deeplinks. Server-side notification data shapes:
    //   MEDIATION_INVITE       → { inviteId, token }    → public accept screen
    //   MEDIATION_DECLINED     → { inviteId }           → mediations list
    //   MEDIATION_ACCEPTED / MEDIATOR_SELECTED / SESSION_READY / RESOLVED /
    //   ESCALATED              → { mediationId, ... }   → MediationDetail
    case NotificationType.MEDIATION_INVITE:
      if (inviteToken) return { name: 'MediationInviteAccept', params: { token: inviteToken } };
      return { name: 'Mediations' };
    case NotificationType.MEDIATION_DECLINED:
      return { name: 'Mediations' };
    case NotificationType.MEDIATION_ACCEPTED:
    case NotificationType.MEDIATION_MEDIATOR_SELECTED:
    case NotificationType.MEDIATION_SESSION_READY:
    case NotificationType.MEDIATION_RESOLVED:
      return mediationId ? { name: 'MediationDetail', params: { id: mediationId } } : { name: 'Mediations' };
    case NotificationType.MEDIATION_ESCALATED:
      // Prefer the new case if the server attached one; fall back to mediation.
      if (escalatedCaseId) return { name: 'CaseDetail', params: { caseId: escalatedCaseId } };
      return mediationId ? { name: 'MediationDetail', params: { id: mediationId } } : { name: 'Mediations' };

    // Organization deeplinks. Server emits:
    //   ORG_APPOINTMENT_REQUEST_RECEIVED   → org-side requests inbox
    //   ORG_APPOINTMENT_REQUEST_ASSIGNED   → client-side requests list (or
    //                                         AppointmentDetail when paid)
    //   ORG_APPOINTMENT_REQUEST_REJECTED   → client-side requests list
    //   ORGANIZATION_VERIFIED / REJECTED   → org's own profile
    case NotificationType.ORG_APPOINTMENT_REQUEST_RECEIVED:
      return { name: 'OrgRequests' };
    case NotificationType.ORG_APPOINTMENT_REQUEST_ASSIGNED:
      if (appointmentId) return { name: 'AppointmentDetail', params: { appointmentId } };
      return { name: 'ClientOrgRequests' };
    case NotificationType.ORG_APPOINTMENT_REQUEST_REJECTED:
      return { name: 'ClientOrgRequests' };
    case NotificationType.ORGANIZATION_VERIFIED:
    case NotificationType.ORGANIZATION_REJECTED:
      return { name: 'OrgProfile' };

    default:
      return null;
  }
}

export function addNotificationResponseListener(onNavigate: (target: NotificationNavTarget) => void): (() => void) {
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
    const data = (response?.notification?.request?.content?.data || {}) as Record<string, unknown>;
    const target = resolveNotificationNavigationTarget(data);
    if (target) onNavigate(target);
  });
  return () => sub.remove();
}

export async function handleInitialNotificationNavigation(
  onNavigate: (target: NotificationNavTarget) => void,
): Promise<void> {
  if (!Notifications) return;
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    const data = (response?.notification?.request?.content?.data || {}) as Record<string, unknown>;
    const target = resolveNotificationNavigationTarget(data);
    if (target) onNavigate(target);
  } catch (err) {
    console.warn('[LocalNotification] Failed initial response handling:', err);
  }
}

export async function configureLocalNotificationChannel(): Promise<void> {
  if (!Notifications) return;
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0B4D64',
      sound: 'default',
    });
  } catch (err) {
    console.warn('[LocalNotification] Failed to configure Android channel:', err);
  }
}
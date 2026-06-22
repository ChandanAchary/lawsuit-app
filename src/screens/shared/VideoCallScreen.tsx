// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { videoApi } from '../../services/api';
import { socketService } from '../../services/socket';
import { safeGoBack } from '../../utils/navigation';
import { useActiveCallStore } from '../../stores/activeCallStore';

// =============================================================================
// VideoCallScreen — chat & appointment calls.
//
// This screen intentionally does NOT render its own video-call UI. Daily's
// prebuilt iframe ships a complete in-call surface (camera/mic toggles,
// participant tiles, screen-share, leave button, more menu, audio-output
// picker, etc.) and we render it full-screen.
//
// Our previous version stacked a custom top bar + bottom action bar on top
// of the Daily iframe, which duplicated controls and looked cramped on
// mobile. The user explicitly asked us to "make it as like the daily.co
// service provider provided" — so everything below is just the bare minimum
// wiring around Daily's prebuilt UI.
//
// Lifecycle (matches lawsuit-server/src/sockets/index.ts):
//   OUTGOING chat call:
//     1. mount → emit `call:initiate { to, callType:'chat', referenceId, mediaType }`
//     2. server replies `call:initiated { callId, roomUrl, token }`
//     3. WebView loads Daily.co prebuilt UI with that room+token
//     4. callee accepts → server emits `call:accepted` (no UI change — Daily
//        handles the join experience itself)
//     5. either side clicks Daily's Leave button → WebView posts `left` →
//        we emit `call:end { callId }` and navigate back
//
//   OUTGOING appointment call: `appointmentId` → HTTP `/video/meeting` →
//     same WebView render → leave → end.
//
//   INCOMING call: route.params already carries `callId`, `roomUrl`, `token`
//     (App.tsx's incoming-call modal accepted on our behalf and forwarded the
//     server payload). We just render the WebView; Daily handles the rest.
// =============================================================================

const normalizeErrorMessage = (value: unknown): string => {
  if (!value) return 'Call failed.';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '[object Object]') return 'Call failed.';
    return trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => normalizeErrorMessage(v)).filter(Boolean);
    return parts.join(' | ') || 'Call failed.';
  }
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    const candidate =
      v.message ??
      v.errorMsg ??
      v.error ??
      v.info ??
      (typeof v.details === 'string' ? v.details : undefined);
    if (candidate) return normalizeErrorMessage(candidate);
    try {
      return JSON.stringify(v);
    } catch {
      return 'Call failed.';
    }
  }
  return 'Call failed.';
};

const mapDailyMessage = (raw: string): string => {
  const msg = raw.toLowerCase();
  if (msg.includes('route not found')) {
    return 'Call service is unavailable on server. Please update/redeploy the backend and try again.';
  }
  if (msg.includes('[object object]')) {
    return 'Unable to connect the call right now. Please try again.';
  }
  if (msg.includes('missing payment method')) {
    return 'Daily account is missing a payment method. Add billing in Daily dashboard to enable calls.';
  }
  if (msg.includes('failed to create daily room')) {
    return 'Unable to create Daily room right now. Please try again.';
  }
  return raw;
};

const isNotFoundRouteError = (err: any): boolean => {
  const code = err?.response?.data?.error?.code;
  const msg = String(err?.response?.data?.error?.message || '').toLowerCase();
  return code === 'not_found' || msg.includes('route not found');
};

// Map server `call:error` codes onto a user-facing Alert. These codes come
// straight from lawsuit-server/src/sockets/index.ts; keep this in sync if
// new ones are added there.
//   USER_OFFLINE   — callee has no live socket
//   USER_BUSY      — callee is already on another call
//   CALLER_BUSY    — caller themselves are already on another call
//   NOT_AUTHORIZED — caller has no relationship (chat/appointment/case) with callee
//   RATE_LIMITED   — caller has hammered call:initiate too many times in a minute
//   PROVIDER_ERROR — Daily room provisioning failed server-side
//   anything else  — generic "call failed"
const callErrorToAlert = (data: { code?: string; message?: string }) => {
  switch (data.code) {
    case 'USER_OFFLINE':
      return {
        title: 'User Not Online',
        body: 'The other party is not online right now. Please try again later.',
      };
    case 'USER_BUSY':
      return {
        title: 'User Busy',
        body: 'The other party is already on another call. Please try again later.',
      };
    case 'CALLER_BUSY':
      return {
        title: 'Already in a Call',
        body: 'You are already in another call.',
      };
    case 'NOT_AUTHORIZED':
      return {
        title: 'Not Allowed',
        body: 'You are not authorized to call this user.',
      };
    case 'RATE_LIMITED':
      return {
        title: 'Too Many Attempts',
        body: 'Too many call attempts. Please wait a moment and try again.',
      };
    case 'PROVIDER_ERROR':
      return {
        title: 'Call Service Error',
        body: 'Unable to start the call right now. Please try again in a moment.',
      };
    default:
      return {
        title: 'Call Failed',
        body: data.message || 'Unable to start the call. Please try again.',
      };
  }
};

export const VideoCallScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const {
    appointmentId,
    callId: initialCallId,
    roomUrl: initialRoomUrl,
    token: initialToken,
    mediaType: mediaTypeParam,
    callType,
    otherUser,
    isOutgoing = true,
    chatId,
  } = route.params || {};

  const mediaType = (mediaTypeParam || callType || 'video') as 'audio' | 'video';
  const isVideoCall = mediaType === 'video';
  const otherId: string | undefined = otherUser?.id;

  const [callId, setCallId] = useState<string | null>(initialCallId || null);
  const [meetingLink, setMeetingLink] = useState<string | null>(initialRoomUrl || null);
  const [meetingToken, setMeetingToken] = useState<string | null>(initialToken || null);
  const [sessionLoading, setSessionLoading] = useState(!initialRoomUrl);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);

  const webViewRef = useRef<WebView>(null);
  const callIdRef = useRef<string | null>(initialCallId || null);
  const hasInitiatedRef = useRef(false);
  // Track whether the user (or remote side) has caused this screen to exit
  // already, so we don't emit `call:end` twice when both the WebView's
  // `left-meeting` AND a socket `call:ended` arrive in quick succession.
  const exitingRef = useRef(false);

  const setActiveCall = useActiveCallStore((s) => s.setActive);
  const clearActiveCall = useActiveCallStore((s) => s.clear);

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  // Push the call into the global store once we have everything we need to
  // resume it. This is what lets the user minimize back to the chat and
  // tap "return to call" later without losing the room.
  useEffect(() => {
    if (!callId || !meetingLink || !meetingToken || !otherId) return;
    setActiveCall({
      callId,
      roomUrl: meetingLink,
      token: meetingToken,
      mediaType,
      otherUser: { id: otherId, name: otherUser?.name, avatarUrl: otherUser?.avatarUrl || otherUser?.avatar },
      chatId: chatId || undefined,
      appointmentId: appointmentId || undefined,
      isOutgoing,
      startedAt: Date.now(),
    });
  }, [callId, meetingLink, meetingToken, otherId, mediaType, otherUser?.name, otherUser?.avatarUrl, otherUser?.avatar, chatId, appointmentId, isOutgoing, setActiveCall]);

  const exitScreen = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setTimeout(() => safeGoBack(navigation, 'MainTabs'), 250);
  }, [navigation]);

  // Minimize: keep the call alive in the store, just pop the screen. The
  // chat screen will show a "Tap to return to call" banner. Tapping it
  // navigates back here with the same roomUrl/token, and Daily rejoins.
  const minimizeCall = useCallback(() => {
    safeGoBack(navigation, 'MainTabs');
  }, [navigation]);

  // End the call for real (NOT a minimize — this fully tears down the
  // call). notifyOther=true means we send `call:end` / `call:cancel` to
  // the server. When the peer or the server triggered the exit, we just
  // clean up locally. Either way we clear the global active-call store so
  // the chat banner disappears.
  const endCall = useCallback(
    (opts?: { notifyOther?: boolean }) => {
      const notifyOther = opts?.notifyOther !== false;
      const id = callIdRef.current;
      if (notifyOther && id) {
        // Same socket emit covers "I clicked Leave in Daily" and "the
        // remote side declined before I even joined" — the server routes
        // each appropriately based on whether the call had startedAt set.
        if (!hasJoined && isOutgoing) {
          socketService.cancelCall(id);
        } else {
          socketService.endCallById(id);
        }
      }
      if (appointmentId) {
        videoApi.endMeeting(appointmentId).catch(() => {});
      }
      clearActiveCall();
      exitScreen();
    },
    [appointmentId, exitScreen, hasJoined, isOutgoing, clearActiveCall],
  );

  // ───────────────────────────────────────────────────────────────────────
  // Bootstrap: appointment calls hit /video/meeting; chat calls emit
  // `call:initiate` and wait for `call:initiated`. Incoming calls already
  // have roomUrl + token from route.params.
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const loadAppointmentSession = async () => {
      setSessionLoading(true);
      setSessionError(null);
      try {
        let data: any;
        try {
          const res = await videoApi.getMeeting(appointmentId);
          data = res.data;
        } catch (err: any) {
          if (!isNotFoundRouteError(err)) throw err;
          const res = await videoApi.createMeeting({
            appointmentId,
            meetingType: isVideoCall ? 'VIDEO_CALL' : 'AUDIO_CALL',
          });
          data = res.data;
        }
        if (!mounted) return;
        setMeetingLink(data.meetingLink || null);
        setMeetingToken(data.token || null);
      } catch (err: any) {
        if (!mounted) return;
        const raw = err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? 'Failed to initialize call session.';
        setSessionError(mapDailyMessage(normalizeErrorMessage(raw)));
      } finally {
        if (mounted) setSessionLoading(false);
      }
    };

    const initiateChatCall = () => {
      if (!otherId || !chatId) {
        setSessionError('Unable to start call: missing recipient or chat context.');
        setSessionLoading(false);
        return;
      }
      if (hasInitiatedRef.current) return;
      hasInitiatedRef.current = true;
      socketService.initiateCall({
        to: otherId,
        referenceId: chatId,
        callType: 'chat',
        mediaType,
      });
    };

    if (initialRoomUrl && initialToken) {
      setSessionLoading(false);
    } else if (appointmentId) {
      loadAppointmentSession();
    } else if (isOutgoing && chatId) {
      initiateChatCall();
    } else {
      setSessionError('Unable to start call: missing context.');
      setSessionLoading(false);
    }

    return () => {
      mounted = false;
    };
  }, [appointmentId, isOutgoing, chatId, otherId, isVideoCall, mediaType, initialRoomUrl, initialToken]);

  // ───────────────────────────────────────────────────────────────────────
  // Socket signaling — purely lifecycle; no in-call UI state lives here
  // anymore since Daily owns the call surface.
  // ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    const unsubInitiated = socketService.on('call:initiated', (payload: unknown) => {
      const data = payload as { callId?: string; roomUrl?: string; token?: string };
      if (!active || !isOutgoing) return;
      if (data?.callId) {
        setCallId(data.callId);
        callIdRef.current = data.callId;
      }
      if (data?.roomUrl) setMeetingLink(data.roomUrl);
      if (data?.token) setMeetingToken(data.token);
      setSessionLoading(false);
    });

    const unsubDeclined = socketService.on('call:declined', (payload: unknown) => {
      const data = payload as { callId?: string };
      if (!active) return;
      if (data?.callId && callIdRef.current && data.callId !== callIdRef.current) return;
      setSessionError('Call was declined.');
      endCall({ notifyOther: false });
    });

    const unsubCancelled = socketService.on('call:cancelled', (payload: unknown) => {
      const data = payload as { callId?: string };
      if (!active) return;
      if (data?.callId && callIdRef.current && data.callId !== callIdRef.current) return;
      setSessionError('Caller cancelled the call.');
      endCall({ notifyOther: false });
    });

    const unsubEnded = socketService.on('call:ended', (payload: unknown) => {
      const data = payload as { callId?: string };
      if (!active) return;
      if (data?.callId && callIdRef.current && data.callId !== callIdRef.current) return;
      endCall({ notifyOther: false });
    });

    const unsubError = socketService.on('call:error', (payload: unknown) => {
      const data = payload as { code?: string; message?: string; callId?: string };
      if (!active) return;
      if (data?.callId && callIdRef.current && data.callId !== callIdRef.current) return;

      // Block the screen with a native Alert. The previous behavior — set
      // a thin red banner and exit ~250ms later — was effectively silent
      // for offline targets (loading spinner stayed up; user just got
      // dropped back to chat with no idea why). The OK button is the
      // only path back, so the user always sees the reason.
      //
      // The most common case here is USER_OFFLINE — the callee isn't
      // connected, server doesn't ring them, and the call never goes
      // through. The Alert tells them so plainly.
      if (exitingRef.current) return;
      const { title, body } = callErrorToAlert(data);
      Alert.alert(
        title,
        body,
        [{ text: 'OK', onPress: () => endCall({ notifyOther: false }) }],
        { cancelable: false },
      );
    });

    return () => {
      active = false;
      unsubInitiated();
      unsubDeclined();
      unsubCancelled();
      unsubEnded();
      unsubError();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOutgoing]);

  // ───────────────────────────────────────────────────────────────────────
  // Daily CALL-OBJECT mode + custom WhatsApp-style portrait UI.
  //
  // The lawsuit-frontend continues to use Daily's prebuilt iframe (which is
  // optimized for desktop 16:9 conference layouts). On mobile we render a
  // 1-on-1 portrait surface: the remote participant fills the screen with
  // object-fit: cover (so a 16:9 source camera fills a 9:16 viewport by
  // cropping the sides), and the local camera sits as a small PIP in the
  // top-right — same affordance pattern as WhatsApp / Signal / FaceTime.
  //
  // We still use the daily-js SDK (same CDN bundle), but instead of
  // createFrame() we use createCallObject() and manually attach the video
  // and audio tracks to <video> / <audio> elements we own. This means we
  // get full layout control without leaving the WebView (no native
  // dependency rebuild, no EAS rebuild).
  //
  // Bridge contract (to React Native):
  //   page → native:  joined, left, error, end-clicked
  //   native → page:  none — Daily controls live entirely in HTML
  // ───────────────────────────────────────────────────────────────────────
  const callHtml = useMemo(() => {
    if (!meetingLink || !meetingToken) return null;
    const safeMeetingLink = JSON.stringify(meetingLink);
    const safeMeetingToken = JSON.stringify(meetingToken);
    const safePeerName = JSON.stringify(otherUser?.name || 'Calling...');
    const safePeerInitial = JSON.stringify(
      String(otherUser?.name || '?').trim().charAt(0).toUpperCase() || '?',
    );
    const startVideoOff = !isVideoCall;
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
    html, body { margin: 0; padding: 0; width: 100vw; height: 100vh; background: #0b141a;
      overflow: hidden; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

    /* Stage = fullscreen container; everything is absolutely positioned
       inside it so the layout scales cleanly to any portrait viewport. */
    .stage { position: fixed; inset: 0; background: #0b141a; }

    /* Remote video fills the whole stage. object-fit: cover means a 16:9
       camera frame crops sideways to fill a 9:16 viewport — same trick
       WhatsApp uses for full-bleed portrait calls. */
    #remote-video {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover; background: #0b141a;
      z-index: 1;
    }

    /* Shown when the remote participant hasn't joined yet, or has their
       camera off. Big centered avatar + name + status, just like an
       incoming-call screen on WhatsApp. */
    .remote-placeholder {
      position: absolute; inset: 0; z-index: 2;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px;
      background: linear-gradient(160deg, #1a2c3a 0%, #0b141a 100%);
    }
    .remote-placeholder.hidden { display: none; }
    .avatar-big {
      width: 150px; height: 150px; border-radius: 75px;
      background: rgba(255,255,255,0.08);
      display: flex; align-items: center; justify-content: center;
      font-size: 64px; font-weight: 300;
      border: 3px solid rgba(255,255,255,0.12);
      margin-bottom: 22px;
    }
    .placeholder-name { font-size: 22px; font-weight: 700; }
    .placeholder-status { font-size: 14px; color: rgba(255,255,255,0.55); margin-top: 4px; }

    /* Local camera PIP — small, rounded, top-right. Mirrored horizontally
       so the user sees themselves the way they expect (selfie cam). */
    .local-pip {
      position: absolute; top: 60px; right: 14px;
      width: 96px; height: 132px;
      border-radius: 14px; overflow: hidden;
      background: #000; z-index: 5;
      border: 2px solid rgba(255,255,255,0.25);
      box-shadow: 0 6px 16px rgba(0,0,0,0.45);
    }
    .local-pip.hidden { display: none; }
    #local-video {
      width: 100%; height: 100%; object-fit: cover;
      transform: scaleX(-1); /* mirror so left/right matches user's intuition */
    }

    /* Top bar: peer name + duration overlay. Gradient fades into the
       remote video so it doesn't blot out the picture. */
    .top-bar {
      position: absolute; top: 0; left: 0; right: 0; z-index: 10;
      padding: 50px 16px 14px;
      display: flex; align-items: center;
      background: linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%);
    }
    .top-bar .meta { flex: 1; min-width: 0; margin-left: 8px; }
    .top-bar .name { font-size: 17px; font-weight: 700; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis; }
    .top-bar .duration { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 2px; }

    /* Bottom action bar. Five circular buttons evenly spaced, end-call in
       red and rotated 135deg so the receiver icon points down (universal
       hang-up glyph). */
    .bottom-bar {
      position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
      padding: 22px 14px 36px;
      display: flex; align-items: center; justify-content: space-evenly; gap: 10px;
      background: linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 100%);
    }
    .btn {
      width: 56px; height: 56px; border-radius: 28px;
      background: rgba(255,255,255,0.18);
      border: 0; padding: 0;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
    }
    .btn:active { transform: scale(0.96); }
    .btn.active { background: rgba(255,255,255,0.42); }
    .btn.end { background: #e4091d; }
    .btn svg { width: 26px; height: 26px; fill: currentColor; }
    .btn.end svg { transform: rotate(135deg); }
    .btn.hidden { display: none; }
  </style>
  <script src="https://unpkg.com/@daily-co/daily-js"></script>
</head>
<body>
  <div class="stage">
    <video id="remote-video" autoplay playsinline></video>

    <div id="remote-placeholder" class="remote-placeholder">
      <div class="avatar-big" id="avatar-initial"></div>
      <div class="placeholder-name" id="placeholder-name"></div>
      <div class="placeholder-status" id="placeholder-status">Calling...</div>
    </div>

    <div id="local-pip" class="local-pip hidden">
      <video id="local-video" autoplay playsinline muted></video>
    </div>

    <div class="top-bar">
      <div class="meta">
        <div class="name" id="top-name"></div>
        <div class="duration" id="duration">Calling...</div>
      </div>
    </div>

    <div class="bottom-bar">
      <button class="btn" id="btn-camera" aria-label="Toggle camera">
        <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
      </button>
      <button class="btn" id="btn-flip" aria-label="Flip camera">
        <svg viewBox="0 0 24 24"><path d="M19.65 6.5C17.89 5.06 15.59 4.1 13 4.1c-3.73 0-6.99 2.04-8.72 5.06l1.47 1.47C7.18 7.7 9.93 6.1 13 6.1c1.92 0 3.68.66 5.07 1.74l-1.72 1.72H22V3.5l-2.35 3zM4.5 13.5l-1.5 1.5h6.13l-1.69-1.69C6.96 12.27 6 10.71 6 9c0-.56.11-1.1.3-1.61L4.81 5.9C4.31 6.83 4 7.88 4 9c0 1.93.83 3.66 2.15 4.86L4.5 13.5z"/></svg>
      </button>
      <button class="btn" id="btn-mic" aria-label="Toggle mic">
        <svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
      </button>
      <button class="btn end" id="btn-end" aria-label="End call">
        <svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
      </button>
    </div>
  </div>

  <script>
    const meetingLink = ${safeMeetingLink};
    const meetingToken = ${safeMeetingToken};
    const startVideoOff = ${JSON.stringify(startVideoOff)};
    const peerName = ${safePeerName};
    const peerInitial = ${safePeerInitial};

    const remoteVideo = document.getElementById('remote-video');
    const localVideo  = document.getElementById('local-video');
    const localPip    = document.getElementById('local-pip');
    const remotePh    = document.getElementById('remote-placeholder');
    const phName      = document.getElementById('placeholder-name');
    const phStatus    = document.getElementById('placeholder-status');
    const phAvatar    = document.getElementById('avatar-initial');
    const topName     = document.getElementById('top-name');
    const durationEl  = document.getElementById('duration');
    const btnCamera   = document.getElementById('btn-camera');
    const btnFlip     = document.getElementById('btn-flip');
    const btnMic      = document.getElementById('btn-mic');
    const btnEnd      = document.getElementById('btn-end');

    phName.textContent  = peerName;
    phAvatar.textContent = peerInitial;
    topName.textContent  = peerName;

    let call = null;
    let startedAt = null;
    let micOn = true;
    let camOn = !startVideoOff;
    let remoteAudioEls = new Map();   // sessionId -> <audio>

    function post(event, payload = {}) {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({ event, ...payload }));
    }

    function setBtnActive(btn, isActive) {
      if (isActive) btn.classList.add('active'); else btn.classList.remove('active');
    }

    function fmtDuration(sec) {
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      return mm + ':' + ss;
    }

    function tickDuration() {
      if (!startedAt) return;
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      durationEl.textContent = fmtDuration(sec);
    }
    setInterval(tickDuration, 1000);

    // Show / hide the remote placeholder based on whether a remote
    // participant has a live video track attached.
    function refreshRemotePlaceholder(hasRemoteVideo, hasAnyRemote) {
      if (hasRemoteVideo) {
        remotePh.classList.add('hidden');
      } else {
        remotePh.classList.remove('hidden');
        phStatus.textContent = hasAnyRemote ? 'Camera off' : 'Calling...';
      }
    }

    function ensureAudioEl(sessionId) {
      let el = remoteAudioEls.get(sessionId);
      if (!el) {
        el = document.createElement('audio');
        el.autoplay = true;
        el.playsinline = true;
        document.body.appendChild(el);
        remoteAudioEls.set(sessionId, el);
      }
      return el;
    }

    // Daily exposes a track's lifecycle via participant.tracks.video.state:
    //   'playable'    — track is live and producing frames; safe to attach
    //   'loading'     — track is being negotiated; persistentTrack may be
    //                   set but won't actually render yet, so DON'T touch
    //                   the video element (the previous fix would clear
    //                   srcObject here and reset the video to black).
    //   'off'/'blocked'/'interrupted' — camera is off / denied / lost
    //   'sendable'    — local-only signal: we could send but haven't yet
    // We only attach when 'playable' and only clear when explicitly off.
    // Intermediate states leave srcObject untouched.
    function pickPlayableTrack(trackInfo) {
      if (!trackInfo) return { track: null, state: null };
      const state = trackInfo.state || null;
      const track = trackInfo.persistentTrack || null;
      return { track, state };
    }

    function srcTrackId(mediaEl, kind) {
      const stream = mediaEl && mediaEl.srcObject;
      if (!stream) return null;
      const tracks = kind === 'video' ? stream.getVideoTracks() : stream.getAudioTracks();
      return tracks[0] ? tracks[0].id : null;
    }

    function setMediaStream(mediaEl, track) {
      try {
        mediaEl.srcObject = new MediaStream([track]);
        // Some Android WebView builds ignore the autoplay attribute when
        // srcObject is reassigned post-load. Forcing .play() catches those.
        const p = mediaEl.play && mediaEl.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (_) {
        // ignore — DOM may briefly be unavailable
      }
    }

    function clearMediaStream(mediaEl) {
      try { mediaEl.srcObject = null; } catch (_) {}
    }

    function attachTracksFor(participant) {
      if (!participant) return;
      const isLocal = !!participant.local;

      // ─── Video ───────────────────────────────────────────────
      const v = pickPlayableTrack(participant.tracks && participant.tracks.video);

      if (isLocal) {
        // Local camera: show PIP whenever there's a playable local video
        // track. Don't gate on camOn — let the real track state drive it,
        // since toggling the button updates state asynchronously.
        if (v.state === 'playable' && v.track) {
          if (srcTrackId(localVideo, 'video') !== v.track.id) {
            setMediaStream(localVideo, v.track);
          }
          localPip.classList.remove('hidden');
        } else if (v.state === 'off' || v.state === 'blocked' || v.state === 'interrupted' || v.state === 'sendable') {
          clearMediaStream(localVideo);
          localPip.classList.add('hidden');
        }
        // 'loading' / unknown → leave whatever we had untouched
      } else {
        if (v.state === 'playable' && v.track) {
          if (srcTrackId(remoteVideo, 'video') !== v.track.id) {
            setMediaStream(remoteVideo, v.track);
          }
        } else if (v.state === 'off' || v.state === 'blocked' || v.state === 'interrupted') {
          clearMediaStream(remoteVideo);
        }
        // 'loading' → keep current (don't flicker to black mid-handshake)
      }

      // ─── Audio (skip local — would feed back into our own speaker) ───
      if (!isLocal) {
        const a = pickPlayableTrack(participant.tracks && participant.tracks.audio);
        const audioEl = ensureAudioEl(participant.session_id);
        if (a.state === 'playable' && a.track) {
          if (srcTrackId(audioEl, 'audio') !== a.track.id) {
            setMediaStream(audioEl, a.track);
          }
        } else if (a.state === 'off' || a.state === 'blocked' || a.state === 'interrupted') {
          clearMediaStream(audioEl);
        }
      }
    }

    function refreshAll() {
      if (!call) return;
      const participants = call.participants();
      let hasRemoteVideoPlayable = false;
      let hasAnyRemote = false;
      Object.values(participants).forEach((p) => {
        attachTracksFor(p);
        if (!p.local) {
          hasAnyRemote = true;
          const v = p.tracks && p.tracks.video;
          if (v && v.state === 'playable' && v.persistentTrack) {
            hasRemoteVideoPlayable = true;
          }
        }
      });
      refreshRemotePlaceholder(hasRemoteVideoPlayable, hasAnyRemote);
    }

    function removeParticipant(participant) {
      if (!participant || participant.local) return;
      const el = remoteAudioEls.get(participant.session_id);
      if (el) {
        el.srcObject = null;
        el.remove();
        remoteAudioEls.delete(participant.session_id);
      }
      remoteVideo.srcObject = null;
      remotePh.classList.remove('hidden');
      phStatus.textContent = 'Call ended';
    }

    // ----- Control wiring -----
    btnMic.addEventListener('click', async () => {
      if (!call) return;
      micOn = !micOn;
      await call.setLocalAudio(micOn);
      setBtnActive(btnMic, !micOn); // active styling = MUTED state
    });

    btnCamera.addEventListener('click', async () => {
      if (!call) return;
      camOn = !camOn;
      // Daily fires participant-updated + track-started/track-stopped
      // a moment after this resolves; the new state-driven attach logic
      // in attachTracksFor() will show/hide the PIP at the right time.
      try { await call.setLocalVideo(camOn); } catch (_) {}
      setBtnActive(btnCamera, !camOn);
      refreshAll();
    });

    btnFlip.addEventListener('click', async () => {
      if (!call) return;
      try { await call.cycleCamera(); } catch (_) {}
    });

    btnEnd.addEventListener('click', async () => {
      try { if (call) await call.leave(); } catch (_) {}
      post('left');
    });

    async function boot() {
      try {
        if (!window.DailyIframe) {
          post('error', { message: 'Daily SDK failed to load.' });
          return;
        }

        // Call-object mode: no prebuilt UI. The SDK still owns the
        // WebRTC/peer-connection plumbing — we just render tracks.
        call = window.DailyIframe.createCallObject({
          // Subscribe to remote tracks automatically so we don't have
          // to manage subscriptions per-participant by hand.
          subscribeToTracksAutomatically: true,
          // Start muted? No — match Daily's prebuilt default (mic on),
          // user can mute via the bottom bar.
          audioSource: true,
          videoSource: !startVideoOff,
        });

        call.on('joined-meeting', () => {
          startedAt = Date.now();
          durationEl.textContent = '00:00';
          refreshAll();
          post('joined');
        });
        call.on('left-meeting', () => post('left'));
        call.on('error', (e) => {
          const message =
            (e && (e.errorMsg || e.error || e.message)) ||
            (typeof e === 'string' ? e : null) ||
            (e ? JSON.stringify(e) : 'Daily call error');
          post('error', { message: message });
        });

        // Re-render tiles whenever a participant or track changes.
        call.on('participant-joined',  refreshAll);
        call.on('participant-updated', refreshAll);
        call.on('track-started',       refreshAll);
        call.on('track-stopped',       refreshAll);
        call.on('participant-left',    (e) => { removeParticipant(e && e.participant); refreshAll(); });

        await call.join({
          url: meetingLink,
          token: meetingToken,
          startVideoOff: startVideoOff,
        });
      } catch (e) {
        post('error', { message: String(e && e.message ? e.message : e) });
      }
    }

    boot();
  </script>
</body>
</html>`;
  }, [meetingLink, meetingToken, isVideoCall, otherUser?.name]);

  const onWebViewMessage = useCallback((event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (payload.event === 'joined') {
        setHasJoined(true);
        return;
      }
      if (payload.event === 'left') {
        // Daily's Leave button → emit call:end to the server.
        endCall({ notifyOther: true });
        return;
      }
      if (payload.event === 'error') {
        const raw = payload.message ?? payload ?? 'Call failed.';
        setSessionError(mapDailyMessage(normalizeErrorMessage(raw)));
      }
    } catch {
      // ignore malformed webview messages
    }
  }, [endCall]);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {callHtml ? (
        <WebView
          ref={webViewRef}
          source={{ html: callHtml, baseUrl: 'https://daily.co/' }}
          onMessage={onWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          // Don't let an accidental back-swipe nuke the WebView mid-call.
          // The user has Daily's Leave button for that.
          allowsBackForwardNavigationGestures={false}
          style={s.webview}
        />
      ) : null}

      {sessionLoading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={s.loadingText}>
            {isOutgoing ? 'Connecting call...' : 'Joining call...'}
          </Text>
          {!!otherUser?.name && (
            <Text style={s.loadingSub}>{otherUser.name}</Text>
          )}
        </View>
      )}

      {!!sessionError && (
        <View style={s.errorOverlay}>
          <Text style={s.errorText}>{sessionError}</Text>
        </View>
      )}

      {/* Minimize affordance — a single small chevron floating above Daily's
          prebuilt UI. Tapping it just pops the screen WITHOUT ending the
          call. The active-call store keeps the room+token so the chat
          screen can show a "Tap to return to call" banner and resume.
          End/hang up still happens through Daily's own red Leave button. */}
      {!sessionLoading && !sessionError && (
        <TouchableOpacity
          style={s.minimizeBtn}
          onPress={minimizeCall}
          activeOpacity={0.7}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <Ionicons name="chevron-down" size={22} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    gap: 12,
  },
  loadingText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  loadingSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  errorOverlay: {
    position: 'absolute',
    top: 60,
    left: 18,
    right: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(229, 28, 66, 0.92)',
  },
  errorText: { color: '#fff', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  // Native minimize chevron sits over the WebView's top-bar at the same
  // vertical center, on the left. It pops the screen without ending the
  // call. End/hangup is the red phone inside the WebView's bottom bar.
  minimizeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 44,
    left: 14,
    zIndex: 50,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VideoCallScreen;

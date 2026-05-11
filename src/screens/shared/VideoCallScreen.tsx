// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { videoApi } from '../../services/api';
import { socketService } from '../../services/socket';
import { safeGoBack } from '../../utils/navigation';

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

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  const exitScreen = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setTimeout(() => safeGoBack(navigation, 'MainTabs'), 250);
  }, [navigation]);

  // End the call. notifyOther=true means we send `call:end` / `call:cancel`
  // to the server (used when WE initiated the leave). When the peer or the
  // server triggered the exit, we just clean up locally.
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
      exitScreen();
    },
    [appointmentId, exitScreen, hasJoined, isOutgoing],
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
      const friendly =
        data?.code === 'USER_OFFLINE'
          ? 'User is not available right now.'
          : data?.code === 'USER_BUSY'
            ? 'User is already in another call.'
            : data?.code === 'CALLER_BUSY'
              ? 'You are already in another call.'
              : data?.message || 'Call failed.';
      setSessionError(friendly);
      endCall({ notifyOther: false });
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
  // Daily prebuilt iframe HTML. Critical config:
  //   - `showLeaveButton: true` — Daily's own red Leave button lives in
  //     the bottom toolbar; clicking it triggers `left-meeting` which we
  //     translate to `call:end` for the server.
  //   - The iframe is positioned fixed/100%/100% so it visually occupies
  //     every pixel of the WebView. The WebView is itself full-screen.
  //   - `startVideoOff` is the only knob we still set, because the chat
  //     button distinguishes audio vs video at call-initiation time.
  // ───────────────────────────────────────────────────────────────────────
  const callHtml = useMemo(() => {
    if (!meetingLink || !meetingToken) return null;
    const safeMeetingLink = JSON.stringify(meetingLink);
    const safeMeetingToken = JSON.stringify(meetingToken);
    const startVideoOff = !isVideoCall;
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <style>
    html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
    /* Belt-and-braces in case Daily's iframeStyle is ignored. */
    iframe { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; border: 0 !important; }
  </style>
  <script src="https://unpkg.com/@daily-co/daily-js"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    const meetingLink = ${safeMeetingLink};
    const meetingToken = ${safeMeetingToken};
    const startVideoOff = ${JSON.stringify(startVideoOff)};
    let frame = null;

    const post = (event, payload = {}) => {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({ event, ...payload }));
    };

    async function boot() {
      try {
        if (!window.DailyIframe) {
          post('error', { message: 'Daily SDK failed to load.' });
          return;
        }

        // Use Daily's full prebuilt UI — they ship participant tiles, mute /
        // camera / screen-share / leave / more menu, audio-output picker.
        // We deliberately leave showLeaveButton ON so the user has a clear
        // exit affordance inside the same UI surface.
        frame = window.DailyIframe.createFrame(document.getElementById('root'), {
          showLeaveButton: true,
          showFullscreenButton: false,
          showLocalVideo: true,
          showParticipantsBar: true,
          iframeStyle: {
            position: 'fixed',
            top: '0px',
            left: '0px',
            width: '100%',
            height: '100%',
            border: '0px',
            background: '#000',
          },
        });

        frame.on('joined-meeting', () => post('joined'));
        frame.on('left-meeting', () => post('left'));
        frame.on('error', (e) => {
          const message =
            (e && (e.errorMsg || e.error || e.message)) ||
            (typeof e === 'string' ? e : null) ||
            (e ? JSON.stringify(e) : 'Daily call error');
          post('error', { message });
        });

        await frame.join({
          url: meetingLink,
          token: meetingToken,
          startVideoOff,
        });
      } catch (e) {
        post('error', { message: String(e && e.message ? e.message : e) });
      }
    }

    boot();
  </script>
</body>
</html>`;
  }, [meetingLink, meetingToken, isVideoCall]);

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
});

export default VideoCallScreen;

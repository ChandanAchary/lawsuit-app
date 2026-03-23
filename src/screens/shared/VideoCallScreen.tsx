// @ts-nocheck
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { videoApi } from '../../services/api';
import { socketService } from '../../services/socket';

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

const ActionBtn: React.FC<{
  icon: string;
  label: string;
  onPress: () => void;
  active?: boolean;
}> = ({ icon, label, onPress, active }) => (
  <View style={s.actionItem}>
    <TouchableOpacity style={[s.actionBtn, active && s.actionBtnActive]} onPress={onPress}>
      <Ionicons name={icon as any} size={22} color="#fff" />
    </TouchableOpacity>
    <Text style={s.actionLabel}>{label}</Text>
  </View>
);

export const VideoCallScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const {
    appointmentId,
    roomId,
    callType = 'audio',
    otherUser,
    isOutgoing = true,
    chatId,
  } = route.params || {};

  const isVideoCall = callType === 'video';
  const displayName: string = otherUser?.name || 'Unknown';
  const displayAvatar: string | null = otherUser?.avatarUrl || otherUser?.avatar || null;
  const otherId: string | undefined = otherUser?.id;

  const [callState, setCallState] = useState<'calling' | 'connected' | 'ended'>(
    isOutgoing ? 'calling' : 'connected',
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(isVideoCall);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);
  const [meetingToken, setMeetingToken] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webViewRef = useRef<WebView>(null);

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setCallSeconds((prev) => prev + 1), 1000);
  };

  const stopTimer = () => {
    if (!timerRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const endCall = useCallback((notifyOther = true) => {
    if (notifyOther && otherId && roomId) {
      socketService.emit('call:end', { to: otherId, roomId, chatId, duration: callSeconds });
    }
    webViewRef.current?.injectJavaScript("window.__handleNativeCmd && window.__handleNativeCmd({ type: 'end' }); true;");
    if (appointmentId) videoApi.endMeeting(appointmentId).catch(() => {});
    if (chatId) videoApi.endChatSession(chatId).catch(() => {});
    stopTimer();
    setCallState('ended');
    setTimeout(() => navigation.goBack(), 900);
  }, [otherId, roomId, appointmentId, navigation, chatId, callSeconds]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      webViewRef.current?.injectJavaScript(
        `window.__handleNativeCmd && window.__handleNativeCmd(${JSON.stringify({ type: 'set-mute', muted: nextMuted })}); true;`,
      );
      return nextMuted;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    if (!isVideoCall) return;
    setIsCameraOff((prev) => {
      const nextCameraOff = !prev;
      webViewRef.current?.injectJavaScript(
        `window.__handleNativeCmd && window.__handleNativeCmd(${JSON.stringify({ type: 'set-camera', cameraOff: nextCameraOff })}); true;`,
      );
      return nextCameraOff;
    });
  }, [isVideoCall]);

  const flipCamera = useCallback(() => {
    if (!isVideoCall) return;
    webViewRef.current?.injectJavaScript(
      "window.__handleNativeCmd && window.__handleNativeCmd({ type: 'flip-camera' }); true;",
    );
  }, [isVideoCall]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => !prev);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      setSessionLoading(true);
      setSessionError(null);
      try {
        if (appointmentId) {
          // Support both get-first and create-first server implementations.
          let data: any;
          try {
            const res = await videoApi.getMeeting(appointmentId);
            data = res.data;
          } catch (err: any) {
            if (!isNotFoundRouteError(err)) throw err;
            const res = await videoApi.createMeeting({ appointmentId, meetingType: isVideoCall ? 'VIDEO_CALL' : 'AUDIO_CALL' });
            data = res.data;
          }
          if (!mounted) return;
          setMeetingLink(data.meetingLink || null);
          setMeetingToken(data.token || null);
          return;
        }
        if (chatId) {
          // Prefer create-session for compatibility with servers that only expose POST.
          let data: any;
          try {
            const res = await videoApi.createChatSession(chatId);
            data = res.data;
          } catch (err: any) {
            if (!isNotFoundRouteError(err)) throw err;
            const res = await videoApi.getChatSession(chatId);
            data = res.data;
          }
          if (!mounted) return;
          setMeetingLink(data.meetingLink || null);
          setMeetingToken(data.token || null);
          return;
        }
        if (!mounted) return;
        setSessionError('Unable to start call: missing appointment or chat context.');
      } catch (err: any) {
        if (!mounted) return;
        const raw = err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? 'Failed to initialize call session.';
        setSessionError(mapDailyMessage(normalizeErrorMessage(raw)));
      } finally {
        if (mounted) setSessionLoading(false);
      }
    };

    loadSession();

    const unsubAccepted = socketService.on('call:accepted', (data: unknown) => {
      const { roomId: incomingRoom } = data as { roomId?: string };
      if (incomingRoom && roomId && incomingRoom !== roomId) return;
      if (callState !== 'ended') setCallState('connected');
      startTimer();
    });

    const unsubRejected = socketService.on('call:rejected', (data: unknown) => {
      const { roomId: incomingRoom } = data as { roomId?: string };
      if (incomingRoom && roomId && incomingRoom !== roomId) return;
      if (mounted) endCall(false);
    });

    const unsubEnded = socketService.on('call:ended', (data: unknown) => {
      const { roomId: incomingRoom } = data as { roomId?: string };
      if (incomingRoom && roomId && incomingRoom !== roomId) return;
      if (mounted) endCall(false);
    });

    return () => {
      mounted = false;
      unsubAccepted();
      unsubRejected();
      unsubEnded();
      stopTimer();
    };
  }, []);

  const callHtml = React.useMemo(() => {
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

        frame = window.DailyIframe.createFrame(document.getElementById('root'), {
          showLeaveButton: false,
          showFullscreenButton: false,
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

    window.__handleNativeCmd = async function (cmd) {
      if (!frame || !cmd || !cmd.type) return;
      try {
        if (cmd.type === 'set-mute') {
          await frame.setLocalAudio(!cmd.muted);
          return;
        }
        if (cmd.type === 'set-camera') {
          await frame.setLocalVideo(!cmd.cameraOff);
          return;
        }
        if (cmd.type === 'flip-camera') {
          const local = frame.participants && frame.participants().local;
          const devices = local && local.devices;
          const hasSecondary = devices && devices.camera && devices.camera.length > 1;
          if (hasSecondary && frame.cycleCamera) {
            frame.cycleCamera();
          }
          return;
        }
        if (cmd.type === 'end') {
          await frame.leave();
          return;
        }
      } catch (e) {
        post('error', { message: String(e && e.message ? e.message : e) });
      }
    };

    boot();
  </script>
</body>
</html>`;
  }, [meetingLink, meetingToken, isVideoCall]);

  const onWebViewMessage = useCallback((event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');
      if (payload.event === 'joined') {
        if (callState !== 'ended') setCallState('connected');
        startTimer();
        return;
      }
      if (payload.event === 'left') {
        endCall(false);
        return;
      }
      if (payload.event === 'error') {
        const raw = payload.message ?? payload ?? 'Call failed.';
        setSessionError(mapDailyMessage(normalizeErrorMessage(raw)));
        stopTimer();
        if (callState !== 'ended') setCallState('ended');
      }
    } catch {
      // ignore malformed webview messages
    }
  }, [callState, endCall]);

  const formatTimeFn = (sec: number) => {
    const mm = Math.floor(sec / 60).toString().padStart(2, '0');
    const ss = (sec % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const statusText =
    callState === 'ended'
      ? 'Call ended'
      : callState === 'connected'
      ? formatTimeFn(callSeconds)
      : isOutgoing
      ? 'Calling...'
      : 'Connecting...';

  const bgColors: [string, string, string] = isVideoCall
    ? ['#080808', '#111', '#080808']
    : ['#0b141a', '#1c2f3a', '#0b141a'];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={bgColors} locations={[0, 0.5, 1]} style={s.container}>
        {callHtml && !sessionError && callState !== 'ended' && (
          <WebView
            ref={webViewRef}
            source={{ html: callHtml, baseUrl: 'https://daily.co/' }}
            onMessage={onWebViewMessage}
            javaScriptEnabled
            domStorageEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            style={s.remoteVideo}
          />
        )}

        {sessionLoading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={s.loadingText}>Connecting call...</Text>
          </View>
        )}

        {!!sessionError && (
          <View style={s.errorOverlay}>
            <Text style={s.errorText}>{sessionError}</Text>
          </View>
        )}

        {isVideoCall && !isCameraOff && (
          <View style={s.localVideoContainer}>
            <View style={s.localVideo} />
          </View>
        )}

        <View style={s.topBar}>
          <TouchableOpacity style={s.iconBtn} onPress={() => endCall()}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={s.topCenter}>
            <Text style={s.topName} numberOfLines={1}>{displayName}</Text>
            <Text style={s.encText}>{statusText}</Text>
          </View>
          {isVideoCall ? (
            <TouchableOpacity style={s.iconBtn} onPress={flipCamera}>
              <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={s.iconBtn} />
          )}
        </View>

        {(!isVideoCall || isCameraOff) && (
          <View style={s.avatarSection}>
            <View style={s.avatarRing}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={s.calleeName}>{displayName}</Text>
            <Text style={s.statusText}>{statusText}</Text>
          </View>
        )}

        <View style={s.bottomBar}>
          {isVideoCall && (
            <ActionBtn
              icon={isCameraOff ? 'videocam-off' : 'videocam'}
              label="Camera"
              onPress={toggleCamera}
              active={isCameraOff}
            />
          )}
          <ActionBtn
            icon={isSpeakerOn ? 'volume-high' : 'volume-medium-outline'}
            label="Speaker"
            onPress={toggleSpeaker}
            active={isSpeakerOn}
          />
          <ActionBtn
            icon={isMuted ? 'mic-off' : 'mic-outline'}
            label={isMuted ? 'Unmute' : 'Mute'}
            onPress={toggleMute}
            active={isMuted}
          />
          <View style={s.actionItem}>
            <TouchableOpacity style={s.endBtn} onPress={() => endCall()}>
              <Ionicons name="call" size={24} color="#fff" style={s.endIcon} />
            </TouchableOpacity>
            <Text style={s.actionLabel}>End</Text>
          </View>
        </View>
      </LinearGradient>
    </>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  remoteVideo: { ...StyleSheet.absoluteFillObject },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 3,
    gap: 10,
  },
  loadingText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  errorOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 95,
    left: 18,
    right: 18,
    zIndex: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(229, 28, 66, 0.85)',
  },
  errorText: { color: '#fff', fontSize: 12, textAlign: 'center' },
  localVideoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 88,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  localVideo: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 5,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  topCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  topName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  encText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 },
  avatarSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  avatarRing: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 162, height: 162, borderRadius: 81 },
  avatarFallback: { backgroundColor: '#2c4a5a', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 68, fontWeight: '300' },
  calleeName: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 6 },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingTop: 18,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 28,
    marginHorizontal: 10,
    marginBottom: 16,
  },
  actionItem: { alignItems: 'center', gap: 7, minWidth: 70 },
  actionBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: { backgroundColor: 'rgba(255,255,255,0.33)' },
  endBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#e4091d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endIcon: { transform: [{ rotate: '135deg' }] },
  actionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center' },
});

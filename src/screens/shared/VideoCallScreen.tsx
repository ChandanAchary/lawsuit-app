import React, { useEffect, useRef, useState } from 'react';
import {
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
import { videoApi } from '../../services/api';
import { socketService } from '../../services/socket';

// ─── Small reusable action button ───────────────────────────────────────────
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

// ─── Main screen ─────────────────────────────────────────────────────────────
export const VideoCallScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const {
    appointmentId,
    roomId: directRoomId,
    callType = 'audio',
    otherUser,
    isOutgoing = true,
  } = route.params || {};

  const isVideoCall = callType === 'video';
  const displayName: string = otherUser?.name || 'Unknown';
  const displayAvatar: string | null = otherUser?.avatarUrl || otherUser?.avatar || null;
  const otherId: string | undefined = otherUser?.id;
  const roomId: string | undefined = directRoomId;

  const [callState, setCallState] = useState<'calling' | 'connected' | 'ended'>(
    isOutgoing ? 'calling' : 'connected',
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setCallSeconds((prev) => prev + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const endCall = (notifyOther = true) => {
    if (notifyOther && otherId && roomId) {
      socketService.emit('call:end', { to: otherId, roomId });
    }
    if (appointmentId) videoApi.endMeeting(appointmentId).catch(() => {});
    stopTimer();
    setCallState('ended');
    setTimeout(() => navigation.goBack(), 900);
  };

  useEffect(() => {
    // Incoming call: already connected
    if (!isOutgoing) {
      setCallState('connected');
      startTimer();
    }

    // Appointment-based meeting
    if (appointmentId) {
      void (async () => {
        try {
          let url: string | null = null;
          try {
            const { data } = await videoApi.getMeeting(appointmentId);
            url = data?.meetingUrl || data?.url || data?.meeting?.url || null;
          } catch {}
          if (!url) {
            const { data } = await videoApi.createMeeting({ appointmentId, meetingType: callType });
            url = data?.meetingUrl || data?.url || data?.meeting?.url || null;
          }
          if (url) { setCallState('connected'); startTimer(); }
        } catch {}
      })();
    }

    const unsubAccepted = socketService.on('call:accepted', () => {
      setCallState('connected');
      startTimer();
    });
    const unsubEnded = socketService.on('call:ended', () => endCall(false));

    return () => {
      unsubAccepted();
      unsubEnded();
      stopTimer();
    };
  }, []);

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const statusText =
    callState === 'ended'
      ? 'Call ended'
      : callState === 'connected'
      ? formatTime(callSeconds)
      : isOutgoing
      ? 'Calling…'
      : 'Incoming call…';

  // ─── Gradient colours per call type ────────────────────────────────────────
  const bgColors: [string, string, string] = isVideoCall
    ? ['#080808', '#111', '#080808']
    : ['#0b141a', '#1c2f3a', '#0b141a'];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={bgColors} locations={[0, 0.5, 1]} style={s.container}>

        {/* ─── Top bar ─────────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={s.topCenter}>
            <Text style={s.topName} numberOfLines={1}>{displayName}</Text>
            <View style={s.encRow}>
              <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.55)" />
              <Text style={s.encText}>End-to-end encrypted</Text>
            </View>
          </View>
          <TouchableOpacity style={s.iconBtn}>
            <Ionicons name="person-add-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ─── Side controls (video only) ────────────────────────────────── */}
        {isVideoCall && (
          <View style={s.rightSide}>
            <TouchableOpacity style={s.sideBtn}>
              <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.sideBtn}>
              <Ionicons name="sparkles-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Avatar + status ──────────────────────────────────────────── */}
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

        {/* ─── Bottom action bar ──────────────────────────────────────────── */}
        <View style={s.bottomBar}>
          <ActionBtn icon="ellipsis-horizontal" label="More" onPress={() => {}} />
          <ActionBtn
            icon={isVideoCall ? (isCameraOff ? 'videocam-off' : 'videocam') : 'camera-reverse-outline'}
            label={isVideoCall ? 'Camera' : 'Flip'}
            onPress={() => isVideoCall && setIsCameraOff((p) => !p)}
            active={isVideoCall && isCameraOff}
          />
          <ActionBtn
            icon={isSpeakerOn ? 'volume-high' : 'volume-medium-outline'}
            label="Speaker"
            onPress={() => setIsSpeakerOn((p) => !p)}
            active={isSpeakerOn}
          />
          <ActionBtn
            icon={isMuted ? 'mic-off' : 'mic-outline'}
            label={isMuted ? 'Unmute' : 'Mute'}
            onPress={() => setIsMuted((p) => !p)}
            active={isMuted}
          />
          {/* End call */}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  topCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  topName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  encRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  encText: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  rightSide: { position: 'absolute', right: 14, top: 160, gap: 12 },
  sideBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSection: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  avatarRing: {
    width: 170, height: 170, borderRadius: 85,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65,
    shadowRadius: 22,
    elevation: 14,
  },
  avatar: { width: 162, height: 162, borderRadius: 81 },
  avatarFallback: { backgroundColor: '#2c4a5a', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 68, fontWeight: '300' },
  calleeName: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: 6 },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingTop: 18,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 28,
    marginHorizontal: 10,
    marginBottom: 16,
  },
  actionItem: { alignItems: 'center', gap: 7, minWidth: 56 },
  actionBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnActive: { backgroundColor: 'rgba(255,255,255,0.33)' },
  endBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#e4091d',
    alignItems: 'center', justifyContent: 'center',
  },
  endIcon: { transform: [{ rotate: '135deg' }] },
  actionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center' },

  // Legacy styles kept to avoid any residual references
  container2: { flex: 1, backgroundColor: '#000' },
  centerContainer: {
    flex: 1, backgroundColor: '#f5f5f5',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  loadingText: { fontSize: 15, color: '#888', marginTop: 14 },
});

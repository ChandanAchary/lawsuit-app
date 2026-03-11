import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  RTCView,
  MediaStream,
} from 'react-native-webrtc';
import { videoApi } from '../../services/api';
import { socketService } from '../../services/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

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
    chatId,
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
  const [isSpeakerOn, setIsSpeakerOn] = useState(isVideoCall);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callSeconds, setCallSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const remoteSocketIdRef = useRef<string | null>(null);
  const iceCandidatesBuffer = useRef<RTCIceCandidate[]>([]);

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

  // ─── Get local media stream ─────────────────────────────────────────────
  const getLocalStream = useCallback(async () => {
    try {
      const constraints: any = {
        audio: true,
        video: isVideoCall ? { facingMode: 'user', width: 640, height: 480 } : false,
      };
      const stream = await mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[WebRTC] getUserMedia error:', err);
      return null;
    }
  }, [isVideoCall]);

  // ─── Create peer connection ─────────────────────────────────────────────
  const createPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    (pc as any).ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Handle ICE candidates
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate && remoteSocketIdRef.current) {
        socketService.emit('video:ice-candidate', {
          roomId,
          candidate: event.candidate,
          to: remoteSocketIdRef.current,
        });
      }
    };

    (pc as any).oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        setCallState('connected');
        startTimer();
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        // Connection lost
      }
    };

    pcRef.current = pc;
    return pc;
  }, [roomId]);

  // ─── Create and send offer ──────────────────────────────────────────────
  const createOffer = useCallback(async (pc: RTCPeerConnection, targetSocketId: string) => {
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoCall,
      } as any);
      await pc.setLocalDescription(offer);
      socketService.emit('video:offer', {
        roomId,
        offer: offer,
        to: targetSocketId,
      });
    } catch (err) {
      console.error('[WebRTC] createOffer error:', err);
    }
  }, [roomId, isVideoCall]);

  // ─── Handle incoming offer and send answer ──────────────────────────────
  const handleOffer = useCallback(async (pc: RTCPeerConnection, offer: any, fromSocketId: string) => {
    try {
      remoteSocketIdRef.current = fromSocketId;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Apply buffered ICE candidates
      for (const candidate of iceCandidatesBuffer.current) {
        await pc.addIceCandidate(candidate);
      }
      iceCandidatesBuffer.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketService.emit('video:answer', {
        roomId,
        answer: answer,
        to: fromSocketId,
      });
    } catch (err) {
      console.error('[WebRTC] handleOffer error:', err);
    }
  }, [roomId]);

  // ─── Cleanup media ─────────────────────────────────────────────────────
  const cleanupMedia = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
  }, [localStream]);

  const endCall = useCallback((notifyOther = true) => {
    if (notifyOther && otherId && roomId) {
      socketService.emit('call:end', { to: otherId, roomId, chatId, duration: callSeconds });
    }
    if (roomId) {
      socketService.emit('video:leave', { roomId });
    }
    if (appointmentId) videoApi.endMeeting(appointmentId).catch(() => {});
    cleanupMedia();
    stopTimer();
    setCallState('ended');
    setTimeout(() => navigation.goBack(), 900);
  }, [otherId, roomId, appointmentId, cleanupMedia, navigation, chatId, callSeconds]);

  // ─── Toggle mute ────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // ─── Toggle camera ──────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    if (localStream && isVideoCall) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  }, [localStream, isVideoCall]);

  // ─── Flip camera ────────────────────────────────────────────────────────
  const flipCamera = useCallback(() => {
    if (localStream && isVideoCall) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        (videoTrack as any)._switchCamera();
        setIsFrontCamera((prev) => !prev);
      }
    }
  }, [localStream, isVideoCall]);

  // ─── Toggle speaker ─────────────────────────────────────────────────────
  const toggleSpeaker = useCallback(() => {
    // Toggle the flag; react-native-webrtc uses default speaker for video calls
    setIsSpeakerOn((prev) => !prev);
  }, []);

  // ─── Setup WebRTC ───────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      // Fetch dynamic ICE servers
      try {
        const { data } = await videoApi.getIceServers();
        if (data?.iceServers) {
          ICE_SERVERS.iceServers = data.iceServers;
        }
      } catch {}

      const stream = await getLocalStream();
      if (!stream || !mounted) return;

      const pc = createPeerConnection(stream);

      // Join the signaling room
      socketService.emit('video:join', { roomId });

      // If outgoing call, wait for remote user to join, then send offer
      // If incoming call, wait for the offer from caller
    };

    setup();

    // Socket event: remote user joined the video room
    const unsubUserJoined = socketService.on('video:user-joined', (data: unknown) => {
      const { socketId } = data as { userId: string; socketId: string };
      remoteSocketIdRef.current = socketId;
      // The person who joined later (or the caller) creates the offer
      if (isOutgoing && pcRef.current) {
        createOffer(pcRef.current, socketId);
      }
    });

    // Socket event: received an offer
    const unsubOffer = socketService.on('video:offer', (data: unknown) => {
      const { offer, from } = data as { offer: any; from: string; userId: string };
      if (pcRef.current) {
        handleOffer(pcRef.current, offer, from);
      }
    });

    // Socket event: received an answer
    const unsubAnswer = socketService.on('video:answer', (data: unknown) => {
      const { answer } = data as { answer: any; from: string };
      if (pcRef.current) {
        pcRef.current.setRemoteDescription(new RTCSessionDescription(answer)).then(() => {
          // Apply buffered ICE candidates
          for (const candidate of iceCandidatesBuffer.current) {
            pcRef.current?.addIceCandidate(candidate);
          }
          iceCandidatesBuffer.current = [];
        });
      }
    });

    // Socket event: received an ICE candidate
    const unsubICE = socketService.on('video:ice-candidate', (data: unknown) => {
      const { candidate } = data as { candidate: any };
      const iceCandidate = new RTCIceCandidate(candidate);
      if (pcRef.current?.remoteDescription) {
        pcRef.current.addIceCandidate(iceCandidate);
      } else {
        iceCandidatesBuffer.current.push(iceCandidate);
      }
    });

    // Socket event: remote user left
    const unsubUserLeft = socketService.on('video:user-left', () => {
      if (mounted) endCall(false);
    });

    // Call signaling events
    const unsubAccepted = socketService.on('call:accepted', () => {
      setCallState('connected');
    });
    const unsubEnded = socketService.on('call:ended', () => {
      if (mounted) endCall(false);
    });

    return () => {
      mounted = false;
      unsubUserJoined();
      unsubOffer();
      unsubAnswer();
      unsubICE();
      unsubUserLeft();
      unsubAccepted();
      unsubEnded();
      stopTimer();
      // Cleanup on unmount
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (roomId) {
        socketService.emit('video:leave', { roomId });
      }
    };
  }, []);

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
      ? 'Calling…'
      : 'Connecting…';

  // ─── Gradient colours per call type ────────────────────────────────────────
  const bgColors: [string, string, string] = isVideoCall
    ? ['#080808', '#111', '#080808']
    : ['#0b141a', '#1c2f3a', '#0b141a'];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={bgColors} locations={[0, 0.5, 1]} style={s.container}>

        {/* ─── Remote video (full screen background) ──────────────────── */}
        {isVideoCall && remoteStream && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={s.remoteVideo}
            objectFit="cover"
          />
        )}

        {/* ─── Local video (picture-in-picture) ──────────────────────── */}
        {isVideoCall && localStream && !isCameraOff && (
          <View style={s.localVideoContainer}>
            <RTCView
              streamURL={localStream.toURL()}
              style={s.localVideo}
              objectFit="cover"
              mirror={isFrontCamera}
            />
          </View>
        )}

        {/* ─── Top bar ─────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.iconBtn} onPress={() => endCall()}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={s.topCenter}>
            <Text style={s.topName} numberOfLines={1}>{displayName}</Text>
            <View style={s.encRow}>
              <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.55)" />
              <Text style={s.encText}>End-to-end encrypted</Text>
            </View>
          </View>
          {/* Flip camera button for video calls */}
          {isVideoCall ? (
            <TouchableOpacity style={s.iconBtn} onPress={flipCamera}>
              <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={s.iconBtn} />
          )}
        </View>

        {/* ─── Avatar + status (shown when no remote video) ──────────── */}
        {(!isVideoCall || !remoteStream) && (
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

        {/* Status overlay for video call when connected */}
        {isVideoCall && remoteStream && (
          <View style={s.videoStatusOverlay}>
            <Text style={s.videoStatusText}>{statusText}</Text>
          </View>
        )}

        {/* ─── Bottom action bar ──────────────────────────────────────── */}
        <View style={s.bottomBar}>
          <ActionBtn
            icon={isVideoCall ? (isCameraOff ? 'videocam-off' : 'videocam') : 'volume-medium-outline'}
            label={isVideoCall ? 'Camera' : 'Speaker'}
            onPress={isVideoCall ? toggleCamera : toggleSpeaker}
            active={isVideoCall ? isCameraOff : isSpeakerOn}
          />
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
  // Remote video: full-screen background
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  // Local video PiP
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
  localVideo: {
    flex: 1,
  },
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
  encRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  encText: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
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
  videoStatusOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 96,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  videoStatusText: { color: '#fff', fontSize: 16, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
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
});

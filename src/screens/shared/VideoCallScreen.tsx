import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Linking,
} from 'react-native';
import { RTCPeerConnection, mediaDevices } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { videoApi, appointmentsApi } from '../../services/api';
import { WebView } from 'react-native-webview';

export const VideoCallScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { appointmentId } = route.params;
  const [loading, setLoading] = useState(true);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const socketService = require('../../services/socket').socketService;
  const [peerConnection, setPeerConnection] = useState<any>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [audioCallActive, setAudioCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    initMeeting();
  }, []);

  // WebRTC signaling logic
  useEffect(() => {
    if (!roomId) return;
    socketService.connect();
    socketService.emit('video:join', { roomId });

    // Setup audio-only peer connection
    const pc = new RTCPeerConnection({ iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ] });
    setPeerConnection(pc);

    mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        setLocalStream(stream);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        setAudioCallActive(true);
      })
      .catch(err => {
        setError('Microphone permission denied or unavailable.');
        setLoading(false);
      });

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    // Signaling event handlers
    const unsubOffer = socketService.on('video:offer', async (payload: any) => {
      await pc.setRemoteDescription(payload.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketService.emit('video:answer', { roomId, answer });
    });
    const unsubAnswer = socketService.on('video:answer', async (payload: any) => {
      await pc.setRemoteDescription(payload.answer);
    });
    const unsubIce = socketService.on('video:ice-candidate', async (payload: any) => {
      await pc.addIceCandidate(payload.candidate);
    });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.emit('video:ice-candidate', { roomId, candidate: event.candidate });
      }
    };

    // To start call: create offer, set local desc, emit offer
    const startCall = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketService.emit('video:offer', { roomId, offer });
    };
    startCall();

    return () => {
      unsubOffer();
      unsubAnswer();
      unsubIce();
      socketService.disconnect();
      if (localStream) {
        localStream.getTracks().forEach((track: any) => track.stop());
      }
      if (peerConnection) peerConnection.close();
      setAudioCallActive(false);
      setLocalStream(null);
      setRemoteStream(null);
      setIsMuted(false);
    };
  }, [roomId]);

  const initMeeting = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to get existing meeting first
      let url: string | null = null;
      let room: string | null = null;
      try {
        const { data } = await videoApi.getMeeting(appointmentId);
        url = data?.meetingUrl || data?.url || data?.meeting?.url || null;
        room = data?.roomId || null;
      } catch {
        // No existing meeting, create one
      }

      if (!url) {
        const { data } = await videoApi.createMeeting({ appointmentId, meetingType: 'video' });
        url = data?.meetingUrl || data?.url || data?.meeting?.url || null;
        room = data?.roomId || null;
      }

      if (url) {
        setMeetingUrl(url);
        setRoomId(room);
      } else {
        setError('Could not get meeting link from server');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to start video call';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExternal = () => {
    if (meetingUrl) {
      Linking.openURL(meetingUrl).catch(() =>
        Alert.alert('Error', 'Could not open meeting link')
      );
    }
  };

  const handleEndCall = async () => {
    Alert.alert('End Call', 'Are you sure you want to end the video call?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            await videoApi.endMeeting(appointmentId);
          } catch { /* ignore */ }
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Setting up audio call...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="mic-off" size={64} color={COLORS.error} />
        <Text style={styles.errorTitle}>Could not start audio call</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={initMeeting}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // If it's a Google Meet or external URL, show options to open externally or in WebView
  // Audio call UI
  if (audioCallActive) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Audio Call</Text>
        </View>
        <View style={styles.audioCallBody}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={64} color={COLORS.primary} />
          <Text style={styles.audioStatus}>Audio call is active</Text>
          <TouchableOpacity
            style={[styles.muteBtn, isMuted && { backgroundColor: COLORS.error }]}
            onPress={() => {
              if (localStream) {
                localStream.getAudioTracks().forEach((track: any) => {
                  track.enabled = !isMuted;
                });
                setIsMuted(!isMuted);
              }
            }}
          >
            <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color={COLORS.white} />
            <Text style={styles.muteBtnText}>{isMuted ? "Unmute" : "Mute"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.endBtn} onPress={handleEndCall}>
            <Ionicons name="call" size={28} color={COLORS.error} />
            <Text style={styles.endBtnText}>End Call</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Fallback UI
  return (
    <View style={styles.centerContainer}>
      <Text>No active audio call</Text>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
    muteBtn: {
      flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
      backgroundColor: COLORS.primary, paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.xxxl, borderRadius: BORDER_RADIUS.full,
      marginTop: SPACING.lg,
    },
    muteBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.md },
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: {
    flex: 1, backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl,
  },
  loadingText: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.lg,
  },
  errorTitle: {
    fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text, marginTop: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.sm,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SPACING.xxl, backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.full,
  },
  retryText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.md },
  backBtn: {
    marginTop: SPACING.md, paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
  },
  backText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: FONT_SIZE.md },
  meetTitle: {
    fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.text, marginTop: SPACING.xl,
  },
  meetSubtitle: {
    fontSize: FONT_SIZE.md, color: COLORS.textSecondary, marginTop: SPACING.sm,
  },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.primary, paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl, borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.xxl,
  },
  joinBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.lg },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    borderWidth: 1.5, borderColor: COLORS.error,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.full, marginTop: SPACING.lg,
  },
  endBtnText: { color: COLORS.error, fontWeight: '700', fontSize: FONT_SIZE.md },
  backLink: { marginTop: SPACING.xl },
  backLinkText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111', paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge, paddingBottom: SPACING.md,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: COLORS.white, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  webview: { flex: 1 },
  controls: {
    flexDirection: 'row', justifyContent: 'center',
    paddingVertical: SPACING.xl, paddingBottom: SPACING.xxxl,
    backgroundColor: '#111',
  },
  controlBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
  },
});

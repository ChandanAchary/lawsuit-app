import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING } from '../../constants';
import { videoApi } from '../../services/api';

export const VideoCallScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { appointmentId } = route.params;
  const [loading, setLoading] = useState(true);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    void initMeeting();
  }, []);

  const initMeeting = async () => {
    setLoading(true);
    setError(null);
    try {
      let url: string | null = null;

      try {
        const { data } = await videoApi.getMeeting(appointmentId);
        url = data?.meetingUrl || data?.url || data?.meeting?.url || null;
      } catch {
        // If no meeting exists yet, create one.
      }

      if (!url) {
        const { data } = await videoApi.createMeeting({ appointmentId, meetingType: 'audio' });
        url = data?.meetingUrl || data?.url || data?.meeting?.url || null;
      }

      if (!url) {
        setError('Could not get call link from server');
        return;
      }

      setMeetingUrl(url);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Failed to start audio call';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCall = async () => {
    if (!meetingUrl) return;
    try {
      await Linking.openURL(meetingUrl);
    } catch {
      Alert.alert('Error', 'Could not open call link');
    }
  };

  const handleEndCall = async () => {
    Alert.alert('End Call', 'Are you sure you want to end the audio call?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            await videoApi.endMeeting(appointmentId);
          } catch {
            // Ignore end errors and return.
          }
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
        <TouchableOpacity style={styles.retryBtn} onPress={() => void initMeeting()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audio Call</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.audioCallBody}>
        <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={64} color={COLORS.primary} />
        <Text style={styles.audioStatus}>Audio call is ready</Text>
        <Text style={styles.hintText}>Tap Join to open the call provider link.</Text>

        <TouchableOpacity style={styles.joinBtn} onPress={() => void handleJoinCall()}>
          <Ionicons name="call" size={20} color={COLORS.white} />
          <Text style={styles.joinBtnText}>Join Audio Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.muteBtn, isMuted && styles.muteBtnActive]}
          onPress={() => setIsMuted((prev) => !prev)}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={20} color={COLORS.white} />
          <Text style={styles.muteBtnText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.endBtn} onPress={() => void handleEndCall()}>
          <Ionicons name="call" size={20} color={COLORS.error} />
          <Text style={styles.endBtnText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl,
  },
  loadingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
  },
  errorTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SPACING.xxl,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.full,
  },
  retryText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.md },
  backBtn: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
  },
  backText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: FONT_SIZE.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge,
    paddingBottom: SPACING.md,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: COLORS.white, fontSize: FONT_SIZE.lg, fontWeight: '700' },
  audioCallBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  audioStatus: {
    color: COLORS.white,
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    marginTop: SPACING.lg,
  },
  hintText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.md,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.xxl,
  },
  joinBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.lg },
  muteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.lg,
  },
  muteBtnActive: {
    backgroundColor: COLORS.error,
  },
  muteBtnText: { color: COLORS.white, fontWeight: '700', fontSize: FONT_SIZE.md },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.error,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.lg,
  },
  endBtnText: { color: COLORS.error, fontWeight: '700', fontSize: FONT_SIZE.md },
});

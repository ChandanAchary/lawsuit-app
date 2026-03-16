import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Image, Alert, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { ChatTab } from '../../components/ChatTab';
import { chatApi } from '../../services/api';
import { socketService } from '../../services/socket';
import { ChatParticipant } from '../../types';
import { useAuthStore } from '../../stores/authStore';

export const ChatScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const { chatId: initialChatId, otherUserId, caseId, name, otherUser, appointmentId } = route.params || {};
  const [chatId, setChatId] = useState<string | null>(initialChatId || null);
  const [loading, setLoading] = useState(!initialChatId);
  const [error, setError] = useState('');
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const currentUser = useAuthStore((s: any) => s.user);

  // Determine the other participant's display info
  const other: ChatParticipant | null = otherUser || null;
  const displayName = other?.name || name || 'Chat';
  const displayAvatar = other?.avatarUrl || other?.avatar || null;
  const otherId = other?.id || otherUserId;

  const generateRoomId = () => `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const initiateCall = (callType: 'audio' | 'video') => {
    if (!otherId) return Alert.alert('Error', 'Cannot determine call recipient');
    if (!chatId) return Alert.alert('Please wait', 'Chat is still loading. Try the call again in a moment.');
    const roomId = generateRoomId();
    socketService.emit('call:initiate', { to: otherId, callType, roomId, chatId });
    navigation.navigate('VideoCall', { roomId, callType, otherUser: other, isOutgoing: true, chatId });
  };

  useEffect(() => {
    const init = async () => {
      try {
        let resolvedChatId = chatId;
        if (!resolvedChatId && appointmentId) {
          const { data } = await chatApi.getOrCreateAppointmentChat(appointmentId);
          resolvedChatId = data.chat?.id || data.id;
          setChatId(resolvedChatId);
        } else if (!resolvedChatId && otherUserId) {
          const { data } = await chatApi.createChat(otherUserId, caseId);
          resolvedChatId = data.chat?.id || data.id;
          setChatId(resolvedChatId);
        }
        if (resolvedChatId) {
          // Load participants
          const { data } = await chatApi.getParticipants(resolvedChatId);
          const list: ChatParticipant[] = data.participants || data || [];
          setParticipants(list);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load chat');
      } finally {
        setLoading(false);
      }
    };
    init();

    // Online presence
    const unsubOnline = socketService.on('user:online', (data: unknown) => {
      const { userId } = data as { userId: string };
      if (userId === otherId) setIsOnline(true);
    });
    const unsubOffline = socketService.on('user:offline', (data: unknown) => {
      const { userId } = data as { userId: string };
      if (userId === otherId) setIsOnline(false);
    });

    return () => { unsubOnline(); unsubOffline(); };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.avatarWrapper}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPH]}>
              <Ionicons name="person" size={18} color={COLORS.textMuted} />
            </View>
          )}
          {isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.nameBlock}>
          <Text style={styles.title} numberOfLines={1}>{displayName}</Text>
          {isOnline && <Text style={styles.onlineLabel}>Online</Text>}
        </View>
        <View style={styles.callButtons}>
          <TouchableOpacity style={styles.callBtn} onPress={() => initiateCall('video')}>
            <Ionicons name="videocam-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.callBtn} onPress={() => initiateCall('audio')}>
            <Ionicons name="call-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
      ) : chatId ? (
        <ChatTab chatId={chatId} participants={participants} />
      ) : (
        <View style={styles.center}><Text style={styles.errorText}>Unable to start chat</Text></View>
      )}
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingTop: SPACING.huge, paddingBottom: SPACING.md, paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.white, ...SHADOWS.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarWrapper: { position: 'relative' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.success, borderWidth: 2, borderColor: COLORS.white,
  },
  nameBlock: { flex: 1 },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  onlineLabel: { fontSize: FONT_SIZE.xs, color: COLORS.success, fontWeight: '600' },
  callButtons: { flexDirection: 'row', gap: SPACING.sm },
  callBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },
});

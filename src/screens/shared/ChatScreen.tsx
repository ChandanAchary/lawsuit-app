import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Image, Alert, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { ChatTab } from '../../components/ChatTab';
import { chatApi } from '../../services/api';
import { socketService } from '../../services/socket';
import { ChatParticipant } from '../../types';
import { useAuthStore } from '../../stores/authStore';

const normalizeChats = (payload: any): any[] => payload?.chats || payload?.items || payload || [];

const extractChatSortTime = (chat: any): number => {
  const raw = chat?.lastMessage?.createdAt || chat?.lastMessageAt || chat?.updatedAt || chat?.createdAt;
  const ts = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
};

const hasMessages = (chat: any): boolean => {
  const text = String(chat?.lastMessage?.text || chat?.lastMessageText || '').trim();
  return text.length > 0;
};

const getParticipantId = (p: any): string => String(p?.id || p?.userId || p?.user?.id || '').trim();
const getParticipantName = (p: any): string => String(p?.name || p?.user?.name || '').trim();
const getParticipantAvatar = (p: any): string =>
  String(p?.avatarUrl || p?.avatar || p?.user?.avatarUrl || p?.user?.avatar || '').trim();

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

  const other: ChatParticipant | null = otherUser || null;
  const conversationOther = useMemo(() => {
    const meId = String(currentUser?.id || '').trim();
    return participants.find((p: any) => {
      const pid = getParticipantId(p);
      if (!pid) return false;
      if (otherUserId && pid === String(otherUserId)) return true;
      return meId ? pid !== meId : true;
    }) || null;
  }, [participants, currentUser?.id, otherUserId]);

  const displayName = getParticipantName(conversationOther) || other?.name || name || 'Chat';
  const displayAvatar = getParticipantAvatar(conversationOther) || other?.avatarUrl || other?.avatar || null;
  const otherId = getParticipantId(conversationOther) || String(other?.id || otherUserId || '').trim();

  const generateRoomId = () => `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const resolveExistingChatId = async (): Promise<string | null> => {
    if (!otherUserId) return null;

    try {
      const { data } = await chatApi.getChats();
      const chats = normalizeChats(data);
      const matches = chats.filter((chat: any) => {
        const participants = chat?.participants || [];
        return participants.some(
          (p: any) => p?.id === otherUserId || p?.userId === otherUserId || p?.user?.id === otherUserId,
        );
      });

      if (!matches.length) return null;

      const caseScoped = caseId ? matches.filter((chat: any) => chat?.caseId === caseId) : [];
      const pool = caseScoped.length ? caseScoped : matches;

      const sorted = pool.slice().sort((a: any, b: any) => extractChatSortTime(b) - extractChatSortTime(a));
      const preferred = sorted.find((chat: any) => hasMessages(chat)) || sorted[0];
      const id = String(preferred?.id || '').trim();
      return id || null;
    } catch {
      return null;
    }
  };

  const initiateCall = (callType: 'audio' | 'video') => {
    if (!otherId) return Alert.alert('Error', 'Cannot determine call recipient');
    if (!chatId) return Alert.alert('Please wait', 'Chat is still loading. Try the call again in a moment.');
    const roomId = generateRoomId();
    socketService.emit('call:initiate', { to: otherId, callType, roomId, chatId });
    navigation.navigate('VideoCall', {
      roomId,
      callType,
      otherUser: {
        id: otherId,
        name: displayName,
        avatarUrl: displayAvatar || undefined,
      },
      isOutgoing: true,
      chatId,
    });
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setError('');
      setParticipants([]);
      setLoading(!initialChatId);

      try {
        let resolvedChatId: string | null = initialChatId || null;
        if (!resolvedChatId) {
          resolvedChatId = await resolveExistingChatId();
        }

        if (!resolvedChatId && appointmentId) {
          const { data } = await chatApi.getOrCreateAppointmentChat(appointmentId);
          resolvedChatId = data.chat?.id || data.id;
        }

        if (!resolvedChatId && otherUserId) {
          const { data } = await chatApi.createChat(otherUserId, caseId);
          resolvedChatId = data.chat?.id || data.id;
        }

        if (!isMounted) return;

        setChatId(resolvedChatId);
        if (resolvedChatId) {
          // Load participants for the resolved thread every time route params change.
          const { data } = await chatApi.getParticipants(resolvedChatId);
          if (!isMounted) return;
          const list: ChatParticipant[] = data.participants || data || [];
          setParticipants(list);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.response?.data?.error || 'Failed to load chat');
      } finally {
        if (isMounted) setLoading(false);
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

    return () => {
      isMounted = false;
      unsubOnline();
      unsubOffline();
    };
  }, [initialChatId, otherUserId, caseId, appointmentId, otherId]);

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

      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : error ? (
          <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
        ) : chatId ? (
          <ChatTab chatId={chatId} participants={participants} />
        ) : (
          <View style={styles.center}><Text style={styles.errorText}>Unable to start chat</Text></View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  chatBody: { flex: 1 },
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

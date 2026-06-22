import { useThemeStore, useColors } from '../../stores/themeStore';
import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Image, Alert, StatusBar, KeyboardAvoidingView, Platform, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { ChatTab } from '../../components/ChatTab';
import { chatApi } from '../../services/api';
import { socketService } from '../../services/socket';
import { ChatParticipant } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useActiveCallStore } from '../../stores/activeCallStore';

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
  const [showInfo, setShowInfo] = useState(false);
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

  // Pull the global active-call (if any). The user can minimize the
  // VideoCallScreen back to the chat without ending the call — when they
  // do, this store still holds the room+token, so we render a sticky
  // "Tap to return to call" banner below the header.
  const activeCall = useActiveCallStore((s) => s.call);
  const hasActiveCallForThisChat = !!(
    activeCall && (
      // Match by chatId when the active call is chat-scoped...
      (chatId && activeCall.chatId && activeCall.chatId === chatId) ||
      // ...otherwise fall back to "same peer" so a call started from an
      // appointment / case context still resumes correctly.
      (activeCall.otherUser?.id && activeCall.otherUser.id === otherId)
    )
  );

  const resumeActiveCall = () => {
    if (!activeCall) return;
    navigation.navigate('VideoCall', {
      callId: activeCall.callId,
      roomUrl: activeCall.roomUrl,
      token: activeCall.token,
      mediaType: activeCall.mediaType,
      callType: activeCall.mediaType,
      otherUser: activeCall.otherUser,
      // Resuming is always "incoming" from VideoCallScreen's POV — we
      // already have roomUrl+token, so it should NOT re-emit `call:initiate`.
      isOutgoing: false,
      chatId: activeCall.chatId,
      appointmentId: activeCall.appointmentId,
    });
  };

  // Just navigate to the call screen with the recipient + media type. The
  // VideoCallScreen owns the `call:initiate` emit + listens for the server's
  // `call:initiated` ack (which carries the Daily room URL + meeting token).
  // The old contract ("client invents a roomId and emits it straight to the
  // peer") never matched the server, which is why chat calls always failed.
  const initiateCall = (mediaType: 'audio' | 'video') => {
    if (!otherId) return Alert.alert('Error', 'Cannot determine call recipient');
    if (!chatId) return Alert.alert('Please wait', 'Chat is still loading. Try the call again in a moment.');
    navigation.navigate('VideoCall', {
      mediaType,
      callType: mediaType, // legacy alias still read by older copies
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
        {/* Tapping the avatar/name pair opens the participants sheet —
            the standard messaging-app affordance for "chat info". */}
        <TouchableOpacity
          style={styles.avatarWrapper}
          activeOpacity={0.8}
          onPress={() => setShowInfo(true)}
        >
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPH]}>
              <Ionicons name="person" size={18} color={COLORS.textMuted} />
            </View>
          )}
          {isOnline && <View style={styles.onlineDot} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.nameBlock}
          activeOpacity={0.8}
          onPress={() => setShowInfo(true)}
        >
          <Text style={styles.title} numberOfLines={1}>{displayName}</Text>
          {isOnline && <Text style={styles.onlineLabel}>Online</Text>}
        </TouchableOpacity>
        <View style={styles.callButtons}>
          <TouchableOpacity style={styles.callBtn} onPress={() => initiateCall('video')}>
            <Ionicons name="videocam-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.callBtn} onPress={() => initiateCall('audio')}>
            <Ionicons name="call-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sticky resume-call banner. Renders only when there's an active
          call in the global store AND it belongs to the chat we're looking
          at. Tapping the banner re-opens VideoCallScreen with the same
          roomUrl/token — Daily simply rejoins the existing room. */}
      {hasActiveCallForThisChat && activeCall && (
        <TouchableOpacity
          style={styles.resumeCallBar}
          onPress={resumeActiveCall}
          activeOpacity={0.85}
        >
          <View style={styles.resumeCallIcon}>
            <Ionicons
              name={activeCall.mediaType === 'audio' ? 'call' : 'videocam'}
              size={16}
              color={COLORS.white}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.resumeCallTitle} numberOfLines={1}>
              In a {activeCall.mediaType === 'audio' ? 'voice' : 'video'} call
              {activeCall.otherUser?.name ? ` with ${activeCall.otherUser.name}` : ''}
            </Text>
            <Text style={styles.resumeCallSub} numberOfLines={1}>
              Tap to return to call
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>
      )}

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

      {/* Participants sheet — opened from the header. Shows everyone in the
          chat thread (case-bound chats include both the client and the
          assigned lawyer). Read-only for now; no admin-style add/remove yet. */}
      <Modal visible={showInfo} transparent animationType="slide" onRequestClose={() => setShowInfo(false)}>
        <View style={styles.infoOverlay}>
          <View style={styles.infoSheet}>
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>Chat Info</Text>
              <TouchableOpacity onPress={() => setShowInfo(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.infoBody}>
              <Text style={styles.infoSectionLabel}>
                {participants.length} participant{participants.length === 1 ? '' : 's'}
              </Text>
              {participants.length === 0 ? (
                <Text style={styles.infoEmpty}>No participants found.</Text>
              ) : (
                participants.map((p: any) => {
                  const pid = getParticipantId(p);
                  const pname = getParticipantName(p) || 'Unknown';
                  const pavatar = getParticipantAvatar(p);
                  const isMe = currentUser?.id && pid === currentUser.id;
                  return (
                    <View key={pid} style={styles.infoRow}>
                      {pavatar ? (
                        <Image source={{ uri: pavatar }} style={styles.infoAvatar} />
                      ) : (
                        <View style={[styles.infoAvatar, styles.infoAvatarPH]}>
                          <Ionicons name="person" size={18} color={COLORS.textMuted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoName}>{pname}{isMe ? ' (you)' : ''}</Text>
                        {!!(p as any)?.email && <Text style={styles.infoSub}>{(p as any).email}</Text>}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  // Sticky banner shown when there's a minimized in-progress call on this
  // chat. Green = "active call you can return to". Style intentionally
  // borrows from WhatsApp / Signal so users recognise the pattern.
  resumeCallBar: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.success,
  },
  resumeCallIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  resumeCallTitle: { color: COLORS.white, fontSize: FONT_SIZE.sm, fontWeight: '800' },
  resumeCallSub: { color: 'rgba(255,255,255,0.85)', fontSize: FONT_SIZE.xs, marginTop: 2, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { fontSize: FONT_SIZE.md, color: COLORS.textSecondary, textAlign: 'center' },

  infoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  infoSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xxl, borderTopRightRadius: BORDER_RADIUS.xxl,
    maxHeight: '70%', paddingBottom: SPACING.xxl,
  },
  infoHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  infoTitle: { fontSize: FONT_SIZE.xl, fontWeight: '800', color: COLORS.text },
  infoBody: { padding: SPACING.xl },
  infoSectionLabel: {
    fontSize: FONT_SIZE.xs, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 1, marginBottom: SPACING.md,
  },
  infoEmpty: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, fontStyle: 'italic' },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  infoAvatar: { width: 42, height: 42, borderRadius: 21 },
  infoAvatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  infoName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text },
  infoSub: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: 2 },
});

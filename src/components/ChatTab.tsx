import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../constants';
import { ChatMessage, ChatParticipant } from '../types';
import { chatApi } from '../services/api';
import { socketService } from '../services/socket';
import { useAuthStore } from '../stores/authStore';
import { formatTime } from '../utils/date';

interface ChatTabProps {
  chatId: string;
  /** Pre-loaded participants — used for avatar in message rows */
  participants?: ChatParticipant[];
}

export const ChatTab: React.FC<ChatTabProps> = ({ chatId, participants = [] }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUser = useAuthStore((s: any) => s.user);

  const participantMap = React.useMemo(() => {
    const m = new Map<string, ChatParticipant>();
    participants.forEach((p) => m.set(p.id, p));
    return m;
  }, [participants]);

  const fetchMessages = useCallback(async (pg = 1, prepend = false) => {
    try {
      const { data } = await chatApi.getMessages(chatId, { page: pg, limit: 30 });
      const items: ChatMessage[] = (data.messages || data.items || []).reverse();
      const total: number = data.total ?? items.length;
      if (prepend) {
        setMessages((prev) => [...items, ...prev]);
      } else {
        setMessages(items);
      }
      setHasMore(pg * 30 < total);
    } catch { } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [chatId]);

  useEffect(() => {
    fetchMessages(1);
    socketService.joinChat(chatId);

    // New message
    const unsubMsg = socketService.on('chat:message:new', (data: unknown) => {
      const { message } = data as { message: ChatMessage };
      if (!message || message.chatId !== chatId) return;
      setMessages((prev) => {
        // Replace optimistic if same text + sender
        const optIdx = prev.findIndex((m) => m.id.startsWith('temp-') && m.senderId === message.senderId && m.text === message.text);
        if (optIdx !== -1) {
          const next = [...prev];
          next[optIdx] = message;
          return next;
        }
        return [...prev, message];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      // Emit delivered first, then read (so sender sees ✓✓ then eye)
      if (message.senderId !== currentUser?.id) {
        socketService.markDelivered(chatId, message.id);
        socketService.markRead(chatId, message.id);
      }
    });

    // Typing indicators
    const unsubTypingStart = socketService.on('chat:typing:start', (data: unknown) => {
      const { user } = data as { user: { id: string; name: string } };
      if (!user || user.id === currentUser?.id) return;
      setTypingUsers((prev) => prev.includes(user.id) ? prev : [...prev, user.id]);
    });

    const unsubTypingStop = socketService.on('chat:typing:stop', (data: unknown) => {
      const { user } = data as { user: { id: string } };
      if (!user) return;
      setTypingUsers((prev) => prev.filter((id) => id !== user.id));
    });

    // Read receipt
    const unsubRead = socketService.on('chat:message:read', (data: unknown) => {
      const { messageId } = data as { messageId: string };
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, isRead: true, isDelivered: true } : m));
    });

    // Delivered receipt
    const unsubDelivered = socketService.on('chat:message:delivered', (data: unknown) => {
      const { messageId } = data as { messageId: string };
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, isDelivered: true } : m));
    });

    return () => {
      unsubMsg();
      unsubTypingStart();
      unsubTypingStop();
      unsubRead();
      unsubDelivered();
    };
  }, [chatId, fetchMessages, currentUser?.id]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchMessages(nextPage, true);
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (val.trim()) {
      socketService.startTyping(chatId);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => socketService.stopTyping(chatId), 2000);
    } else {
      socketService.stopTyping(chatId);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    socketService.stopTyping(chatId);

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      chatId,
      senderId: currentUser?.id || '',
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      // Use REST API as primary — socket emit via server is the reliable path
      const { data } = await chatApi.sendMessage(chatId, { text: trimmed });
      const serverMsg: ChatMessage = data.message || data;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === optimistic.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = serverMsg;
          return next;
        }
        return prev;
      });
    } catch {
      // rollback optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const getParticipantAvatar = (senderId: string) => {
    const p = participantMap.get(senderId);
    return p?.avatarUrl || p?.avatar || null;
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMine = item.senderId === currentUser?.id;

    // ─── Call history message ───────────────────────────────────────
    if (item.messageType === 'CALL') {
      const meta = (item as any).metadata || {};
      const callType = meta.callType || 'audio';
      const duration = meta.duration || 0;
      const missed = meta.missed || false;
      const isOutgoing = isMine;
      const durationStr = duration > 0
        ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`
        : null;
      const iconName = callType === 'video' ? 'videocam' : 'call';
      const arrowIcon = missed ? 'arrow-down-outline' : isOutgoing ? 'arrow-up-outline' : 'arrow-down-outline';
      const arrowColor = missed ? '#e4091d' : '#4CAF50';

      return (
        <View style={styles.callLogRow}>
          <View style={styles.callLogBubble}>
            <View style={styles.callLogIconWrap}>
              <Ionicons name={iconName as any} size={18} color={COLORS.primary} />
            </View>
            <View style={styles.callLogInfo}>
              <View style={styles.callLogTop}>
                <Ionicons name={arrowIcon as any} size={14} color={arrowColor} />
                <Text style={styles.callLogLabel}>
                  {missed ? 'Missed' : isOutgoing ? 'Outgoing' : 'Incoming'}{' '}
                  {callType === 'video' ? 'video' : 'voice'} call
                </Text>
              </View>
              <Text style={styles.callLogTime}>
                {durationStr ? durationStr + ' • ' : ''}{formatTime(item.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    // ─── Regular text message ───────────────────────────────────────
    const isTemp = item.id.startsWith('temp-');
    const prevMsg = messages[index - 1];
    const showAvatar = !isMine && (!prevMsg || prevMsg.senderId !== item.senderId);
    const avatarUri = !isMine ? getParticipantAvatar(item.senderId) : null;

    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isMine && (
          <View style={styles.avatarSlot}>
            {showAvatar ? (
              avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.msgAvatar} />
              ) : (
                <View style={[styles.msgAvatar, styles.msgAvatarPH]}>
                  <Ionicons name="person" size={14} color={COLORS.textMuted} />
                </View>
              )
            ) : null}
          </View>
        )}
        <View style={[styles.msgBubble, isMine ? styles.myBubble : styles.otherBubble, isTemp && styles.tempBubble]}>
          <Text style={[styles.msgText, isMine ? styles.myText : styles.otherText]}>{item.text}</Text>
          <View style={styles.msgMeta}>
            <Text style={[styles.msgTime, isMine ? styles.myTime : styles.otherTime]}>
              {formatTime(item.createdAt)}
            </Text>
            {isMine && (
              item.isRead ? (
                <Ionicons name="eye" size={14} color="#7ee8f5" style={{ marginLeft: 4 }} />
              ) : isTemp ? (
                <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.55)" style={{ marginLeft: 4 }} />
              ) : item.isDelivered ? (
                <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.75)" style={{ marginLeft: 4 }} />
              ) : (
                <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.55)" style={{ marginLeft: 4 }} />
              )
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      {loadingMore && (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onEndReached={loadMore}
        onEndReachedThreshold={0.15}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>No messages yet. Start the conversation!</Text>
          </View>
        }
      />

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <View style={styles.typingRow}>
          <View style={styles.typingBubble}>
            <View style={styles.typingDots}>
              <View style={[styles.dot, styles.dot1]} />
              <View style={[styles.dot, styles.dot2]} />
              <View style={[styles.dot, styles.dot3]} />
            </View>
          </View>
          <Text style={styles.typingText}>typing…</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.chatInput}
          value={text}
          onChangeText={handleTextChange}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="send" size={18} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingMore: { alignItems: 'center', paddingVertical: SPACING.sm },
  messageList: { padding: SPACING.lg, paddingBottom: SPACING.sm },
  msgRow: { marginBottom: SPACING.sm, flexDirection: 'row', alignItems: 'flex-end' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  avatarSlot: { width: 30, marginRight: SPACING.xs, alignSelf: 'flex-end' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  msgBubble: {
    maxWidth: '75%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  myBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
    ...SHADOWS.sm,
  },
  otherBubble: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    ...SHADOWS.sm,
  },
  tempBubble: { opacity: 0.75 },
  msgText: { fontSize: FONT_SIZE.md, lineHeight: 20 },
  myText: { color: COLORS.white },
  otherText: { color: COLORS.text },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  msgTime: { fontSize: 10 },
  myTime: { color: 'rgba(255,255,255,0.55)' },
  otherTime: { color: COLORS.textMuted },
  // Typing indicator
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xs, gap: SPACING.xs },
  typingBubble: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, ...SHADOWS.sm },
  typingDots: { flexDirection: 'row', gap: 4, alignItems: 'center', height: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.textMuted },
  dot1: {}, dot2: {}, dot3: {},
  typingText: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontStyle: 'italic' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    gap: SPACING.sm,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZE.md,
    maxHeight: 100,
    color: COLORS.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  emptyChat: { alignItems: 'center', paddingVertical: SPACING.huge },
  emptyChatText: { color: COLORS.textMuted, fontSize: FONT_SIZE.md },
  // Call log styles
  callLogRow: { alignItems: 'center', marginVertical: SPACING.sm },
  callLogBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  callLogIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callLogInfo: { gap: 2 },
  callLogTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  callLogLabel: { fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600' },
  callLogTime: { fontSize: 10, color: COLORS.textMuted },
});

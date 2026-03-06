import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../constants';
import { ChatMessage } from '../types';
import { chatApi } from '../services/api';
import { socketService } from '../services/socket';
import { useAuthStore } from '../stores/authStore';
import { formatTime } from '../utils/date';

interface ChatTabProps {
  chatId: string;
}

export const ChatTab: React.FC<ChatTabProps> = ({ chatId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const currentUser = useAuthStore((s: any) => s.user);

  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await chatApi.getMessages(chatId);
      setMessages((data.messages || data.items || []).reverse());
    } catch {} finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    fetchMessages();
    socketService.joinChat(chatId);

    const unsub = socketService.on('chat:message:new', (data: unknown) => {
      const msg = data as ChatMessage;
      if (msg.chatId === chatId) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => { unsub(); };
  }, [chatId, fetchMessages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      socketService.sendMessage({ chatId, text: trimmed });
      setText('');
      // Optimistic append
      const optimistic: ChatMessage = {
        id: `temp-${Date.now()}`,
        chatId,
        senderId: currentUser?.id || '',
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
    } catch {} finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderId === currentUser?.id;
    return (
      <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
        <View style={[styles.msgBubble, isMine ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.msgText, isMine ? styles.myText : styles.otherText]}>{item.text}</Text>
          <Text style={[styles.msgTime, isMine ? styles.myTime : styles.otherTime]}>
            {formatTime(item.createdAt)}
          </Text>
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatText}>No messages yet. Start the conversation!</Text>
          </View>
        }
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.chatInput}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          <Ionicons name="send" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { padding: SPACING.lg, paddingBottom: SPACING.sm },
  msgRow: { marginBottom: SPACING.sm },
  msgRowRight: { alignItems: 'flex-end' },
  msgRowLeft: { alignItems: 'flex-start' },
  msgBubble: {
    maxWidth: '78%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  myBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: SPACING.xs,
  },
  otherBubble: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: SPACING.xs,
    ...SHADOWS.sm,
  },
  msgText: { fontSize: FONT_SIZE.md, lineHeight: 20 },
  myText: { color: COLORS.white },
  otherText: { color: COLORS.text },
  msgTime: { fontSize: FONT_SIZE.xs, marginTop: SPACING.xs, alignSelf: 'flex-end' },
  myTime: { color: 'rgba(255,255,255,0.6)' },
  otherTime: { color: COLORS.textMuted },
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
});

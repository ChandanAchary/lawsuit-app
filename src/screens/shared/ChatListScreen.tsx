import {  useThemeStore , useColors } from '../../stores/themeStore';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { chatApi } from '../../services/api';
import { socketService } from '../../services/socket';
import { onChatSessionClosed, onChatSessionOpened } from '../../services/chatSyncEvents';
import { useAuthStore } from '../../stores/authStore';
import { Loading } from '../../components/Common';
import { ChatMessage } from '../../types';
import { presentChatMessageNotification } from '../../utils/localNotifications';

export const ChatListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const isDark = useThemeStore((s: any) => s.isDark);
  const COLORS = useColors();
  const styles = React.useMemo(() => getStyles(COLORS), [isDark]);

  const { user } = useAuthStore();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Track which chatId is currently open so we don't increment its unread count
  const activeChatRef = useRef<string | null>(null);

  const getChatSortTime = useCallback((chat: any): number => {
    const raw = chat?.lastMessage?.createdAt || chat?.lastMessageAt || chat?.updatedAt || chat?.createdAt;
    const t = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  }, []);

  const getLastMessageTime = useCallback((chat: any): number => {
    const raw = chat?.lastMessage?.createdAt || chat?.lastMessageAt;
    const t = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  }, []);

  const hasChatHistory = useCallback((chat: any): boolean => {
    if (!chat) return false;
    const text = String(chat?.lastMessage?.text || chat?.lastMessageText || '').trim();
    return !!text || getLastMessageTime(chat) > 0;
  }, [getLastMessageTime]);

  const normalizeChats = useCallback((list: any[]): any[] => {
    const grouped = new Map<string, any>();

    (list || []).forEach((chat) => {
      if (!chat || !chat.id) return;
      const key = String(chat.id);
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, { ...chat });
        return;
      }

      const existingHasHistory = hasChatHistory(existing);
      const incomingHasHistory = hasChatHistory(chat);

      let latest = { ...existing };
      if (!existingHasHistory && incomingHasHistory) {
        latest = { ...chat };
      } else if (existingHasHistory && !incomingHasHistory) {
        latest = { ...existing };
      } else {
        const existingMsgTs = getLastMessageTime(existing);
        const incomingMsgTs = getLastMessageTime(chat);
        if (incomingMsgTs > existingMsgTs) {
          latest = { ...chat };
        } else if (incomingMsgTs === existingMsgTs) {
          const existingTs = getChatSortTime(existing);
          const incomingTs = getChatSortTime(chat);
          latest = incomingTs >= existingTs ? { ...chat } : { ...existing };
        }
      }

      latest.unreadCount = Math.max(Number(existing.unreadCount || 0), Number(chat.unreadCount || 0));
      grouped.set(key, latest);
    });

    return Array.from(grouped.values()).sort((a, b) => getChatSortTime(b) - getChatSortTime(a));
  }, [getChatSortTime, getLastMessageTime, hasChatHistory]);

  const fetchChats = useCallback(async () => {
    try {
      const { data } = await chatApi.getChats();
      setChats(normalizeChats(data?.chats || data || []));
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normalizeChats]);

  useEffect(() => {
    fetchChats();

    // Real-time: new message arrives → update last message + unread badge
    const unsubMsg = socketService.on('chat:message:new', (payload: unknown) => {
      const { message } = payload as { message: ChatMessage };
      if (!message) return;

      if (message.senderId !== user?.id && activeChatRef.current !== message.chatId) {
        void presentChatMessageNotification({
          chatId: message.chatId,
          senderName: 'Someone',
          text: message.text,
          messageId: message.id,
        });
      }

      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === message.chatId);
        if (idx === -1) {
          // Unknown chat — re-fetch to get full chat object
          fetchChats();
          return prev;
        }
        const updated = { ...prev[idx], lastMessage: message, updatedAt: message.createdAt };
        // Increment unread only if this chat is not currently active
        if (message.senderId !== user?.id && activeChatRef.current !== message.chatId) {
          updated.unreadCount = (updated.unreadCount || 0) + 1;
        }
        const next = [updated, ...prev.filter((_, i) => i !== idx)];
        return normalizeChats(next);
      });
    });

    // When user reads a chat, reset its unread count
    const unsubRead = socketService.on('chat:message:read', (payload: unknown) => {
      const { chatId } = payload as { chatId?: string; messageId?: string };
      if (!chatId) return;
      setChats((prev) => normalizeChats(prev.map((c) => c.id === chatId ? { ...c, unreadCount: 0 } : c)));
    });

    // Track focus state so we can suppress unread increments for the open chat
    const unsubFocus = navigation.addListener('focus', () => {
      activeChatRef.current = null;
      fetchChats();
    });

    // Sync chat list when Daily live chat sessions are opened/closed.
    const unsubSessionOpened = onChatSessionOpened(({ chatId }) => {
      setChats((prev) => normalizeChats(prev.map((c) => c.id === chatId ? { ...c, unreadCount: 0 } : c)));
    });

    const unsubSessionClosed = onChatSessionClosed(() => {
      fetchChats();
    });

    return () => {
      unsubMsg();
      unsubRead();
      unsubFocus();
      unsubSessionOpened();
      unsubSessionClosed();
    };
  }, [fetchChats, user?.id, navigation, normalizeChats]);

  const onRefresh = () => { setRefreshing(true); fetchChats(); };

  const getOtherUser = (chat: any) => {
    const participants = chat.participants || [];
    return participants.find((p: any) => p.id !== user?.id && p.userId !== user?.id) || participants[0] || {};
  };

  const formatChatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderChat = ({ item }: { item: any }) => {
    const other = getOtherUser(item);
    const otherName = other?.name || other?.user?.name || 'Unknown';
    const otherAvatar = other?.avatarUrl || other?.user?.avatarUrl || other?.avatar;
    const lastMsg = item.lastMessage?.text || item.lastMessageText || '';
    const time = item.lastMessage?.createdAt || item.lastMessageAt || item.updatedAt;
    const unread = item.unreadCount || 0;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => {
          activeChatRef.current = item.id;
          // Reset local unread
          setChats((prev) => prev.map((c) => c.id === item.id ? { ...c, unreadCount: 0 } : c));
          navigation.navigate('ChatScreen', {
            chatId: item.id,
            otherUser: { id: other?.id || other?.userId, name: otherName, avatarUrl: otherAvatar },
          });
        }}
      >
        <View style={styles.avatarWrapper}>
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPH]}>
              <Ionicons name="person" size={24} color={COLORS.textMuted} />
            </View>
          )}
        </View>
        <View style={styles.chatContent}>
          <View style={styles.chatTopRow}>
            <Text style={[styles.chatName, unread > 0 && styles.chatNameUnread]} numberOfLines={1}>{otherName}</Text>
            <Text style={styles.chatTime}>{formatChatTime(time)}</Text>
          </View>
          <View style={styles.chatBottomRow}>
            <Text style={[styles.chatLastMsg, unread > 0 && styles.chatLastMsgUnread]} numberOfLines={1}>
              {lastMsg || 'No messages yet'}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <Loading />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderChat}
        contentContainerStyle={chats.length === 0 ? styles.emptyContainer : { paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No Conversations</Text>
            <Text style={styles.emptySubtitle}>Your conversations will appear here</Text>
          </View>
        }
      />
    </View>
  );
};

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.huge, paddingBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '900', color: COLORS.white },
  chatItem: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  chatContent: { flex: 1 },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text, flex: 1, marginRight: SPACING.sm },
  chatNameUnread: { fontWeight: '800' },
  chatTime: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  chatBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatLastMsg: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, flex: 1, marginRight: SPACING.sm },
  chatLastMsgUnread: { color: COLORS.text, fontWeight: '600' },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadText: { fontSize: FONT_SIZE.xs - 1, fontWeight: '700', color: COLORS.white },
  emptyContainer: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, paddingTop: 80 },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

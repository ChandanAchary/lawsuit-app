import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../../constants';
import { chatApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { Loading } from '../../components/Common';

export const ChatListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChats = useCallback(async () => {
    try {
      const { data } = await chatApi.getChats();
      setChats(data?.chats || data || []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  const onRefresh = () => { setRefreshing(true); fetchChats(); };

  const getOtherUser = (chat: any) => {
    const participants = chat.participants || [];
    return participants.find((p: any) => p.id !== user?.id && p.userId !== user?.id) || participants[0] || {};
  };

  const formatTime = (dateStr: string) => {
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
        onPress={() => navigation.navigate('ChatScreen', { chatId: item.id, otherUser: { id: other?.id || other?.userId, name: otherName, avatarUrl: otherAvatar } })}
      >
        {otherAvatar ? (
          <Image source={{ uri: otherAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPH]}>
            <Ionicons name="person" size={24} color={COLORS.textMuted} />
          </View>
        )}
        <View style={styles.chatContent}>
          <View style={styles.chatTopRow}>
            <Text style={styles.chatName} numberOfLines={1}>{otherName}</Text>
            <Text style={styles.chatTime}>{formatTime(time)}</Text>
          </View>
          <View style={styles.chatBottomRow}>
            <Text style={styles.chatLastMsg} numberOfLines={1}>{lastMsg || 'No messages yet'}</Text>
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

const styles = StyleSheet.create({
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
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPH: { backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  chatContent: { flex: 1 },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: SPACING.sm },
  chatTime: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
  chatBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatLastMsg: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, flex: 1, marginRight: SPACING.sm },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadText: { fontSize: FONT_SIZE.xs - 1, fontWeight: '700', color: COLORS.white },
  emptyContainer: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted },
});

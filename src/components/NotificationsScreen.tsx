import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, FONT_SIZE, SPACING, SHADOWS } from '../constants';
import { Notification, NotificationType } from '../types';
import { useNotificationStore } from '../stores/notificationStore';
import { formatTimeAgo } from '../utils/date';

const NOTIFICATION_ICONS: Record<string, { icon: string; color: string }> = {
  [NotificationType.APPOINTMENT_BOOKED]: { icon: 'calendar', color: COLORS.info },
  [NotificationType.APPOINTMENT_CONFIRMED]: { icon: 'checkmark-circle', color: COLORS.success },
  [NotificationType.APPOINTMENT_CANCELLED]: { icon: 'close-circle', color: COLORS.error },
  [NotificationType.APPOINTMENT_REMINDER]: { icon: 'alarm', color: COLORS.warning },
  [NotificationType.NEW_MESSAGE]: { icon: 'chatbubble', color: COLORS.primary },
  [NotificationType.PAYMENT_RECEIVED]: { icon: 'wallet', color: COLORS.success },
  [NotificationType.WALLET_CREDIT]: { icon: 'arrow-down-circle', color: COLORS.success },
  [NotificationType.WALLET_DEBIT]: { icon: 'arrow-up-circle', color: COLORS.error },
  [NotificationType.CASE_UPDATE]: { icon: 'briefcase', color: COLORS.info },
  [NotificationType.DOCUMENT_UPLOADED]: { icon: 'document', color: COLORS.primary },
  [NotificationType.VIDEO_CALL]: { icon: 'videocam', color: COLORS.accent },
  [NotificationType.REVIEW_RECEIVED]: { icon: 'star', color: COLORS.accent },
};

export const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    notifications, isLoading, unreadCount, hasMore,
    fetchNotifications, fetchNextPage, markRead, markAllRead, deleteNotification,
  } = useNotificationStore();

  useEffect(() => { fetchNotifications(); }, []);

  const getIcon = (type: string) => NOTIFICATION_ICONS[type] || { icon: 'notifications', color: COLORS.primary };

  const renderItem = ({ item }: { item: Notification }) => {
    const { icon, color } = getIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.unreadCard]}
        activeOpacity={0.7}
        onPress={() => { if (!item.isRead) markRead(item.id); }}
      >
        <View style={[styles.iconCircle, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, !item.isRead && styles.unreadTitle]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.time}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => deleteNotification(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={() => { if (hasMore && notifications.length > 0 && !isLoading) fetchNextPage(); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={isLoading ? <ActivityIndicator color={COLORS.primary} style={{ padding: SPACING.lg }} /> : null}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontWeight: '800', color: COLORS.text },
  markAll: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.primary },
  list: { padding: SPACING.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, marginLeft: SPACING.md },
  title: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text },
  unreadTitle: { fontWeight: '800' },
  body: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  time: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginTop: SPACING.xs },
  deleteBtn: { padding: SPACING.xs },
  empty: { alignItems: 'center', paddingVertical: SPACING.huge },
  emptyText: { fontSize: FONT_SIZE.md, color: COLORS.textMuted, marginTop: SPACING.md },
});

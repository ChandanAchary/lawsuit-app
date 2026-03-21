import { create } from 'zustand';
import { notificationsApi } from '../services/api';
import { socketService } from '../services/socket';
import { Notification, NotificationType } from '../types';
import { presentDomainNotification } from '../utils/localNotifications';

interface NotificationState {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  toast: Notification | null;
  fetchNotifications: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  pushNotification: (n: Notification) => void;
  setUnreadCount: (count: number) => void;
  initSocketListeners: () => () => void;
  clearToast: () => void;
}

const PAGE_SIZE = 20;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  total: 0,
  unreadCount: 0,
  page: 1,
  hasMore: true,
  isLoading: false,
  toast: null,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const { data } = await notificationsApi.getAll({ page: 1, limit: PAGE_SIZE });
      const items = data.items || data.notifications || [];
      set({
        notifications: items,
        total: data.total || items.length,
        page: 1,
        hasMore: items.length >= PAGE_SIZE,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchNextPage: async () => {
    const { page, hasMore, isLoading } = get();
    if (!hasMore || isLoading) return;
    set({ isLoading: true });
    try {
      const nextPage = page + 1;
      const { data } = await notificationsApi.getAll({ page: nextPage, limit: PAGE_SIZE });
      const items = data.items || data.notifications || [];
      set((s) => ({
        notifications: [...s.notifications, ...items],
        page: nextPage,
        hasMore: items.length >= PAGE_SIZE,
        isLoading: false,
      }));
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await notificationsApi.getUnreadCount();
      set({ unreadCount: data.count ?? data.unreadCount ?? 0 });
    } catch {}
  },

  markRead: async (id) => {
    await notificationsApi.markRead(id);
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },

  markAllRead: async () => {
    await notificationsApi.markAllRead();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
      unreadCount: 0,
    }));
  },

  deleteNotification: async (id) => {
    await notificationsApi.delete(id);
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
      total: s.total - 1,
    }));
  },

  pushNotification: (n) => {
    set((s) => ({
      notifications: [n, ...s.notifications],
      total: s.total + 1,
      unreadCount: s.unreadCount + 1,
      toast: n,
    }));
    if (n.type !== NotificationType.NEW_MESSAGE) {
      void presentDomainNotification(n);
    }
    setTimeout(() => set({ toast: null }), 4000);
  },

  setUnreadCount: (count) => set({ unreadCount: count }),

  initSocketListeners: () => {
    const unsub1 = socketService.on('notification', (data: unknown) => {
      get().pushNotification(data as Notification);
    });
    const unsub2 = socketService.on('notification:unread-count', (data: unknown) => {
      const d = data as { count: number };
      get().setUnreadCount(d.count);
    });
    return () => {
      unsub1();
      unsub2();
    };
  },

  clearToast: () => set({ toast: null }),
}));

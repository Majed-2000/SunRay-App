import { create } from 'zustand';
import type { AppNotification } from '@/types';

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: () => number;
  markAllRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  // Empty until push notifications exist. It opened on five invented messages
  // about order SR-4821, with an unread badge on the home screen for them.
  notifications: [],
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  clearAll: () => set({ notifications: [] }),
}));

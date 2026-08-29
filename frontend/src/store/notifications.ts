import { create } from "zustand";

export type NotificationTone = "ok" | "warn" | "info" | "error";

export type AppNotification = {
  id: string;
  tone: NotificationTone;
  title?: string;
  message: string;
  createdAt: number;
  read: boolean;
  /** Toast was dismissed (still visible in center until cleared). */
  toastDismissed: boolean;
};

const TOAST_MS: Record<NotificationTone, number> = {
  ok: 4500,
  info: 5000,
  warn: 6500,
  error: 8000,
};

type PushInput = {
  tone?: NotificationTone;
  title?: string;
  message: string;
  /** When false, only adds to center (no toast). */
  toast?: boolean;
};

type NotificationState = {
  items: AppNotification[];
  centerOpen: boolean;
  push: (input: PushInput) => string;
  dismissToast: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  setCenterOpen: (open: boolean) => void;
  toggleCenter: () => void;
};

const MAX_ITEMS = 80;

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],
  centerOpen: false,

  push: ({ tone = "info", title, message, toast = true }) => {
    const id = nextId();
    const item: AppNotification = {
      id,
      tone,
      title,
      message,
      createdAt: Date.now(),
      read: false,
      toastDismissed: !toast,
    };
    set((state) => ({
      items: [item, ...state.items].slice(0, MAX_ITEMS),
    }));
    if (toast) {
      window.setTimeout(() => get().dismissToast(id), TOAST_MS[tone]);
    }
    return id;
  },

  dismissToast: (id) => {
    set((state) => ({
      items: state.items.map((n) => (n.id === id ? { ...n, toastDismissed: true } : n)),
    }));
  },

  markRead: (id) => {
    set((state) => ({
      items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  markAllRead: () => {
    set((state) => ({
      items: state.items.map((n) => ({ ...n, read: true })),
    }));
  },

  clearAll: () => set({ items: [] }),

  setCenterOpen: (open) => {
    set({ centerOpen: open });
    if (open) get().markAllRead();
  },

  toggleCenter: () => {
    const next = !get().centerOpen;
    get().setCenterOpen(next);
  },
}));

export function unreadCount(items: AppNotification[]) {
  return items.filter((n) => !n.read).length;
}

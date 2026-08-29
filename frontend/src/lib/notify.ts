import { useNotifications, type NotificationTone } from "../store/notifications";

type NotifyOptions = {
  tone?: NotificationTone;
  title?: string;
};

export function notify(message: string, options?: NotifyOptions) {
  return useNotifications.getState().push({
    message,
    tone: options?.tone ?? "info",
    title: options?.title,
  });
}

notify.ok = (message: string, title?: string) =>
  notify(message, { tone: "ok", title });

notify.warn = (message: string, title?: string) =>
  notify(message, { tone: "warn", title });

notify.error = (message: string, title?: string) =>
  notify(message, { tone: "error", title });

notify.info = (message: string, title?: string) =>
  notify(message, { tone: "info", title });

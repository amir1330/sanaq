import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import { cn } from "../lib/utils";
import {
  unreadCount,
  useNotifications,
  type AppNotification,
  type NotificationTone,
} from "../store/notifications";
import { Button } from "./ui";

const toneStyles: Record<
  NotificationTone,
  { ring: string; icon: string; iconBg: string; label: string }
> = {
  ok: {
    ring: "border-confirm/30",
    icon: "✓",
    iconBg: "bg-confirm text-paper",
    label: "text-confirm",
  },
  info: {
    ring: "border-sun/35",
    icon: "i",
    iconBg: "bg-sun text-paper",
    label: "text-sun",
  },
  warn: {
    ring: "border-sun/40",
    icon: "!",
    iconBg: "bg-sun text-paper",
    label: "text-accent-text",
  },
  error: {
    ring: "border-maroon/35",
    icon: "×",
    iconBg: "bg-maroon text-paper",
    label: "text-maroon",
  },
};

function formatWhen(ts: number, t: (key: string, vars?: Record<string, string | number>) => string) {
  const diff = Date.now() - ts;
  if (diff < 45_000) return t("notifications.justNow");
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return t("notifications.minutesAgo", { n: mins });
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function NotificationCard({
  item,
  compact,
  onDismiss,
  onOpenCenter,
}: {
  item: AppNotification;
  compact?: boolean;
  onDismiss?: () => void;
  onOpenCenter?: () => void;
}) {
  const t = useT();
  const style = toneStyles[item.tone];

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-lg border bg-paper shadow-soft notification-enter",
        style.ring,
        compact ? "p-3.5" : "p-4",
      )}
      role={compact ? "status" : "listitem"}
      aria-live={compact ? "polite" : undefined}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-bold",
            style.iconBg,
          )}
          aria-hidden
        >
          {style.icon}
        </div>
        <div className="min-w-0 flex-1">
          {item.title ? (
            <p className={cn("font-display text-[15px] font-medium leading-snug", style.label)}>
              {item.title}
            </p>
          ) : null}
          <p className={cn("text-[13.5px] leading-snug text-ink", item.title ? "mt-0.5" : "")}>
            {item.message}
          </p>
          {!compact && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
              {formatWhen(item.createdAt, t)}
            </p>
          )}
        </div>
        {compact && onDismiss && (
          <button
            type="button"
            className="shrink-0 self-start rounded-md px-2 py-1 text-[12px] text-ink-soft hover:bg-paper-2 hover:text-ink"
            onClick={onDismiss}
            aria-label={t("common.close")}
          >
            ×
          </button>
        )}
      </div>
      {compact && onOpenCenter && (
        <button
          type="button"
          className="mt-2.5 text-left text-[12px] text-ink-soft underline hover:text-ink"
          onClick={onOpenCenter}
        >
          {t("notifications.openCenter")}
        </button>
      )}
    </article>
  );
}

function ToastStack() {
  const t = useT();
  const items = useNotifications((s) => s.items);
  const dismissToast = useNotifications((s) => s.dismissToast);
  const setCenterOpen = useNotifications((s) => s.setCenterOpen);
  const visible = items.filter((n) => !n.toastDismissed).slice(0, 4);

  if (visible.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-3 top-3 z-[90] flex w-[min(100vw-1.5rem,22rem)] flex-col gap-2.5 sm:right-5 sm:top-5"
      aria-label={t("notifications.title")}
    >
      {visible.map((n) => (
        <div key={n.id} className="pointer-events-auto">
          <NotificationCard
            item={n}
            compact
            onDismiss={() => dismissToast(n.id)}
            onOpenCenter={() => setCenterOpen(true)}
          />
        </div>
      ))}
    </div>
  );
}

function NotificationCenterPanel() {
  const t = useT();
  const items = useNotifications((s) => s.items);
  const centerOpen = useNotifications((s) => s.centerOpen);
  const setCenterOpen = useNotifications((s) => s.setCenterOpen);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const clearAll = useNotifications((s) => s.clearAll);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!centerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCenterOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [centerOpen, setCenterOpen]);

  if (!centerOpen) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[95] bg-ink/25 backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={() => setCenterOpen(false)}
      />
      <aside
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-[96] flex w-full max-w-md flex-col border-l border-line bg-paper shadow-soft notification-panel-enter"
        aria-labelledby="notification-center-title"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="notification-center-title" className="font-display text-[20px] font-normal">
              {t("notifications.title")}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-soft">{t("notifications.subtitle")}</p>
          </div>
          <button
            type="button"
            className="rounded-md px-3 py-2 text-[13px] text-ink-soft hover:bg-paper-2 hover:text-ink"
            onClick={() => setCenterOpen(false)}
          >
            {t("common.close")}
          </button>
        </header>

        {items.length > 0 && (
          <div className="flex shrink-0 gap-2 border-b border-line px-5 py-3">
            <Button variant="quiet" size="md" className="h-10 px-3 text-[13px]" onClick={markAllRead}>
              {t("notifications.markAllRead")}
            </Button>
            <Button variant="ghost" size="md" className="h-10 px-3 text-[13px]" onClick={clearAll}>
              {t("notifications.clearAll")}
            </Button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full min-h-[12rem] flex-col items-center justify-center text-center">
              <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-paper-2 text-[22px] text-faint">
                ◌
              </div>
              <p className="font-display text-[17px] text-ink-soft">{t("notifications.empty")}</p>
              <p className="mt-1 max-w-[16rem] text-[13px] text-faint">{t("notifications.emptyHint")}</p>
            </div>
          ) : (
            <ul className="space-y-3" role="list">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationCard item={n} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>,
    document.body,
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const t = useT();
  const items = useNotifications((s) => s.items);
  const centerOpen = useNotifications((s) => s.centerOpen);
  const toggleCenter = useNotifications((s) => s.toggleCenter);
  const unread = unreadCount(items);

  return (
    <button
      type="button"
      className={cn(
        "relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line-2 bg-paper text-[18px] transition hover:border-ink hover:bg-paper-2 touch-manipulation",
        centerOpen && "border-ink bg-paper-2",
        className,
      )}
      onClick={toggleCenter}
      aria-expanded={centerOpen}
      aria-label={
        unread > 0 ? t("notifications.bellUnread", { n: unread }) : t("notifications.bell")
      }
    >
      <span aria-hidden className="leading-none">
        🔔
      </span>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-sun px-1 font-mono text-[10px] font-bold text-paper">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

export function NotificationHost() {
  return (
    <>
      <ToastStack />
      <NotificationCenterPanel />
    </>
  );
}

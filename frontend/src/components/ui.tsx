import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import { useFocusTrap } from "../lib/useFocusTrap";
import { cn } from "../lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "ink" | "danger" | "foam" | "sky" | "quiet" | "gold" | "confirm";
  size?: "md" | "lg";
}) {
  const styles = {
    primary: "border-ink bg-ink text-paper hover:border-sun hover:bg-sun",
    ink: "border-ink bg-ink text-paper hover:border-sun hover:bg-sun",
    foam: "border-line-2 bg-paper text-ink hover:border-ink",
    ghost: "border-transparent bg-transparent text-ink hover:text-accent",
    quiet: "border-line bg-paper-2 text-ink-soft hover:border-line-2 hover:text-ink",
    danger: "border-maroon bg-maroon text-paper hover:bg-maroon-deep",
    sky: "border-sky bg-sky text-paper hover:bg-sky-deep",
    gold: "border-sun bg-sun text-paper hover:border-sun-hot hover:bg-sun-hot",
    confirm: "border-confirm bg-confirm text-paper hover:bg-confirm-deep",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition disabled:opacity-40",
        size === "lg" ? "h-14 px-7 text-[16px]" : "h-12 px-5 text-[15px]",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export const pill =
  "inline-flex min-h-12 items-center justify-center rounded-md border px-5 text-[15px] font-medium transition touch-manipulation";

export function Field({
  label,
  hint,
  children,
  tone = "light",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <label className="block">
      <span
        className={cn(
          "mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.1em]",
          tone === "dark" ? "text-cream-soft" : "text-faint",
        )}
      >
        {label}
      </span>
      {children}
      {hint ? <p className="mt-1.5 text-[13px] leading-snug text-mute">{hint}</p> : null}
    </label>
  );
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px] text-ink touch-manipulation">
      <input
        type="checkbox"
        className="h-6 w-6 shrink-0 rounded border border-line-2 accent-sun"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

const fieldControl =
  "w-full min-h-12 rounded-md border px-4 py-3 text-[15px] outline-none transition touch-manipulation";

export function Input({
  tone = "light",
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { tone?: "light" | "dark" }) {
  return (
    <input
      {...props}
      className={cn(
        fieldControl,
        tone === "dark"
          ? "border-line-dark bg-roast-2 text-cream caret-cream placeholder:text-cream-soft focus:border-sun [color-scheme:dark] [&:-webkit-autofill]:[-webkit-text-fill-color:rgb(var(--cream))] [&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_rgb(var(--roast-2))_inset]"
          : "border-line-2 bg-paper text-ink placeholder:text-faint focus:border-sun",
        className,
      )}
    />
  );
}

export function Select({
  tone = "light",
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { tone?: "light" | "dark" }) {
  return (
    <select
      {...props}
      className={cn(
        fieldControl,
        tone === "dark"
          ? "border-line-dark bg-roast-2 text-cream focus:border-sun [color-scheme:dark]"
          : "border-line-2 bg-paper text-ink focus:border-sun",
        className,
      )}
    />
  );
}

export function Dialog({
  open,
  title,
  hint,
  onClose,
  children,
  dark,
  size = "md",
  fillBody = false,
}: {
  open: boolean;
  title: string;
  hint?: string;
  onClose: () => void;
  children: ReactNode;
  dark?: boolean;
  size?: "md" | "lg" | "xl";
  /** Pin footer actions: body scrolls inside, children should use flex column layout. */
  fillBody?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-roast/70 p-3 sm:p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <DialogBody title={title} hint={hint} onClose={onClose} size={size} dark={dark} fillBody={fillBody}>
        {children}
      </DialogBody>
    </div>,
    document.body,
  );
}

function DialogBody({
  title,
  hint,
  onClose,
  children,
  size,
  dark,
  fillBody,
}: {
  title: string;
  hint?: string;
  onClose: () => void;
  children: ReactNode;
  size: "md" | "lg" | "xl";
  dark?: boolean;
  fillBody?: boolean;
}) {
  const t = useT();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, onClose);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={cn(
        "flex max-h-[min(92vh,900px)] w-full flex-col overflow-hidden rounded-lg border shadow-soft",
        dark ? "border-line-dark bg-roast text-cream" : "border-line bg-paper",
        size === "xl" ? "max-w-3xl" : size === "lg" ? "max-w-2xl" : "max-w-lg",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-2xl font-medium tracking-tight sm:text-[26px]">
            {title}
          </h2>
          {hint && <p className={cn("mt-2 text-[15px] leading-relaxed", dark ? "text-cream-soft" : "text-mute")}>{hint}</p>}
        </div>
        <button
          type="button"
          className={cn(
            "min-h-11 shrink-0 rounded-md px-3 font-mono text-[11px] uppercase tracking-[0.08em] touch-manipulation hover:bg-paper-2",
            dark ? "text-cream-soft" : "text-faint",
          )}
          onClick={onClose}
        >
          {t("common.close")}
        </button>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 px-5 py-5 sm:px-6",
          fillBody ? "flex flex-col overflow-hidden" : "overflow-y-auto overscroll-contain",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("surface-raised p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

export function PageTitle({
  kicker,
  title,
  hint,
  action,
}: {
  kicker: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 border-b border-line pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-accent">{kicker}</p>
          <h1 className="mt-2 font-display text-[28px] font-medium leading-tight tracking-tight text-ink sm:text-[32px]">
            {title}
          </h1>
          {hint && <p className="mt-2 text-sm leading-relaxed text-mute">{hint}</p>}
        </div>
        {action}
      </div>
      <hr className="perforation-h mt-6" />
    </header>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="surface-panel px-5 py-12 text-center text-sm text-mute">{children}</div>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "ok";
  children: ReactNode;
}) {
  const cls = {
    info: "border-line bg-paper-2 text-ink",
    warn: "border-maroon/30 bg-maroon/8 text-maroon",
    ok: "border-sky/30 bg-sky/8 text-sky",
  }[tone];
  return (
    <div role="status" aria-live="polite" className={cn("mb-4 rounded-md border px-4 py-3 text-sm", cls)}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-faint", className)}>
      {children}
    </span>
  );
}

export type MoreMenuItem = {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  custom?: ReactNode;
};

export function MoreMenu({ items, label }: { items: MoreMenuItem[]; label?: string }) {
  const t = useT();
  const menuLabel = label ?? t("common.more");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="grid h-12 w-12 place-items-center rounded-md border border-transparent text-[20px] leading-none text-faint hover:border-line hover:bg-paper-2 hover:text-ink touch-manipulation"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ⋯
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-44 overflow-hidden rounded-md border border-line bg-paper py-1 shadow-soft"
        >
          {items.map((item) =>
            item.custom ? (
              <div key={item.label} role="none" className="px-3 py-2">
                {item.custom}
              </div>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn(
                  "block min-h-12 w-full px-4 py-3 text-left text-[15px] disabled:opacity-40 touch-manipulation",
                  item.danger ? "text-maroon hover:bg-maroon/8" : "text-ink hover:bg-paper-2",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

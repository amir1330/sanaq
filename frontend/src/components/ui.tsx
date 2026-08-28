import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useId, useRef, useState } from "react";
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
        size === "lg" ? "h-12 px-6 text-[14px]" : "h-10 px-4 text-[13px]",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export const pill =
  "inline-flex h-10 items-center justify-center rounded-md border px-4 text-[13px] font-medium transition";

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
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-ink">
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 rounded border border-line-2 accent-sun"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

const fieldControl = "w-full rounded-md border px-4 py-3 text-[14px] outline-none transition";

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
  wide,
  dark,
}: {
  open: boolean;
  title: string;
  hint?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  dark?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-roast/70 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <DialogBody title={title} hint={hint} onClose={onClose} wide={wide} dark={dark}>
        {children}
      </DialogBody>
    </div>
  );
}

function DialogBody({
  title,
  hint,
  onClose,
  children,
  wide,
  dark,
}: {
  title: string;
  hint?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  dark?: boolean;
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
        "max-h-[90vh] w-full overflow-auto rounded-md border p-6 shadow-soft",
        dark ? "border-line-dark bg-roast text-cream" : "border-line bg-paper",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="font-display text-xl font-medium tracking-tight">
            {title}
          </h2>
          {hint && <p className={cn("mt-1.5 text-sm", dark ? "text-cream-soft" : "text-mute")}>{hint}</p>}
        </div>
        <button
          type="button"
          className={cn("font-mono text-[10px] uppercase tracking-[0.08em]", dark ? "text-cream-soft" : "text-faint")}
          onClick={onClose}
        >
          {t("common.close")}
        </button>
      </div>
      {children}
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
        className="grid h-10 w-10 place-items-center rounded-md border border-transparent text-[18px] leading-none text-faint hover:border-line hover:bg-paper-2 hover:text-ink"
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
                  "block w-full px-4 py-2.5 text-left text-[13px] disabled:opacity-40",
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

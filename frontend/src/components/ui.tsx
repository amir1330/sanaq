import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "ink" | "danger" | "foam" | "sky" | "quiet" | "gold";
  size?: "md" | "lg";
}) {
  const styles = {
    primary: "border-ink bg-ink text-paper hover:border-maroon hover:bg-maroon",
    ink: "border-ink bg-ink text-paper hover:border-maroon hover:bg-maroon",
    foam: "border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
    ghost: "border-transparent bg-transparent text-ink hover:text-maroon",
    quiet: "border-line-2 bg-transparent text-ink-soft hover:border-ink hover:text-ink",
    danger: "border-maroon bg-maroon text-paper hover:bg-maroon-deep",
    sky: "border-turq bg-turq text-roast hover:bg-sky-deep",
    gold: "border-gold bg-gold text-roast hover:border-cream hover:bg-cream",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] font-semibold transition disabled:opacity-40",
        size === "lg" ? "h-12 px-[26px] text-[13.5px]" : "h-10 px-[18px] text-[12.5px]",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export const pill = "inline-flex h-10 items-center justify-center rounded-full border-[1.5px] px-[18px] text-[12.5px] font-medium transition";

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
      {hint ? <p className="mt-1.5 text-[12.5px] leading-snug text-mute">{hint}</p> : null}
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
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14.5px] text-ink">
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 rounded-[4px] border-[1.5px] border-line-2 accent-maroon"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}

const fieldControl = "w-full rounded-md border-[1.5px] px-4 py-[13px] text-[14.5px] outline-none transition";

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
          ? "border-[#453e30] bg-[#2c271e] text-[#efe9da] caret-[#efe9da] placeholder:text-[#736b58] focus:border-gold [color-scheme:dark] [&:-webkit-autofill]:[-webkit-text-fill-color:#efe9da] [&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_#2c271e_inset]"
          : "border-line-2 bg-cream text-ink placeholder:text-faint focus:border-ink",
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
          ? "border-[#453e30] bg-[#2c271e] text-[#efe9da] focus:border-gold [color-scheme:dark]"
          : "border-line-2 bg-cream text-ink focus:border-ink",
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
      className="fixed inset-0 z-40 grid place-items-center bg-roast/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "max-h-[90vh] w-full overflow-auto rounded-lg p-7 shadow-soft",
          dark ? "border border-line-dark bg-roast text-cream" : "bg-paper",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-normal">{title}</h2>
            {hint && <p className={cn("mt-1.5 text-sm", dark ? "text-cream-soft" : "text-mute")}>{hint}</p>}
          </div>
          <button
            type="button"
            className={cn("font-mono text-[10px] uppercase tracking-[0.08em]", dark ? "text-cream-soft" : "text-faint")}
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
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
  return <section className={cn("rounded-lg bg-cream p-6 shadow-soft", className)}>{children}</section>;
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">{kicker}</p>
        <h1 className="mt-2 font-display text-[32px] font-normal leading-tight text-ink">{title}</h1>
        {hint && <p className="mt-2 text-sm leading-relaxed text-mute">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg bg-cream px-5 py-12 text-center text-sm text-mute shadow-soft">{children}</div>
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
    info: "bg-cream text-ink",
    warn: "bg-maroon/10 text-maroon",
    ok: "bg-turq/10 text-turq",
  }[tone];
  return <div className={`mb-4 rounded-md px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint", className)}>
      {children}
    </span>
  );
}

export type MoreMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function MoreMenu({ items, label = "Ещё" }: { items: MoreMenuItem[]; label?: string }) {
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
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="grid h-10 w-10 place-items-center rounded-full text-[18px] leading-none text-faint hover:bg-cream hover:text-ink"
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
          className="absolute right-0 z-20 mt-1 min-w-44 overflow-hidden rounded-md bg-paper py-1 shadow-soft"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                "block w-full px-4 py-2.5 text-left text-[13.5px] disabled:opacity-40",
                item.danger ? "text-maroon hover:bg-maroon/10" : "text-ink hover:bg-cream",
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (item.disabled) return;
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

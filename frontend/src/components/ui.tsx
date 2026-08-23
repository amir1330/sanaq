import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "../lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "ink" | "danger" | "foam" | "sky" | "quiet";
}) {
  const styles = {
    primary:
      "border border-ink bg-ink text-paper hover:bg-mute hover:border-mute",
    ink: "border border-ink bg-ink text-paper hover:bg-mute hover:border-mute",
    foam: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
    ghost: "border border-transparent bg-transparent text-ink hover:underline",
    quiet:
      "border border-line-2 bg-transparent px-4 py-2 text-ink-soft hover:border-ink hover:text-ink",
    danger: "border border-alert bg-alert text-paper hover:bg-alert/90",
    sky: "border border-sky bg-sky text-paper hover:bg-sky-deep",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 px-6 py-3 text-[13.5px] font-semibold tracking-[0.01em] transition disabled:opacity-40",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  tone = "light",
}: {
  label: string;
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
    </label>
  );
}

const fieldControl =
  "w-full rounded-none border-0 border-b bg-transparent px-0 py-2.5 text-[15px] outline-none";

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
          ? "border-line-dark text-cream placeholder:text-[#5c5647] focus:border-gold"
          : "border-line-2 text-ink placeholder:text-faint focus:border-ink",
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
        tone === "dark" ? "border-line-dark text-cream focus:border-gold" : "border-line-2 text-ink focus:border-ink",
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
          "max-h-[90vh] w-full overflow-auto p-7",
          dark ? "border border-line-dark bg-roast text-cream" : "border border-line bg-paper",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-normal tracking-tight">{title}</h2>
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
  return <section className={cn("border border-line bg-paper p-6", className)}>{children}</section>;
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
    <div className="border border-dashed border-line px-5 py-12 text-center text-sm text-mute">{children}</div>
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
    info: "border-line text-ink",
    warn: "border-alert/50 text-alert",
    ok: "border-sky/40 text-sky",
  }[tone];
  return <div className={`mb-4 border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint", className)}>
      {children}
    </span>
  );
}

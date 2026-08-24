import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
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
          ? "border-line-dark bg-roast-2 text-cream placeholder:text-[#736b58] focus:border-gold"
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
          ? "border-line-dark bg-roast-2 text-cream focus:border-gold"
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

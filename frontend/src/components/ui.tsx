import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "ink" | "danger" | "foam" | "sky";
}) {
  const styles = {
    primary: "bg-sun text-ink hover:bg-[#f0c33a]",
    ghost: "bg-transparent text-ink hover:bg-ink/5",
    ink: "bg-ink text-paper hover:bg-ink/90",
    danger: "bg-alert text-white hover:bg-[#c73d24]",
    foam: "bg-foam text-ink border border-line hover:border-ink",
    sky: "bg-sky text-white hover:bg-[#0b6870]",
  }[variant];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition disabled:opacity-40",
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
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-[0.14em] text-mute">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full border border-line bg-foam px-3 py-2.5 text-ink outline-none focus:border-ink",
        props.className,
      )}
    />
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
    <section className={cn("border border-line bg-foam p-5", className)}>{children}</section>
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{kicker}</p>
        <h1 className="mt-1 text-3xl font-medium tracking-tight text-ink">{title}</h1>
        {hint && <p className="mt-2 text-sm text-mute">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-line bg-foam px-5 py-10 text-center text-sm text-mute">
      {children}
    </div>
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
    info: "border-sky/30 bg-sky/5 text-ink",
    warn: "border-alert/40 bg-alert/10 text-alert",
    ok: "border-sky/40 bg-sky/10 text-sky",
  }[tone];
  return <div className={`mb-4 border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

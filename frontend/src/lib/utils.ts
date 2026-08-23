import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("kk-KZ", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0,
  }).format(n);
}

export function payLabel(type: "cash" | "card"): string {
  return type === "cash" ? "Наличный" : "Безналичный";
}

export function payAction(type: "cash" | "card"): string {
  return type === "cash" ? "Оплатить наличными" : "Оплатить безналично";
}

export function qty(value: string | number, unit?: string): string {
  const n = Number(value);
  const text = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return unit ? `${text} ${unit}` : text;
}

export function publicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const api = import.meta.env.VITE_API_URL as string | undefined;
  if (api && api.startsWith("http")) {
    return `${new URL(api).origin}${path}`;
  }
  return path;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfPeriod(period: "today" | "week" | "month"): { from: string; to: string } {
  const now = new Date();
  const to = isoDate(now);
  if (period === "today") return { from: to, to };
  if (period === "week") {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return { from: isoDate(from), to };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: isoDate(from), to };
}

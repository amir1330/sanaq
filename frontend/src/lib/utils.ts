import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { t, useLocale } from "../i18n";

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

export function shortDay(iso: string | null | undefined): string {
  if (!iso) return t("common.none");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t("common.none");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const then = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - then.getTime()) / 86_400_000);
  if (diff === 0) return t("common.today");
  if (diff === 1) return t("common.yesterday");
  if (diff > 1 && diff < 7) return t("common.daysAgo", { n: diff });
  const tag = useLocale.getState().locale === "kk" ? "kk-KZ" : useLocale.getState().locale === "en" ? "en-GB" : "ru-RU";
  return d.toLocaleDateString(tag, { day: "numeric", month: "short" });
}

export function shelfValue(item: {
  value?: string | number | null;
  quantity: string | number;
  cost_per_base_unit: string | number;
}): number {
  if (item.value != null && item.value !== "") return Number(item.value);
  return Number(item.quantity) * Number(item.cost_per_base_unit);
}

export function payLabel(type: "cash" | "card"): string {
  return type === "cash" ? t("pay.cash") : t("pay.card");
}

export function payAction(type: "cash" | "card"): string {
  return payLabel(type);
}

export function qty(value: string | number, unit?: string): string {
  const n = Number(value);
  const digits = Number.isInteger(n) ? 0 : n >= 10 ? 1 : 2;
  const text = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
  if (!unit) return text;
  return `${text} ${unitWord(n, unit)}`;
}

const UNIT_KEYS: Record<string, string> = {
  пачка: "units.pack",
  мешок: "units.bag",
  ящик: "units.box",
  шт: "units.pcs",
  г: "units.g",
  мл: "units.ml",
  кг: "units.kg",
  л: "units.l",
};

export function unitLabel(unit: string): string {
  const key = UNIT_KEYS[unit];
  return key ? t(key) : unit;
}

export function unitWord(_n: number, unit: string): string {
  return unitLabel(unit);
}

export function unitCost(value: string | number, unit?: string): string {
  const n = Number(value ?? 0);
  const text = new Intl.NumberFormat("kk-KZ", {
    style: "currency",
    currency: "KZT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n);
  return unit ? `${text}/${unit}` : text;
}

export const BASE_UNITS = ["г", "мл", "шт"] as const;
export const PURCHASE_UNITS = ["пачка", "мешок", "кг", "г", "л", "мл", "ящик", "шт"] as const;

export function defaultStockCreate() {
  return {
    name: "",
    sku: "",
    base_unit: "мл",
    purchase_unit: "пачка",
    purchase_to_base: "1000",
    min_quantity: "0",
    cost_per_purchase: "0",
    on_pos: true,
  };
}

export function suggestPurchaseFactor(base: string, purchase: string): string {
  if (base === "шт" && purchase === "шт") return "1";
  if (base === "мл" && (purchase === "л" || purchase === "пачка")) return "1000";
  if (base === "г" && (purchase === "кг" || purchase === "мешок")) return "1000";
  if (base === purchase) return "1";
  return "1";
}

export function costPerBase(purchasePrice: string | number, purchaseToBase: string | number): string {
  const pack = Number(purchasePrice);
  const factor = Number(purchaseToBase);
  if (!Number.isFinite(pack) || !Number.isFinite(factor) || factor <= 0) return "0";
  return (pack / factor).toFixed(4);
}

export function costPerPurchase(costPerBaseUnit: string | number, purchaseToBase: string | number): string {
  const base = Number(costPerBaseUnit);
  const factor = Number(purchaseToBase);
  if (!Number.isFinite(base) || !Number.isFinite(factor)) return "0";
  const n = base * (factor > 0 ? factor : 1);
  return String(Number(n.toFixed(4)));
}

export function stockBalance(item: {
  quantity: string | number;
  base_unit: string;
  purchase_unit: string;
  purchase_to_base: string | number;
  quantity_in_purchase?: string | number;
}): string {
  const base = qty(item.quantity, item.base_unit);
  const packs = Number(item.quantity_in_purchase ?? Number(item.quantity) / Number(item.purchase_to_base || 1));
  if (item.purchase_unit === item.base_unit && Number(item.purchase_to_base) === 1) return base;
  return `${base} ≈ ${qty(packs, item.purchase_unit)}`;
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

export type Period = "today" | "week" | "month" | "custom";

export const TIMEZONES = ["Asia/Almaty", "Asia/Aqtobe", "Asia/Aqtau", "Europe/Helsinki", "UTC"];

export function startOfPeriod(period: Exclude<Period, "custom">): { from: string; to: string } {
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

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generatePassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

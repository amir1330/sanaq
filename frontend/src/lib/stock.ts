import type { StockJournalEntry, StockJournalKind } from "../types";
import { qty } from "./utils";

export const WRITEOFF_REASONS = ["бой", "пролив", "дегустация", "срок", "угощение"] as const;

export const MOVE_KINDS: StockJournalKind[] = [
  "income",
  "writeoff",
  "correction",
  "sale",
  "refund",
  "transfer_in",
  "transfer_out",
  "regrade_in",
  "regrade_out",
];

export function kindTitle(kind: StockJournalKind, delta: number | null): string {
  if (kind === "income") return "Пришло на склад";
  if (kind === "writeoff") return "Списали";
  if (kind === "sale") return "Ушло в чек";
  if (kind === "refund") return "Вернули на полку";
  if (kind === "correction") return delta != null && delta < 0 ? "Ревизия · недостача" : "Ревизия · излишек";
  if (kind === "transfer_in") return "Приехало с другой точки";
  if (kind === "transfer_out") return "Уехало на другую точку";
  if (kind === "regrade_in") return "Пересорт · сюда";
  if (kind === "regrade_out") return "Пересорт · отсюда";
  if (kind === "created") return "Добавили карточку";
  if (kind === "updated") return "Изменили карточку";
  return "Удалили карточку";
}

export function deltaBase(row: StockJournalEntry): number | null {
  if (row.quantity_base == null) return null;
  const n = Number(row.quantity_base);
  if (row.kind === "correction") return n;
  if (
    row.kind === "writeoff" ||
    row.kind === "sale" ||
    row.kind === "transfer_out" ||
    row.kind === "regrade_out"
  ) {
    return -Math.abs(n);
  }
  if (
    row.kind === "income" ||
    row.kind === "refund" ||
    row.kind === "transfer_in" ||
    row.kind === "regrade_in"
  ) {
    return Math.abs(n);
  }
  return null;
}

export function formatDelta(row: StockJournalEntry): string | null {
  const d = deltaBase(row);
  if (d == null) return null;
  const sign = d < 0 ? "−" : "+";
  const main = `${sign}${qty(Math.abs(d), row.base_unit ?? undefined)}`;
  if (row.kind === "income" && row.quantity_purchase != null && row.purchase_unit) {
    return `+${qty(row.quantity_purchase, row.purchase_unit)} → ${main}`;
  }
  return main;
}

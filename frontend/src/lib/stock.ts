import type { StockJournalEntry, StockJournalKind } from "../types";
import { t } from "../i18n";
import { qty } from "./utils";

export const WRITEOFF_REASONS = ["бой", "пролив", "дегустация", "срок", "угощение"] as const;

const REASON_KEYS: Record<(typeof WRITEOFF_REASONS)[number], string> = {
  бой: "stock.reasonBreak",
  пролив: "stock.reasonSpill",
  дегустация: "stock.reasonTaste",
  срок: "stock.reasonExpiry",
  угощение: "stock.reasonTreat",
};

export function writeoffReasonLabel(reason: string): string {
  const key = REASON_KEYS[reason as (typeof WRITEOFF_REASONS)[number]];
  return key ? t(key) : reason;
}

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
  if (kind === "income") return t("stock.kindIncome");
  if (kind === "writeoff") return t("stock.kindWriteoff");
  if (kind === "sale") return t("stock.kindSale");
  if (kind === "refund") return t("stock.kindRefund");
  if (kind === "correction") return delta != null && delta < 0 ? t("stock.kindRevShort") : t("stock.kindRevOver");
  if (kind === "transfer_in") return t("stock.kindTransferIn");
  if (kind === "transfer_out") return t("stock.kindTransferOut");
  if (kind === "regrade_in") return t("stock.kindRegradeIn");
  if (kind === "regrade_out") return t("stock.kindRegradeOut");
  if (kind === "created") return t("stock.kindCreated");
  if (kind === "updated") return t("stock.kindUpdated");
  return t("stock.kindDeleted");
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

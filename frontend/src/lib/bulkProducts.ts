import { t } from "../i18n";

/** Parse pasted catalog lines: "Name 1200", "Name — 1200", "Name\t1200". */
export type BulkProductLine = { name: string; sale_price: string; raw: string; ok: boolean; error?: string };

const PRICE_TAIL =
  /^(.*?)(?:\s*[—–\-|;,]?\s+|\t+)(\d+(?:[.,]\d+)?)\s*(?:₸|тг|tg)?\s*$/iu;

export function parseBulkProductLines(text: string): BulkProductLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.map((raw) => {
    const m = raw.match(PRICE_TAIL);
    if (!m) {
      return { name: raw, sale_price: "", raw, ok: false, error: t("products.bulkErrNoPrice") };
    }
    const name = m[1].trim().replace(/[—–\-|;,]+$/, "").trim();
    const sale_price = m[2].replace(",", ".");
    if (!name) {
      return { name: "", sale_price, raw, ok: false, error: t("products.bulkErrNoName") };
    }
    if (!(Number(sale_price) > 0)) {
      return { name, sale_price, raw, ok: false, error: t("products.bulkErrPrice") };
    }
    return { name, sale_price, raw, ok: true };
  });
}

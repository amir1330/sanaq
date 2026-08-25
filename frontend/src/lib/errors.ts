import { t } from "../i18n";

const FIELD_KEYS: Record<string, string> = {
  sale_price: "errors.fieldSalePrice",
  name: "errors.fieldName",
  pin_code: "errors.fieldPin",
  quantity: "errors.fieldQty",
  price_total: "errors.fieldSum",
  min_quantity: "errors.fieldMin",
  full_name: "errors.fieldFullName",
  password: "errors.fieldPassword",
  email: "errors.fieldEmail",
  phone: "errors.fieldPhone",
  category_id: "errors.fieldCategory",
  tax_percent: "errors.fieldVat",
  tax_type: "errors.fieldTaxCode",
};

function fieldLabel(loc: unknown): string {
  if (!Array.isArray(loc)) return "";
  const key = loc.filter((part) => part !== "body" && typeof part === "string").pop();
  if (typeof key !== "string") return "";
  const path = FIELD_KEYS[key];
  return path ? t(path) : key;
}

export function formatApiError(detail: unknown, fallback?: string): string {
  const fb = fallback ?? t("errors.saveFailed");
  if (typeof detail === "string" && detail.trim()) {
    if (detail.startsWith("[") || detail.startsWith("{")) {
      try {
        return formatApiError(JSON.parse(detail), fb);
      } catch {
        return detail;
      }
    }
    return detail;
  }
  if (Array.isArray(detail)) {
    const parts = detail.map((err) => {
      if (!err || typeof err !== "object") return "";
      const row = err as { type?: string; loc?: unknown; msg?: string };
      const field = fieldLabel(row.loc);
      const type = row.type ?? "";
      if (type.includes("decimal") || type.includes("int") || type.includes("float")) {
        return field ? t("errors.numberField", { field }) : t("errors.checkNumbers");
      }
      if (type.includes("missing") || type.includes("value_error")) {
        return field ? t("errors.fillField", { field }) : t("errors.fillRequired");
      }
      if (row.msg && field) return `${field}: ${row.msg}`;
      return row.msg ?? "";
    });
    const text = parts.filter(Boolean).join(". ");
    return text || fb;
  }
  if (detail && typeof detail === "object") return fb;
  return fb;
}

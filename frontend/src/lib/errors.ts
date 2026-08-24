const FIELD_RU: Record<string, string> = {
  sale_price: "цену",
  name: "название",
  pin_code: "PIN",
  quantity: "количество",
  price_total: "сумму",
  min_quantity: "минимум",
  full_name: "имя",
  password: "пароль",
  email: "почту",
  phone: "телефон",
  category_id: "категорию",
  tax_percent: "НДС",
  tax_type: "код налога",
};

function fieldLabel(loc: unknown): string {
  if (!Array.isArray(loc)) return "";
  const key = loc.filter((part) => part !== "body" && typeof part === "string").pop();
  if (typeof key !== "string") return "";
  return FIELD_RU[key] ?? key;
}

export function formatApiError(detail: unknown, fallback = "Не сохранилось"): string {
  if (typeof detail === "string" && detail.trim()) {
    if (detail.startsWith("[") || detail.startsWith("{")) {
      try {
        return formatApiError(JSON.parse(detail), fallback);
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
        return field ? `Укажи ${field} числом` : "Проверь числа в форме";
      }
      if (type.includes("missing") || type.includes("value_error")) {
        return field ? `Заполни ${field}` : "Заполни обязательные поля";
      }
      if (row.msg && field) return `${field}: ${row.msg}`;
      return row.msg ?? "";
    });
    const text = parts.filter(Boolean).join(". ");
    return text || fallback;
  }
  if (detail && typeof detail === "object") return fallback;
  return fallback;
}

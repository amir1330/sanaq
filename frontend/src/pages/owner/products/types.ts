import type { Product } from "../../../types";

export type ViewMode = "list" | "tiles";
export const VIEW_KEY = "sanaq-products-view";
export const PAGE_SIZE = 50;

export function readViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "tiles" || v === "list") return v;
  } catch {
    /* ignore */
  }
  return "list";
}

export type IngRow = {
  stock_item_id: number | "";
  quantity: string;
  name?: string;
  base_unit?: string;
  cost_per_base_unit?: string;
};

export type VariantRow = {
  id?: number;
  name: string;
  name_kk: string;
  name_en: string;
  sale_price: string;
  barcode: string;
  is_default: boolean;
  is_active: boolean;
  ingredients: IngRow[];
};

export type Draft = {
  id?: number;
  name: string;
  name_kk: string;
  name_en: string;
  barcode: string;
  sale_price: string;
  category_id: number | null;
  is_active: boolean;
  is_service: boolean;
  has_variants: boolean;
  tax_percent: string;
  tax_type: string;
  image_url: string | null;
  ingredients: IngRow[];
  variants: VariantRow[];
};

export function draftFromProduct(p: Product, categoryId?: number | null): Draft {
  const variants =
    p.variants?.map((v) => ({
      id: v.id,
      name: v.name ?? "",
      name_kk: v.name_kk ?? "",
      name_en: v.name_en ?? "",
      sale_price: v.sale_price ?? "",
      barcode: v.barcode ?? "",
      is_default: Boolean(v.is_default),
      is_active: v.is_active ?? true,
      ingredients:
        v.ingredients?.map((i) => ({
          stock_item_id: i.stock_item_id,
          quantity: String(i.quantity),
          name: i.stock_item_name ?? undefined,
          base_unit: i.unit ?? undefined,
        })) ?? [],
    })) ?? [];
  return {
    id: p.id,
    name: p.name ?? "",
    name_kk: p.name_kk ?? "",
    name_en: p.name_en ?? "",
    barcode: p.barcode ?? "",
    sale_price: p.sale_price ?? "",
    category_id: p.category_id ?? categoryId ?? null,
    is_active: p.is_active ?? true,
    is_service: Boolean(p.is_service ?? !(p.ingredients?.length || variants.length)),
    has_variants: variants.length > 0,
    tax_percent: p.tax_percent ?? "0",
    tax_type: String(p.tax_type ?? 0),
    image_url: p.image_url ?? null,
    ingredients:
      p.ingredients?.map((i) => ({
        stock_item_id: i.stock_item_id,
        quantity: String(i.quantity),
        name: i.stock_item_name ?? undefined,
        base_unit: i.unit ?? undefined,
      })) ?? [],
    variants,
  };
}

export function emptyVariant(isDefault = false): VariantRow {
  return {
    name: "",
    name_kk: "",
    name_en: "",
    sale_price: "",
    barcode: "",
    is_default: isDefault,
    is_active: true,
    ingredients: [],
  };
}

export function emptyDraft(categoryId?: number | null): Draft {
  return {
    name: "",
    name_kk: "",
    name_en: "",
    barcode: "",
    sale_price: "",
    category_id: categoryId ?? null,
    is_active: true,
    is_service: false,
    has_variants: false,
    tax_percent: "0",
    tax_type: "0",
    image_url: null,
    ingredients: [],
    variants: [],
  };
}

/** Prepare variant rows for API: ensure default, valid prices, stable sort_order. */
export function normalizeVariantsForSave(variants: VariantRow[]) {
  const rows = variants
    .filter((v) => v.name.trim() && v.sale_price.trim())
    .map((v, idx) => ({
      id: v.id,
      name: v.name.trim(),
      name_kk: v.name_kk.trim() || null,
      name_en: v.name_en.trim() || null,
      sort_order: idx,
      sale_price: v.sale_price.replace(",", "."),
      sku: null as string | null,
      barcode: v.barcode.trim() || null,
      is_default: v.is_default,
      is_active: v.is_active,
      ingredients: v.ingredients
        .filter((i) => i.stock_item_id && i.quantity)
        .map((i) => ({ stock_item_id: Number(i.stock_item_id), quantity: i.quantity })),
    }));
  if (rows.length > 0 && !rows.some((v) => v.is_default)) {
    rows[0] = { ...rows[0], is_default: true };
  }
  return rows;
}

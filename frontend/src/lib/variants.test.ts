import { describe, expect, it } from "vitest";
import { collectVariantColumns } from "./vitrineLayout";
import { normalizeVariantsForSave } from "../pages/owner/products/types";
import type { Product } from "../types";

describe("normalizeVariantsForSave", () => {
  it("sets first variant as default when none marked", () => {
    const rows = normalizeVariantsForSave([
      {
        name: "Small",
        name_kk: "",
        name_en: "",
        sale_price: "900",
        barcode: "",
        is_default: false,
        is_active: true,
        ingredients: [],
      },
      {
        name: "Large",
        name_kk: "",
        name_en: "",
        sale_price: "1200",
        barcode: "",
        is_default: false,
        is_active: true,
        ingredients: [],
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].is_default).toBe(true);
    expect(rows[1].is_default).toBe(false);
  });
});

describe("collectVariantColumns", () => {
  it("aligns prices by sort_order not name spelling", () => {
    const cappuccino: Product = {
      id: 1,
      shop_id: 1,
      category_id: 1,
      name: "Cappuccino",
      name_kk: null,
      name_en: null,
      sale_price: "1000",
      is_active: true,
      is_service: false,
      sort_order: 0,
      image_url: null,
      created_at: "2026-01-01T00:00:00Z",
      variants: [
        {
          id: 1,
          product_id: 1,
          name: "Small",
          name_kk: null,
          name_en: null,
          sort_order: 0,
          sale_price: "900",
          sku: null,
          barcode: null,
          is_default: false,
          is_active: true,
          ingredients: [],
        },
        {
          id: 2,
          product_id: 1,
          name: "Large",
          name_kk: null,
          name_en: null,
          sort_order: 1,
          sale_price: "1200",
          sku: null,
          barcode: null,
          is_default: true,
          is_active: true,
          ingredients: [],
        },
      ],
      ingredients: [],
    };
    const cols = collectVariantColumns([cappuccino], "en");
    expect(cols.map((c) => c.sortOrder)).toEqual([0, 1]);
    expect(cols[0].label).toBe("Small");
  });
});

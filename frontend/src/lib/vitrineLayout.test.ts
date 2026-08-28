import { describe, expect, it } from "vitest";
import {
  autoColumnsFromCatalog,
  editorColumnsToPayload,
  savedToEditor,
  type EditorColumn,
} from "./vitrineLayout";
import type { Category, Product, VitrineColumn } from "../types";

const product = (id: number, category_id: number | null, name: string): Product =>
  ({
    id,
    shop_id: 1,
    category_id,
    name,
    name_kk: null,
    name_en: null,
    sale_price: "1000",
    is_active: true,
    is_service: false,
    sort_order: id,
    image_url: null,
    created_at: "2026-01-01T00:00:00Z",
    variants: [],
    ingredients: [],
  }) satisfies Product;

describe("vitrine layout save payload", () => {
  it("serializes editor columns for PUT /vitrine-layout", () => {
    const columns: EditorColumn[] = [
      {
        key: "c1",
        title: "Coffee",
        header_style: "ornament",
        items: [
          { key: "i1", product_id: 10, product: product(10, 1, "Latte") },
          { key: "i2", product_id: 11, product: product(11, 1, "Cappuccino") },
        ],
      },
    ];

    expect(editorColumnsToPayload(columns, "New column")).toEqual({
      columns: [
        {
          title: "Coffee",
          sort_order: 0,
          header_style: "ornament",
          items: [
            { product_id: 10, sort_order: 0 },
            { product_id: 11, sort_order: 1 },
          ],
        },
      ],
    });
  });

  it("round-trips saved layout columns into editor state", () => {
    const saved: VitrineColumn[] = [
      {
        id: 5,
        title: "Pastries",
        sort_order: 0,
        header_style: "line",
        items: [{ id: 9, product_id: 3, sort_order: 0, product: product(3, 2, "Croissant") }],
      },
    ];
    const editor = savedToEditor(saved);
    expect(editor[0].title).toBe("Pastries");
    expect(editor[0].items[0].product_id).toBe(3);
  });

  it("builds columns from catalog categories", () => {
    const categories: Category[] = [{ id: 1, shop_id: 1, name: "Coffee", name_kk: null, name_en: null, sort_order: 0 }];
    const products = [product(1, 1, "Espresso"), product(2, null, "Water")];
    const cols = autoColumnsFromCatalog(products, categories, "Other", "ru");
    expect(cols).toHaveLength(2);
    expect(cols[0].items).toHaveLength(1);
    expect(cols[1].title).toBe("Other");
  });
});

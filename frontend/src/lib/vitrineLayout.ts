import { localizedName } from "./i18nName";
import type { Locale } from "../i18n/types";
import type { Category, Product, VitrineColumn } from "../types";

export type HeaderStyle = "ornament" | "line" | "none";

export type EditorItem = {
  key: string;
  product_id: number;
  product: Product;
};

export type EditorColumn = {
  key: string;
  title: string;
  header_style: HeaderStyle;
  items: EditorItem[];
};

export function newEditorKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function activeVariants(product: Product) {
  return (product.variants ?? []).filter((v) => v.is_active);
}

export function hasVariantPrices(product: Product) {
  return activeVariants(product).length > 0;
}

export function collectVariantNames(products: Product[]): string[] {
  const order = new Map<string, number>();
  for (const p of products) {
    for (const v of [...activeVariants(p)].sort((a, b) => a.sort_order - b.sort_order)) {
      if (!order.has(v.name)) order.set(v.name, v.sort_order);
    }
  }
  return [...order.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);
}

export function savedToEditor(cols: VitrineColumn[]): EditorColumn[] {
  return cols.map((col) => ({
    key: String(col.id),
    title: col.title,
    header_style: (col.header_style as HeaderStyle) || "ornament",
    items: col.items.map((item) => ({
      key: String(item.id),
      product_id: item.product_id,
      product: item.product,
    })),
  }));
}

export function editorColumnsToPayload(columns: EditorColumn[], defaultTitle: string) {
  return {
    columns: columns.map((col, colIdx) => ({
      title: col.title.trim() || defaultTitle,
      sort_order: colIdx,
      header_style: col.header_style,
      items: col.items.map((item, itemIdx) => ({
        product_id: item.product_id,
        sort_order: itemIdx,
      })),
    })),
  };
}

export function autoColumnsFromCatalog(
  allProducts: Product[],
  categories: Category[],
  otherLabel: string,
  locale: Locale,
): EditorColumn[] {
  const active = allProducts.filter((p) => p.is_active && !p.is_service);
  const blocks = categories
    .map((c) => ({
      key: `cat-${c.id}`,
      title: localizedName(c, locale),
      header_style: "ornament" as HeaderStyle,
      items: active
        .filter((p) => p.category_id === c.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((p) => ({ key: `p-${p.id}`, product_id: p.id, product: p })),
    }))
    .filter((b) => b.items.length > 0);
  const rest = active.filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id));
  if (rest.length) {
    blocks.push({
      key: "cat-0",
      title: otherLabel,
      header_style: "ornament",
      items: rest
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((p) => ({ key: `p-${p.id}`, product_id: p.id, product: p })),
    });
  }
  return blocks;
}

export function printVitrineMenu(orientation: "portrait" | "landscape") {
  const styleId = "vitrine-print-page";
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = `@media print { @page { size: ${orientation}; margin: 10mm; } }`;
  document.documentElement.dataset.vitrinePrint = orientation;
  const cleanup = () => {
    delete document.documentElement.dataset.vitrinePrint;
    style?.remove();
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
}

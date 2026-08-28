import type { Discount } from "../../lib/discount";
import { money } from "../../lib/utils";
import type { Product, ProductVariant } from "../../types";

export type Line = {
  product: Product;
  variant: ProductVariant | null;
  quantity: number;
  discount?: Discount | null;
};

export type MobileTab = "products" | "cart" | "shift";

export type DiscountDraft = { type: Discount["type"]; value: string };

export type PosPanel = "none" | "open" | "close" | "move" | "seller" | "receipts";

export function lineKey(productId: number, variantId: number | null | undefined) {
  return `${productId}:${variantId ?? ""}`;
}

export function linePrice(line: Line): string {
  return line.variant?.sale_price ?? line.product.sale_price;
}

export function activeVariants(product: Product): ProductVariant[] {
  return (product.variants ?? []).filter((v) => v.is_active);
}

export function productPriceLabel(product: Product): string {
  const vs = activeVariants(product);
  if (vs.length === 0) return money(product.sale_price);
  if (vs.length === 1) return money(vs[0].sale_price);
  const prices = vs.map((v) => Number(v.sale_price));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
}

export const PRODUCT_PAGE = 60;
export const CASH_NOTES = [10_000, 5_000, 1_000] as const;

import type { Discount } from "../../lib/discount";
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

export const PRODUCT_PAGE = 60;
export const CASH_NOTES = [10_000, 5_000, 1_000] as const;

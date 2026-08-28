import { money } from "./utils";
import type { Product, ProductVariant } from "../types";

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

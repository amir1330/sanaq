/** Discount math mirrored from backend create_sale. */

export type DiscountType = "percent" | "amount";
export type Discount = { type: DiscountType; value: number };

export function discountAmount(base: number, discount: Discount | null | undefined): number {
  if (!discount || !Number.isFinite(discount.value) || discount.value <= 0 || base <= 0) return 0;
  if (discount.type === "percent") {
    const pct = Math.min(discount.value, 100);
    return Math.round(((base * pct) / 100) * 100) / 100;
  }
  return Math.round(Math.min(discount.value, base) * 100) / 100;
}

export function lineGross(price: number | string, qty: number): number {
  return Math.round(Number(price) * qty * 100) / 100;
}

export function lineTotal(price: number | string, qty: number, discount?: Discount | null): number {
  const gross = lineGross(price, qty);
  return Math.round((gross - discountAmount(gross, discount)) * 100) / 100;
}

export function cartTotals(
  lines: { price: number | string; quantity: number; discount?: Discount | null }[],
  receiptDiscount?: Discount | null,
): { subtotal: number; itemsDiscount: number; afterItems: number; receiptDiscount: number; total: number; discountTotal: number } {
  let subtotal = 0;
  let itemsDiscount = 0;
  for (const line of lines) {
    const gross = lineGross(line.price, line.quantity);
    const disc = discountAmount(gross, line.discount);
    subtotal += gross;
    itemsDiscount += disc;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  itemsDiscount = Math.round(itemsDiscount * 100) / 100;
  const afterItems = Math.round((subtotal - itemsDiscount) * 100) / 100;
  const receipt = discountAmount(afterItems, receiptDiscount);
  const total = Math.round((afterItems - receipt) * 100) / 100;
  return {
    subtotal,
    itemsDiscount,
    afterItems,
    receiptDiscount: receipt,
    total,
    discountTotal: Math.round((itemsDiscount + receipt) * 100) / 100,
  };
}

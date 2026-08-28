import { describe, expect, it } from "vitest";
import { cartTotals, lineTotal } from "./discount";

describe("POS sale totals", () => {
  it("sums line prices without discounts", () => {
    const totals = cartTotals([
      { price: "1200", quantity: 2 },
      { price: 500, quantity: 1 },
    ]);
    expect(totals.subtotal).toBe(2900);
    expect(totals.total).toBe(2900);
  });

  it("applies line and receipt discounts", () => {
    const totals = cartTotals(
      [{ price: 1000, quantity: 2, discount: { type: "percent", value: 10 } }],
      { type: "amount", value: 100 },
    );
    expect(lineTotal(1000, 2, { type: "percent", value: 10 })).toBe(1800);
    expect(totals.afterItems).toBe(1800);
    expect(totals.receiptDiscount).toBe(100);
    expect(totals.total).toBe(1700);
  });
});

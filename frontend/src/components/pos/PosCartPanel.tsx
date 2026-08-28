import type { Dispatch, SetStateAction } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { Banner, Button } from "../ui";
import { DiscountEditor } from "./DiscountEditor";
import { cartTotals, lineGross, lineTotal, type Discount } from "../../lib/discount";
import { localizedName } from "../../lib/i18nName";
import { money, payAction } from "../../lib/utils";
import type { Locale } from "../../i18n/types";
import {
  CASH_NOTES,
  lineKey,
  linePrice,
  type DiscountDraft,
  type Line,
} from "../../pages/pos/types";
import type { Product } from "../../types";

type CartTotals = ReturnType<typeof cartTotals>;

export function PosProductsPanel({
  t,
  locale,
  productSearch,
  onProductSearchChange,
  onSearchEnter,
  notice,
  onDismissNotice,
  shiftOpen,
  salesFrozen,
  revisionId,
  visible,
  onAddProduct,
  productPriceLabel,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  productSearch: string;
  onProductSearchChange: (value: string) => void;
  onSearchEnter: () => void;
  notice: { tone: "ok" | "warn"; text: string } | null;
  onDismissNotice: () => void;
  shiftOpen: boolean;
  salesFrozen: boolean;
  revisionId: number | null;
  visible: Product[];
  onAddProduct: (product: Product) => void;
  productPriceLabel: (product: Product) => string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  return (
    <section id="main-content" className="flex h-full flex-col overflow-hidden bg-paper-2">
      <div className="sticky top-0 z-10 border-b border-line bg-paper-2 p-4 sm:px-6 sm:pt-6 sm:pb-3">
        <input
          className="w-full rounded-md border-[1.5px] border-line-2 bg-paper px-4 py-2.5 text-[14px] text-ink outline-none focus:border-ink"
          value={productSearch}
          onChange={(e) => onProductSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            onSearchEnter();
          }}
          placeholder={t("pos.searchProducts")}
          aria-label={t("pos.searchProducts")}
          autoComplete="off"
          enterKeyHint="done"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 sm:pt-3">
        {notice && (
          <Banner tone={notice.tone}>
            {notice.text}{" "}
            <button type="button" className="underline" onClick={onDismissNotice}>
              {t("pos.hide")}
            </button>
          </Banner>
        )}
        {!shiftOpen && <Banner tone="warn">{t("pos.closedBanner")}</Banner>}
        {salesFrozen && <Banner tone="warn">{t("pos.revisionBanner", { id: revisionId! })}</Banner>}
        <div className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-2 md:grid-cols-3">
          {visible.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAddProduct(p)}
              className={`min-h-[5.5rem] rounded-lg border-[1.5px] border-transparent bg-paper px-3 py-4 text-left text-ink transition hover:-translate-y-0.5 hover:border-gold sm:px-4 sm:py-[18px] ${!shiftOpen || salesFrozen ? "opacity-50" : ""}`}
            >
              <p className="truncate font-mono text-[9.5px] uppercase tracking-wide text-ink-soft">
                {localizedName(
                  {
                    name: p.category_name ?? "",
                    name_kk: p.category_name_kk,
                    name_en: p.category_name_en,
                  },
                  locale,
                )}
              </p>
              <p className="mt-2 break-words text-[14.5px] font-medium leading-snug">{localizedName(p, locale)}</p>
              {p.barcode ? (
                <p className="mt-1 font-mono text-[11px] text-ink-soft">{p.barcode}</p>
              ) : null}
              <p className="mt-3 font-mono text-sm font-semibold text-gold">{productPriceLabel(p)}</p>
            </button>
          ))}
        </div>
        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button variant="quiet" disabled={isFetchingNextPage} onClick={onLoadMore}>
              {isFetchingNextPage ? t("common.loading") : t("common.loadMore")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export function PosCartPanel({
  t,
  locale,
  cart,
  setCart,
  canDiscount,
  lineDiscountEdit,
  setLineDiscountEdit,
  lineDiscountDraft,
  setLineDiscountDraft,
  receiptDiscount,
  setReceiptDiscount,
  receiptDiscountEdit,
  setReceiptDiscountEdit,
  receiptDiscountDraft,
  setReceiptDiscountDraft,
  applyDraft,
  changeQty,
  totals,
  total,
  shiftOpen,
  salesFrozen,
  cashPayOpen,
  tendered,
  setTendered,
  changeDue,
  tenderEnough,
  sell,
  onOpenCashPay,
  onResetTender,
  onAddNote,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  cart: Line[];
  setCart: Dispatch<SetStateAction<Line[]>>;
  canDiscount: boolean;
  lineDiscountEdit: string | null;
  setLineDiscountEdit: (key: string | null) => void;
  lineDiscountDraft: DiscountDraft;
  setLineDiscountDraft: Dispatch<SetStateAction<DiscountDraft>>;
  receiptDiscount: Discount | null;
  setReceiptDiscount: (discount: Discount | null) => void;
  receiptDiscountEdit: boolean;
  setReceiptDiscountEdit: (open: boolean) => void;
  receiptDiscountDraft: DiscountDraft;
  setReceiptDiscountDraft: Dispatch<SetStateAction<DiscountDraft>>;
  applyDraft: (draft: DiscountDraft) => Discount | null;
  changeQty: (productId: number, variantId: number | null, delta: number) => void;
  totals: CartTotals;
  total: number;
  shiftOpen: boolean;
  salesFrozen: boolean;
  cashPayOpen: boolean;
  tendered: number;
  setTendered: Dispatch<SetStateAction<number>>;
  changeDue: number;
  tenderEnough: boolean;
  sell: UseMutationResult<unknown, Error, "cash" | "card", unknown>;
  onOpenCashPay: () => void;
  onResetTender: () => void;
  onAddNote: (n: number) => void;
}) {
  return (
    <aside className="flex h-full flex-col overflow-y-auto px-5 py-6">
      <h4 className="mb-4 shrink-0 font-display text-[19px] font-normal">{t("pos.cart")}</h4>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {cart.length === 0 && (
          <p className="py-5 text-center text-[13px] text-ink-soft">{t("pos.cartEmpty")}</p>
        )}
        {cart.map((l) => {
          const key = lineKey(l.product.id, l.variant?.id);
          const price = linePrice(l);
          const gross = lineGross(price, l.quantity);
          const net = lineTotal(price, l.quantity, l.discount);
          const hasDisc = Boolean(l.discount && Number(l.discount.value) > 0);
          const title = l.variant
            ? `${localizedName(l.product, locale)} — ${localizedName(l.variant, locale)}`
            : localizedName(l.product, locale);
          return (
            <div key={key} className="rounded-md bg-paper-2 px-3.5 py-2.5 text-[13.5px]">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-base leading-none text-ink lg:h-[22px] lg:w-[22px] lg:text-xs"
                    onClick={() => changeQty(l.product.id, l.variant?.id ?? null, -1)}
                  >
                    −
                  </button>
                  <span className="min-w-[1.25rem] text-center">{l.quantity}</span>
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-base leading-none text-ink lg:h-[22px] lg:w-[22px] lg:text-xs"
                    onClick={() => changeQty(l.product.id, l.variant?.id ?? null, 1)}
                  >
                    +
                  </button>
                </div>
                <span className="min-w-0 flex-1 break-words">{title}</span>
                <span className="shrink-0 text-right font-mono font-semibold text-gold">
                  {hasDisc ? (
                    <>
                      <span className="block text-[11px] font-normal text-ink-soft line-through">
                        {money(gross)}
                      </span>
                      {money(net)}
                    </>
                  ) : (
                    money(net)
                  )}
                </span>
              </div>
              {hasDisc && (
                <p className="mt-1 text-[11px] text-ink-soft">
                  {t("pos.discountOf", { n: money(gross - net) })}
                </p>
              )}
              {canDiscount && (
                <div className="mt-1.5">
                  {lineDiscountEdit === key ? (
                    <DiscountEditor
                      draft={lineDiscountDraft}
                      onChange={setLineDiscountDraft}
                      applyLabel={t("pos.discountApply")}
                      percentLabel={t("pos.discountPercent")}
                      amountLabel={t("pos.discountAmount")}
                      onApply={() => {
                        const next = applyDraft(lineDiscountDraft);
                        setCart((prev) =>
                          prev.map((row) =>
                            lineKey(row.product.id, row.variant?.id) === key
                              ? { ...row, discount: next }
                              : row,
                          ),
                        );
                        setLineDiscountEdit(null);
                      }}
                      onCancel={() => setLineDiscountEdit(null)}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-[11px] text-ink-soft underline"
                        onClick={() => {
                          setLineDiscountEdit(key);
                          setLineDiscountDraft({
                            type: l.discount?.type ?? "percent",
                            value: l.discount ? String(l.discount.value) : "",
                          });
                        }}
                      >
                        {hasDisc ? t("pos.discountItem") : t("pos.discountAdd")}
                      </button>
                      {hasDisc && (
                        <button
                          type="button"
                          className="text-[11px] text-maroon underline"
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((row) =>
                                lineKey(row.product.id, row.variant?.id) === key
                                  ? { ...row, discount: null }
                                  : row,
                              ),
                            )
                          }
                        >
                          {t("pos.discountRemove")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 mt-3.5 border-t border-line bg-paper pt-4">
        {canDiscount && (
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span className="text-ink-soft">{t("pos.discountReceipt")}</span>
              {receiptDiscount && Number(receiptDiscount.value) > 0 ? (
                <button
                  type="button"
                  className="text-maroon underline"
                  onClick={() => {
                    setReceiptDiscount(null);
                    setReceiptDiscountEdit(false);
                  }}
                >
                  {t("pos.discountRemove")}
                </button>
              ) : (
                <button
                  type="button"
                  className="underline text-ink-soft"
                  onClick={() => {
                    setReceiptDiscountEdit(true);
                    setReceiptDiscountDraft({ type: "percent", value: "" });
                  }}
                >
                  {t("pos.discountAdd")}
                </button>
              )}
            </div>
            {receiptDiscount && Number(receiptDiscount.value) > 0 && !receiptDiscountEdit && (
              <p className="text-[12px] text-ink-soft">
                {receiptDiscount.type === "percent"
                  ? `${receiptDiscount.value}%`
                  : money(receiptDiscount.value)}{" "}
                → −{money(totals.receiptDiscount)}
              </p>
            )}
            {receiptDiscountEdit && (
              <DiscountEditor
                draft={receiptDiscountDraft}
                onChange={setReceiptDiscountDraft}
                applyLabel={t("pos.discountApply")}
                percentLabel={t("pos.discountPercent")}
                amountLabel={t("pos.discountAmount")}
                onApply={() => {
                  setReceiptDiscount(applyDraft(receiptDiscountDraft));
                  setReceiptDiscountEdit(false);
                }}
                onCancel={() => setReceiptDiscountEdit(false)}
              />
            )}
          </div>
        )}
        <div className="mb-3 space-y-1.5 rounded-md border border-line bg-paper-2 px-3 py-3 font-mono text-[13px]">
          <div className="flex justify-between text-ink-soft">
            <span>{t("pos.subtotal")}</span>
            <span>{money(totals.subtotal)}</span>
          </div>
          {totals.discountTotal > 0 && (
            <div className="flex justify-between text-ink-soft">
              <span>{t("pos.discountItem")}</span>
              <span>−{money(totals.discountTotal)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between text-ink">
            <span>{t("pos.toPay")}</span>
            <b className="text-[22px] font-semibold">{money(total)}</b>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>{t("pos.amountReceived")}</span>
            <span>{money(cashPayOpen || tendered > 0 ? tendered : 0)}</span>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>{t("pos.changeDue")}</span>
            <span className={changeDue > 0 ? "font-semibold text-ink" : ""}>{money(changeDue)}</span>
          </div>
        </div>

        {cashPayOpen ? (
          <div className="mb-3 space-y-2.5 rounded-md border border-line bg-cream px-3 py-3">
            <p className="font-sans text-[12.5px] text-ink-soft">{t("pos.tenderHint")}</p>
            <input
              className="w-full rounded-md border-[1.5px] border-line-2 bg-paper px-3 py-2.5 font-mono text-[18px] text-ink outline-none focus:border-ink"
              value={tendered ? String(tendered) : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
                const n = Number(raw);
                setTendered(Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0);
              }}
              inputMode="decimal"
              placeholder="0"
              autoFocus
            />
            <div className="grid grid-cols-3 gap-2">
              {CASH_NOTES.map((n) => (
                <Button key={n} variant="quiet" className="w-full font-mono" onClick={() => onAddNote(n)}>
                  +{n.toLocaleString("ru-RU")}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="quiet" onClick={() => setTendered(total)} disabled={total <= 0}>
                {t("pos.tenderExact")}
              </Button>
              <Button variant="ghost" onClick={() => setTendered(0)}>
                {t("pos.tenderClear")}
              </Button>
            </div>
            <Button
              variant="confirm"
              size="lg"
              className="w-full"
              disabled={!shiftOpen || salesFrozen || !tenderEnough || sell.isPending}
              onClick={() => sell.mutate("cash")}
            >
              {sell.isPending ? t("pos.writing") : t("pos.confirmCash")}
            </Button>
            <Button variant="ghost" className="w-full" onClick={onResetTender}>
              {t("common.cancel")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="confirm"
              size="lg"
              className="w-full"
              disabled={!shiftOpen || salesFrozen || cart.length === 0 || sell.isPending}
              onClick={onOpenCashPay}
            >
              {payAction("cash")}
            </Button>
            <Button
              variant="sky"
              size="lg"
              className="w-full"
              disabled={!shiftOpen || salesFrozen || cart.length === 0 || sell.isPending}
              onClick={() => {
                onResetTender();
                sell.mutate("card");
              }}
            >
              {payAction("card")}
            </Button>
          </div>
        )}
        {cart.length > 0 && (
          <Button
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => {
              setCart([]);
              setReceiptDiscount(null);
              onResetTender();
            }}
          >
            {t("pos.clearCart")}
          </Button>
        )}
      </div>
    </aside>
  );
}

import type { UseMutationResult } from "@tanstack/react-query";
import { Button, Dialog } from "../ui";
import { dateLocaleTag, localizedName } from "../../lib/i18nName";
import { money, payLabel } from "../../lib/utils";
import type { Locale } from "../../i18n/types";
import { activeVariants } from "../../lib/productVariants";
import type { PosPanel } from "../../pages/pos/types";
import type { CrewMember, Product, ProductVariant, Shift, ShiftSale } from "../../types";

export function PosShiftDialog({
  t,
  locale,
  panel,
  panelTitle,
  panelHint,
  onClose,
  cashOpen,
  onCashOpenChange,
  openShift,
  shift,
  cashClose,
  onCashCloseChange,
  closeShift,
  onOpenMovePanel,
  crew,
  sellerId,
  onChooseSeller,
  findReceiptId,
  onFindReceiptIdChange,
  findReceiptError,
  onFindReceipt,
  refundTarget,
  onRefundTarget,
  restoreStock,
  onRestoreStockChange,
  refund,
  salesFrozen,
  revisionId,
  moveType,
  onMoveTypeChange,
  moveAmount,
  onMoveAmountChange,
  cashMove,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  panel: PosPanel;
  panelTitle: string;
  panelHint: string | undefined;
  onClose: () => void;
  cashOpen: string;
  onCashOpenChange: (value: string) => void;
  openShift: UseMutationResult<unknown, Error, void, unknown>;
  shift: Shift | null | undefined;
  cashClose: string;
  onCashCloseChange: (value: string) => void;
  closeShift: UseMutationResult<unknown, Error, boolean, unknown>;
  onOpenMovePanel: () => void;
  crew: CrewMember[] | undefined;
  sellerId: number | undefined;
  onChooseSeller: (member: CrewMember) => void;
  findReceiptId: string;
  onFindReceiptIdChange: (value: string) => void;
  findReceiptError: string | null;
  onFindReceipt: () => void;
  refundTarget: ShiftSale | null;
  onRefundTarget: (sale: ShiftSale | null) => void;
  restoreStock: boolean;
  onRestoreStockChange: (value: boolean) => void;
  refund: UseMutationResult<unknown, Error, boolean, unknown>;
  salesFrozen: boolean;
  revisionId: number | null;
  moveType: "deposit" | "withdrawal";
  onMoveTypeChange: (type: "deposit" | "withdrawal") => void;
  moveAmount: string;
  onMoveAmountChange: (value: string) => void;
  cashMove: UseMutationResult<unknown, Error, void, unknown>;
}) {
  if (panel === "none") return null;

  return (
    <Dialog
      open
      title={panelTitle}
      hint={panelHint}
      onClose={onClose}
      size={panel === "receipts" && !refundTarget ? "lg" : "md"}
    >
      {panel === "open" && (
        <>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            {t("pos.cashInDrawer")}
            <input
              className="mt-2 w-full rounded-md border-[1.5px] border-line-2 bg-cream px-4 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
              value={cashOpen}
              onChange={(e) => onCashOpenChange(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              autoFocus
            />
          </label>
          <div className="mt-6 flex gap-3">
            <Button variant="confirm" className="flex-1" onClick={() => openShift.mutate()}>
              {t("pos.openShift")}
            </Button>
            <Button variant="ghost" className="text-ink-soft" onClick={onClose}>
              {t("common.back")}
            </Button>
          </div>
        </>
      )}
      {panel === "close" && (
        <>
          <div className="rounded-md bg-paper-2 px-4 py-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-ink-soft">{t("pos.closeStart")}</span>
              <span className="font-mono">{money(shift?.opening_cash)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-ink-soft">{t("pos.closeCashSales")}</span>
              <span className="font-mono">{money(shift?.cash_revenue)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-ink-soft">{t("pos.closeDeposits")}</span>
              <span className="font-mono">{money(shift?.deposits)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-ink-soft">{t("pos.closeWithdrawals")}</span>
              <span className="font-mono">{money(shift?.withdrawals)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-2 font-medium">
              <span>{t("pos.closeExpected")}</span>
              <span className="font-mono">{money(shift?.expected_cash)}</span>
            </div>
          </div>
          <button
            type="button"
            className="mt-3 text-left text-[13px] text-ink-soft underline hover:text-ink"
            onClick={onOpenMovePanel}
          >
            {t("pos.closeWithdrawFirst")}
          </button>
          <label className="mt-4 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            {t("pos.closeCounted")}
            <input
              className="mt-2 w-full rounded-md border-[1.5px] border-line-2 bg-cream px-4 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
              value={cashClose}
              onChange={(e) => onCashCloseChange(e.target.value)}
              placeholder={String(shift?.expected_cash ?? "")}
              inputMode="decimal"
              autoFocus
            />
          </label>
          {(shift?.fiscal_pending_count ?? 0) > 0 && (
            <p className="mt-3 text-sm text-alert">
              {t("pos.closePendingOfd", { n: shift?.fiscal_pending_count ?? 0 })}
            </p>
          )}
          {closeShift.isError && <p className="mt-3 text-sm text-alert">{(closeShift.error as Error).message}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="confirm"
              className="flex-1"
              disabled={cashClose.trim() === "" || closeShift.isPending}
              onClick={() => closeShift.mutate(false)}
            >
              {t("pos.closeShift")}
            </Button>
            <Button variant="ghost" className="text-ink-soft" onClick={onClose}>
              {t("common.back")}
            </Button>
            {closeShift.isError && (
              <Button variant="danger" onClick={() => closeShift.mutate(true)}>
                {t("pos.closeAnyway")}
              </Button>
            )}
          </div>
        </>
      )}
      {panel === "seller" && (
        <>
          <div>
            {(crew ?? []).map((member) => (
              <button
                key={member.id}
                type="button"
                className={`block w-full border-b border-line py-2.5 text-left text-sm ${
                  sellerId === member.id ? "text-ink" : "text-ink-soft"
                }`}
                onClick={() => onChooseSeller(member)}
              >
                {member.full_name}
              </button>
            ))}
          </div>
          <Button variant="ghost" className="mt-4 text-ink-soft" onClick={onClose}>
            {t("common.back")}
          </Button>
        </>
      )}
      {panel === "receipts" && !refundTarget && (
        <>
          <div className="rounded-md border border-line bg-paper-2 p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              {t("pos.findReceipt")}
            </p>
            <div className="mt-2 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border-[1.5px] border-line-2 bg-cream px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
                value={findReceiptId}
                onChange={(e) => onFindReceiptIdChange(e.target.value)}
                placeholder={t("pos.findReceiptPh")}
                inputMode="numeric"
              />
              <Button variant="quiet" onClick={onFindReceipt}>
                {t("pos.findReceiptGo")}
              </Button>
            </div>
            {findReceiptError && <p className="mt-2 text-sm text-alert">{findReceiptError}</p>}
          </div>
          <div className="mt-4 max-h-72 overflow-auto">
            {(shift?.sales ?? []).length === 0 && (
              <p className="py-4 text-sm text-ink-soft">{t("pos.noReceipts")}</p>
            )}
            {(shift?.sales ?? []).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between border-b border-line py-2.5 text-sm">
                <div>
                  <p className={sale.is_refunded ? "text-ink-soft line-through" : ""}>
                    №{sale.id} · {money(sale.total_amount)} · {payLabel(sale.payment_type)}
                    {sale.discount_amount && Number(sale.discount_amount) > 0
                      ? ` · ${t("pos.discountOf", { n: money(sale.discount_amount) })}`
                      : ""}
                  </p>
                  <p className="font-mono text-[10px] text-faint">
                    {new Date(sale.created_at).toLocaleTimeString(dateLocaleTag(locale), {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {sale.barista_name ? ` · ${sale.barista_name}` : ""}
                  </p>
                </div>
                {!sale.is_refunded && (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      onRestoreStockChange(false);
                      onRefundTarget(sale);
                    }}
                  >
                    {t("pos.refund")}
                  </button>
                )}
                {sale.is_refunded && <span className="text-ink-soft">{t("pos.refunded")}</span>}
              </div>
            ))}
          </div>
          <Button variant="ghost" className="mt-4 text-ink-soft" onClick={onClose}>
            {t("common.back")}
          </Button>
        </>
      )}
      {panel === "receipts" && refundTarget && (
        <>
          <fieldset className="space-y-3">
            <legend className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
              {t("pos.refundAsk")}
            </legend>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line-2 px-3 py-3 has-[:checked]:border-ink">
              <input
                type="radio"
                className="mt-1"
                name="refund-stock"
                checked={!restoreStock}
                onChange={() => onRestoreStockChange(false)}
              />
              <span>
                <span className="block text-sm font-medium">{t("pos.refundGiven")}</span>
                <span className="mt-0.5 block text-[13px] text-ink-soft">{t("pos.refundGivenNote")}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line-2 px-3 py-3 has-[:checked]:border-ink">
              <input
                type="radio"
                className="mt-1"
                name="refund-stock"
                checked={restoreStock}
                onChange={() => onRestoreStockChange(true)}
              />
              <span>
                <span className="block text-sm font-medium">{t("pos.refundKept")}</span>
                <span className="mt-0.5 block text-[13px] text-ink-soft">{t("pos.refundKeptNote")}</span>
              </span>
            </label>
          </fieldset>
          {refund.isError && <p className="mt-3 text-sm text-alert">{(refund.error as Error).message}</p>}
          {salesFrozen && (
            <p className="mt-3 text-sm text-alert">{t("pos.refundRevision", { id: revisionId! })}</p>
          )}
          <div className="mt-6 flex gap-3">
            <Button
              variant="danger"
              className="flex-1"
              disabled={refund.isPending || salesFrozen}
              onClick={() => refund.mutate(restoreStock)}
            >
              {refund.isPending ? t("pos.refundPending") : t("pos.refundSubmit")}
            </Button>
            <Button
              variant="ghost"
              className="text-ink-soft"
              onClick={() => {
                onRefundTarget(null);
                onRestoreStockChange(false);
              }}
            >
              {t("common.back")}
            </Button>
          </div>
        </>
      )}
      {panel === "move" && (
        <>
          <p className="rounded-md bg-paper-2 px-3 py-2 font-mono text-[13px]">
            {t("pos.drawerNow", { n: money(shift?.expected_cash) })}
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              variant={moveType === "deposit" ? "confirm" : "quiet"}
              className="flex-1"
              onClick={() => onMoveTypeChange("deposit")}
            >
              {t("pos.moveIn")}
            </Button>
            <Button
              variant={moveType === "withdrawal" ? "danger" : "quiet"}
              className="flex-1"
              onClick={() => onMoveTypeChange("withdrawal")}
            >
              {t("pos.moveOut")}
            </Button>
          </div>
          <label className="mt-5 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            {t("expenses.amount")}, ₸
            <input
              className="mt-2 w-full rounded-md border-[1.5px] border-line-2 bg-cream px-4 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
              value={moveAmount}
              onChange={(e) => onMoveAmountChange(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </label>
          {Number(moveAmount) > 0 && (
            <p className="mt-3 text-sm text-ink-soft">
              {t("pos.afterMove", {
                n: money(
                  Number(shift?.expected_cash ?? 0) +
                    (moveType === "deposit" ? Number(moveAmount) : -Number(moveAmount)),
                ),
              })}
            </p>
          )}
          {cashMove.isError && (
            <p className="mt-3 text-sm text-alert">{(cashMove.error as Error).message}</p>
          )}
          <div className="mt-6 flex gap-3">
            <Button
              variant={moveType === "withdrawal" ? "danger" : "confirm"}
              className="flex-1"
              disabled={!moveAmount || Number(moveAmount) <= 0 || cashMove.isPending}
              onClick={() => cashMove.mutate()}
            >
              {cashMove.isPending
                ? t("pos.writing")
                : moveType === "withdrawal"
                  ? t("pos.moveOut")
                  : t("pos.moveIn")}
            </Button>
            <Button variant="ghost" className="text-ink-soft" onClick={onClose}>
              {t("common.back")}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

export function PosVariantPickDialog({
  t,
  locale,
  product,
  onClose,
  onPick,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  product: Product;
  onClose: () => void;
  onPick: (variant: ProductVariant) => void;
}) {
  return (
    <Dialog
      open
      title={t("pos.pickVariant")}
      hint={t("pos.pickVariantHint", { name: localizedName(product, locale) })}
      onClose={onClose}
    >
      <div className="grid gap-2">
        {activeVariants(product).map((v) => (
          <button
            key={v.id}
            type="button"
            className="flex items-center justify-between rounded-md border-[1.5px] border-line bg-cream px-4 py-3 text-left hover:border-ink"
            onClick={() => onPick(v)}
          >
            <span className="font-medium">{localizedName(v, locale)}</span>
            <span className="font-mono font-semibold text-gold">{money(v.sale_price)}</span>
          </button>
        ))}
      </div>
      <Button variant="ghost" onClick={onClose}>
        {t("common.cancel")}
      </Button>
    </Dialog>
  );
}

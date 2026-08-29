import type { ReactNode } from "react";
import { ShopBrand } from "../ShopBrand";
import { Button, MoreMenu } from "../ui";
import { localizedName } from "../../lib/i18nName";
import { money } from "../../lib/utils";
import type { Locale } from "../../i18n/types";
import type { CashRegister, Category, Shop, Shift } from "../../types";

export function PosSidebar({
  t,
  locale,
  currentShop,
  isBarista,
  sellerName,
  tillName,
  headerOpen,
  onToggleHeader,
  onOpenSellerPanel,
  multiTill,
  registerList,
  registerId,
  onPickRegister,
  shift,
  onOpenShift,
  onCloseShift,
  moreItems,
  categoryId,
  onCategoryChange,
  categories,
  financeOpen,
  onToggleFinance,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  currentShop: Shop | undefined;
  isBarista: boolean;
  sellerName: string;
  tillName: string;
  headerOpen: boolean;
  onToggleHeader: () => void;
  onOpenSellerPanel: () => void;
  multiTill: boolean;
  registerList: CashRegister[];
  registerId: number | null;
  onPickRegister: (id: number) => void;
  shift: Shift | null | undefined;
  onOpenShift: () => void;
  onCloseShift: () => void;
  moreItems: Array<{ label: string; onClick?: () => void; disabled?: boolean; custom?: ReactNode }>;
  categoryId: number | "all";
  onCategoryChange: (id: number | "all") => void;
  categories: Category[] | undefined;
  financeOpen: boolean;
  onToggleFinance: () => void;
}) {
  const headerBlock = (
    <div className="space-y-2 rounded-md bg-paper-2 p-2.5">
      <div className="px-1.5 py-1">
        <ShopBrand shop={currentShop} fallback={t("pos.tillFallback")} size="sm" markClass="h-4 w-5 text-gold" />
        {currentShop?.address && (
          <p className="mt-1 truncate text-[12px] text-ink-soft">{currentShop.address}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!isBarista ? (
          <button
            type="button"
            onClick={onOpenSellerPanel}
            className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-ink hover:bg-paper"
            title={t("pos.changeSeller")}
          >
            {sellerName}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate px-2 py-1.5 text-[13px] font-medium text-ink">
            {sellerName}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleHeader}
          className="shrink-0 rounded-md px-2 py-1.5 text-[12px] text-ink-soft hover:bg-paper hover:text-ink"
          aria-expanded={headerOpen}
        >
          <span className="max-w-[7.5rem] truncate">{tillName}</span>
          <span className="ml-1" aria-hidden>
            {headerOpen ? "▴" : "▾"}
          </span>
        </button>
      </div>
      {headerOpen && (
        <div className="space-y-2 border-t border-line px-1.5 pt-2">
          {multiTill ? (
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                {t("pos.tillLabel")}
              </p>
              {registerList.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onPickRegister(r.id)}
                  className={`min-h-10 w-full rounded-md px-3 py-2 text-left text-[13px] ${
                    r.id === registerId
                      ? "bg-paper font-semibold text-ink"
                      : "text-ink-soft hover:bg-paper/60"
                  }`}
                >
                  <span className="block">{r.name}</span>
                  <span className="text-[11px] text-faint">
                    {r.has_open_shift || (r.id === registerId && shift)
                      ? t("pos.shiftOpen")
                      : t("pos.shiftClosed")}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-ink-soft">
              {tillName}
              {shift ? ` · ${t("pos.shiftOpen")}` : ` · ${t("pos.shiftClosed")}`}
            </p>
          )}
          {currentShop && !currentShop.webkassa_enabled && (
            <p className="text-[11px] text-gold">{t("pos.ofdOff")}</p>
          )}
          {(shift?.fiscal_pending_count ?? 0) > 0 && (
            <p className="text-[11px] text-gold">
              {t("pos.ofdPending", { n: shift?.fiscal_pending_count ?? 0 })}
            </p>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 pt-0.5">
        {shift ? (
          <Button variant="confirm" className="min-w-0 flex-1" onClick={onCloseShift}>
            {t("pos.closeShift")}
          </Button>
        ) : (
          <Button variant="confirm" className="min-w-0 flex-1" onClick={onOpenShift}>
            {t("pos.openShift")}
          </Button>
        )}
        <MoreMenu label="⋮" items={moreItems} />
      </div>
    </div>
  );

  const categoriesBlock = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-1 pb-2">
        <button
          type="button"
          className={`min-h-11 w-full rounded-md px-3.5 py-[11px] text-left text-[13.5px] ${
            categoryId === "all" ? "bg-paper-2 font-semibold text-ink" : "text-ink-soft"
          }`}
          onClick={() => onCategoryChange("all")}
        >
          {t("pos.allProducts")}
        </button>
        {categories?.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`min-h-11 w-full rounded-md px-3.5 py-[11px] text-left text-[13.5px] ${
              categoryId === c.id ? "bg-paper-2 font-semibold text-ink" : "text-ink-soft"
            }`}
            onClick={() => onCategoryChange(c.id)}
          >
            {localizedName(c, locale)}
          </button>
        ))}
      </div>
    </div>
  );

  const shiftOpsBlock = shift ? (
    <div className="space-y-2.5 text-[12.5px]">
      <button
        type="button"
        onClick={onToggleFinance}
        className="flex w-full items-center justify-between rounded-md bg-paper-2 px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-ink-soft">{t("pos.cashNow")}</span>
          <span className="font-mono font-semibold text-ink">{money(shift.expected_cash)}</span>
        </span>
        <span className="text-ink-soft" aria-hidden>
          {financeOpen ? "▲" : "▼"}
        </span>
      </button>
      {financeOpen && (
        <div className="rounded-md bg-paper-2 px-4 py-3.5">
          <div className="flex justify-between py-1">
            <span>{t("pay.cash")}</span>
            <span className="font-mono font-semibold text-gold">{money(shift.cash_revenue)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>{t("pay.card")}</span>
            <span className="font-mono font-semibold text-turq">{money(shift.card_revenue)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>{t("pos.receipts")}</span>
            <span className="font-mono font-semibold">{shift.sales_count}</span>
          </div>
          <div className="mt-2 border-t border-line pt-2">
            <div className="flex justify-between py-1">
              <span className="text-ink">{t("pos.cashNow")}</span>
              <span className="font-mono font-semibold">{money(shift.expected_cash)}</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-faint">
              {t("pos.start", { n: money(shift.opening_cash) })}
              {Number(shift.cash_revenue) ? t("pos.plusCash", { n: money(shift.cash_revenue) }) : ""}
              {Number(shift.deposits) ? t("pos.plusIn", { n: money(shift.deposits) }) : ""}
              {Number(shift.withdrawals) ? t("pos.minusOut", { n: money(shift.withdrawals) }) : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <aside className="flex h-full flex-col gap-3 overflow-hidden px-[18px] py-6">
      <div className="shrink-0 space-y-3">
        {headerBlock}
        {shiftOpsBlock}
      </div>
      <div className="min-h-0 flex-1 border-t border-line pt-3">{categoriesBlock}</div>
    </aside>
  );
}

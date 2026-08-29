import type { ReactNode } from "react";
import { ShopBrand } from "../ShopBrand";
import { Button, MoreMenu } from "../ui";
import { NotificationBell } from "../NotificationHost";
import { localizedName } from "../../lib/i18nName";
import { money } from "../../lib/utils";
import type { Locale } from "../../i18n/types";
import type { CashRegister, Category, Shop, Shift } from "../../types";

export function PosMobileHeader({
  t,
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
  financeOpen,
  onToggleFinance,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
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
  financeOpen: boolean;
  onToggleFinance: () => void;
}) {
  return (
    <div className="shrink-0 space-y-2 border-b border-line bg-paper px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <ShopBrand shop={currentShop} fallback={t("pos.tillFallback")} size="sm" markClass="h-4 w-5 text-gold" />
        </div>
        {shift ? (
          <Button variant="confirm" size="md" className="shrink-0 px-3" onClick={onCloseShift}>
            {t("pos.closeShift")}
          </Button>
        ) : (
          <Button variant="confirm" size="md" className="shrink-0 px-3" onClick={onOpenShift}>
            {t("pos.openShift")}
          </Button>
        )}
        <NotificationBell />
        <MoreMenu label="⋮" items={moreItems} />
      </div>
      <div className="flex items-center gap-2 text-[13px]">
        {!isBarista ? (
          <button type="button" onClick={onOpenSellerPanel} className="truncate font-medium text-ink underline">
            {sellerName}
          </button>
        ) : (
          <span className="truncate font-medium text-ink">{sellerName}</span>
        )}
        <span className="text-faint">·</span>
        <button
          type="button"
          onClick={onToggleHeader}
          className="truncate text-ink-soft"
          aria-expanded={headerOpen}
        >
          {tillName}
          {shift ? ` · ${t("pos.shiftOpen")}` : ` · ${t("pos.shiftClosed")}`}
        </button>
      </div>
      {headerOpen && (
        <div className="space-y-2 rounded-md bg-paper-2 p-2.5 text-[13px]">
          {multiTill &&
            registerList.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onPickRegister(r.id)}
                className={`min-h-10 w-full rounded-md px-3 py-2 text-left ${
                  r.id === registerId ? "bg-paper font-semibold text-ink" : "text-ink-soft"
                }`}
              >
                {r.name}
              </button>
            ))}
          {shift && (
            <>
              <button
                type="button"
                onClick={onToggleFinance}
                className="flex w-full items-center justify-between rounded-md bg-paper px-3 py-2"
              >
                <span>
                  {t("pos.cashNow")}: <strong className="font-mono">{money(shift.expected_cash)}</strong>
                </span>
                <span aria-hidden>{financeOpen ? "▲" : "▼"}</span>
              </button>
              {financeOpen && (
                <div className="space-y-1 rounded-md bg-paper px-3 py-2 font-mono text-[12px]">
                  <div className="flex justify-between">
                    <span>{t("pay.cash")}</span>
                    <span>{money(shift.cash_revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("pay.card")}</span>
                    <span>{money(shift.card_revenue)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PosCategoryStrip({
  t,
  locale,
  categoryId,
  categories,
  onCategoryChange,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  categoryId: number | "all";
  categories: Category[] | undefined;
  onCategoryChange: (id: number | "all") => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        type="button"
        onClick={() => onCategoryChange("all")}
        className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium ${
          categoryId === "all" ? "bg-ink text-paper" : "bg-paper-2 text-ink-soft"
        }`}
      >
        {t("pos.allProducts")}
      </button>
      {(categories ?? []).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onCategoryChange(c.id)}
          className={`shrink-0 rounded-full px-3.5 py-2 text-[13px] font-medium ${
            categoryId === c.id ? "bg-ink text-paper" : "bg-paper-2 text-ink-soft"
          }`}
        >
          {localizedName(c, locale)}
        </button>
      ))}
    </div>
  );
}

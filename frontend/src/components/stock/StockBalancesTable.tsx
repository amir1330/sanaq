import { Button, Input } from "../ui";
import {
  costPerPurchase,
  money,
  publicUrl,
  qty,
  shelfValue,
  shortDay,
  stockBalance,
  unitCost,
} from "../../lib/utils";
import type { StockItem } from "../../types";

export function StockBalancesTable({
  t,
  q,
  onQChange,
  totalCount,
  rowsLength,
  lowCount,
  shelfTotal,
  rows,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onRowClick,
  onTogglePos,
  togglePosPendingId,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  q: string;
  onQChange: (value: string) => void;
  totalCount: number;
  rowsLength: number;
  lowCount: number;
  shelfTotal: number;
  rows: StockItem[];
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  onRowClick: (item: StockItem) => void;
  onTogglePos: (item: StockItem, on: boolean) => void;
  togglePosPendingId: number | undefined;
}) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Input
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder={t("stock.searchPh")}
          className="max-w-xs"
        />
        <p className="font-mono text-[12.5px] text-mute">
          {totalCount === 1
            ? t("stock.nItems", { n: totalCount })
            : t("stock.nItemsMany", { n: totalCount })}
          {rowsLength < totalCount ? ` · ${rowsLength}` : ""}
          {lowCount ? ` · ${t("stock.runningLow", { n: lowCount })}` : ""}
          {" · "}
          {t("stock.shelfSum", { n: money(shelfTotal) })}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg bg-cream shadow-soft">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
            <tr className="border-b border-line text-left">
              <th className="px-5 py-3.5">{t("stock.colItem")}</th>
              <th>{t("stock.colNow")}</th>
              <th>{t("stock.colMin")}</th>
              <th>{t("stock.colCost")}</th>
              <th className="text-right">{t("stock.colShelf")}</th>
              <th className="pr-5 text-right">{t("stock.colLastIn")}</th>
              <th className="pr-5 text-center">{t("stock.colOnPos")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const src = publicUrl(i.image_url);
              return (
                <tr
                  key={i.id}
                  className={`cursor-pointer border-b border-line last:border-0 ${i.is_low ? "bg-maroon/5" : ""}`}
                  onClick={() => onRowClick(i)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {src ? (
                        <img src={src} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-paper font-mono text-[9px] uppercase tracking-wide text-mute">
                          {t("common.photo")}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">{i.name}</span>
                        {i.sku ? (
                          <span className="mt-0.5 block font-mono text-[11px] text-mute">{i.sku}</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="font-mono">{stockBalance(i)}</td>
                  <td className="font-mono text-mute">{qty(i.min_quantity, i.base_unit)}</td>
                  <td className="font-mono">
                    {unitCost(costPerPurchase(i.cost_per_base_unit, i.purchase_to_base), i.purchase_unit)}
                    {Number(i.purchase_to_base) !== 1 || i.purchase_unit !== i.base_unit ? (
                      <span className="mt-0.5 block text-[11px] text-mute">
                        {unitCost(i.cost_per_base_unit, i.base_unit)}
                      </span>
                    ) : null}
                  </td>
                  <td className="pr-4 text-right font-mono font-semibold">{money(shelfValue(i))}</td>
                  <td className="pr-5 text-right font-mono text-[12.5px] text-mute">{shortDay(i.last_income_at)}</td>
                  <td className="pr-5 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-5 w-5 cursor-pointer rounded-[4px] border-[1.5px] border-line-2 accent-maroon"
                      checked={Boolean(i.on_pos)}
                      disabled={togglePosPendingId === i.id}
                      aria-label={t("stock.onPos")}
                      onChange={(e) => onTogglePos(i, e.target.checked)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !isLoading && (
          <p className="px-5 py-8 text-center text-sm text-mute">
            {q.trim() ? t("stock.emptySearch") : t("stock.empty")}
          </p>
        )}
      </div>
      {hasNextPage && (
        <div className="mt-3 flex justify-center">
          <Button variant="quiet" disabled={isFetchingNextPage} onClick={onLoadMore}>
            {isFetchingNextPage ? t("common.loading") : t("common.loadMore")}
          </Button>
        </div>
      )}
    </>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useT } from "../i18n";
import { costPerPurchase, money, qty } from "../lib/utils";
import type { StockItem } from "../types";
import { StockSearchPicker } from "./StockSearchPicker";
import { Button, Dialog, Field, Input } from "./ui";

type Line = { item: StockItem; qty: string; price: string; touched: boolean };

function suggestPrice(item: StockItem, qtyValue: string): string {
  const q = Number(qtyValue);
  const pack = Number(costPerPurchase(item.cost_per_base_unit, item.purchase_to_base));
  if (!(q > 0) || !(pack > 0)) return "";
  return String(Math.round(pack * q));
}

export function ReceivePanel({
  shopId,
  onClose,
  initialItem,
}: {
  shopId: number;
  onClose: () => void;
  initialItem?: StockItem | null;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [lines, setLines] = useState<Line[]>(() =>
    initialItem ? [{ item: initialItem, qty: "", price: "", touched: false }] : [],
  );

  const apply = useMutation({
    mutationFn: async () => {
      for (const line of lines) {
        if (!Number(line.qty)) continue;
        await api.stockMove(shopId, line.item.id, {
          type: "income",
          quantity: line.qty,
          price_total: line.price || null,
        });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-stats", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-low", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-pick", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-item", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
      onClose();
    },
  });

  function addItem(item: StockItem) {
    if (lines.some((l) => l.item.id === item.id)) return;
    setLines((prev) => [...prev, { item, qty: "", price: "", touched: false }]);
  }

  function patch(id: number, next: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.item.id === id ? { ...l, ...next } : l)));
  }

  const total = lines.reduce((s, l) => s + (Number(l.price) || 0), 0);
  const ready = lines.some((l) => Number(l.qty) > 0);

  return (
    <Dialog open title={t("receive.title")} hint={t("receive.hint")} onClose={onClose}>
      <div className="space-y-3">
          {lines.map((line) => {
            const preview = Number(line.qty) > 0 ? Number(line.qty) * Number(line.item.purchase_to_base) : null;
            return (
              <div key={line.item.id} className="rounded-md bg-cream px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{line.item.name}</p>
                  <button
                    type="button"
                    className="text-[12.5px] text-mute hover:text-maroon"
                    onClick={() => setLines((prev) => prev.filter((l) => l.item.id !== line.item.id))}
                  >
                    {t("common.remove")}
                  </button>
                </div>
                <p className="mt-1 text-[12.5px] text-mute">
                  {t("stock.oneEquals", { unit: line.item.purchase_unit })}{" "}
                  {qty(line.item.purchase_to_base, line.item.base_unit)}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label={t("receive.qtyLabel", { unit: line.item.purchase_unit })}>
                    <Input
                      value={line.qty}
                      inputMode="decimal"
                      onChange={(e) => {
                        const qtyValue = e.target.value;
                        patch(line.item.id, {
                          qty: qtyValue,
                          price: line.touched ? line.price : suggestPrice(line.item, qtyValue),
                        });
                      }}
                    />
                  </Field>
                  <Field label={t("receive.sumLabel")} hint={t("receive.sumHint")}>
                    <Input
                      value={line.price}
                      inputMode="decimal"
                      onChange={(e) => patch(line.item.id, { price: e.target.value, touched: true })}
                    />
                  </Field>
                </div>
                {preview != null && (
                  <p className="mt-2 font-mono text-[11px] text-mute">
                    {t("receive.onShelf", { n: qty(preview, line.item.base_unit) })}
                  </p>
                )}
              </div>
            );
          })}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{t("receive.addLine")}</p>
      <StockSearchPicker
        className="mt-2"
        shopId={shopId}
        excludeIds={lines.map((l) => l.item.id)}
        onPick={addItem}
        placeholder={t("stock.searchPh")}
      />
      {lines.length > 0 && (
        <p className="font-mono text-[15px] font-semibold">
          {t("common.total")} {money(total)}
        </p>
      )}
      {apply.isError && <p className="text-sm text-alert">{(apply.error as Error).message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!ready || apply.isPending} onClick={() => apply.mutate()}>
          {t("receive.post")}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Dialog>
  );
}

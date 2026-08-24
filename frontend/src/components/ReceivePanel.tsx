import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { qty, stockBalance } from "../lib/utils";
import type { StockItem } from "../types";
import { Button, Field, Input } from "./ui";

export function ReceivePanel({ shopId, onClose }: { shopId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const stock = useQuery({ queryKey: ["stock", shopId], queryFn: () => api.stock(shopId) });
  const [pick, setPick] = useState<StockItem | null>(null);
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");

  const apply = useMutation({
    mutationFn: () =>
      api.stockMove(shopId, pick!.id, {
        type: "income",
        quantity: amount,
        price_total: price || null,
      }),
    onSuccess: () => {
      setPick(null);
      setAmount("");
      setPrice("");
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
    },
  });

  const preview = pick && Number(amount) > 0 ? Number(amount) * Number(pick.purchase_to_base) : null;

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto border border-line bg-paper p-7 text-ink">
        <h2 className="font-display text-2xl font-normal">Приёмка</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Количество — в единицах закупки. Сумма — за всю партию, как в накладной.
        </p>
        <div className="mt-4 max-h-64 overflow-auto">
          {(stock.data ?? []).map((item) => (
            <button
              key={item.id}
              className={`block w-full border-b border-line py-2.5 text-left text-sm ${
                pick?.id === item.id ? "text-ink" : "text-ink-soft"
              }`}
              onClick={() => setPick(item)}
            >
              {item.name}
              <span className="ml-2 opacity-70">{stockBalance(item)}</span>
            </button>
          ))}
        </div>
        {pick && (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-ink-soft">
              {pick.name} · закупка: {pick.purchase_unit} (1 {pick.purchase_unit} ={" "}
              {qty(pick.purchase_to_base, pick.base_unit)})
            </p>
            <Field label={`Сколько, ${pick.purchase_unit}?`}>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </Field>
            {preview !== null && (
              <p className="font-mono text-xs text-ink-soft">→ на склад: +{qty(preview, pick.base_unit)}</p>
            )}
            <Field label="Сумма закупки за партию, ₸">
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="можно пусто"
              />
            </Field>
          </div>
        )}
        {apply.isError && <p className="mt-3 text-sm text-alert">{(apply.error as Error).message}</p>}
        <div className="mt-6 flex gap-3">
          <Button
            className="flex-1 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper"
            disabled={!pick || !amount}
            onClick={() => apply.mutate()}
          >
            Принять
          </Button>
          <Button variant="ghost" className="text-ink-soft" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}

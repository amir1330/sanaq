import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { qty } from "../lib/utils";
import { Button, Field, Input } from "./ui";

export function ReceivePanel({ shopId, onClose }: { shopId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const stock = useQuery({ queryKey: ["stock", shopId], queryFn: () => api.stock(shopId) });
  const [pick, setPick] = useState<{ id: number; name: string; unit: string } | null>(null);
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
    },
  });

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-roast/70 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto border border-line-dark bg-roast p-7 text-cream">
        <h2 className="font-display text-2xl font-normal">Приёмка</h2>
        <p className="mt-2 text-sm text-cream-soft">Что привезли — количество и сумма по накладной, если есть.</p>
        <div className="mt-4 max-h-64 overflow-auto">
          {(stock.data ?? []).map((item) => (
            <button
              key={item.id}
              className={`block w-full border-b border-line-dark py-2.5 text-left text-sm ${
                pick?.id === item.id ? "text-cream" : "text-cream-soft"
              }`}
              onClick={() => setPick({ id: item.id, name: item.name, unit: item.unit })}
            >
              {item.name}
              <span className="ml-2 opacity-70">{qty(item.quantity, item.unit)}</span>
            </button>
          ))}
        </div>
        {pick && (
          <div className="mt-5 space-y-4">
            <Field label={`${pick.name}, ${pick.unit}`} tone="dark">
              <Input tone="dark" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Сумма закупки, ₸" tone="dark">
              <Input
                tone="dark"
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
            className="flex-1 border-cream bg-transparent text-cream hover:bg-cream hover:text-roast"
            disabled={!pick || !amount}
            onClick={() => apply.mutate()}
          >
            Принять
          </Button>
          <Button variant="ghost" className="text-cream-soft" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}

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
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto border border-line bg-foam p-6">
        <h2 className="text-2xl font-medium">Приёмка</h2>
        <p className="mt-2 text-sm text-mute">Что привезли — количество и сумма по накладной, если есть.</p>
        <div className="mt-4 max-h-64 space-y-1 overflow-auto">
          {(stock.data ?? []).map((item) => (
            <button
              key={item.id}
              className={`block w-full px-3 py-2 text-left text-sm ${
                pick?.id === item.id ? "bg-ink text-paper" : "hover:bg-paper"
              }`}
              onClick={() => setPick({ id: item.id, name: item.name, unit: item.unit })}
            >
              {item.name}
              <span className={pick?.id === item.id ? "ml-2 opacity-70" : "ml-2 text-mute"}>
                {qty(item.quantity, item.unit)}
              </span>
            </button>
          ))}
        </div>
        {pick && (
          <div className="mt-4 space-y-3">
            <Field label={`${pick.name}, ${pick.unit}`}>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Сумма закупки, ₸">
              <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="можно пусто" />
            </Field>
          </div>
        )}
        {apply.isError && <p className="mt-3 text-sm text-rust">{(apply.error as Error).message}</p>}
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" disabled={!pick || !amount} onClick={() => apply.mutate()}>
            Принять
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}

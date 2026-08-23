import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Field, Input, PageTitle } from "../../components/ui";
import { money, qty } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { StockItem } from "../../types";

export function StockPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const stock = useQuery({ queryKey: ["stock", shopId], queryFn: () => api.stock(shopId) });
  const [create, setCreate] = useState({ name: "", unit: "г", min_quantity: "0", cost_per_unit: "0" });
  const [move, setMove] = useState<{ item: StockItem; type: "income" | "writeoff"; qty: string; price: string } | null>(
    null,
  );

  const add = useMutation({
    mutationFn: () => api.createStock(shopId, create),
    onSuccess: () => {
      setCreate({ name: "", unit: "г", min_quantity: "0", cost_per_unit: "0" });
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
    },
  });
  const apply = useMutation({
    mutationFn: () =>
      api.stockMove(shopId, move!.item.id, {
        type: move!.type,
        quantity: move!.qty,
        price_total: move!.type === "income" ? move!.price || null : null,
      }),
    onSuccess: () => {
      setMove(null);
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
    },
  });

  return (
    <div>
      <PageTitle
        kicker="Склад"
        title="Сырьё"
        hint="Приход — закупка (пересчитает среднюю цену). Списание — порча или инвентаризация. Касса сама снимает сырьё по рецепту."
      />
      {(stock.data ?? []).some((i) => i.is_low) && (
        <Card className="mb-4 border border-rust/30 bg-[#f7ebe3]">
          <p className="font-semibold text-roast">Заканчивается</p>
          <p className="mt-1 text-sm">
            {stock.data
              ?.filter((i) => i.is_low)
              .map((i) => `${i.name} (${qty(i.quantity, i.unit)})`)
              .join(" · ")}
          </p>
        </Card>
      )}
      <Card className="mb-4 grid gap-3 md:grid-cols-5">
        <Field label="Название сырья">
          <Input
            placeholder="Молоко"
            value={create.name}
            onChange={(e) => setCreate({ ...create, name: e.target.value })}
          />
        </Field>
        <Field label="Единица">
          <Input
            placeholder="мл / г / шт"
            value={create.unit}
            onChange={(e) => setCreate({ ...create, unit: e.target.value })}
          />
        </Field>
        <Field label="Порог «заканчивается»">
          <Input value={create.min_quantity} onChange={(e) => setCreate({ ...create, min_quantity: e.target.value })} />
        </Field>
        <Field label="Цена за 1 ед., ₸">
          <Input value={create.cost_per_unit} onChange={(e) => setCreate({ ...create, cost_per_unit: e.target.value })} />
        </Field>
        <div className="flex items-end">
          <Button className="w-full" onClick={() => add.mutate()} disabled={!create.name}>
            Добавить сырьё
          </Button>
        </div>
      </Card>
      <div className="overflow-hidden rounded-lg bg-foam">
        <table className="w-full text-sm">
          <thead className="font-mono text-[11px] uppercase tracking-wider text-ink/45">
            <tr className="border-b border-ink/10 text-left">
              <th className="px-4 py-3">id</th>
              <th>Название</th>
              <th>Остаток</th>
              <th>Себест.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(stock.data ?? []).map((i) => (
              <tr key={i.id} className={`border-b border-ink/5 ${i.is_low ? "bg-rust/5" : ""}`}>
                <td className="px-4 py-3 font-mono">{i.id}</td>
                <td>{i.name}</td>
                <td className="font-mono">{qty(i.quantity, i.unit)}</td>
                <td className="font-mono">{money(i.cost_per_unit)}</td>
                <td className="space-x-3 px-4 text-right">
                  <button className="underline" onClick={() => setMove({ item: i, type: "income", qty: "", price: "" })}>
                    Приход
                  </button>
                  <button className="underline" onClick={() => setMove({ item: i, type: "writeoff", qty: "", price: "" })}>
                    Списание
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {move && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-foam p-6">
            <h2 className="text-2xl font-medium">
              {move.type === "income" ? "Закупка" : "Списать"} · {move.item.name}
            </h2>
            <p className="text-sm text-mute">
              {move.type === "income"
                ? "Сколько привезли и сколько заплатили всего — себестоимость пересчитается сама."
                : "Сколько выбросить или убрать после ревизии."}
            </p>
            <Field label={`Количество, ${move.item.unit}`}>
              <Input value={move.qty} onChange={(e) => setMove({ ...move, qty: e.target.value })} />
            </Field>
            {move.type === "income" && (
              <Field label="Сумма закупки">
                <Input value={move.price} onChange={(e) => setMove({ ...move, price: e.target.value })} />
              </Field>
            )}
            <div className="flex gap-2">
              <Button onClick={() => apply.mutate()}>Записать</Button>
              <Button variant="ghost" onClick={() => setMove(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

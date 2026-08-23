import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Field, Input, PageTitle, Select } from "../../components/ui";
import { BASE_UNITS, PURCHASE_UNITS, qty, stockBalance, suggestPurchaseFactor, unitCost } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { StockItem } from "../../types";

const emptyCreate = {
  name: "",
  base_unit: "мл",
  purchase_unit: "пачка",
  purchase_to_base: "1000",
  min_quantity: "0",
  cost_per_base_unit: "0",
};

export function StockPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const stock = useQuery({ queryKey: ["stock", shopId], queryFn: () => api.stock(shopId) });
  const [create, setCreate] = useState(emptyCreate);
  const [move, setMove] = useState<{ item: StockItem; type: "income" | "writeoff"; qty: string; price: string } | null>(
    null,
  );
  const [edit, setEdit] = useState<{
    id: number;
    name: string;
    base_unit: string;
    purchase_unit: string;
    purchase_to_base: string;
    min_quantity: string;
    cost_per_base_unit: string;
  } | null>(null);
  const [remove, setRemove] = useState<StockItem | null>(null);

  const add = useMutation({
    mutationFn: () => api.createStock(shopId, create),
    onSuccess: () => {
      setCreate(emptyCreate);
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
    },
  });
  const saveEdit = useMutation({
    mutationFn: () =>
      api.patchStock(shopId, edit!.id, {
        name: edit!.name,
        purchase_unit: edit!.purchase_unit,
        purchase_to_base: edit!.purchase_to_base,
        min_quantity: edit!.min_quantity,
        cost_per_base_unit: edit!.cost_per_base_unit,
      }),
    onSuccess: () => {
      setEdit(null);
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
    },
  });
  const drop = useMutation({
    mutationFn: () => api.deleteStock(shopId, remove!.id),
    onSuccess: () => {
      setRemove(null);
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
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

  function setUnits(patch: Partial<typeof create>) {
    const next = { ...create, ...patch };
    if (patch.base_unit || patch.purchase_unit) {
      next.purchase_to_base = suggestPurchaseFactor(next.base_unit, next.purchase_unit);
    }
    setCreate(next);
  }

  const incomePreview =
    move?.type === "income" && Number(move.qty) > 0
      ? Number(move.qty) * Number(move.item.purchase_to_base)
      : null;

  return (
    <div>
      <PageTitle
        kicker="Склад"
        title="Сырьё"
        hint="Остаток и рецепт всегда в базовой единице (мл, г, шт). На приёмке вводишь пачки и сумму за партию — склад пересчитает сам."
      />
      {(stock.data ?? []).some((i) => i.is_low) && (
        <Card className="mb-4 border border-alert/40 bg-alert/10">
          <p className="font-semibold text-alert">Заканчивается</p>
          <p className="mt-1 text-sm">
            {stock.data
              ?.filter((i) => i.is_low)
              .map((i) => `${i.name} (${stockBalance(i)})`)
              .join(" · ")}
          </p>
        </Card>
      )}
      <Card className="mb-4 grid gap-3 md:grid-cols-3">
        <Field label="Название">
          <Input
            placeholder="Молоко 3.2%"
            value={create.name}
            onChange={(e) => setCreate({ ...create, name: e.target.value })}
          />
        </Field>
        <Field label="Базовая единица — остаток и рецепт">
          <Select value={create.base_unit} onChange={(e) => setUnits({ base_unit: e.target.value })}>
            {BASE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Единица закупки — как покупаешь">
          <Select value={create.purchase_unit} onChange={(e) => setUnits({ purchase_unit: e.target.value })}>
            {PURCHASE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`1 ${create.purchase_unit} =`}>
          <Input
            value={create.purchase_to_base}
            onChange={(e) => setCreate({ ...create, purchase_to_base: e.target.value })}
            inputMode="decimal"
            placeholder={`сколько ${create.base_unit}`}
          />
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
            {create.base_unit}
          </p>
        </Field>
        <Field label={`Минимум, ${create.base_unit}`}>
          <Input
            value={create.min_quantity}
            onChange={(e) => setCreate({ ...create, min_quantity: e.target.value })}
            inputMode="decimal"
          />
        </Field>
        <Field label={`Цена за 1 ${create.base_unit}, ₸`}>
          <Input
            value={create.cost_per_base_unit}
            onChange={(e) => setCreate({ ...create, cost_per_base_unit: e.target.value })}
            inputMode="decimal"
            placeholder="можно 0 — заполнится с приёмки"
          />
        </Field>
        <div className="flex items-end md:col-span-3">
          <Button className="w-full md:w-auto" onClick={() => add.mutate()} disabled={!create.name || add.isPending}>
            Добавить сырьё
          </Button>
        </div>
        {add.isError && <p className="text-sm text-alert md:col-span-3">{(add.error as Error).message}</p>}
      </Card>
      <div className="border border-line">
        <table className="w-full text-sm">
          <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
            <tr className="border-b border-ink/10 text-left">
              <th className="px-4 py-3">id</th>
              <th>Название</th>
              <th>Остаток</th>
              <th>Минимум</th>
              <th>Себест.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(stock.data ?? []).map((i) => (
              <tr key={i.id} className={`border-b border-ink/5 ${i.is_low ? "bg-rust/5" : ""}`}>
                <td className="px-4 py-3 font-mono">{i.id}</td>
                <td>{i.name}</td>
                <td className="font-mono">{stockBalance(i)}</td>
                <td className="font-mono text-mute">{qty(i.min_quantity, i.base_unit)}</td>
                <td className="font-mono">{unitCost(i.cost_per_base_unit, i.base_unit)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                    <button
                      className="underline"
                      onClick={() =>
                        setEdit({
                          id: i.id,
                          name: i.name,
                          base_unit: i.base_unit,
                          purchase_unit: i.purchase_unit,
                          purchase_to_base: String(Number(i.purchase_to_base)),
                          min_quantity: String(Number(i.min_quantity)),
                          cost_per_base_unit: String(Number(i.cost_per_base_unit)),
                        })
                      }
                    >
                      Изменить
                    </button>
                    <button className="underline" onClick={() => setMove({ item: i, type: "income", qty: "", price: "" })}>
                      Приход
                    </button>
                    <button
                      className="underline"
                      onClick={() => setMove({ item: i, type: "writeoff", qty: "", price: "" })}
                    >
                      Списать
                    </button>
                    <button
                      className="underline text-alert"
                      onClick={() => {
                        drop.reset();
                        setRemove(i);
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-sm space-y-3 border border-line bg-paper p-7">
            <h2 className="text-2xl font-medium">Изменить · {edit.name}</h2>
            <p className="text-sm text-mute">
              Базовая единица «{edit.base_unit}» не меняется — в ней уже стоят остаток и рецепты.
            </p>
            <Field label="Название">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Единица закупки">
              <Select
                value={edit.purchase_unit}
                onChange={(e) => {
                  const purchase_unit = e.target.value;
                  setEdit({
                    ...edit,
                    purchase_unit,
                    purchase_to_base: suggestPurchaseFactor(edit.base_unit, purchase_unit),
                  });
                }}
              >
                {[edit.purchase_unit, ...PURCHASE_UNITS.filter((u) => u !== edit.purchase_unit)].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`1 ${edit.purchase_unit} =`}>
              <Input
                value={edit.purchase_to_base}
                onChange={(e) => setEdit({ ...edit, purchase_to_base: e.target.value })}
                inputMode="decimal"
              />
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{edit.base_unit}</p>
            </Field>
            <Field label={`Минимум, ${edit.base_unit}`}>
              <Input
                value={edit.min_quantity}
                onChange={(e) => setEdit({ ...edit, min_quantity: e.target.value })}
                inputMode="decimal"
              />
            </Field>
            <Field label={`Цена за 1 ${edit.base_unit}, ₸`}>
              <Input
                value={edit.cost_per_base_unit}
                onChange={(e) => setEdit({ ...edit, cost_per_base_unit: e.target.value })}
                inputMode="decimal"
              />
            </Field>
            {saveEdit.isError && <p className="text-sm text-alert">{(saveEdit.error as Error).message}</p>}
            <div className="flex gap-2">
              <Button onClick={() => saveEdit.mutate()} disabled={!edit.name || saveEdit.isPending}>
                Сохранить
              </Button>
              <Button variant="ghost" onClick={() => setEdit(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
      {remove && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-sm space-y-3 border border-line bg-paper p-7">
            <h2 className="text-2xl font-medium">Удалить · {remove.name}</h2>
            <p className="text-sm text-mute">
              Позиция пропадёт со склада вместе с историей приходов. Если сырьё стоит в рецепте — сначала уберите его
              из меню.
            </p>
            {Number(remove.quantity) > 0 && (
              <p className="text-sm text-alert">Сейчас на остатке {stockBalance(remove)} — это тоже исчезнет.</p>
            )}
            {drop.isError && <p className="text-sm text-alert">{(drop.error as Error).message}</p>}
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => drop.mutate()} disabled={drop.isPending}>
                Удалить
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  drop.reset();
                  setRemove(null);
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
      {move && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-sm space-y-3 border border-line bg-paper p-7">
            <h2 className="text-2xl font-medium">
              {move.type === "income" ? "Приход" : "Списать"} · {move.item.name}
            </h2>
            <p className="text-sm text-mute">
              {move.type === "income"
                ? `Закупка: ${move.item.purchase_unit} (1 ${move.item.purchase_unit} = ${qty(move.item.purchase_to_base, move.item.base_unit)})`
                : `Списывают по факту — в ${move.item.base_unit}, не в ${move.item.purchase_unit}.`}
            </p>
            {move.type === "income" ? (
              <Field label={`Сколько, ${move.item.purchase_unit}?`}>
                <Input
                  value={move.qty}
                  onChange={(e) => setMove({ ...move, qty: e.target.value })}
                  inputMode="decimal"
                />
              </Field>
            ) : (
              <Field label={`Сколько списать, ${move.item.base_unit}`}>
                <Input
                  value={move.qty}
                  onChange={(e) => setMove({ ...move, qty: e.target.value })}
                  inputMode="decimal"
                />
              </Field>
            )}
            {incomePreview !== null && (
              <p className="font-mono text-xs text-mute">
                → на склад: +{qty(incomePreview, move.item.base_unit)}
              </p>
            )}
            {move.type === "income" && (
              <Field label="Сумма закупки за партию, ₸">
                <Input
                  value={move.price}
                  onChange={(e) => setMove({ ...move, price: e.target.value })}
                  inputMode="decimal"
                  placeholder="за всю партию, не за одну пачку"
                />
              </Field>
            )}
            {apply.isError && <p className="text-sm text-alert">{(apply.error as Error).message}</p>}
            <div className="flex gap-2">
              <Button onClick={() => apply.mutate()} disabled={!move.qty || apply.isPending}>
                Записать
              </Button>
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

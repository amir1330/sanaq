import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { RevisionsPanel } from "../../components/RevisionsPanel";
import { Button, Card, Empty, Field, Input, PageTitle, Select } from "../../components/ui";
import { BASE_UNITS, PURCHASE_UNITS, money, qty, stockBalance, suggestPurchaseFactor, unitCost } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { StockItem, StockJournalEntry, StockJournalKind } from "../../types";

const MOVE_KINDS: StockJournalKind[] = ["income", "writeoff", "correction", "sale", "refund"];
const CARD_KINDS: StockJournalKind[] = ["created", "updated", "deleted"];

const MOVE_TABS: { id: string; label: string; kinds: StockJournalKind[] }[] = [
  { id: "moves", label: "Всё по остатку", kinds: MOVE_KINDS },
  { id: "in", label: "Пришло", kinds: ["income", "refund"] },
  { id: "out", label: "Ушло", kinds: ["writeoff", "sale"] },
  { id: "revision", label: "Ревизии", kinds: ["correction"] },
  { id: "cards", label: "Карточки", kinds: CARD_KINDS },
];

function kindTitle(kind: StockJournalKind, delta: number | null): string {
  if (kind === "income") return "Пришло на склад";
  if (kind === "writeoff") return "Списали";
  if (kind === "sale") return "Ушло в чек";
  if (kind === "refund") return "Вернули на полку";
  if (kind === "correction") return delta != null && delta < 0 ? "Ревизия · недостача" : "Ревизия · излишек";
  if (kind === "created") return "Добавили карточку";
  if (kind === "updated") return "Изменили карточку";
  return "Удалили карточку";
}

function deltaBase(row: StockJournalEntry): number | null {
  if (row.quantity_base == null) return null;
  const n = Number(row.quantity_base);
  if (row.kind === "correction") return n;
  if (row.kind === "writeoff" || row.kind === "sale") return -Math.abs(n);
  if (row.kind === "income" || row.kind === "refund") return Math.abs(n);
  return null;
}

function formatDelta(row: StockJournalEntry): string | null {
  const d = deltaBase(row);
  if (d == null) return null;
  const sign = d < 0 ? "−" : "+";
  const main = `${sign}${qty(Math.abs(d), row.base_unit ?? undefined)}`;
  if (row.kind === "income" && row.quantity_purchase != null && row.purchase_unit) {
    return `+${qty(row.quantity_purchase, row.purchase_unit)} → ${main}`;
  }
  return main;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === yday.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

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
  const [creating, setCreating] = useState(false);
  const [create, setCreate] = useState(emptyCreate);
  const [logItem, setLogItem] = useState("");
  const [logKind, setLogKind] = useState("moves");
  const stock = useQuery({ queryKey: ["stock", shopId], queryFn: () => api.stock(shopId) });
  const journal = useQuery({
    queryKey: ["stock-journal", shopId, logItem],
    queryFn: () => api.stockJournal(shopId, logItem ? Number(logItem) : undefined),
  });
  const [move, setMove] = useState<{
    item: StockItem;
    type: "income" | "writeoff";
    qty: string;
    price: string;
    comment: string;
  } | null>(null);
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
      setCreating(false);
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
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
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
    },
  });
  const drop = useMutation({
    mutationFn: () => api.deleteStock(shopId, remove!.id),
    onSuccess: () => {
      setRemove(null);
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
    },
  });
  const apply = useMutation({
    mutationFn: () =>
      api.stockMove(shopId, move!.item.id, {
        type: move!.type,
        quantity: move!.qty,
        price_total: move!.type === "income" ? move!.price || null : null,
        comment: move!.comment || null,
      }),
    onSuccess: () => {
      setMove(null);
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
    },
  });

  function setUnits(patch: Partial<typeof create>) {
    const next = { ...create, ...patch };
    if (patch.base_unit || patch.purchase_unit) {
      next.purchase_to_base = suggestPurchaseFactor(next.base_unit, next.purchase_unit);
    }
    setCreate(next);
  }

  function toggleCreate() {
    if (creating) {
      add.reset();
      setCreate(emptyCreate);
      setCreating(false);
      return;
    }
    setCreating(true);
  }

  const incomePreview =
    move?.type === "income" && Number(move.qty) > 0
      ? Number(move.qty) * Number(move.item.purchase_to_base)
      : null;

  const kindFilter = MOVE_TABS.find((f) => f.id === logKind) ?? MOVE_TABS[0];
  const selectedItem = (stock.data ?? []).find((i) => String(i.id) === logItem) ?? null;
  const ledger = useMemo(() => {
    const rows = (journal.data ?? []).filter((row) => kindFilter.kinds.includes(row.kind));
    const lines: { row: StockJournalEntry; delta: number | null; after?: number }[] = rows.map((row) => ({
      row,
      delta: deltaBase(row),
    }));
    if (selectedItem && kindFilter.id !== "cards") {
      let cursor = Number(selectedItem.quantity);
      for (const line of lines) {
        if (line.delta == null) continue;
        line.after = cursor;
        cursor -= line.delta;
      }
    }
    const groups: { day: string; lines: typeof lines }[] = [];
    for (const line of lines) {
      const key = dayKey(line.row.created_at);
      const last = groups[groups.length - 1];
      if (last && dayKey(last.lines[0].row.created_at) === key) last.lines.push(line);
      else groups.push({ day: dayLabel(line.row.created_at), lines: [line] });
    }
    return { groups, empty: lines.length === 0 };
  }, [journal.data, kindFilter, selectedItem]);

  return (
    <div>
      <PageTitle
        kicker="Склад"
        title="Сырьё"
        hint="Остаток — сколько сейчас. Ниже — зачем он изменился: приход, чек, списание, ревизия."
        action={
          <Button variant={creating ? "ghost" : "primary"} onClick={toggleCreate}>
            {creating ? "Свернуть" : "Добавить сырьё"}
          </Button>
        }
      />
      <RevisionsPanel shopId={shopId} />
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
      {creating && (
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
        <div className="flex flex-wrap items-end gap-2 md:col-span-3">
          <Button onClick={() => add.mutate()} disabled={!create.name || add.isPending}>
            Сохранить
          </Button>
          <Button variant="ghost" onClick={toggleCreate}>
            Отмена
          </Button>
        </div>
        {add.isError && <p className="text-sm text-alert md:col-span-3">{(add.error as Error).message}</p>}
      </Card>
      )}
      <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
        <table className="w-full text-sm">
          <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
            <tr className="border-b border-line text-left">
              <th className="px-5 py-3.5">Сырьё</th>
              <th>Сейчас</th>
              <th>Минимум</th>
              <th>Себест.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(stock.data ?? []).map((i) => (
              <tr
                key={i.id}
                className={`border-b border-line last:border-0 ${i.is_low ? "bg-maroon/5" : ""} ${
                  logItem === String(i.id) ? "bg-paper" : ""
                }`}
              >
                <td className="px-5 py-3.5">
                  <button
                    className="text-left font-medium hover:underline"
                    onClick={() => {
                      setLogItem(String(i.id));
                      setLogKind("moves");
                      requestAnimationFrame(() =>
                        document.getElementById("stock-history")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                      );
                    }}
                  >
                    {i.name}
                  </button>
                </td>
                <td className="font-mono">{stockBalance(i)}</td>
                <td className="font-mono text-mute">{qty(i.min_quantity, i.base_unit)}</td>
                <td className="font-mono">{unitCost(i.cost_per_base_unit, i.base_unit)}</td>
                <td className="px-5 py-3.5 text-right">
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
                    <button
                      className="underline"
                      onClick={() => setMove({ item: i, type: "income", qty: "", price: "", comment: "" })}
                    >
                      Приход
                    </button>
                    <button
                      className="underline"
                      onClick={() => setMove({ item: i, type: "writeoff", qty: "", price: "", comment: "" })}
                    >
                      Списать
                    </button>
                    <button
                      className="underline text-maroon"
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
      <div id="stock-history" className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">История</p>
          <h2 className="mt-1 font-display text-2xl font-normal text-ink">Почему менялся остаток</h2>
          <p className="mt-1 text-sm text-mute">
            Каждая строка — одно изменение количества. Правки названия и единиц — во вкладке «Карточки».
          </p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {MOVE_TABS.map((f) => (
          <button
            key={f.id}
            onClick={() => setLogKind(f.id)}
            className={`rounded-full border-[1.5px] px-4 py-2 text-[12.5px] ${
              logKind === f.id
                ? "border-ink bg-ink text-paper"
                : "border-line-2 text-ink-soft hover:border-ink hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
        <Select value={logItem} onChange={(e) => setLogItem(e.target.value)} className="min-w-44">
          <option value="">Все позиции</option>
          {(stock.data ?? []).map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
      </div>
      {selectedItem && (
        <p className="mb-4 rounded-md bg-cream px-5 py-3 text-sm shadow-soft">
          <span className="font-medium">{selectedItem.name}</span>
          <span className="text-mute"> · сейчас {stockBalance(selectedItem)}</span>
          <button className="ml-3 underline" onClick={() => setLogItem("")}>
            показать все
          </button>
        </p>
      )}
      {ledger.empty ? (
        <Empty>
          {kindFilter.id === "cards"
            ? "Карточки пока не меняли."
            : "Остаток ещё не двигался. Приход, чек или списание появятся здесь."}
        </Empty>
      ) : (
        <div className="space-y-6">
          {ledger.groups.map((group) => (
            <div key={group.day}>
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.13em] text-faint">{group.day}</p>
              <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
                {group.lines.map((line) => {
                  const d = line.delta;
                  const plus = d != null && d > 0;
                  const minus = d != null && d < 0;
                  return (
                    <div
                      key={line.row.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-5 py-3.5 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink">
                          {kindTitle(line.row.kind, d)}
                          {kindFilter.id !== "cards" && logItem === "" ? (
                            <span className="font-normal text-ink-soft"> · {line.row.item_name}</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-mute">
                          {clock(line.row.created_at)}
                          {line.row.actor_name ? ` · ${line.row.actor_name}` : ""}
                          {line.row.price_total != null ? ` · ${money(line.row.price_total)}` : ""}
                          {line.row.comment ? ` · ${line.row.comment}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        {formatDelta(line.row) && (
                          <p
                            className={`font-mono text-[15px] font-semibold ${
                              plus ? "text-turq" : minus ? "text-maroon" : "text-ink"
                            }`}
                          >
                            {formatDelta(line.row)}
                          </p>
                        )}
                        {line.after != null && selectedItem && (
                          <p className="font-mono text-[11px] text-faint">
                            стало {qty(line.after, selectedItem.base_unit)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-roast/60 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-paper p-7 shadow-soft">
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
        <div className="fixed inset-0 z-30 grid place-items-center bg-roast/60 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-paper p-7 shadow-soft">
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
        <div className="fixed inset-0 z-30 grid place-items-center bg-roast/60 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-paper p-7 shadow-soft">
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
            <Field label="Комментарий">
              <Input
                value={move.comment}
                onChange={(e) => setMove({ ...move, comment: e.target.value })}
                placeholder="по желанию — поставщик, причина списания"
              />
            </Field>
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

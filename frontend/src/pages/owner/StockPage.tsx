import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PhotoField } from "../../components/PhotoField";
import { ReceivePanel } from "../../components/ReceivePanel";
import { RevisionsPanel } from "../../components/RevisionsPanel";
import { Button, Card, Field, Input, PageTitle, Select } from "../../components/ui";
import { BASE_UNITS, PURCHASE_UNITS, costPerBase, costPerPurchase, publicUrl, qty, stockBalance, suggestPurchaseFactor, unitCost } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { StockItem } from "../../types";

function CostHint({
  purchasePrice,
  factor,
  purchaseUnit,
  baseUnit,
}: {
  purchasePrice: string;
  factor: string;
  purchaseUnit: string;
  baseUnit: string;
}) {
  const perBase = Number(costPerBase(purchasePrice, factor));
  const pack = Number(purchasePrice);
  const n = Number(factor);
  if (!n || n <= 0) return <p className="mt-1 text-[12.5px] text-mute">Сначала сколько {baseUnit} в одной {purchaseUnit}</p>;
  if (!(pack > 0) || (n === 1 && purchaseUnit === baseUnit)) {
    return <p className="mt-1 text-[12.5px] text-mute">Можно 0 — подставится с приёмки</p>;
  }
  return (
    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
      → {unitCost(perBase, baseUnit)}
    </p>
  );
}

const emptyCreate = {
  name: "",
  base_unit: "мл",
  purchase_unit: "пачка",
  purchase_to_base: "1000",
  min_quantity: "0",
  cost_per_purchase: "0",
};

export function StockPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [create, setCreate] = useState(emptyCreate);
  const [createPhoto, setCreatePhoto] = useState<File | null>(null);
  const [createPreview, setCreatePreview] = useState<string | null>(null);
  const stock = useQuery({ queryKey: ["stock", shopId], queryFn: () => api.stock(shopId) });
  const revisions = useQuery({
    queryKey: ["stock-revisions", shopId],
    queryFn: () => api.stockRevisions(shopId),
  });
  const hasDraft = (revisions.data ?? []).some((r) => r.status === "draft");
  const [move, setMove] = useState<{
    item: StockItem;
    qty: string;
    comment: string;
  } | null>(null);
  const [edit, setEdit] = useState<{
    id: number;
    name: string;
    base_unit: string;
    purchase_unit: string;
    purchase_to_base: string;
    min_quantity: string;
    cost_per_purchase: string;
    image_url: string | null;
  } | null>(null);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [dropEditPhoto, setDropEditPhoto] = useState(false);
  const [remove, setRemove] = useState<StockItem | null>(null);
  const [menu, setMenu] = useState<StockItem | null>(null);
  const [receive, setReceive] = useState<StockItem | null | "open">(null);

  const add = useMutation({
    mutationFn: async () => {
      const item = await api.createStock(shopId, {
        name: create.name,
        base_unit: create.base_unit,
        purchase_unit: create.purchase_unit,
        purchase_to_base: create.purchase_to_base,
        min_quantity: create.min_quantity,
        cost_per_base_unit: costPerBase(create.cost_per_purchase, create.purchase_to_base),
      });
      if (createPhoto) await api.uploadStockImage(shopId, item.id, createPhoto);
    },
    onSuccess: () => {
      setCreate(emptyCreate);
      setCreatePhoto(null);
      setCreatePreview(null);
      setCreating(false);
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
    },
  });
  const saveEdit = useMutation({
    mutationFn: async () => {
      await api.patchStock(shopId, edit!.id, {
        name: edit!.name,
        purchase_unit: edit!.purchase_unit,
        purchase_to_base: edit!.purchase_to_base,
        min_quantity: edit!.min_quantity,
        cost_per_base_unit: costPerBase(edit!.cost_per_purchase, edit!.purchase_to_base),
      });
      if (dropEditPhoto && !editPhoto) await api.deleteStockImage(shopId, edit!.id);
      if (editPhoto) await api.uploadStockImage(shopId, edit!.id, editPhoto);
    },
    onSuccess: () => {
      setEdit(null);
      setEditPhoto(null);
      setEditPreview(null);
      setDropEditPhoto(false);
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
        type: "writeoff",
        quantity: move!.qty,
        comment: move!.comment || null,
      }),
    onSuccess: () => {
      setMove(null);
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
    },
  });
  const startRevision = useMutation({
    mutationFn: () => api.createStockRevision(shopId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["stock-revisions", shopId] }),
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
      setCreatePhoto(null);
      setCreatePreview(null);
      setCreating(false);
      return;
    }
    setCreating(true);
  }

  function openEdit(i: StockItem) {
    setEditPhoto(null);
    setEditPreview(null);
    setDropEditPhoto(false);
    setEdit({
      id: i.id,
      name: i.name,
      base_unit: i.base_unit,
      purchase_unit: i.purchase_unit,
      purchase_to_base: String(Number(i.purchase_to_base)),
      min_quantity: String(Number(i.min_quantity)),
      cost_per_purchase: costPerPurchase(i.cost_per_base_unit, i.purchase_to_base),
      image_url: i.image_url,
    });
  }

  }

  return (
    <div>
      <PageTitle
        kicker="Склад"
        title="Остатки"
        hint="Молоко, стаканы, печенье — всё, что лежит на точке. Минимум нужен только чтобы подсветить, что заканчивается."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/owner/stock/moves">
              <Button variant="quiet">Движения</Button>
            </Link>
            <Link to="/owner/stock/revisions">
              <Button variant="quiet">Пересчёты</Button>
            </Link>
            {!hasDraft && (
              <Button variant="quiet" onClick={() => startRevision.mutate()} disabled={startRevision.isPending}>
                Ревизия
              </Button>
            )}
            <Button variant="quiet" onClick={() => setReceive("open")}>
              Приход
            </Button>
            <Button variant={creating ? "quiet" : "primary"} onClick={toggleCreate}>
              {creating ? "Свернуть" : "Добавить позицию"}
            </Button>
          </div>
        }
      />
      {startRevision.isError && (
        <p className="mb-4 text-sm text-alert">{(startRevision.error as Error).message}</p>
      )}
      <RevisionsPanel shopId={shopId} part="draft" />
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
        <div className="md:col-span-3">
          <PhotoField
            src={createPreview}
            onFile={(file) => {
              setCreatePhoto(file);
              setCreatePreview(URL.createObjectURL(file));
            }}
            onClear={() => {
              setCreatePhoto(null);
              setCreatePreview(null);
            }}
            hint="Снимок пачки, банки, коробки — чтобы не перепутать на приёмке"
          />
        </div>
        <Field label="Название">
          <Input
            placeholder="Молоко, печенье, стаканы…"
            value={create.name}
            onChange={(e) => setCreate({ ...create, name: e.target.value })}
          />
        </Field>
        <Field label="Базовая единица — в ней остаток">
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
        <Field
          label={`Минимум, ${create.base_unit}`}
          hint="Только для уведомления «заканчивается». Когда остаток опустится до этой цифры — строка подсветится."
        >
          <Input
            value={create.min_quantity}
            onChange={(e) => setCreate({ ...create, min_quantity: e.target.value })}
            inputMode="decimal"
          />
        </Field>
        <Field label={`Цена за 1 ${create.purchase_unit}, ₸`}>
          <Input
            value={create.cost_per_purchase}
            onChange={(e) => setCreate({ ...create, cost_per_purchase: e.target.value })}
            inputMode="decimal"
            placeholder="как в чеке за одну пачку"
          />
          <CostHint
            purchasePrice={create.cost_per_purchase}
            factor={create.purchase_to_base}
            purchaseUnit={create.purchase_unit}
            baseUnit={create.base_unit}
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
              <th className="px-5 py-3.5">Позиция</th>
              <th>Сейчас</th>
              <th>Минимум</th>
              <th>Себест.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(stock.data ?? []).map((i) => {
              const src = publicUrl(i.image_url);
              return (
              <tr
                key={i.id}
                className={`cursor-pointer border-b border-line last:border-0 ${i.is_low ? "bg-maroon/5" : ""}`}
                onClick={() => setMenu(i)}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {src ? (
                      <img src={src} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-paper font-mono text-[9px] uppercase tracking-wide text-mute">
                        фото
                      </div>
                    )}
                    <span className="font-medium">{i.name}</span>
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
                <td className="px-5 py-3.5 text-right">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-faint">открыть</span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {edit && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-roast/60 p-4">
          <div className="max-h-[90vh] w-full max-w-md space-y-3 overflow-auto rounded-lg bg-paper p-7 shadow-soft">
            <h2 className="text-2xl font-medium">Изменить · {edit.name}</h2>
            <p className="text-sm text-mute">
              Базовая единица «{edit.base_unit}» не меняется — в ней уже стоят остаток и составы.
            </p>
            <PhotoField
              src={editPreview ?? (dropEditPhoto ? null : publicUrl(edit.image_url))}
              onFile={(file) => {
                setDropEditPhoto(false);
                setEditPhoto(file);
                setEditPreview(URL.createObjectURL(file));
              }}
              onClear={() => {
                setEditPhoto(null);
                setEditPreview(null);
                setDropEditPhoto(true);
              }}
              hint="PNG, JPG или WEBP, до 2 МБ"
            />
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
            <Field
              label={`Минимум, ${edit.base_unit}`}
              hint="Порог уведомления «заканчивается», не норма расхода."
            >
              <Input
                value={edit.min_quantity}
                onChange={(e) => setEdit({ ...edit, min_quantity: e.target.value })}
                inputMode="decimal"
              />
            </Field>
            <Field label={`Цена за 1 ${edit.purchase_unit}, ₸`}>
              <Input
                value={edit.cost_per_purchase}
                onChange={(e) => setEdit({ ...edit, cost_per_purchase: e.target.value })}
                inputMode="decimal"
                placeholder="как в чеке за одну пачку"
              />
              <CostHint
                purchasePrice={edit.cost_per_purchase}
                factor={edit.purchase_to_base}
                purchaseUnit={edit.purchase_unit}
                baseUnit={edit.base_unit}
              />
            </Field>
            {saveEdit.isError && <p className="text-sm text-alert">{(saveEdit.error as Error).message}</p>}
            <div className="flex gap-2">
              <Button onClick={() => saveEdit.mutate()} disabled={!edit.name || saveEdit.isPending}>
                Сохранить
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setEdit(null);
                  setEditPhoto(null);
                  setEditPreview(null);
                  setDropEditPhoto(false);
                }}
              >
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
              Позиция пропадёт со склада вместе с историей приходов. Если она стоит в составе товара — сначала уберите её
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
            <h2 className="text-2xl font-medium">Списать · {move.item.name}</h2>
            <p className="text-sm text-mute">
              Списывают по факту — в {move.item.base_unit}, не в {move.item.purchase_unit}.
            </p>
            <Field label={`Сколько списать, ${move.item.base_unit}`}>
              <Input
                value={move.qty}
                onChange={(e) => setMove({ ...move, qty: e.target.value })}
                inputMode="decimal"
              />
            </Field>
            <Field label="Почему">
              <Input
                value={move.comment}
                onChange={(e) => setMove({ ...move, comment: e.target.value })}
                placeholder="бой, пролив, дегустация"
              />
            </Field>
            {apply.isError && <p className="text-sm text-alert">{(apply.error as Error).message}</p>}
            <div className="flex gap-2">
              <Button onClick={() => apply.mutate()} disabled={!move.qty || apply.isPending}>
                Списать
              </Button>
              <Button variant="ghost" onClick={() => setMove(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
      {menu && (
        <div className="fixed inset-0 z-30 bg-roast/60" onClick={() => setMenu(null)}>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-lg bg-paper p-6 shadow-soft md:inset-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-sm md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-2xl font-normal">{menu.name}</p>
            <p className="mt-1 font-mono text-sm text-mute">{stockBalance(menu)}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                onClick={() => {
                  setReceive(menu);
                  setMenu(null);
                }}
              >
                Приход
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  setMove({ item: menu, qty: "", comment: "" });
                  setMenu(null);
                }}
              >
                Списать
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  navigate(`/owner/stock/moves?item=${menu.id}`);
                  setMenu(null);
                }}
              >
                История
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  openEdit(menu);
                  setMenu(null);
                }}
              >
                Изменить
              </Button>
            </div>
            <button
              type="button"
              className="mt-4 min-h-11 w-full text-center text-[13px] text-maroon"
              onClick={() => {
                drop.reset();
                setRemove(menu);
                setMenu(null);
              }}
            >
              Удалить позицию
            </button>
          </div>
        </div>
      )}
      {receive != null && (
        <ReceivePanel
          shopId={shopId}
          initialItem={receive === "open" ? null : receive}
          onClose={() => setReceive(null)}
        />
      )}
    </div>
  );
}

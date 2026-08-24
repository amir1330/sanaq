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

  return (
    <div>
      <PageTitle
        kicker="Склад"
        title="Остатки"
        hint="Нажми строку — карточка с историей, пересортом и перемещением. Приход сразу на несколько позиций."
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
          <p className="font-semibold text-alert">Закупить</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {stock.data
              ?.filter((i) => i.is_low)
              .map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="underline decoration-maroon/40 underline-offset-4 hover:text-maroon"
                  onClick={() => navigate(`/owner/stock/item/${i.id}`)}
                >
                  {i.name} · {stockBalance(i)}
                </button>
              ))}
          </div>
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
                onClick={() => navigate(`/owner/stock/item/${i.id}`)}
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

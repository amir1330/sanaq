import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { StockSearchPicker } from "../StockSearchPicker";
import { Button, Check, Field, Input } from "../ui";
import { makeInternalBarcode } from "../../lib/barcode";
import { money } from "../../lib/utils";
import { emptyVariant, type Draft, type IngRow, type VariantRow } from "../../pages/owner/products/types";
import type { StockItem } from "../../types";

export function ProductRecipeSection({
  t,
  ingredients,
  onChange,
  onPick,
  shopId,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  ingredients: IngRow[];
  onChange: (ingredients: IngRow[]) => void;
  onPick: (item: StockItem) => void;
  shopId: number;
}) {
  return (
    <>
      <p className="mt-2 text-[12.5px] text-mute">{t("products.recipeHint")}</p>
      <div className="mt-3 space-y-2">
        {ingredients.map((row, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_6.5rem_auto] gap-2">
            <div className="rounded-md border border-line bg-paper px-3 py-2 text-sm">
              {row.name ?? (row.stock_item_id ? `#${row.stock_item_id}` : t("products.itemPh"))}
              {row.base_unit ? (
                <span className="ml-1 text-mute">· {row.base_unit}</span>
              ) : null}
            </div>
            <Input
              placeholder={row.base_unit ?? t("products.qtyPh")}
              value={row.quantity}
              onChange={(e) => {
                const next = [...ingredients];
                next[idx] = { ...row, quantity: e.target.value };
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(ingredients.filter((_, i) => i !== idx))}
            >
              {t("common.remove")}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <p className="mb-1 text-[12.5px] text-mute">{t("products.addItem")}</p>
        <StockSearchPicker
          shopId={shopId}
          excludeIds={ingredients
            .map((r) => r.stock_item_id)
            .filter((id): id is number => typeof id === "number")}
          onPick={onPick}
          placeholder={t("stock.searchPh")}
        />
      </div>
      <p className="mt-3 font-mono text-sm">
        {t("products.recipeCost", {
          n: money(
            ingredients.reduce((sum, row) => {
              if (!row.quantity || !row.cost_per_base_unit) return sum;
              return sum + Number(row.quantity) * Number(row.cost_per_base_unit);
            }, 0),
          ),
        })}
      </p>
    </>
  );
}

export function ProductVariantsSection({
  t,
  editing,
  setEditing,
  shopId,
  onApplySizePreset,
  onPickVariantIngredient,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  editing: Draft;
  setEditing: Dispatch<SetStateAction<Draft | null>>;
  shopId: number;
  onApplySizePreset: () => void;
  onPickVariantIngredient: (variantIdx: number, item: StockItem) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (activeIdx >= editing.variants.length) {
      setActiveIdx(Math.max(0, editing.variants.length - 1));
    }
  }, [activeIdx, editing.variants.length]);

  function addVariant() {
    const next = [...editing.variants, emptyVariant(editing.variants.length === 0)];
    setEditing({ ...editing, variants: next });
    setActiveIdx(next.length - 1);
  }

  const active = editing.variants[activeIdx];

  return (
    <div className="space-y-4 rounded-lg bg-cream px-4 py-4 sm:px-5">
      <div className="sticky top-0 z-[1] -mx-1 space-y-3 bg-cream px-1 pb-1 pt-0.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[14.5px] font-medium">{t("products.variants")}</p>
            <p className="mt-0.5 text-[12.5px] text-mute">{t("products.variantsHint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="quiet" onClick={onApplySizePreset}>
              {t("products.variantPreset")}
            </Button>
            <Button type="button" variant="primary" onClick={addVariant}>
              {t("products.addVariant")}
            </Button>
          </div>
        </div>

        {editing.variants.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {editing.variants.map((v, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-medium transition ${
                  idx === activeIdx
                    ? "border-ink bg-ink text-paper"
                    : "border-line-2 bg-paper text-ink-soft hover:border-ink"
                }`}
              >
                {v.name.trim() || t("products.variantUntitled", { n: idx + 1 })}
                {v.is_default ? " · ★" : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {editing.variants.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-paper px-4 py-8 text-center">
          <p className="text-[14px] text-mute">{t("products.variantsEmpty")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="quiet" onClick={onApplySizePreset}>
              {t("products.variantPreset")}
            </Button>
            <Button type="button" variant="primary" onClick={addVariant}>
              {t("products.addVariant")}
            </Button>
          </div>
        </div>
      ) : active ? (
        <VariantEditor
          t={t}
          variant={active}
          variantIdx={activeIdx}
          variantCount={editing.variants.length}
          editing={editing}
          setEditing={setEditing}
          shopId={shopId}
          onPickVariantIngredient={onPickVariantIngredient}
          onRemove={() => {
            const next = editing.variants.filter((_, i) => i !== activeIdx);
            setEditing({ ...editing, variants: next });
            setActiveIdx(Math.max(0, activeIdx - 1));
          }}
        />
      ) : null}
    </div>
  );
}

function VariantEditor({
  t,
  variant,
  variantIdx,
  variantCount,
  editing,
  setEditing,
  shopId,
  onPickVariantIngredient,
  onRemove,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  variant: VariantRow;
  variantIdx: number;
  variantCount: number;
  editing: Draft;
  setEditing: Dispatch<SetStateAction<Draft | null>>;
  shopId: number;
  onPickVariantIngredient: (variantIdx: number, item: StockItem) => void;
  onRemove: () => void;
}) {
  const v = variant;
  const vIdx = variantIdx;

  return (
    <div className="space-y-3 rounded-md border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-faint">
          {t("products.variantEdit", { n: vIdx + 1, total: variantCount })}
        </p>
        {variantCount > 1 && (
          <Button type="button" variant="ghost" onClick={onRemove}>
            {t("products.removeVariant")}
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("products.variantName")}>
          <Input
            value={v.name}
            onChange={(e) => {
              const variants = [...editing.variants];
              variants[vIdx] = { ...v, name: e.target.value };
              setEditing({ ...editing, variants });
            }}
            placeholder={t("products.variantNamePh")}
            autoFocus
          />
        </Field>
        <Field label={t("products.price")}>
          <Input
            value={v.sale_price}
            onChange={(e) => {
              const variants = [...editing.variants];
              variants[vIdx] = { ...v, sale_price: e.target.value };
              setEditing({ ...editing, variants });
            }}
            inputMode="decimal"
            placeholder={t("products.pricePh")}
          />
        </Field>
      </div>
      <Field label={t("products.barcode")}>
        <div className="flex gap-2">
          <Input
            value={v.barcode}
            onChange={(e) => {
              const variants = [...editing.variants];
              variants[vIdx] = { ...v, barcode: e.target.value };
              setEditing({ ...editing, variants });
            }}
            placeholder={t("products.barcodePh")}
            inputMode="numeric"
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            variant="quiet"
            className="h-auto self-stretch px-3"
            disabled={Boolean(v.barcode.trim())}
            onClick={() => {
              const variants = [...editing.variants];
              variants[vIdx] = { ...v, barcode: makeInternalBarcode() };
              setEditing({ ...editing, variants });
            }}
          >
            {t("products.barcodeGen")}
          </Button>
        </div>
      </Field>
      <Check
        checked={v.is_default}
        onChange={(is_default) => {
          const variants = editing.variants.map((row, i) => ({
            ...row,
            is_default: is_default ? i === vIdx : false,
          }));
          setEditing({ ...editing, variants });
        }}
      >
        {t("products.variantDefault")}
      </Check>
      <div className="space-y-2 border-t border-line pt-3">
        <p className="text-[13px] font-medium">{t("products.recipe")}</p>
        <p className="text-[12.5px] text-mute">{t("products.variantRecipeHint")}</p>
        {v.ingredients.map((row, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_6.5rem_auto] gap-2">
            <div className="rounded-md border border-line bg-cream px-3 py-2 text-sm">
              {row.name ?? `#${row.stock_item_id}`}
              {row.base_unit ? <span className="ml-1 text-mute">· {row.base_unit}</span> : null}
            </div>
            <Input
              value={row.quantity}
              onChange={(e) => {
                const variants = [...editing.variants];
                const ings = [...v.ingredients];
                ings[idx] = { ...row, quantity: e.target.value };
                variants[vIdx] = { ...v, ingredients: ings };
                setEditing({ ...editing, variants });
              }}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const variants = [...editing.variants];
                variants[vIdx] = {
                  ...v,
                  ingredients: v.ingredients.filter((_, i) => i !== idx),
                };
                setEditing({ ...editing, variants });
              }}
            >
              {t("common.remove")}
            </Button>
          </div>
        ))}
        <StockSearchPicker
          shopId={shopId}
          excludeIds={v.ingredients
            .map((r) => r.stock_item_id)
            .filter((id): id is number => typeof id === "number")}
          onPick={(item) => onPickVariantIngredient(vIdx, item)}
          placeholder={t("stock.searchPh")}
        />
      </div>
    </div>
  );
}

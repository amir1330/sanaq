import type { Dispatch, SetStateAction } from "react";
import { StockSearchPicker } from "../StockSearchPicker";
import { Button, Check, Field, Input } from "../ui";
import { makeInternalBarcode } from "../../lib/barcode";
import { money } from "../../lib/utils";
import type { Draft, IngRow, VariantRow } from "../../pages/owner/products/types";
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
  return (
    <div className="space-y-4 rounded-lg bg-cream px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14.5px] font-medium">{t("products.variants")}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="quiet" onClick={onApplySizePreset}>
            {t("products.variantPreset")}
          </Button>
          <Button
            type="button"
            variant="quiet"
            onClick={() =>
              setEditing({
                ...editing,
                variants: [...editing.variants, {
                  name: "",
                  name_kk: "",
                  name_en: "",
                  sale_price: "",
                  barcode: "",
                  is_default: editing.variants.length === 0,
                  is_active: true,
                  ingredients: [],
                }],
              })
            }
          >
            {t("products.addVariant")}
          </Button>
        </div>
      </div>
      <p className="text-[12.5px] text-mute">{t("products.variantsHint")}</p>
      {editing.variants.map((v, vIdx) => (
        <VariantEditor
          key={vIdx}
          t={t}
          variant={v}
          variantIdx={vIdx}
          editing={editing}
          setEditing={setEditing}
          shopId={shopId}
          onPickVariantIngredient={onPickVariantIngredient}
        />
      ))}
    </div>
  );
}

function VariantEditor({
  t,
  variant,
  variantIdx,
  editing,
  setEditing,
  shopId,
  onPickVariantIngredient,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  variant: VariantRow;
  variantIdx: number;
  editing: Draft;
  setEditing: Dispatch<SetStateAction<Draft | null>>;
  shopId: number;
  onPickVariantIngredient: (variantIdx: number, item: StockItem) => void;
}) {
  const v = variant;
  const vIdx = variantIdx;

  return (
    <div className="space-y-2 rounded-md border border-line bg-paper p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t("products.variantName")}>
          <Input
            value={v.name}
            onChange={(e) => {
              const variants = [...editing.variants];
              variants[vIdx] = { ...v, name: e.target.value };
              setEditing({ ...editing, variants });
            }}
            placeholder={t("products.variantNamePh")}
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
      <div className="flex flex-wrap items-center gap-3">
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
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            setEditing({
              ...editing,
              variants: editing.variants.filter((_, i) => i !== vIdx),
            })
          }
        >
          {t("common.remove")}
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-[12.5px] text-mute">{t("products.recipe")}</p>
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

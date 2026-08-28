import { PhotoField } from "../PhotoField";
import { Button, Check, Field, Input, Select } from "../ui";
import { BASE_UNITS, PURCHASE_UNITS, costPerBase, defaultStockCreate, suggestPurchaseFactor, unitCost, unitLabel } from "../../lib/utils";
import { useT } from "../../i18n";

export function CostHint({
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
  const t = useT();
  const perBase = Number(costPerBase(purchasePrice, factor));
  const pack = Number(purchasePrice);
  const n = Number(factor);
  if (!n || n <= 0) {
    return (
      <p className="mt-1 text-[12.5px] text-mute">
        {t("stock.costHintUnits", { base: baseUnit, purchase: purchaseUnit })}
      </p>
    );
  }
  if (!(pack > 0) || (n === 1 && purchaseUnit === baseUnit)) {
    return <p className="mt-1 text-[12.5px] text-mute">{t("stock.costHintZero")}</p>;
  }
  return (
    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
      → {unitCost(perBase, baseUnit)}
    </p>
  );
}

export type StockCreateState = ReturnType<typeof defaultStockCreate>;

export function StockCreateForm({
  create,
  onCreateChange,
  createPreview,
  onPhotoFile,
  onPhotoClear,
  onSave,
  onCancel,
  savePending,
  saveError,
}: {
  create: StockCreateState;
  onCreateChange: (next: StockCreateState) => void;
  createPreview: string | null;
  onPhotoFile: (file: File) => void;
  onPhotoClear: () => void;
  onSave: () => void;
  onCancel: () => void;
  savePending: boolean;
  saveError: Error | null;
}) {
  const t = useT();

  function setUnits(patch: Partial<StockCreateState>) {
    const next = { ...create, ...patch };
    if (patch.base_unit || patch.purchase_unit) {
      next.purchase_to_base = suggestPurchaseFactor(next.base_unit, next.purchase_unit);
    }
    onCreateChange(next);
  }

  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3">
      <div className="md:col-span-3">
        <PhotoField
          src={createPreview}
          onFile={onPhotoFile}
          onClear={onPhotoClear}
          hint={t("stock.photoHint")}
        />
      </div>
      <Field label={t("stock.name")}>
        <Input
          placeholder={t("stock.namePh")}
          value={create.name}
          onChange={(e) => onCreateChange({ ...create, name: e.target.value })}
        />
      </Field>
      <Field label={t("stock.sku")} hint={t("stock.skuHint")}>
        <Input
          placeholder={t("stock.skuPh")}
          value={create.sku}
          onChange={(e) => onCreateChange({ ...create, sku: e.target.value })}
        />
      </Field>
      <Field label={t("stock.baseUnit")}>
        <Select value={create.base_unit} onChange={(e) => setUnits({ base_unit: e.target.value })}>
          {BASE_UNITS.map((u) => (
            <option key={u} value={u}>
              {unitLabel(u)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("stock.purchaseUnit")}>
        <Select value={create.purchase_unit} onChange={(e) => setUnits({ purchase_unit: e.target.value })}>
          {PURCHASE_UNITS.map((u) => (
            <option key={u} value={u}>
              {unitLabel(u)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("stock.oneEquals", { unit: unitLabel(create.purchase_unit) })}>
        <Input
          value={create.purchase_to_base}
          onChange={(e) => onCreateChange({ ...create, purchase_to_base: e.target.value })}
          inputMode="decimal"
          placeholder={t("stock.howMany", { unit: unitLabel(create.base_unit) })}
        />
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
          {unitLabel(create.base_unit)}
        </p>
      </Field>
      <Field label={t("stock.minLabel", { unit: unitLabel(create.base_unit) })} hint={t("stock.minHint")}>
        <Input
          value={create.min_quantity}
          onChange={(e) => onCreateChange({ ...create, min_quantity: e.target.value })}
          inputMode="decimal"
        />
      </Field>
      <Field label={t("stock.pricePer", { unit: unitLabel(create.purchase_unit) })}>
        <Input
          value={create.cost_per_purchase}
          onChange={(e) => onCreateChange({ ...create, cost_per_purchase: e.target.value })}
          inputMode="decimal"
          placeholder={t("stock.pricePh")}
        />
        <CostHint
          purchasePrice={create.cost_per_purchase}
          factor={create.purchase_to_base}
          purchaseUnit={create.purchase_unit}
          baseUnit={create.base_unit}
        />
      </Field>
      <div className="md:col-span-3">
        <Check
          checked={create.on_pos}
          onChange={(on_pos) => onCreateChange({ ...create, on_pos })}
        >
          {t("stock.onPos")}
        </Check>
        <p className="mt-1 text-[12.5px] text-mute">{t("stock.onPosHint")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2 md:col-span-3">
        <Button onClick={onSave} disabled={!create.name || savePending}>
          {t("common.save")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
      {saveError && (
        <p role="alert" className="text-sm text-alert md:col-span-3">
          {saveError.message}
        </p>
      )}
    </div>
  );
}

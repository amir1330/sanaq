import type { Dispatch, SetStateAction } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { PhotoField } from "../PhotoField";
import { Button, Check, Field, Input, Select } from "../ui";
import { makeInternalBarcode } from "../../lib/barcode";
import { localizedName } from "../../lib/i18nName";
import { publicUrl } from "../../lib/utils";
import type { Locale } from "../../i18n/types";
import { emptyVariant, type Draft } from "../../pages/owner/products/types";
import type { Category, StockItem } from "../../types";
import { ProductRecipeSection, ProductVariantsSection } from "./ProductVariantsSection";

export function ProductEditorForm({
  t,
  locale,
  shopId,
  editing,
  setEditing,
  categories,
  photoPreview,
  dropPhoto,
  onPhotoFile,
  onPhotoClear,
  catName,
  onCatNameChange,
  addingCat,
  onAddingCatChange,
  addCat,
  onApplySizePreset,
  onPickIngredient,
  onPickVariantIngredient,
  save,
  onCancel,
  onDelete,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  shopId: number;
  editing: Draft;
  setEditing: Dispatch<SetStateAction<Draft | null>>;
  categories: Category[] | undefined;
  photoPreview: string | null;
  dropPhoto: boolean;
  onPhotoFile: (file: File) => void;
  onPhotoClear: () => void;
  catName: string;
  onCatNameChange: (value: string) => void;
  addingCat: boolean;
  onAddingCatChange: (adding: boolean) => void;
  addCat: UseMutationResult<unknown, Error, void, unknown>;
  onApplySizePreset: () => void;
  onPickIngredient: (item: StockItem) => void;
  onPickVariantIngredient: (variantIdx: number, item: StockItem) => void;
  save: UseMutationResult<unknown, Error, void, unknown>;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <PhotoField
          compact
          src={photoPreview ?? (dropPhoto ? null : publicUrl(editing.image_url))}
          onFile={onPhotoFile}
          onClear={onPhotoClear}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <Field label={t("products.namePrimary")}>
            <Input
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder={t("products.namePh")}
              autoFocus
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("products.nameKk")}>
              <Input
                value={editing.name_kk}
                onChange={(e) => setEditing({ ...editing, name_kk: e.target.value })}
                placeholder={t("products.nameKkPh")}
              />
            </Field>
            <Field label={t("products.nameEn")}>
              <Input
                value={editing.name_en}
                onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                placeholder={t("products.nameEnPh")}
              />
            </Field>
          </div>
          <p className="text-[12.5px] leading-snug text-mute">{t("products.nameLangHint")}</p>
        </div>
      </div>

      <div className="space-y-4 rounded-lg bg-cream px-4 py-4 sm:px-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{t("products.sectionPos")}</p>
        <Field label={t("products.price")}>
          <Input
            value={editing.sale_price}
            onChange={(e) => setEditing({ ...editing, sale_price: e.target.value })}
            inputMode="decimal"
            placeholder={t("products.pricePh")}
          />
        </Field>
        <Field label={t("products.category")}>
          <Select
            value={editing.category_id ?? ""}
            onChange={(e) =>
              setEditing({ ...editing, category_id: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">{t("products.noCategory")}</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {localizedName(c, locale)}
              </option>
            ))}
          </Select>
        </Field>
        {addingCat ? (
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-0 flex-1"
              value={catName}
              onChange={(e) => onCatNameChange(e.target.value)}
              placeholder={t("products.catPh")}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (catName.trim()) addCat.mutate();
              }}
            />
            <Button
              type="button"
              variant="quiet"
              disabled={!catName.trim() || addCat.isPending}
              onClick={() => addCat.mutate()}
            >
              {addCat.isPending ? "…" : t("common.add")}
            </Button>
            {(categories ?? []).length > 0 && (
              <Button type="button" variant="ghost" onClick={() => onAddingCatChange(false)}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="text-[12.5px] text-mute hover:text-ink"
            onClick={() => onAddingCatChange(true)}
          >
            {t("products.newCategory")}
          </button>
        )}
        {addCat.isError && (
          <p className="text-sm text-alert">{(addCat.error as Error).message}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={!editing.is_service ? "primary" : "quiet"}
            onClick={() => setEditing({ ...editing, is_service: false })}
          >
            {t("products.kindProduct")}
          </Button>
          <Button
            type="button"
            variant={editing.is_service ? "primary" : "quiet"}
            onClick={() =>
              setEditing({
                ...editing,
                is_service: true,
                ingredients: [],
                has_variants: false,
                variants: [],
              })
            }
          >
            {t("products.kindService")}
          </Button>
        </div>
        <Check checked={editing.is_active} onChange={(is_active) => setEditing({ ...editing, is_active })}>
          {t("products.onPos")}
        </Check>
        {!editing.is_service && !editing.has_variants && (
          <Field label={t("products.barcode")} hint={t("products.barcodeHint")}>
            <div className="flex gap-2">
              <Input
                value={editing.barcode}
                onChange={(e) => setEditing({ ...editing, barcode: e.target.value })}
                placeholder={t("products.barcodePh")}
                inputMode="numeric"
                autoComplete="off"
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="quiet"
                className="h-auto self-stretch px-3"
                disabled={Boolean(editing.barcode.trim())}
                onClick={() => setEditing({ ...editing, barcode: makeInternalBarcode() })}
              >
                {t("products.barcodeGen")}
              </Button>
            </div>
          </Field>
        )}
      </div>

      {!editing.is_service && (
        <Check
          checked={editing.has_variants}
          onChange={(has_variants) =>
            setEditing({
              ...editing,
              has_variants,
              variants: has_variants
                ? editing.variants.length
                  ? editing.variants
                  : [emptyVariant(true)]
                : [],
              barcode: has_variants ? "" : editing.barcode,
            })
          }
        >
          {t("products.hasVariants")}
        </Check>
      )}
      {!editing.is_service && editing.has_variants && (
        <ProductVariantsSection
          t={t}
          editing={editing}
          setEditing={setEditing}
          shopId={shopId}
          onApplySizePreset={onApplySizePreset}
          onPickVariantIngredient={onPickVariantIngredient}
        />
      )}
      {!editing.is_service && !editing.has_variants && (
        <details className="rounded-lg bg-cream px-4 py-2 sm:px-5">
          <summary className="flex min-h-12 cursor-pointer list-none items-center text-[16px] font-medium touch-manipulation [&::-webkit-details-marker]:hidden">
            {t("products.recipe")}
          </summary>
          <ProductRecipeSection
            t={t}
            ingredients={editing.ingredients}
            onChange={(ingredients) => setEditing({ ...editing, ingredients })}
            onPick={onPickIngredient}
            shopId={shopId}
          />
        </details>
      )}
      <details className="rounded-lg bg-cream px-4 py-2 sm:px-5">
        <summary className="flex min-h-12 cursor-pointer list-none items-center text-[16px] font-medium touch-manipulation [&::-webkit-details-marker]:hidden">
          {t("products.ofdReceipt")}
        </summary>
        <p className="mt-2 text-[12.5px] text-mute">{t("products.ofdHint")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label={t("products.vat")}>
            <Input
              value={editing.tax_percent}
              onChange={(e) => setEditing({ ...editing, tax_percent: e.target.value })}
              inputMode="decimal"
            />
          </Field>
          <Field label={t("products.taxCode")}>
            <Input
              value={editing.tax_type}
              onChange={(e) => setEditing({ ...editing, tax_type: e.target.value })}
              inputMode="numeric"
            />
          </Field>
        </div>
      </details>
      {save.isError && <p className="text-[15px] text-alert">{(save.error as Error).message}</p>}
      <div className="sticky bottom-0 flex flex-wrap gap-3 border-t border-line bg-paper pt-5">
        <Button type="submit" size="lg" className="min-w-36" disabled={save.isPending}>
          {save.isPending ? t("common.saving") : t("common.save")}
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        {editing.id ? (
          <Button type="button" size="lg" variant="danger" className="ml-auto" onClick={onDelete}>
            {t("common.delete")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

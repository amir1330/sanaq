import type { RefObject } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Dialog, Field, Input, Select } from "../ui";
import type { Locale } from "../../i18n/types";
import type { Category, StockItem } from "../../types";

type ImportPreviewRow = Awaited<ReturnType<typeof api.previewStockImport>>["rows"][number];

export function StockMakeProductDialog({
  t,
  item,
  makePrice,
  onMakePriceChange,
  makeCategoryId,
  onMakeCategoryIdChange,
  categories,
  makeProduct,
  onClose,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  item: StockItem | null;
  makePrice: string;
  onMakePriceChange: (value: string) => void;
  makeCategoryId: number | "";
  onMakeCategoryIdChange: (value: number | "") => void;
  categories: Category[] | undefined;
  makeProduct: UseMutationResult<unknown, Error, void, unknown>;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={item != null}
      title={t("stock.makeProductTitle")}
      hint={item ? `${item.name}. ${t("stock.makeProductHint")}` : undefined}
      onClose={onClose}
    >
      <div className="grid gap-3">
        <Field label={t("products.price")}>
          <Input
            value={makePrice}
            onChange={(e) => onMakePriceChange(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        </Field>
        <Field label={t("products.category")}>
          <Select
            value={makeCategoryId === "" ? "" : String(makeCategoryId)}
            onChange={(e) => onMakeCategoryIdChange(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">{t("products.noCategory")}</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {makeProduct.isError && (
          <p role="alert" className="text-sm text-alert">{(makeProduct.error as Error).message}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => makeProduct.mutate()}
            disabled={!makePrice || Number(makePrice) <= 0 || makeProduct.isPending}
          >
            {t("common.save")}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function StockImportDialog({
  t,
  locale,
  shopId,
  open,
  onClose,
  importInput,
  importRows,
  importOk,
  importErr,
  previewImport,
  confirmImport,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  shopId: number;
  open: boolean;
  onClose: () => void;
  importInput: RefObject<HTMLInputElement | null>;
  importRows: ImportPreviewRow[] | null;
  importOk: number;
  importErr: number;
  previewImport: UseMutationResult<
    Awaited<ReturnType<typeof api.previewStockImport>>,
    Error,
    File,
    unknown
  >;
  confirmImport: UseMutationResult<unknown, Error, void, unknown>;
}) {
  return (
    <Dialog open={open} title={t("stock.importBtn")} size="lg" onClose={onClose}>
      <div className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="quiet" onClick={() => void api.downloadStockImportTemplate(shopId, locale)}>
            {t("stock.importTemplate")}
          </Button>
          <Button variant="quiet" onClick={() => importInput.current?.click()}>
            {t("stock.importPreview")}
          </Button>
          <input
            ref={importInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) previewImport.mutate(file);
            }}
          />
        </div>
        {previewImport.isError && (
          <p role="alert" className="text-sm text-alert">{(previewImport.error as Error).message}</p>
        )}
        {importRows && (
          <>
            <p className="text-sm text-mute">
              {t("stock.importOk", { n: importOk })}
              {importErr ? ` · ${t("stock.importErrors", { n: importErr })}` : ""}
            </p>
            <div className="max-h-[40vh] overflow-auto rounded-md border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="sticky top-0 bg-cream font-mono text-[10px] uppercase tracking-wide text-faint">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">{t("stock.name")}</th>
                    <th className="px-3 py-2">{t("stock.colNow")}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((r) => (
                    <tr
                      key={r.row}
                      className={`border-t border-line ${r.ok ? "" : "bg-alert/10"}`}
                    >
                      <td className="px-3 py-2 font-mono text-mute">{r.row}</td>
                      <td className="px-3 py-2">{r.data?.name ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">
                        {r.data ? `${r.data.quantity} ${r.data.purchase_unit}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-[12.5px]">
                        {r.ok ? "OK" : r.errors.join("; ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {confirmImport.isError && (
              <p role="alert" className="text-sm text-alert">{(confirmImport.error as Error).message}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => confirmImport.mutate()}
                disabled={importOk === 0 || confirmImport.isPending}
              >
                {t("stock.importConfirm")}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                {t("common.cancel")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

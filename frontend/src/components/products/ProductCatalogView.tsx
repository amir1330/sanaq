import { Button, Input, MoreMenu, pill } from "../ui";
import { localizedName } from "../../lib/i18nName";
import { productPriceLabel } from "../../lib/productVariants";
import { publicUrl } from "../../lib/utils";
import type { Locale } from "../../i18n/types";
import type { Category, Product } from "../../types";

type ProductGroup = {
  id: number | null;
  name: string;
  items: Product[];
};

export function ProductCatalogView({
  t,
  locale,
  filterCat,
  onFilterCat,
  categories,
  q,
  onQChange,
  viewMode,
  onViewMode,
  groups,
  rename,
  onRenameChange,
  onRenameCancel,
  onSaveCategory,
  saveCatPending,
  onOpenProduct,
  onAddProduct,
  onRenameCategory,
  onDeleteCategory,
  openingId,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  totalProducts,
  listLength,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  filterCat: number | "all";
  onFilterCat: (id: number | "all") => void;
  categories: Category[];
  q: string;
  onQChange: (value: string) => void;
  viewMode: "list" | "tiles";
  onViewMode: (mode: "list" | "tiles") => void;
  groups: ProductGroup[];
  rename: { id: number; name: string } | null;
  onRenameChange: (rename: { id: number; name: string }) => void;
  onRenameCancel: () => void;
  onSaveCategory: () => void;
  saveCatPending: boolean;
  onOpenProduct: (product: Product) => void;
  onAddProduct: (categoryId: number | null) => void;
  onRenameCategory: (group: ProductGroup) => void;
  onDeleteCategory: (group: ProductGroup) => void;
  openingId: number | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  totalProducts: number;
  listLength: number;
}) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onFilterCat("all")}
            className={`${pill} ${
              filterCat === "all" ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-soft hover:border-ink"
            }`}
          >
            {t("common.all")}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onFilterCat(c.id)}
              className={`${pill} ${
                filterCat === c.id ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-soft hover:border-ink"
              }`}
            >
              {localizedName(c, locale)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder={t("pos.searchProducts")}
            className="max-w-xs"
          />
          <div className="grid h-12 grid-cols-2 items-stretch rounded-full border-[1.5px] border-line-2 p-0.5">
            <button
              type="button"
              onClick={() => onViewMode("list")}
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 text-[14px] font-medium leading-none touch-manipulation ${
                viewMode === "list" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {t("products.viewList")}
            </button>
            <button
              type="button"
              onClick={() => onViewMode("tiles")}
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 text-[14px] font-medium leading-none touch-manipulation ${
                viewMode === "tiles" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
              }`}
            >
              {t("products.viewTiles")}
            </button>
          </div>
        </div>
      </div>
      {groups.map((group) => (
        <section key={group.id ?? "none"} className="mb-8">
          <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
            {rename?.id === group.id ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <Input
                  value={rename.name}
                  onChange={(e) => onRenameChange({ id: group.id!, name: e.target.value })}
                  className="max-w-xs"
                />
                <Button size="md" disabled={!rename.name.trim() || saveCatPending} onClick={onSaveCategory}>
                  {t("common.save")}
                </Button>
                <Button variant="ghost" onClick={onRenameCancel}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-[22px] font-normal">{group.name}</h2>
                {group.id != null && (
                  <MoreMenu
                    items={[
                      { label: t("products.addOne"), onClick: () => onAddProduct(group.id) },
                      { label: t("common.rename"), onClick: () => onRenameCategory(group) },
                      {
                        label: t("common.delete"),
                        danger: true,
                        onClick: () => onDeleteCategory(group),
                      },
                    ]}
                  />
                )}
              </>
            )}
          </div>
          {group.items.length === 0 ? (
            <p className="rounded-lg bg-cream px-5 py-8 text-sm text-mute">
              {t("products.catEmpty")}
            </p>
          ) : viewMode === "list" ? (
            <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-auto" />
                  <col className="w-[7.5rem]" />
                  <col className="w-[6.5rem]" />
                </colgroup>
                <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
                  <tr className="border-b border-line text-left">
                    <th className="px-5 py-3">{t("products.colName")}</th>
                    <th className="px-2 py-3 text-right">{t("products.colPrice")}</th>
                    <th className="pr-5 py-3 text-right">{t("products.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((p) => {
                    const src = publicUrl(p.image_url);
                    return (
                      <tr
                        key={p.id}
                        className={`cursor-pointer border-b border-line last:border-0 hover:bg-paper/60 ${
                          p.is_active ? "" : "opacity-55"
                        }`}
                        onClick={() => onOpenProduct(p)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex min-w-0 items-center gap-3">
                            {src ? (
                              <img
                                src={src}
                                alt={localizedName(p, locale)}
                                className="h-10 w-10 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-paper font-mono text-[8px] uppercase tracking-wide text-mute">
                                —
                              </div>
                            )}
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {localizedName(p, locale)}
                                {openingId === p.id ? ` · ${t("common.loading")}` : ""}
                              </span>
                              {p.barcode ? (
                                <span className="mt-0.5 block truncate font-mono text-[11px] text-mute">
                                  {p.barcode}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-3.5 text-right font-mono text-[15px] font-semibold tabular-nums">
                          {productPriceLabel(p)}
                        </td>
                        <td className="pr-5 py-3.5 text-right text-[14px] text-mute">
                          {p.is_active ? t("products.active") : t("products.hidden")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((p) => {
                const src = publicUrl(p.image_url);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenProduct(p)}
                    className={`overflow-hidden rounded-lg bg-cream text-left shadow-soft transition hover:-translate-y-0.5 ${
                      p.is_active ? "" : "opacity-55"
                    }`}
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={localizedName(p, locale)}
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-40 place-items-center bg-paper text-sm text-mute">{t("products.noPhoto")}</div>
                    )}
                    <div className="px-5 py-4">
                      <p className="font-display text-[19px] font-normal">{localizedName(p, locale)}</p>
                      {p.barcode ? (
                        <p className="mt-1 truncate font-mono text-[11px] text-mute">{p.barcode}</p>
                      ) : null}
                      <p className="mt-2 font-mono text-[15px] font-semibold">{productPriceLabel(p)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ))}
      {hasNextPage && (
        <div className="mb-6 flex justify-center">
          <Button variant="quiet" disabled={isFetchingNextPage} onClick={onLoadMore}>
            {isFetchingNextPage ? t("common.loading") : t("common.loadMore")}
            {totalProducts > listLength ? ` · ${listLength}/${totalProducts}` : ""}
          </Button>
        </div>
      )}
    </>
  );
}

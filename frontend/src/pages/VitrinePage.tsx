import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Glyph } from "../components/Glyph";
import { ShopBrand } from "../components/ShopBrand";
import { Dialog, Input, MoreMenu } from "../components/ui";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { useLocale, useT } from "../i18n";
import { localizedName } from "../lib/i18nName";
import { cn, money, publicUrl } from "../lib/utils";
import { homePath, useAuth } from "../store/auth";
import type { Product, ProductVariant, VitrineColumn } from "../types";

const PAGE = 100;

type HeaderStyle = "ornament" | "line" | "none";

type EditorItem = {
  key: string;
  product_id: number;
  product: Product;
};

type EditorColumn = {
  key: string;
  title: string;
  header_style: HeaderStyle;
  items: EditorItem[];
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function activeVariants(product: Product): ProductVariant[] {
  return (product.variants ?? []).filter((v) => v.is_active);
}

function hasVariantPrices(product: Product): boolean {
  return activeVariants(product).length > 0;
}

function collectVariantNames(products: Product[]): string[] {
  const names: string[] = [];
  for (const p of products) {
    const sorted = [...activeVariants(p)].sort((a, b) => a.sort_order - b.sort_order);
    for (const v of sorted) {
      if (!names.includes(v.name)) names.push(v.name);
    }
  }
  return names;
}

function savedToEditor(cols: VitrineColumn[]): EditorColumn[] {
  return cols.map((col) => ({
    key: String(col.id),
    title: col.title,
    header_style: (col.header_style as HeaderStyle) || "ornament",
    items: col.items.map((item) => ({
      key: String(item.id),
      product_id: item.product_id,
      product: item.product,
    })),
  }));
}

function autoColumns(
  allProducts: Product[],
  categories: { id: number; name: string; name_kk?: string | null; name_en?: string | null }[],
  otherLabel: string,
  locale: import("../i18n/types").Locale,
): EditorColumn[] {
  const active = allProducts.filter((p) => p.is_active);
  const blocks = categories
    .map((c) => ({
      key: `cat-${c.id}`,
      title: localizedName(c, locale),
      header_style: "ornament" as HeaderStyle,
      items: active
        .filter((p) => p.category_id === c.id)
        .map((p) => ({ key: `p-${p.id}`, product_id: p.id, product: p })),
    }))
    .filter((b) => b.items.length > 0);
  const rest = active.filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id));
  if (rest.length) {
    blocks.push({
      key: "cat-0",
      title: otherLabel,
      header_style: "ornament",
      items: rest.map((p) => ({ key: `p-${p.id}`, product_id: p.id, product: p })),
    });
  }
  return blocks;
}

function ColumnHeader({
  title,
  headerStyle,
  editMode,
  onTitleChange,
  onStyleChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
}: {
  title: string;
  headerStyle: HeaderStyle;
  editMode: boolean;
  onTitleChange?: (v: string) => void;
  onStyleChange?: (v: HeaderStyle) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const t = useT();
  return (
    <div className="mb-5 flex flex-col items-center text-center">
      {editMode && (
        <div className="mb-2 flex flex-wrap items-center justify-center gap-1">
          <button
            type="button"
            disabled={!canMoveUp}
            className="rounded border border-line px-2 py-0.5 text-[11px] disabled:opacity-40"
            onClick={onMoveUp}
            title={t("vitrine.moveUp")}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            className="rounded border border-line px-2 py-0.5 text-[11px] disabled:opacity-40"
            onClick={onMoveDown}
            title={t("vitrine.moveDown")}
          >
            ↓
          </button>
          {(["ornament", "line", "none"] as HeaderStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              className={cn(
                "rounded border px-2 py-0.5 text-[10px] uppercase",
                headerStyle === style ? "border-ink bg-paper" : "border-line text-faint",
              )}
              onClick={() => onStyleChange?.(style)}
              title={
                style === "ornament"
                  ? t("vitrine.headerOrnament")
                  : style === "line"
                    ? t("vitrine.headerLine")
                    : t("vitrine.headerNone")
              }
            >
              {style === "ornament" ? "✦" : style === "line" ? "—" : "○"}
            </button>
          ))}
          {onDelete ? (
            <button
              type="button"
              className="rounded border border-line px-2 py-0.5 text-[10px] text-faint hover:text-ink"
              onClick={onDelete}
            >
              {t("vitrine.deleteColumn")}
            </button>
          ) : null}
        </div>
      )}
      {editMode ? (
        <input
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          className="w-full max-w-[220px] border-b border-line bg-transparent text-center font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-faint outline-none"
        />
      ) : (
        <>
          {headerStyle === "ornament" && (
            <Glyph name="ornament" className="h-6 w-full max-w-[220px] text-maroon md:h-7 md:max-w-[260px]" />
          )}
          {headerStyle === "line" && <div className="h-px w-full max-w-[220px] bg-line-2" />}
          <h2
            className={cn(
              "font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-faint",
              headerStyle === "none" ? "mt-0" : "mt-3",
            )}
          >
            {title}
          </h2>
        </>
      )}
    </div>
  );
}

function VariantHeaderRow({ variantNames }: { variantNames: string[] }) {
  return (
    <li className="flex items-center gap-3.5 px-3 pb-1 text-[13px] uppercase tracking-wide text-faint">
      <span className="w-[4.5rem] shrink-0" />
      <span className="min-w-0 flex-1" />
      {variantNames.map((n) => (
        <span key={n} className="w-14 shrink-0 text-center md:w-16">
          {n}
        </span>
      ))}
    </li>
  );
}

function VariantRow({
  product,
  variantNames,
  striped,
  editMode,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  product: Product;
  variantNames: string[];
  striped?: boolean;
  editMode?: boolean;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const locale = useLocale((s) => s.locale);
  const t = useT();
  return (
    <li
      className={cn(
        "flex items-center gap-3.5 rounded-md px-3 py-2",
        striped ? "bg-paper-2" : "bg-transparent",
      )}
    >
      {editMode ? (
        <div className="flex w-[4.5rem] shrink-0 flex-col gap-0.5">
          <button type="button" disabled={!canMoveUp} className="text-[11px] disabled:opacity-40" onClick={onMoveUp}>
            ↑
          </button>
          <button type="button" disabled={!canMoveDown} className="text-[11px] disabled:opacity-40" onClick={onMoveDown}>
            ↓
          </button>
          <button type="button" className="text-[11px] text-faint hover:text-ink" onClick={onRemove} title={t("vitrine.removeItem")}>
            ×
          </button>
        </div>
      ) : (
        <span className="w-[4.5rem] shrink-0" />
      )}
      <h3 className="min-w-0 flex-1 truncate font-display text-[26px] font-normal leading-none md:text-[30px]">
        {localizedName(product, locale)}
      </h3>
      {variantNames.map((n) => {
        const v = activeVariants(product).find((x) => x.name === n);
        return (
          <span
            key={n}
            className="w-14 shrink-0 text-center font-mono text-[16px] tabular-nums text-gold md:w-16 md:text-[18px]"
          >
            {v ? money(v.sale_price) : "—"}
          </span>
        );
      })}
    </li>
  );
}

function MenuRow({
  product,
  striped,
  editMode,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  product: Product;
  striped?: boolean;
  editMode?: boolean;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const locale = useLocale((s) => s.locale);
  const t = useT();
  const label = localizedName(product, locale);
  const src = publicUrl(product.image_url);
  return (
    <li
      className={cn(
        "flex items-end gap-3.5 rounded-md px-3 py-2",
        striped ? "bg-paper-2" : "bg-transparent",
      )}
    >
      {editMode ? (
        <div className="flex w-[4.5rem] shrink-0 flex-col gap-0.5 pb-1">
          <button type="button" disabled={!canMoveUp} className="text-[11px] disabled:opacity-40" onClick={onMoveUp}>
            ↑
          </button>
          <button type="button" disabled={!canMoveDown} className="text-[11px] disabled:opacity-40" onClick={onMoveDown}>
            ↓
          </button>
          <button type="button" className="text-[11px] text-faint hover:text-ink" onClick={onRemove} title={t("vitrine.removeItem")}>
            ×
          </button>
        </div>
      ) : src ? (
        <img src={src} alt="" className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-md object-cover" />
      ) : (
        <span className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-md bg-paper-2 font-display text-2xl text-maroon">
          {label.slice(0, 1)}
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-baseline gap-2 pb-1">
        <h3 className="min-w-0 truncate font-display text-[26px] font-normal leading-none md:text-[30px]">
          {label}
        </h3>
        <span className="mb-[3px] min-w-6 flex-1 border-b border-dotted border-line-2" />
        <span className="shrink-0 font-mono text-[18px] font-semibold tabular-nums text-gold md:text-[20px]">
          {money(product.sale_price)}
        </span>
      </div>
    </li>
  );
}

function ProductPicker({
  shopId,
  open,
  onClose,
  onPick,
}: {
  shopId: number;
  open: boolean;
  onClose: () => void;
  onPick: (product: Product) => void;
}) {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 250);
  const products = useQuery({
    queryKey: ["products", "vitrine-pick", shopId, debouncedQ],
    queryFn: () =>
      api.products(shopId, {
        active_only: true,
        q: debouncedQ.trim() || undefined,
        limit: 40,
      }),
    enabled: open && shopId > 0,
  });
  const items = products.data?.items ?? [];

  return (
    <Dialog open={open} onClose={onClose} title={t("vitrine.pickProduct")}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} autoFocus />
      <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-line">
        {items.map((p) => (
          <button
            key={p.id}
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-cream"
            onClick={() => {
              onPick(p);
              onClose();
              setQ("");
            }}
          >
            <span className="min-w-0 truncate">{localizedName(p, locale)}</span>
            <span className="shrink-0 font-mono text-xs text-gold">{money(p.sale_price)}</span>
          </button>
        ))}
        {!products.isLoading && items.length === 0 && (
          <p className="px-3 py-4 text-sm text-mute">{t("vitrine.empty")}</p>
        )}
      </div>
    </Dialog>
  );
}

export function VitrinePage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const qc = useQueryClient();
  const { user, shopId } = useAuth();
  const sid = shopId ?? user?.shop_id ?? 0;
  const canEdit = user?.role === "owner" || user?.role === "super_admin";
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [full, setFull] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<EditorColumn[] | null>(null);
  const [pickColumnKey, setPickColumnKey] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const shops = useQuery({ queryKey: ["shops"], queryFn: api.shops, enabled: sid > 0 });
  const savedLayout = useQuery({
    queryKey: ["vitrine-layout", sid],
    queryFn: () => api.vitrineLayout(sid),
    enabled: sid > 0,
    refetchInterval: editMode ? false : 20_000,
  });
  const products = useInfiniteQuery({
    queryKey: ["products", "vitrine", sid],
    queryFn: ({ pageParam }) =>
      api.products(sid, { active_only: true, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled: sid > 0,
    refetchInterval: editMode ? false : 20_000,
  });
  const categories = useQuery({
    queryKey: ["categories", sid],
    queryFn: () => api.categories(sid),
    enabled: sid > 0,
    refetchInterval: editMode ? false : 20_000,
  });

  useEffect(() => {
    if (products.hasNextPage && !products.isFetchingNextPage) {
      void products.fetchNextPage();
    }
  }, [products.hasNextPage, products.isFetchingNextPage, products.data]);

  const shop = shops.data?.find((s) => s.id === sid) ?? shops.data?.[0];
  const otherLabel = t("vitrine.other");
  const allProducts = useMemo(
    () => products.data?.pages.flatMap((p) => p.items) ?? [],
    [products.data],
  );

  const displayColumns = useMemo((): EditorColumn[] => {
    const saved = savedLayout.data?.columns ?? [];
    if (saved.length > 0) return savedToEditor(saved);
    return autoColumns(allProducts, categories.data ?? [], otherLabel, locale);
  }, [savedLayout.data, allProducts, categories.data, otherLabel, locale]);

  const columns = editMode && draft ? draft : displayColumns;

  const saveLayout = useMutation({
    mutationFn: () =>
      api.putVitrineLayout(sid, {
        columns: (draft ?? []).map((col, colIdx) => ({
          title: col.title.trim() || t("vitrine.newColumn"),
          sort_order: colIdx,
          header_style: col.header_style,
          items: col.items.map((item, itemIdx) => ({
            product_id: item.product_id,
            sort_order: itemIdx,
          })),
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vitrine-layout", sid] });
      setEditMode(false);
      setDraft(null);
    },
  });

  function startEdit() {
    setDraft(structuredClone(displayColumns));
    setEditMode(true);
  }

  async function finishEdit() {
    await saveLayout.mutateAsync();
  }

  function updateColumn(colKey: string, patch: Partial<EditorColumn>) {
    setDraft((prev) => (prev ?? []).map((c) => (c.key === colKey ? { ...c, ...patch } : c)));
  }

  function moveColumn(colKey: string, delta: -1 | 1) {
    setDraft((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((c) => c.key === colKey);
      const next = idx + delta;
      if (idx < 0 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }

  function moveItem(colKey: string, itemKey: string, delta: -1 | 1) {
    setDraft((prev) => {
      if (!prev) return prev;
      return prev.map((col) => {
        if (col.key !== colKey) return col;
        const idx = col.items.findIndex((i) => i.key === itemKey);
        const next = idx + delta;
        if (idx < 0 || next < 0 || next >= col.items.length) return col;
        const items = [...col.items];
        [items[idx], items[next]] = [items[next], items[idx]];
        return { ...col, items };
      });
    });
  }

  function removeItem(colKey: string, itemKey: string) {
    setDraft((prev) =>
      (prev ?? []).map((col) =>
        col.key === colKey ? { ...col, items: col.items.filter((i) => i.key !== itemKey) } : col,
      ),
    );
  }

  function addProductToColumn(colKey: string, product: Product) {
    setDraft((prev) =>
      (prev ?? []).map((col) =>
        col.key === colKey
          ? {
              ...col,
              items: [...col.items, { key: newKey(), product_id: product.id, product }],
            }
          : col,
      ),
    );
  }

  function addColumn() {
    setDraft((prev) => [
      ...(prev ?? []),
      { key: newKey(), title: t("vitrine.newColumn"), header_style: "ornament", items: [] },
    ]);
  }

  async function toggleFull() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await rootRef.current?.requestFullscreen();
  }

  const timeLocale = locale === "en" ? "en-GB" : locale === "kk" ? "kk-KZ" : "ru-RU";
  const time = now.toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" });
  const gridCols =
    columns.length >= 3 ? "lg:grid-cols-2 xl:grid-cols-3" : columns.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1";

  return (
    <div ref={rootRef} className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="px-8 pt-7 md:px-12">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <ShopBrand shop={shop} fallback={t("vitrine.menu")} size="md" markClass="h-6 w-8 text-maroon" />
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-faint">{t("vitrine.menu")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {canEdit &&
              (editMode ? (
                <button
                  type="button"
                  className="rounded-full border border-ink px-4 py-2 font-mono text-[12px] uppercase tracking-wide text-ink hover:bg-cream"
                  disabled={saveLayout.isPending}
                  onClick={() => void finishEdit()}
                >
                  {saveLayout.isPending ? t("common.loading") : t("vitrine.done")}
                </button>
              ) : (
                <MoreMenu
                  items={[{ label: t("vitrine.editMenu"), onClick: startEdit }]}
                />
              ))}
            <p className="font-mono text-[28px] tabular-nums text-gold md:text-[34px]">{time}</p>
          </div>
        </div>
      </header>

      <main className={cn("grid flex-1 auto-rows-min gap-x-0 gap-y-12 px-8 py-8 md:px-12", gridCols)}>
        {columns.map((col, colIdx) => {
          const productsInCol = col.items.map((i) => i.product);
          const variantNames = collectVariantNames(productsInCol);
          const hasVariantTable = variantNames.length > 0;
          let rowIdx = 0;
          return (
            <section key={col.key} className={cn("min-w-0 px-6", colIdx > 0 && "border-l border-line")}>
              <ColumnHeader
                title={col.title}
                headerStyle={col.header_style}
                editMode={editMode}
                onTitleChange={(title) => updateColumn(col.key, { title })}
                onStyleChange={(header_style) => updateColumn(col.key, { header_style })}
                onMoveUp={() => moveColumn(col.key, -1)}
                onMoveDown={() => moveColumn(col.key, 1)}
                onDelete={() => setDraft((prev) => (prev ?? []).filter((c) => c.key !== col.key))}
                canMoveUp={colIdx > 0}
                canMoveDown={colIdx < columns.length - 1}
              />
              <ul className="space-y-1">
                {hasVariantTable && <VariantHeaderRow variantNames={variantNames} />}
                {col.items.map((item, itemIdx) => {
                  const striped = rowIdx % 2 === 1;
                  rowIdx += 1;
                  const common = {
                    striped,
                    editMode,
                    onRemove: () => removeItem(col.key, item.key),
                    onMoveUp: () => moveItem(col.key, item.key, -1),
                    onMoveDown: () => moveItem(col.key, item.key, 1),
                    canMoveUp: itemIdx > 0,
                    canMoveDown: itemIdx < col.items.length - 1,
                  };
                  if (hasVariantPrices(item.product)) {
                    return (
                      <VariantRow
                        key={item.key}
                        product={item.product}
                        variantNames={variantNames}
                        {...common}
                      />
                    );
                  }
                  return <MenuRow key={item.key} product={item.product} {...common} />;
                })}
              </ul>
              {editMode && (
                <button
                  type="button"
                  className="mt-3 w-full rounded-md border border-dashed border-line py-2 text-[12px] text-faint hover:border-gold hover:text-ink"
                  onClick={() => setPickColumnKey(col.key)}
                >
                  {t("vitrine.addProduct")}
                </button>
              )}
            </section>
          );
        })}
        {editMode && (
          <section className="flex min-h-[120px] items-center justify-center px-6">
            <button
              type="button"
              className="w-full max-w-xs rounded-lg border border-dashed border-line py-8 text-sm text-faint hover:border-gold hover:text-ink"
              onClick={addColumn}
            >
              {t("vitrine.addColumn")}
            </button>
          </section>
        )}
        {!editMode && products.isSuccess && columns.length === 0 && (
          <p className="font-display text-2xl text-mute">{t("vitrine.empty")}</p>
        )}
      </main>

      <footer className="mt-auto flex items-center justify-between gap-4 px-8 py-4 md:px-12">
        <Link to={homePath(user?.role)} className="text-[12.5px] text-faint hover:text-ink">
          {t("vitrine.back")}
        </Link>
        <button type="button" className="text-[12.5px] text-faint hover:text-ink" onClick={() => void toggleFull()}>
          {full ? t("vitrine.exitFullscreen") : t("vitrine.fullscreen")}
        </button>
      </footer>

      <ProductPicker
        shopId={sid}
        open={pickColumnKey != null}
        onClose={() => setPickColumnKey(null)}
        onPick={(product) => {
          if (pickColumnKey) addProductToColumn(pickColumnKey, product);
        }}
      />
    </div>
  );
}

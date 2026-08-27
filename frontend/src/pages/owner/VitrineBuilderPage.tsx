import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Field, Input, PageTitle, Select } from "../../components/ui";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useLocale, useT } from "../../i18n";
import { localizedName } from "../../lib/i18nName";
import { money } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { Product, ProductVariant } from "../../types";

type EditorItem = {
  key: string;
  product_id: number;
  variant_id: number | null;
  product: Product;
  variant: ProductVariant | null;
};

type EditorColumn = {
  key: string;
  title: string;
  title_kk: string;
  title_en: string;
  items: EditorItem[];
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function SortRow({
  id,
  label,
  sub,
  onRemove,
}: {
  id: string;
  label: string;
  sub?: string;
  onRemove?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border border-line bg-cream px-3 py-2 text-sm ${
        isDragging ? "opacity-70 shadow-soft" : ""
      }`}
    >
      <button type="button" className="cursor-grab font-mono text-[11px] text-faint" {...attributes} {...listeners}>
        ⋮⋮
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{label}</p>
        {sub ? <p className="truncate font-mono text-[11px] text-faint">{sub}</p> : null}
      </div>
      {onRemove ? (
        <button type="button" className="text-faint hover:text-ink" onClick={onRemove} aria-label="remove">
          ×
        </button>
      ) : null}
    </div>
  );
}

export function VitrineBuilderPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [filterCat, setFilterCat] = useState<number | "all">("all");
  const [columns, setColumns] = useState<EditorColumn[]>([]);
  const [selectedCol, setSelectedCol] = useState(0);

  const layout = useQuery({
    queryKey: ["vitrine-layout", shopId],
    queryFn: () => api.vitrineLayout(shopId),
  });
  const categories = useQuery({
    queryKey: ["categories", shopId],
    queryFn: () => api.categories(shopId),
  });
  const products = useQuery({
    queryKey: ["products", shopId, "vitrine-builder", debouncedSearch, filterCat],
    queryFn: () =>
      api.products(shopId, {
        active_only: true,
        q: debouncedSearch || undefined,
        category_id: filterCat === "all" ? undefined : filterCat,
        limit: 200,
        offset: 0,
      }),
  });

  useEffect(() => {
    if (!layout.data) return;
    setColumns(
      layout.data.columns.map((col) => ({
        key: String(col.id),
        title: col.title,
        title_kk: col.title_kk ?? "",
        title_en: col.title_en ?? "",
        items: col.items.map((item) => ({
          key: String(item.id),
          product_id: item.product_id,
          variant_id: item.variant_id ?? null,
          product: item.product,
          variant: item.variant ?? null,
        })),
      })),
    );
    if (layout.data.columns.length && selectedCol >= layout.data.columns.length) {
      setSelectedCol(0);
    }
  }, [layout.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const save = useMutation({
    mutationFn: () =>
      api.putVitrineLayout(shopId, {
        columns: columns.map((col, colIdx) => ({
          title: col.title.trim(),
          title_kk: col.title_kk.trim() || null,
          title_en: col.title_en.trim() || null,
          sort_order: colIdx,
          items: col.items.map((item, itemIdx) => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            sort_order: itemIdx,
          })),
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vitrine-layout", shopId] });
    },
  });

  const catalog = useMemo(() => products.data?.items ?? [], [products.data]);

  function displayName(product: Product, variant: ProductVariant | null) {
    if (variant) {
      return `${localizedName(product, locale)} — ${localizedName(variant, locale)}`;
    }
    return localizedName(product, locale);
  }

  function displayPrice(product: Product, variant: ProductVariant | null) {
    if (variant) return money(variant.sale_price);
    const vs = (product.variants ?? []).filter((v) => v.is_active);
    if (vs.length === 0) return money(product.sale_price);
    if (vs.length === 1) return money(vs[0].sale_price);
    const prices = vs.map((v) => Number(v.sale_price));
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
  }

  function addColumn() {
    setColumns((prev) => {
      const next = [
        ...prev,
        { key: newKey(), title: t("vitrineBuilder.newColumn"), title_kk: "", title_en: "", items: [] },
      ];
      setSelectedCol(next.length - 1);
      return next;
    });
  }

  function addProduct(product: Product, variant: ProductVariant | null = null) {
    setColumns((prev) => {
      let next = prev;
      let colIdx = selectedCol;
      if (!next.length) {
        next = [{ key: newKey(), title: t("vitrineBuilder.newColumn"), title_kk: "", title_en: "", items: [] }];
        colIdx = 0;
        setSelectedCol(0);
      } else {
        colIdx = Math.min(selectedCol, next.length - 1);
      }
      const copy = [...next];
      const col = { ...copy[colIdx], items: [...copy[colIdx].items] };
      col.items.push({
        key: newKey(),
        product_id: product.id,
        variant_id: variant?.id ?? null,
        product,
        variant,
      });
      copy[colIdx] = col;
      return copy;
    });
  }

  function onItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumns((prev) => {
      const next = [...prev];
      const col = { ...next[selectedCol], items: [...next[selectedCol].items] };
      const oldIndex = col.items.findIndex((i) => i.key === String(active.id));
      const newIndex = col.items.findIndex((i) => i.key === String(over.id));
      col.items = arrayMove(col.items, oldIndex, newIndex);
      next[selectedCol] = col;
      return next;
    });
  }

  const activeCol = columns[selectedCol];

  return (
    <div>
      <PageTitle
        kicker={t("vitrineBuilder.kicker")}
        title={t("vitrineBuilder.title")}
        hint={t("vitrineBuilder.hint")}
        action={
          <Button onClick={() => save.mutate()} disabled={save.isPending || !columns.length}>
            {save.isSuccess ? t("vitrineBuilder.saved") : t("vitrineBuilder.save")}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            {t("vitrineBuilder.catalog")}
          </p>
          <Field label={t("common.search")}>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
          <Field label={t("products.category")}>
            <Select
              value={filterCat === "all" ? "all" : String(filterCat)}
              onChange={(e) => setFilterCat(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">{t("common.all")}</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {localizedName(c, locale)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="max-h-[520px] space-y-1.5 overflow-y-auto">
            {catalog.map((p) => {
              const variants = (p.variants ?? []).filter((v) => v.is_active);
              if (variants.length <= 1) {
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-paper px-3 py-2 text-left text-sm hover:border-gold"
                    onClick={() => addProduct(p, variants.length === 1 ? variants[0] : null)}
                  >
                    <span className="min-w-0 truncate font-medium">{localizedName(p, locale)}</span>
                    <span className="shrink-0 font-mono text-xs text-gold">{displayPrice(p, null)}</span>
                  </button>
                );
              }
              return (
                <div key={p.id} className="rounded-md border border-line bg-paper px-3 py-2">
                  <p className="truncate font-medium">{localizedName(p, locale)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="rounded border border-line px-2 py-1 text-[11px] hover:border-gold"
                      onClick={() => addProduct(p, null)}
                    >
                      {t("vitrineBuilder.wholeProduct")}
                    </button>
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className="rounded border border-line px-2 py-1 text-[11px] hover:border-gold"
                        onClick={() => addProduct(p, v)}
                      >
                        {localizedName(v, locale)} · {money(v.sale_price)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {products.isSuccess && catalog.length === 0 && (
              <p className="text-sm text-mute">{t("vitrineBuilder.emptyCatalog")}</p>
            )}
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {columns.map((col, idx) => (
              <button
                key={col.key}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  selectedCol === idx ? "border-ink bg-paper" : "border-line bg-cream"
                }`}
                onClick={() => setSelectedCol(idx)}
              >
                {col.title.trim() || t("vitrineBuilder.newColumn")}
              </button>
            ))}
            <Button variant="quiet" onClick={addColumn}>
              {t("vitrineBuilder.addColumn")}
            </Button>
          </div>

          {!activeCol ? (
            <Card>
              <p className="text-sm text-mute">{t("vitrineBuilder.pickColumn")}</p>
            </Card>
          ) : (
            <Card className="space-y-3">
              <Field label={t("vitrineBuilder.columnTitle")}>
                <Input
                  value={activeCol.title}
                  onChange={(e) =>
                    setColumns((prev) =>
                      prev.map((c, i) => (i === selectedCol ? { ...c, title: e.target.value } : c)),
                    )
                  }
                />
              </Field>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                {t("vitrineBuilder.columnItems")}
              </p>
              {activeCol.items.length === 0 ? (
                <p className="text-sm text-mute">{t("vitrineBuilder.emptyColumn")}</p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onItemDragEnd}>
                  <SortableContext
                    items={activeCol.items.map((i) => i.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {activeCol.items.map((item) => (
                        <SortRow
                          key={item.key}
                          id={item.key}
                          label={displayName(item.product, item.variant)}
                          sub={displayPrice(item.product, item.variant)}
                          onRemove={() =>
                            setColumns((prev) =>
                              prev.map((c, i) =>
                                i === selectedCol
                                  ? { ...c, items: c.items.filter((row) => row.key !== item.key) }
                                  : c,
                              ),
                            )
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
              <Button
                variant="quiet"
                onClick={() =>
                  setColumns((prev) => prev.filter((_, i) => i !== selectedCol))
                }
              >
                {t("vitrineBuilder.deleteColumn")}
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

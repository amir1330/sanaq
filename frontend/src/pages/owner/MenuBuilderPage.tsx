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
import { defaultPriceLabel, MenuGrid } from "../../components/MenuGrid";
import { Button, Card, Check, Field, PageTitle, Select } from "../../components/ui";
import { useLocale, useT } from "../../i18n";
import { localizedName } from "../../lib/i18nName";
import { useAuth } from "../../store/auth";
import type { Category, Product } from "../../types";

function SortRow({
  id,
  label,
  active,
  onClick,
}: {
  id: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex w-full items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm ${
        active ? "border-ink bg-paper" : "border-line bg-cream"
      } ${isDragging ? "opacity-70 shadow-soft" : ""}`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <span className="cursor-grab font-mono text-[11px] text-faint">⋮⋮</span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
    </button>
  );
}

export function MenuBuilderPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const menu = useQuery({ queryKey: ["menu", shopId], queryFn: () => api.menu(shopId) });
  const [catOrder, setCatOrder] = useState<Category[]>([]);
  const [productOrder, setProductOrder] = useState<Product[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [columns, setColumns] = useState(3);
  const [showDividers, setShowDividers] = useState(true);
  const [cardStyle, setCardStyle] = useState("photo");

  useEffect(() => {
    if (!menu.data) return;
    const cats = [...menu.data.categories].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
    );
    setCatOrder(cats);
    setColumns(menu.data.layout.columns || 3);
    setShowDividers(menu.data.layout.show_dividers !== false);
    setCardStyle(menu.data.layout.card_style || "photo");
    if (selectedCat == null && cats[0]) setSelectedCat(cats[0].id);
  }, [menu.data]);

  useEffect(() => {
    if (!menu.data || selectedCat == null) {
      setProductOrder([]);
      return;
    }
    setProductOrder(
      menu.data.products
        .filter((p) => p.category_id === selectedCat)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    );
  }, [menu.data, selectedCat]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function invalidateMenu() {
    void qc.invalidateQueries({ queryKey: ["menu", shopId] });
    void qc.invalidateQueries({ queryKey: ["menu-layout", shopId] });
    void qc.invalidateQueries({ queryKey: ["products", shopId] });
    void qc.invalidateQueries({ queryKey: ["categories", shopId] });
  }

  const saveLayout = useMutation({
    mutationFn: () =>
      api.putMenuLayout(shopId, {
        columns,
        show_dividers: showDividers,
        card_style: cardStyle,
      }),
    onSuccess: invalidateMenu,
  });

  const saveCats = useMutation({
    mutationFn: () =>
      api.reorderCategories(
        shopId,
        catOrder.map((c, i) => ({ id: c.id, sort_order: i })),
      ),
    onSuccess: invalidateMenu,
  });

  const saveProducts = useMutation({
    mutationFn: () =>
      api.reorderProducts(
        shopId,
        productOrder.map((p, i) => ({ id: p.id, sort_order: i })),
      ),
    onSuccess: invalidateMenu,
  });

  function onCatDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCatOrder((items) => {
      const oldIndex = items.findIndex((i) => String(i.id) === String(active.id));
      const newIndex = items.findIndex((i) => String(i.id) === String(over.id));
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function onProductDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setProductOrder((items) => {
      const oldIndex = items.findIndex((i) => String(i.id) === String(active.id));
      const newIndex = items.findIndex((i) => String(i.id) === String(over.id));
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  const previewProducts = useMemo(() => {
    if (!menu.data) return [];
    const byId = new Map(menu.data.products.map((p) => [p.id, p]));
    const ordered: Product[] = [];
    for (const cat of catOrder) {
      const inCat =
        cat.id === selectedCat
          ? productOrder
          : menu.data.products
              .filter((p) => p.category_id === cat.id)
              .sort(
                (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
              );
      for (const p of inCat) {
        const full = byId.get(p.id);
        if (full) ordered.push(full);
      }
    }
    const rest = menu.data.products.filter((p) => !p.category_id);
    return [...ordered, ...rest];
  }, [menu.data, catOrder, productOrder, selectedCat]);

  return (
    <div>
      <PageTitle
        kicker={t("menuBuilder.kicker")}
        title={t("menuBuilder.title")}
        hint={t("menuBuilder.hint")}
        action={
          <Button
            onClick={() => {
              saveLayout.mutate();
              saveCats.mutate();
              if (selectedCat != null) saveProducts.mutate();
            }}
            disabled={saveLayout.isPending || saveCats.isPending || saveProducts.isPending}
          >
            {saveLayout.isSuccess || saveCats.isSuccess || saveProducts.isSuccess
              ? t("menuBuilder.saved")
              : t("menuBuilder.saveOrder")}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Field label={t("menuBuilder.columns")}>
          <Select value={String(columns)} onChange={(e) => setColumns(Number(e.target.value))}>
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("menuBuilder.cardStyle")}>
          <Select value={cardStyle} onChange={(e) => setCardStyle(e.target.value)}>
            <option value="photo">{t("menuBuilder.stylePhoto")}</option>
            <option value="compact">{t("menuBuilder.styleCompact")}</option>
            <option value="list">{t("menuBuilder.styleList")}</option>
          </Select>
        </Field>
        <div className="flex items-end pb-1">
          <Check checked={showDividers} onChange={setShowDividers}>
            {t("menuBuilder.dividers")}
          </Check>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_240px_minmax(0,1fr)]">
        <Card className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            {t("menuBuilder.categories")}
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCatDragEnd}>
            <SortableContext
              items={catOrder.map((c) => String(c.id))}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {catOrder.map((c) => (
                  <SortRow
                    key={c.id}
                    id={String(c.id)}
                    label={localizedName(c, locale)}
                    active={selectedCat === c.id}
                    onClick={() => setSelectedCat(c.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </Card>

        <Card className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            {t("menuBuilder.products")}
          </p>
          {selectedCat == null ? (
            <p className="text-sm text-mute">{t("menuBuilder.pickCat")}</p>
          ) : productOrder.length === 0 ? (
            <p className="text-sm text-mute">{t("menuBuilder.emptyCat")}</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onProductDragEnd}
            >
              <SortableContext
                items={productOrder.map((p) => String(p.id))}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {productOrder.map((p) => (
                    <SortRow key={p.id} id={String(p.id)} label={localizedName(p, locale)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Card>

        <Card className="min-h-[320px] space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
            {t("menuBuilder.preview")}
          </p>
          <MenuGrid
            products={previewProducts}
            categories={catOrder}
            layout={{ columns, show_dividers: showDividers, card_style: cardStyle }}
            locale={locale}
            onPick={() => undefined}
            priceLabel={defaultPriceLabel}
          />
        </Card>
      </div>
    </div>
  );
}

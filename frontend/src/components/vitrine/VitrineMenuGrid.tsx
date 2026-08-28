import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState, type ReactNode } from "react";
import { Glyph } from "../Glyph";
import {
  activeVariants,
  collectVariantNames,
  hasVariantPrices,
  type EditorColumn,
  type EditorItem,
  type HeaderStyle,
} from "../../lib/vitrineLayout";
import { useLocale, useT } from "../../i18n";
import { localizedName } from "../../lib/i18nName";
import { cn, money, publicUrl } from "../../lib/utils";
import type { Product } from "../../types";

const gripBtn =
  "flex h-10 w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-transparent text-faint transition hover:border-line hover:bg-paper-2 active:cursor-grabbing";

function DragGrip({ label, listeners, attributes }: { label: string; listeners?: object; attributes?: object }) {
  return (
    <button
      type="button"
      className={gripBtn}
      aria-label={label}
      {...listeners}
      {...attributes}
    >
      <span className="font-mono text-base leading-none tracking-tighter" aria-hidden>
        ⋮⋮
      </span>
    </button>
  );
}

function ColumnHeader({
  title,
  headerStyle,
  editMode,
  onTitleChange,
  onStyleChange,
  onDelete,
  dragHandle,
}: {
  title: string;
  headerStyle: HeaderStyle;
  editMode: boolean;
  onTitleChange?: (v: string) => void;
  onStyleChange?: (v: HeaderStyle) => void;
  onDelete?: () => void;
  dragHandle?: ReactNode;
}) {
  const t = useT();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="relative mb-5 flex flex-col items-center text-center">
      {editMode && (
        <div className="mb-2 flex w-full items-center justify-between gap-2">
          {dragHandle}
          <div className="relative ml-auto">
            <button
              type="button"
              className="rounded-md border border-line bg-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-mute hover:border-gold hover:text-ink"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
            >
              {t("vitrine.columnSettings")}
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-md border border-line bg-paper py-1 shadow-soft">
                {(["ornament", "line", "none"] as HeaderStyle[]).map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={cn(
                      "block w-full px-3 py-2 text-left text-sm hover:bg-cream",
                      headerStyle === style && "bg-cream font-medium",
                    )}
                    onClick={() => {
                      onStyleChange?.(style);
                      setSettingsOpen(false);
                    }}
                  >
                    {style === "ornament"
                      ? t("vitrine.headerOrnament")
                      : style === "line"
                        ? t("vitrine.headerLine")
                        : t("vitrine.headerNone")}
                  </button>
                ))}
                {onDelete ? (
                  <button
                    type="button"
                    className="block w-full border-t border-line px-3 py-2 text-left text-sm text-maroon hover:bg-cream"
                    onClick={() => {
                      onDelete();
                      setSettingsOpen(false);
                    }}
                  >
                    {t("vitrine.deleteColumn")}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
      {editMode ? (
        <input
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          aria-label={t("vitrine.columnTitle")}
          className="w-full max-w-[280px] rounded-lg border border-line bg-paper px-4 py-2.5 text-center font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink outline-none focus:border-gold"
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
    <li className="flex items-center gap-2 px-1 pb-1 text-[12px] uppercase tracking-wide text-faint md:gap-3 md:px-2">
      <span className="w-10 shrink-0 md:w-12" />
      <span className="min-w-0 flex-1" />
      {variantNames.map((n) => (
        <span key={n} className="w-12 shrink-0 text-center md:w-14">
          {n}
        </span>
      ))}
      <span className="w-8 shrink-0" />
    </li>
  );
}

function MenuRowBody({
  product,
  variantNames,
  striped,
  editMode,
  onRemove,
  dragHandle,
}: {
  product: Product;
  variantNames: string[];
  striped?: boolean;
  editMode?: boolean;
  onRemove?: () => void;
  dragHandle?: ReactNode;
}) {
  const locale = useLocale((s) => s.locale);
  const t = useT();
  const label = localizedName(product, locale);
  const src = publicUrl(product.image_url);
  const withVariants = hasVariantPrices(product);

  if (withVariants) {
    return (
      <li
        className={cn(
          "group flex items-center gap-2 rounded-md px-1 py-1.5 md:gap-3 md:px-2 md:py-2",
          striped ? "bg-paper-2" : "bg-transparent",
          editMode && "ring-1 ring-transparent hover:ring-line",
        )}
      >
        {editMode ? dragHandle : <span className="w-10 shrink-0 md:w-12" />}
        <h3 className="min-w-0 flex-1 truncate font-display text-[22px] font-normal leading-none md:text-[28px]">
          {label}
        </h3>
        {variantNames.map((n) => {
          const v = activeVariants(product).find((x) => x.name === n);
          return (
            <span
              key={n}
              className="w-12 shrink-0 text-center font-mono text-[15px] tabular-nums text-gold md:w-14 md:text-[17px]"
            >
              {v ? money(v.sale_price) : "—"}
            </span>
          );
        })}
        {editMode && onRemove ? (
          <button
            type="button"
            className="w-8 shrink-0 rounded-md text-lg text-faint opacity-0 transition hover:bg-cream hover:text-maroon group-hover:opacity-100"
            onClick={onRemove}
            aria-label={t("vitrine.removeItem")}
          >
            ×
          </button>
        ) : (
          <span className="w-8 shrink-0" />
        )}
      </li>
    );
  }

  return (
    <li
      className={cn(
        "group flex items-end gap-2 rounded-md px-1 py-1.5 md:gap-3 md:px-2 md:py-2",
        striped ? "bg-paper-2" : "bg-transparent",
        editMode && "ring-1 ring-transparent hover:ring-line",
      )}
    >
      {editMode ? (
        dragHandle
      ) : src ? (
        <img src={src} alt={label} className="h-14 w-14 shrink-0 rounded-md object-cover md:h-[4.5rem] md:w-[4.5rem]" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-paper-2 font-display text-2xl text-maroon md:h-[4.5rem] md:w-[4.5rem]">
          {label.slice(0, 1)}
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-baseline gap-2 pb-1">
        <h3 className="min-w-0 truncate font-display text-[22px] font-normal leading-none md:text-[28px]">
          {label}
        </h3>
        <span className="mb-[3px] min-w-4 flex-1 border-b border-dotted border-line-2" />
        <span className="shrink-0 font-mono text-[16px] font-semibold tabular-nums text-gold md:text-[18px]">
          {money(product.sale_price)}
        </span>
      </div>
      {editMode && onRemove ? (
        <button
          type="button"
          className="mb-1 w-8 shrink-0 rounded-md text-lg text-faint opacity-0 transition hover:bg-cream hover:text-maroon group-hover:opacity-100"
          onClick={onRemove}
          aria-label={t("vitrine.removeItem")}
        >
          ×
        </button>
      ) : null}
    </li>
  );
}

function SortableMenuItem({
  item,
  columnKey,
  variantNames,
  striped,
  editMode,
  onRemove,
}: {
  item: EditorItem;
  columnKey: string;
  variantNames: string[];
  striped: boolean;
  editMode: boolean;
  onRemove: () => void;
}) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    data: { type: "item", columnKey },
    disabled: !editMode,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <MenuRowBody
        product={item.product}
        variantNames={variantNames}
        striped={striped}
        editMode={editMode}
        onRemove={onRemove}
        dragHandle={<DragGrip label={t("vitrine.dragHandle")} listeners={listeners} attributes={attributes} />}
      />
    </div>
  );
}

function SortableColumnShell({
  col,
  colIdx,
  editMode,
  onTitleChange,
  onStyleChange,
  onDelete,
  onAddProduct,
  children,
}: {
  col: EditorColumn;
  colIdx: number;
  editMode: boolean;
  onTitleChange: (v: string) => void;
  onStyleChange: (v: HeaderStyle) => void;
  onDelete: () => void;
  onAddProduct: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.key,
    data: { type: "column" },
    disabled: !editMode,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(
        "min-w-0 px-4 md:px-6",
        colIdx > 0 && "border-l border-line",
        editMode && "rounded-lg bg-paper/60 pb-4 pt-2",
      )}
    >
      <ColumnHeader
        title={col.title}
        headerStyle={col.header_style}
        editMode={editMode}
        onTitleChange={onTitleChange}
        onStyleChange={onStyleChange}
        onDelete={onDelete}
        dragHandle={
          editMode ? <DragGrip label={t("vitrine.dragColumn")} listeners={listeners} attributes={attributes} /> : null
        }
      />
      {children}
      {editMode && (
        <button
          type="button"
          className="mt-3 w-full rounded-lg border border-dashed border-line py-3 text-[14px] font-medium text-mute transition hover:border-gold hover:bg-cream/40 hover:text-ink"
          onClick={onAddProduct}
        >
          {t("vitrine.addProduct")}
        </button>
      )}
    </section>
  );
}

export function VitrineMenuGrid({
  columns,
  editMode,
  onColumnsChange,
  onAddProduct,
  onAddColumn,
}: {
  columns: EditorColumn[];
  editMode: boolean;
  onColumnsChange: (cols: EditorColumn[]) => void;
  onAddProduct: (columnKey: string) => void;
  onAddColumn: () => void;
}) {
  const t = useT();
  const [activeDrag, setActiveDrag] = useState<{ type: "column" | "item"; id: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnIds = useMemo(() => columns.map((c) => c.key), [columns]);

  const gridCols =
    columns.length >= 3 ? "lg:grid-cols-2 xl:grid-cols-3" : columns.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1";

  function updateColumn(colKey: string, patch: Partial<EditorColumn>) {
    onColumnsChange(columns.map((c) => (c.key === colKey ? { ...c, ...patch } : c)));
  }

  function handleDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type as "column" | "item" | undefined;
    if (type) setActiveDrag({ type, id: String(event.active.id) });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type as string | undefined;
    const overType = over.data.current?.type as string | undefined;

    if (activeType === "column" && overType === "column") {
      const oldIndex = columns.findIndex((c) => c.key === active.id);
      const newIndex = columns.findIndex((c) => c.key === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        onColumnsChange(arrayMove(columns, oldIndex, newIndex));
      }
      return;
    }

    if (activeType === "item" && overType === "item") {
      const colKey = active.data.current?.columnKey as string;
      const overColKey = over.data.current?.columnKey as string;
      if (colKey !== overColKey) return;
      onColumnsChange(
        columns.map((col) => {
          if (col.key !== colKey) return col;
          const oldIndex = col.items.findIndex((i) => i.key === active.id);
          const newIndex = col.items.findIndex((i) => i.key === over.id);
          if (oldIndex < 0 || newIndex < 0) return col;
          return { ...col, items: arrayMove(col.items, oldIndex, newIndex) };
        }),
      );
    }
  }

  const activeItem = useMemo(() => {
    if (!activeDrag || activeDrag.type !== "item") return null;
    for (const col of columns) {
      const item = col.items.find((i) => i.key === activeDrag.id);
      if (item) return { item, col };
    }
    return null;
  }, [activeDrag, columns]);

  const grid = (
    <div className={cn("vitrine-menu-grid grid flex-1 auto-rows-min gap-x-0 gap-y-10 py-6 md:gap-y-12", gridCols)}>
      {columns.map((col, colIdx) => {
        const productsInCol = col.items.map((i) => i.product);
        const variantNames = collectVariantNames(productsInCol);
        const hasVariantTable = variantNames.length > 0;
        let rowIdx = 0;

        const list = (
          <ul className="space-y-0.5">
            {hasVariantTable && <VariantHeaderRow variantNames={variantNames} />}
            <SortableContext items={col.items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
              {col.items.map((item) => {
                const striped = rowIdx % 2 === 1;
                rowIdx += 1;
                return (
                  <SortableMenuItem
                    key={item.key}
                    item={item}
                    columnKey={col.key}
                    variantNames={variantNames}
                    striped={striped}
                    editMode={editMode}
                    onRemove={() => {
                      updateColumn(col.key, {
                        items: col.items.filter((i) => i.key !== item.key),
                      });
                    }}
                  />
                );
              })}
            </SortableContext>
          </ul>
        );

        return (
          <SortableColumnShell
            key={col.key}
            col={col}
            colIdx={colIdx}
            editMode={editMode}
            onTitleChange={(title) => updateColumn(col.key, { title })}
            onStyleChange={(header_style) => updateColumn(col.key, { header_style })}
            onDelete={() => onColumnsChange(columns.filter((c) => c.key !== col.key))}
            onAddProduct={() => onAddProduct(col.key)}
          >
            {list}
          </SortableColumnShell>
        );
      })}
      {editMode && (
        <section className="flex min-h-[100px] items-center justify-center px-6">
          <button
            type="button"
            className="max-w-sm rounded-lg border border-dashed border-line px-8 py-8 text-[15px] font-medium text-mute transition hover:border-gold hover:bg-cream/40 hover:text-ink"
            onClick={onAddColumn}
          >
            {t("vitrine.addColumn")}
          </button>
        </section>
      )}
    </div>
  );

  if (!editMode) return grid;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
        {grid}
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <div className="rounded-md bg-paper shadow-soft ring-1 ring-line">
            <MenuRowBody
              product={activeItem.item.product}
              variantNames={collectVariantNames(activeItem.col.items.map((i) => i.product))}
              editMode
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

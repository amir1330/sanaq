import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PhotoField } from "../../components/PhotoField";
import { StockSearchPicker } from "../../components/StockSearchPicker";
import { Button, Check, Dialog, Empty, Field, Input, MoreMenu, PageTitle, Select, pill } from "../../components/ui";
import { parseBulkProductLines } from "../../lib/bulkProducts";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { money, publicUrl } from "../../lib/utils";
import { localizedName } from "../../lib/i18nName";
import { useLocale, useT } from "../../i18n";
import { useAuth } from "../../store/auth";
import type { Product, StockItem } from "../../types";

type ViewMode = "list" | "tiles";
const VIEW_KEY = "sanaq-products-view";
const PAGE_SIZE = 50;

function readViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "tiles" || v === "list") return v;
  } catch {
    /* ignore */
  }
  return "list";
}

type IngRow = {
  stock_item_id: number | "";
  quantity: string;
  name?: string;
  base_unit?: string;
  cost_per_base_unit?: string;
};

type Draft = {
  id?: number;
  name: string;
  name_kk: string;
  name_en: string;
  sku: string;
  sale_price: string;
  category_id: number | null;
  is_active: boolean;
  is_service: boolean;
  tax_percent: string;
  tax_type: string;
  image_url: string | null;
  ingredients: IngRow[];
};

export function ProductsPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 250);
  const [filterCat, setFilterCat] = useState<number | "all">("all");
  const products = useInfiniteQuery({
    queryKey: ["products", shopId, filterCat, debouncedQ],
    queryFn: ({ pageParam }) =>
      api.products(shopId, {
        q: debouncedQ.trim() || undefined,
        category_id: filterCat === "all" ? undefined : filterCat,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  const categories = useQuery({ queryKey: ["categories", shopId], queryFn: () => api.categories(shopId) });
  const [editing, setEditing] = useState<Draft | null>(null);
  const [catName, setCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [rename, setRename] = useState<{ id: number; name: string } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkCategoryId, setBulkCategoryId] = useState<number | "">("");
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const [openingId, setOpeningId] = useState<number | null>(null);

  function setView(next: ViewMode) {
    setViewMode(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const bulkParsed = useMemo(() => parseBulkProductLines(bulkText), [bulkText]);
  const bulkOk = bulkParsed.filter((r) => r.ok);
  const bulkBad = bulkParsed.filter((r) => !r.ok);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing?.name.trim()) throw new Error(t("products.needName"));
      if (!editing.sale_price.trim() || Number.isNaN(Number(editing.sale_price.replace(",", ".")))) {
        throw new Error(t("products.needPrice"));
      }
      const price = editing.sale_price.replace(",", ".");
      const ingredients = editing.is_service
        ? []
        : (editing.ingredients ?? [])
            .filter((i) => i.stock_item_id && i.quantity)
            .map((i) => ({ stock_item_id: Number(i.stock_item_id), quantity: i.quantity }));
      let id = editing.id;
      if (id) {
        await api.patchProduct(shopId, id, {
          name: editing.name.trim(),
          name_kk: editing.name_kk.trim() || null,
          name_en: editing.name_en.trim() || null,
          sku: editing.sku.trim() || null,
          sale_price: price,
          category_id: editing.category_id,
          is_active: editing.is_active,
          is_service: editing.is_service,
          tax_percent: editing.tax_percent || "0",
          tax_type: Number(editing.tax_type || 0),
        });
        await api.setIngredients(shopId, id, ingredients);
      } else {
        const created = await api.createProduct(shopId, {
          name: editing.name.trim(),
          name_kk: editing.name_kk.trim() || null,
          name_en: editing.name_en.trim() || null,
          sku: editing.sku.trim() || null,
          sale_price: price,
          category_id: editing.category_id || null,
          is_active: editing.is_active,
          is_service: editing.is_service,
          tax_percent: editing.tax_percent || "0",
          tax_type: Number(editing.tax_type || 0),
          ingredients,
        });
        id = created.id;
      }
      if (id && dropPhoto && editing?.id && !photoFile) await api.deleteProductImage(shopId, id);
      if (id && photoFile) await api.uploadProductImage(shopId, id, photoFile);
    },
    onSuccess: () => {
      setEditing(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      setDropPhoto(false);
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });

  const addCat = useMutation({
    mutationFn: () => api.createCategory(shopId, catName.trim()),
    onSuccess: (cat) => {
      setCatName("");
      setAddingCat(false);
      setEditing((draft) => (draft ? { ...draft, category_id: cat.id } : draft));
      setFilterCat(cat.id);
      void qc.invalidateQueries({ queryKey: ["categories", shopId] });
    },
  });
  const saveCat = useMutation({
    mutationFn: () => api.patchCategory(shopId, rename!.id, rename!.name.trim()),
    onSuccess: () => {
      setRename(null);
      void qc.invalidateQueries({ queryKey: ["categories", shopId] });
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });
  const dropCat = useMutation({
    mutationFn: (id: number) => api.deleteCategory(shopId, id),
    onSuccess: () => {
      setFilterCat("all");
      void qc.invalidateQueries({ queryKey: ["categories", shopId] });
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });

  const bulkSave = useMutation({
    mutationFn: () =>
      api.createProductsBulk(shopId, {
        category_id: bulkCategoryId === "" ? null : Number(bulkCategoryId),
        items: bulkOk.map((r) => ({ name: r.name, sale_price: r.sale_price })),
      }),
    onSuccess: (created) => {
      setBulkOpen(false);
      setBulkText("");
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
      if (bulkCategoryId !== "") setFilterCat(Number(bulkCategoryId));
      return created;
    },
  });

  function openBulk() {
    setBulkText("");
    setBulkCategoryId(filterCat === "all" ? "" : filterCat);
    bulkSave.reset();
    setBulkOpen(true);
  }

  function draftFromProduct(p: Product, categoryId?: number | null): Draft {
    return {
      id: p.id,
      name: p.name ?? "",
      name_kk: p.name_kk ?? "",
      name_en: p.name_en ?? "",
      sku: p.sku ?? "",
      sale_price: p.sale_price ?? "",
      category_id: p.category_id ?? categoryId ?? null,
      is_active: p.is_active ?? true,
      is_service: Boolean(p.is_service ?? !(p.ingredients?.length)),
      tax_percent: p.tax_percent ?? "0",
      tax_type: String(p.tax_type ?? 0),
      image_url: p.image_url ?? null,
      ingredients:
        p.ingredients?.map((i) => ({
          stock_item_id: i.stock_item_id,
          quantity: String(i.quantity),
          name: i.stock_item_name ?? undefined,
          base_unit: i.unit ?? undefined,
        })) ?? [],
    };
  }

  async function open(p?: Product, categoryId?: number | null) {
    setPhotoFile(null);
    setPhotoPreview(null);
    setDropPhoto(false);
    setCatName("");
    setAddingCat(!p && (categories.data?.length ?? 0) === 0);
    if (p?.id) {
      setOpeningId(p.id);
      try {
        const full = await api.product(shopId, p.id);
        setEditing(draftFromProduct(full, categoryId));
      } finally {
        setOpeningId(null);
      }
      return;
    }
    setEditing({
      name: "",
      name_kk: "",
      name_en: "",
      sku: "",
      sale_price: "",
      category_id: categoryId ?? null,
      is_active: true,
      is_service: false,
      tax_percent: "0",
      tax_type: "0",
      image_url: null,
      ingredients: [],
    });
  }

  function pickIngredient(item: StockItem) {
    if (!editing) return;
    if (editing.ingredients.some((r) => r.stock_item_id === item.id)) return;
    setEditing({
      ...editing,
      ingredients: [
        ...editing.ingredients,
        {
          stock_item_id: item.id,
          quantity: "",
          name: item.name,
          base_unit: item.base_unit,
          cost_per_base_unit: item.cost_per_base_unit,
        },
      ],
    });
  }

  const list = useMemo(
    () => products.data?.pages.flatMap((p) => p.items) ?? [],
    [products.data],
  );
  const totalProducts = products.data?.pages[0]?.total ?? list.length;
  const cats = categories.data ?? [];
  const groups = (filterCat === "all" ? cats : cats.filter((c) => c.id === filterCat)).map((c) => ({
    id: c.id as number | null,
    name: localizedName(c, locale),
    items: list.filter((p) => p.category_id === c.id),
  }));
  if (filterCat === "all") {
    const rest = list.filter((p) => !p.category_id);
    if (rest.length) groups.push({ id: null, name: t("products.noCategory"), items: rest });
  }

  return (
    <div>
      <PageTitle
        kicker={t("products.kicker")}
        title={t("products.title")}
        hint={t("products.hint")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="foam" onClick={openBulk}>
              {t("products.addBulk")}
            </Button>
            <Button onClick={() => open(undefined, filterCat === "all" ? null : filterCat)}>
              {t("products.addOne")}
            </Button>
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterCat("all")}
            className={`${pill} ${
              filterCat === "all" ? "border-ink bg-ink text-paper" : "border-line-2 text-ink-soft hover:border-ink"
            }`}
          >
            {t("common.all")}
          </button>
          {(categories.data ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilterCat(c.id)}
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
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("pos.searchProducts")}
            className="max-w-xs"
          />
          <div className="flex gap-1 rounded-md border border-line-2 p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded px-3 py-1.5 text-[12.5px] ${
              viewMode === "list" ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t("products.viewList")}
          </button>
          <button
            type="button"
            onClick={() => setView("tiles")}
            className={`rounded px-3 py-1.5 text-[12.5px] ${
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
                  onChange={(e) => setRename({ id: group.id!, name: e.target.value })}
                  className="max-w-xs"
                />
                <Button size="md" disabled={!rename.name.trim() || saveCat.isPending} onClick={() => saveCat.mutate()}>
                  {t("common.save")}
                </Button>
                <Button variant="ghost" onClick={() => setRename(null)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-[22px] font-normal">{group.name}</h2>
                {group.id != null && (
                  <MoreMenu
                    items={[
                      { label: t("products.addOne"), onClick: () => open(undefined, group.id) },
                      {
                        label: t("products.addBulk"),
                        onClick: () => {
                          setBulkCategoryId(group.id!);
                          setBulkText("");
                          bulkSave.reset();
                          setBulkOpen(true);
                        },
                      },
                      { label: t("common.rename"), onClick: () => {
                        const cat = cats.find((c) => c.id === group.id);
                        setRename({ id: group.id!, name: cat?.name ?? group.name });
                      } },
                      { label: t("common.delete"), danger: true, onClick: () => dropCat.mutate(group.id!) },
                    ]}
                  />
                )}
              </>
            )}
          </div>
          {group.items.length === 0 ? (
            <p className="rounded-lg bg-cream px-5 py-8 text-sm text-mute shadow-soft">
              {t("products.catEmpty")}
            </p>
          ) : viewMode === "list" ? (
            <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
              <table className="w-full text-sm">
                <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
                  <tr className="border-b border-line text-left">
                    <th className="px-5 py-3">{t("products.colName")}</th>
                    <th className="pr-4">{t("products.colPrice")}</th>
                    <th className="pr-5 text-right">{t("products.colStatus")}</th>
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
                        onClick={() => void open(p)}
                      >
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-3">
                            {src ? (
                              <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                            ) : (
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-paper font-mono text-[8px] uppercase tracking-wide text-mute">
                                —
                              </div>
                            )}
                            <span className="font-medium">
                              {localizedName(p, locale)}
                              {openingId === p.id ? ` · ${t("common.loading")}` : ""}
                            </span>
                          </div>
                        </td>
                        <td className="pr-4 font-mono font-semibold">{money(p.sale_price)}</td>
                        <td className="pr-5 text-right text-[12.5px] text-mute">
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
                    onClick={() => void open(p)}
                    className={`overflow-hidden rounded-lg bg-cream text-left shadow-soft transition hover:-translate-y-0.5 ${
                      p.is_active ? "" : "opacity-55"
                    }`}
                  >
                    {src ? (
                      <img src={src} alt="" className="h-40 w-full object-cover" />
                    ) : (
                      <div className="grid h-40 place-items-center bg-paper text-sm text-mute">{t("products.noPhoto")}</div>
                    )}
                    <div className="px-5 py-4">
                      <p className="font-display text-[19px] font-normal">{localizedName(p, locale)}</p>
                      <p className="mt-2 font-mono text-[15px] font-semibold">{money(p.sale_price)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ))}
      {products.hasNextPage && (
        <div className="mb-6 flex justify-center">
          <Button
            variant="quiet"
            disabled={products.isFetchingNextPage}
            onClick={() => void products.fetchNextPage()}
          >
            {products.isFetchingNextPage ? t("common.loading") : t("common.loadMore")}
            {totalProducts > list.length ? ` · ${list.length}/${totalProducts}` : ""}
          </Button>
        </div>
      )}
      {list.length === 0 && (categories.data ?? []).length === 0 && (
        <Empty>{t("products.menuEmpty")}</Empty>
      )}

      {editing && (
        <div className="fixed inset-0 z-30 grid place-items-end bg-roast/60 p-0 sm:place-items-center sm:p-4">
          <form
            className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-lg bg-paper shadow-soft sm:rounded-lg"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <h2 className="font-display text-[28px] font-normal leading-tight">
                {editing.id ? t("products.editTitle") : t("products.newTitle")}
              </h2>
              <button
                type="button"
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint"
                onClick={() => {
                  setEditing(null);
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  setDropPhoto(false);
                  setCatName("");
                  setAddingCat(false);
                }}
              >
                {t("common.close")}
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-auto px-6 py-5">
              <div className="flex gap-4">
                <PhotoField
                  compact
                  src={photoPreview ?? (dropPhoto ? null : publicUrl(editing.image_url))}
                  onFile={(file) => {
                    setDropPhoto(false);
                    setPhotoFile(file);
                    setPhotoPreview(URL.createObjectURL(file));
                  }}
                  onClear={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    setDropPhoto(true);
                  }}
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <Field label={t("products.namePrimary")}>
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="Капучино"
                      autoFocus
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("products.nameKk")}>
                      <Input
                        value={editing.name_kk}
                        onChange={(e) => setEditing({ ...editing, name_kk: e.target.value })}
                        placeholder="Капучино"
                      />
                    </Field>
                    <Field label={t("products.nameEn")}>
                      <Input
                        value={editing.name_en}
                        onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                        placeholder="Cappuccino"
                      />
                    </Field>
                  </div>
                  <p className="text-[12.5px] leading-snug text-mute">{t("products.nameLangHint")}</p>
                  <Field label={t("products.price")}>
                    <Input
                      value={editing.sale_price}
                      onChange={(e) => setEditing({ ...editing, sale_price: e.target.value })}
                      inputMode="decimal"
                      placeholder="1200"
                    />
                  </Field>
                  <Field label={t("products.sku")} hint={t("products.skuHint")}>
                    <Input
                      value={editing.sku}
                      onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                      placeholder={t("products.skuPh")}
                    />
                  </Field>
                </div>
              </div>
              <div>
                <Field label={t("products.category")}>
                  <Select
                    value={editing.category_id ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, category_id: e.target.value ? Number(e.target.value) : null })
                    }
                  >
                    <option value="">{t("products.noCategory")}</option>
                    {categories.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {localizedName(c, locale)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {addingCat ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Input
                      className="min-w-0 flex-1"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
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
                    {(categories.data ?? []).length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setAddingCat(false);
                          setCatName("");
                        }}
                      >
                        {t("common.cancel")}
                      </Button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mt-2 text-[12.5px] text-mute hover:text-ink"
                    onClick={() => setAddingCat(true)}
                  >
                    {t("products.newCategory")}
                  </button>
                )}
                {addCat.isError && (
                  <p className="mt-2 text-sm text-alert">{(addCat.error as Error).message}</p>
                )}
              </div>
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
                  onClick={() => setEditing({ ...editing, is_service: true, ingredients: [] })}
                >
                  {t("products.kindService")}
                </Button>
              </div>
              <Check checked={editing.is_active} onChange={(is_active) => setEditing({ ...editing, is_active })}>
                {t("products.onPos")}
              </Check>
              {!editing.is_service && (
              <details className="rounded-md bg-cream px-4 py-3">
                <summary className="cursor-pointer text-[14.5px] font-medium">{t("products.recipe")}</summary>
                <p className="mt-2 text-[12.5px] text-mute">{t("products.recipeHint")}</p>
                <div className="mt-3 space-y-2">
                  {editing.ingredients.map((row, idx) => (
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
                            const next = [...editing.ingredients];
                            next[idx] = { ...row, quantity: e.target.value };
                            setEditing({ ...editing, ingredients: next });
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setEditing({
                              ...editing,
                              ingredients: editing.ingredients.filter((_, i) => i !== idx),
                            })
                          }
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
                    excludeIds={editing.ingredients
                      .map((r) => r.stock_item_id)
                      .filter((id): id is number => typeof id === "number")}
                    onPick={pickIngredient}
                    placeholder={t("stock.searchPh")}
                  />
                </div>
                <p className="mt-3 font-mono text-sm">
                  {t("products.recipeCost", {
                    n: money(
                      editing.ingredients.reduce((sum, row) => {
                        if (!row.quantity || !row.cost_per_base_unit) return sum;
                        return sum + Number(row.quantity) * Number(row.cost_per_base_unit);
                      }, 0),
                    ),
                  })}
                </p>
              </details>
              )}
              <details className="rounded-md bg-cream px-4 py-3">
                <summary className="cursor-pointer text-[14.5px] font-medium">{t("products.ofdReceipt")}</summary>
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
              {save.isError && <p className="text-sm text-alert">{(save.error as Error).message}</p>}
            </div>
            <div className="flex gap-2 border-t border-line px-6 py-4">
              <Button type="submit" className="min-w-32" disabled={save.isPending}>
                {save.isPending ? t("common.saving") : t("common.save")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setPhotoFile(null);
                  setPhotoPreview(null);
                  setDropPhoto(false);
                  setCatName("");
                  setAddingCat(false);
                }}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </div>
      )}

      <Dialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={t("products.bulkTitle")}
        hint={t("products.bulkHint")}
        wide
      >
        <div className="space-y-4">
          <Field label={t("products.bulkCategory")}>
            <Select
              value={bulkCategoryId === "" ? "" : String(bulkCategoryId)}
              onChange={(e) => setBulkCategoryId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">{t("products.bulkNoCategory")}</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {localizedName(c, locale)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("products.bulkList")}>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={10}
              placeholder={"Капучино 1500\nЛатте — 1600\nЧизкейк\t2200"}
              className="w-full rounded-md border-[1.5px] border-line-2 bg-cream px-4 py-[13px] font-mono text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-ink"
            />
          </Field>
          {bulkParsed.length > 0 && (
            <div className="rounded-md bg-cream px-4 py-3 text-sm shadow-soft">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                {t("products.bulkReady")}: {bulkOk.length}
                {bulkBad.length ? ` · ${t("products.bulkErrors")}: ${bulkBad.length}` : ""}
              </p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                {bulkParsed.map((row, i) => (
                  <li
                    key={`${row.raw}-${i}`}
                    className={row.ok ? "flex justify-between gap-3" : "text-alert"}
                  >
                    {row.ok ? (
                      <>
                        <span className="truncate">{row.name}</span>
                        <span className="shrink-0 font-mono">{money(row.sale_price)}</span>
                      </>
                    ) : (
                      <span>
                        {row.raw} — {row.error}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {bulkSave.isError && <p className="text-sm text-alert">{(bulkSave.error as Error).message}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={bulkOk.length === 0 || bulkBad.length > 0 || bulkSave.isPending}
              onClick={() => bulkSave.mutate()}
            >
              {bulkSave.isPending ? t("products.bulkCreating") : t("products.bulkCreate", { n: bulkOk.length })}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

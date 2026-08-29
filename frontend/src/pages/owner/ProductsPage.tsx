import { useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { ProductCatalogView } from "../../components/products/ProductCatalogView";
import { ProductEditorForm } from "../../components/products/ProductEditorForm";
import { Button, Dialog, Empty, PageTitle } from "../../components/ui";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { localizedName } from "../../lib/i18nName";
import { useLocale, useT } from "../../i18n";
import { useAuth } from "../../store/auth";
import type { Product, StockItem } from "../../types";
import {
  draftFromProduct,
  emptyDraft,
  emptyVariant,
  normalizeVariantsForSave,
  PAGE_SIZE,
  readViewMode,
  VIEW_KEY,
  type Draft,
  type ViewMode,
} from "./products/types";

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
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<{ id: number; name: string } | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<{ id: number; name: string } | null>(null);

  function closeEdit() {
    setEditing(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setDropPhoto(false);
    setCatName("");
    setAddingCat(false);
  }

  function setView(next: ViewMode) {
    setViewMode(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!editing?.name.trim()) throw new Error(t("products.needName"));
      const variants =
        editing.is_service || !editing.has_variants ? [] : normalizeVariantsForSave(editing.variants);
      if (editing.has_variants && !editing.is_service && variants.length === 0) {
        throw new Error(t("products.needVariant"));
      }
      const priceFromVariants =
        variants.length > 0
          ? String(Math.min(...variants.map((v) => Number(v.sale_price))))
          : editing.sale_price.replace(",", ".");
      if (
        !priceFromVariants.trim() ||
        Number.isNaN(Number(priceFromVariants)) ||
        Number(priceFromVariants) < 0
      ) {
        throw new Error(t("products.needPrice"));
      }
      const price = priceFromVariants;
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
          sku: null,
          barcode: editing.has_variants ? null : editing.barcode.trim() || null,
          sale_price: price,
          category_id: editing.category_id,
          is_active: editing.is_active,
          is_service: editing.is_service,
          tax_percent: editing.tax_percent || "0",
          tax_type: Number(editing.tax_type || 0),
          ingredients: editing.has_variants ? [] : ingredients,
          variants,
        });
      } else {
        const created = await api.createProduct(shopId, {
          name: editing.name.trim(),
          name_kk: editing.name_kk.trim() || null,
          name_en: editing.name_en.trim() || null,
          sku: null,
          barcode: editing.has_variants ? null : editing.barcode.trim() || null,
          sale_price: price,
          category_id: editing.category_id || null,
          is_active: editing.is_active,
          is_service: editing.is_service,
          tax_percent: editing.tax_percent || "0",
          tax_type: Number(editing.tax_type || 0),
          ingredients: editing.has_variants ? [] : ingredients,
          variants,
        });
        id = created.id;
      }
      if (id && dropPhoto && editing?.id && !photoFile) await api.deleteProductImage(shopId, id);
      if (id && photoFile) await api.uploadProductImage(shopId, id, photoFile);
    },
    onSuccess: () => {
      closeEdit();
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
      setDeleteCategory(null);
      setFilterCat("all");
      void qc.invalidateQueries({ queryKey: ["categories", shopId] });
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });
  const dropProduct = useMutation({
    mutationFn: (id: number) => api.deleteProduct(shopId, id),
    onSuccess: () => {
      setDeleteProduct(null);
      closeEdit();
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });

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
    setEditing(emptyDraft(categoryId));
  }

  function applySizePreset() {
    if (!editing) return;
    const labels =
      locale === "en"
        ? ["Small", "Medium", "Large"]
        : locale === "kk"
          ? ["Кіші", "Орташа", "Үлкен"]
          : ["Маленький", "Средний", "Большой"];
    setEditing({
      ...editing,
      has_variants: true,
      barcode: "",
      variants: labels.map((name, i) => ({
        ...emptyVariant(i === 1),
        name,
        sale_price: editing.sale_price || "",
      })),
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

  function pickVariantIngredient(variantIdx: number, item: StockItem) {
    if (!editing) return;
    const variants = [...editing.variants];
    const row = variants[variantIdx];
    if (!row || row.ingredients.some((r) => r.stock_item_id === item.id)) return;
    variants[variantIdx] = {
      ...row,
      ingredients: [
        ...row.ingredients,
        {
          stock_item_id: item.id,
          quantity: "",
          name: item.name,
          base_unit: item.base_unit,
          cost_per_base_unit: item.cost_per_base_unit,
        },
      ],
    };
    setEditing({ ...editing, variants });
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
          <Button size="lg" onClick={() => open(undefined, filterCat === "all" ? null : filterCat)}>
            {t("products.addOne")}
          </Button>
        }
      />
      <ProductCatalogView
        t={t}
        locale={locale}
        filterCat={filterCat}
        onFilterCat={setFilterCat}
        categories={cats}
        q={q}
        onQChange={setQ}
        viewMode={viewMode}
        onViewMode={setView}
        groups={groups}
        rename={rename}
        onRenameChange={setRename}
        onRenameCancel={() => setRename(null)}
        onSaveCategory={() => saveCat.mutate()}
        saveCatPending={saveCat.isPending}
        onOpenProduct={(p) => void open(p)}
        onAddProduct={(categoryId) => open(undefined, categoryId)}
        onRenameCategory={(group) => {
          const cat = cats.find((c) => c.id === group.id);
          setRename({ id: group.id!, name: cat?.name ?? group.name });
        }}
        onDeleteCategory={(group) => setDeleteCategory({ id: group.id!, name: group.name })}
        openingId={openingId}
        hasNextPage={Boolean(products.hasNextPage)}
        isFetchingNextPage={products.isFetchingNextPage}
        onLoadMore={() => void products.fetchNextPage()}
        totalProducts={totalProducts}
        listLength={list.length}
      />
      {list.length === 0 && (categories.data ?? []).length === 0 && (
        <Empty>{t("products.menuEmpty")}</Empty>
      )}

      <Dialog
        open={!!editing}
        onClose={closeEdit}
        title={editing?.id ? t("products.editTitle") : t("products.newTitle")}
        size="xl"
        fillBody
      >
        {editing && (
          <ProductEditorForm
            t={t}
            locale={locale}
            shopId={shopId}
            editing={editing}
            setEditing={setEditing}
            categories={categories.data}
            photoPreview={photoPreview}
            dropPhoto={dropPhoto}
            onPhotoFile={(file) => {
              setDropPhoto(false);
              setPhotoFile(file);
              setPhotoPreview(URL.createObjectURL(file));
            }}
            onPhotoClear={() => {
              setPhotoFile(null);
              setPhotoPreview(null);
              setDropPhoto(true);
            }}
            catName={catName}
            onCatNameChange={setCatName}
            addingCat={addingCat}
            onAddingCatChange={(adding) => {
              setAddingCat(adding);
              if (!adding) setCatName("");
            }}
            addCat={addCat}
            onApplySizePreset={applySizePreset}
            onPickIngredient={pickIngredient}
            onPickVariantIngredient={pickVariantIngredient}
            save={save}
            onCancel={closeEdit}
            onDelete={() =>
              setDeleteProduct({
                id: editing.id!,
                name: editing.name.trim() || localizedName(editing, locale),
              })
            }
          />
        )}
      </Dialog>

      {deleteProduct && (
        <Dialog
          open
          title={t("products.deleteTitle", { name: deleteProduct.name })}
          onClose={() => setDeleteProduct(null)}
        >
          <p className="text-sm text-mute">{t("products.deleteHint")}</p>
          {dropProduct.isError && (
            <p role="alert" className="text-sm text-alert">
              {(dropProduct.error as Error).message}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => dropProduct.mutate(deleteProduct.id)} disabled={dropProduct.isPending}>
              {t("common.delete")}
            </Button>
            <Button variant="ghost" onClick={() => setDeleteProduct(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </Dialog>
      )}

      {deleteCategory && (
        <Dialog
          open
          title={t("products.deleteCategoryTitle", { name: deleteCategory.name })}
          onClose={() => setDeleteCategory(null)}
        >
          <p className="text-sm text-mute">{t("products.deleteCategoryHint")}</p>
          {dropCat.isError && (
            <p role="alert" className="text-sm text-alert">
              {(dropCat.error as Error).message}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => dropCat.mutate(deleteCategory.id)} disabled={dropCat.isPending}>
              {t("common.delete")}
            </Button>
            <Button variant="ghost" onClick={() => setDeleteCategory(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

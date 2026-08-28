import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { ShopBrand } from "../components/ShopBrand";
import { VitrineMenuGrid } from "../components/vitrine/VitrineMenuGrid";
import { Button, Dialog, Input, MoreMenu } from "../components/ui";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { useLocale, useT } from "../i18n";
import { localizedName } from "../lib/i18nName";
import {
  autoColumnsFromCatalog,
  editorColumnsToPayload,
  newEditorKey,
  printVitrineMenu,
  savedToEditor,
  type EditorColumn,
} from "../lib/vitrineLayout";
import { cn } from "../lib/utils";
import { homePath, useAuth } from "../store/auth";
import type { Product, Shop } from "../types";

const PAGE = 100;
const DEFAULT_SHOP_ID = Number(import.meta.env.VITE_DEFAULT_SHOP_ID || 1);

function ProductPicker({
  shopId,
  open,
  onClose,
  onPick,
  existingProductIds,
}: {
  shopId: number;
  open: boolean;
  onClose: () => void;
  onPick: (product: Product) => void;
  existingProductIds: Set<number>;
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
        limit: 50,
      }),
    enabled: open && shopId > 0,
  });
  const items = products.data?.items ?? [];

  return (
    <Dialog open={open} onClose={onClose} title={t("vitrine.pickProduct")}>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} autoFocus />
      <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-line">
        {items.map((p) => {
          const inMenu = existingProductIds.has(p.id);
          const variants = (p.variants ?? []).filter((v) => v.is_active);
          return (
            <button
              key={p.id}
              type="button"
              disabled={inMenu}
              className={cn(
                "flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm",
                inMenu ? "cursor-not-allowed bg-paper-2 text-mute" : "hover:bg-cream",
              )}
              onClick={() => {
                if (inMenu) return;
                onPick(p);
                onClose();
                setQ("");
              }}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{localizedName(p, locale)}</p>
                {variants.length > 0 ? (
                  <p className="mt-0.5 truncate text-xs text-mute">
                    {variants.map((v) => v.name).join(" · ")}
                  </p>
                ) : p.category_name ? (
                  <p className="mt-0.5 truncate text-xs text-mute">
                    {localizedName(
                      {
                        name: p.category_name,
                        name_kk: p.category_name_kk,
                        name_en: p.category_name_en,
                      },
                      locale,
                    )}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-mute">
                {inMenu ? t("vitrine.alreadyInColumn") : variants.length > 0 ? "" : p.sale_price}
              </span>
            </button>
          );
        })}
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { user, shopId, accessToken } = useAuth();
  const shopParam = Number(searchParams.get("shop") || DEFAULT_SHOP_ID);
  const isAuthed = Boolean(user && accessToken);
  const sid = shopId ?? user?.shop_id ?? shopParam;
  const canEdit = isAuthed && (user?.role === "owner" || user?.role === "super_admin");
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

  const shops = useQuery({ queryKey: ["shops"], queryFn: api.shops, enabled: isAuthed && sid > 0 });
  const publicMenu = useQuery({
    queryKey: ["public-vitrine", sid],
    queryFn: () => api.publicVitrineMenu(sid),
    enabled: sid > 0 && !isAuthed,
    refetchInterval: editMode ? false : 20_000,
  });
  const savedLayout = useQuery({
    queryKey: ["vitrine-layout", sid],
    queryFn: () => api.vitrineLayout(sid),
    enabled: sid > 0 && isAuthed,
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
    enabled: sid > 0 && isAuthed,
    refetchInterval: editMode ? false : 20_000,
  });
  const categories = useQuery({
    queryKey: ["categories", sid],
    queryFn: () => api.categories(sid),
    enabled: sid > 0 && isAuthed,
    refetchInterval: editMode ? false : 20_000,
  });

  useEffect(() => {
    if (!isAuthed || !products.hasNextPage || products.isFetchingNextPage) return;
    void products.fetchNextPage();
  }, [isAuthed, products.hasNextPage, products.isFetchingNextPage, products.data]);

  const shop = useMemo((): Shop | undefined => {
    const fromAuth = shops.data?.find((s) => s.id === sid) ?? shops.data?.[0];
    if (fromAuth) return fromAuth;
    const pub = publicMenu.data?.shop;
    if (!pub) return undefined;
    return {
      id: pub.id,
      name: pub.name,
      logo_url: pub.logo_url,
      address: null,
      timezone: "Asia/Almaty",
      is_active: true,
      created_at: "",
    };
  }, [shops.data, publicMenu.data, sid]);
  const otherLabel = t("vitrine.other");
  const allProducts = useMemo(
    () => products.data?.pages.flatMap((p) => p.items) ?? [],
    [products.data],
  );

  const displayColumns = useMemo((): EditorColumn[] => {
    if (isAuthed) {
      const saved = savedLayout.data?.columns ?? [];
      if (saved.length > 0) return savedToEditor(saved);
      return autoColumnsFromCatalog(allProducts, categories.data ?? [], otherLabel, locale);
    }
    const bundle = publicMenu.data;
    if (!bundle) return [];
    if (bundle.layout.columns.length > 0) return savedToEditor(bundle.layout.columns);
    return autoColumnsFromCatalog(bundle.products, bundle.categories, otherLabel, locale);
  }, [isAuthed, savedLayout.data, allProducts, categories.data, publicMenu.data, otherLabel, locale]);

  const columns = editMode && draft !== null ? draft : displayColumns;

  const saveLayout = useMutation({
    mutationFn: () => api.putVitrineLayout(sid, editorColumnsToPayload(draft ?? [], t("vitrine.newColumn"))),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vitrine-layout", sid] });
      setEditMode(false);
      setDraft(null);
    },
  });

  function startEdit() {
    if (!canEdit) {
      navigate("/login");
      return;
    }
    setDraft(structuredClone(displayColumns));
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setDraft(null);
  }

  async function finishEdit() {
    await saveLayout.mutateAsync();
  }

  function fillFromCatalog() {
    if (!window.confirm(t("vitrine.fillConfirm"))) return;
    setDraft(
      autoColumnsFromCatalog(allProducts, categories.data ?? [], otherLabel, locale).map((col) => ({
        ...col,
        key: newEditorKey(),
        items: col.items.map((item) => ({ ...item, key: newEditorKey() })),
      })),
    );
  }

  function addProductToColumn(colKey: string, product: Product) {
    setDraft((prev) =>
      (prev ?? []).map((col) =>
        col.key === colKey
          ? {
              ...col,
              items: [...col.items, { key: newEditorKey(), product_id: product.id, product }],
            }
          : col,
      ),
    );
  }

  function addColumn() {
    setDraft((prev) => [
      ...(prev ?? []),
      { key: newEditorKey(), title: t("vitrine.newColumn"), header_style: "ornament", items: [] },
    ]);
  }

  async function toggleFull() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await rootRef.current?.requestFullscreen();
  }

  const pickColumn = columns.find((c) => c.key === pickColumnKey);
  const pickExistingIds = new Set(pickColumn?.items.map((i) => i.product_id) ?? []);

  const timeLocale = locale === "en" ? "en-GB" : locale === "kk" ? "kk-KZ" : "ru-RU";
  const time = now.toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" });

  const menuItems = [
    ...(canEdit ? [{ label: t("vitrine.editMenu"), onClick: startEdit }] : []),
    { label: t("vitrine.pdfPortrait"), onClick: () => printVitrineMenu("portrait") },
    { label: t("vitrine.pdfLandscape"), onClick: () => printVitrineMenu("landscape") },
  ];

  return (
    <div ref={rootRef} className="vitrine-page flex min-h-screen flex-col bg-paper text-ink">
      {editMode && (
        <div className="vitrine-chrome sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur-sm md:px-8">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accent">
                {t("vitrine.editing")}
              </p>
              <p className="mt-0.5 text-sm text-mute">{t("vitrine.livePreview")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="quiet" onClick={fillFromCatalog}>
                {t("vitrine.fillFromCatalog")}
              </Button>
              <Button type="button" variant="ghost" onClick={cancelEdit}>
                {t("common.cancel")}
              </Button>
              <Button type="button" variant="primary" disabled={saveLayout.isPending} onClick={() => void finishEdit()}>
                {saveLayout.isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <header className="vitrine-chrome px-6 pt-6 md:px-10 md:pt-7 print:px-8 print:pt-6">
        <div className="mx-auto flex max-w-[1400px] items-end justify-between gap-6">
          <div className="min-w-0">
            <ShopBrand shop={shop} fallback={t("vitrine.menu")} size="md" markClass="h-6 w-8 text-maroon" />
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-faint">{t("vitrine.menu")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {!editMode && <MoreMenu items={menuItems} />}
            <p className="font-mono text-[26px] tabular-nums text-gold md:text-[32px]">{time}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 md:px-8 print:px-6">
        <VitrineMenuGrid
          columns={columns}
          editMode={editMode}
          onColumnsChange={(cols) => setDraft(cols)}
          onAddProduct={(columnKey) => setPickColumnKey(columnKey)}
          onAddColumn={addColumn}
        />
        {!editMode && (isAuthed ? products.isSuccess : publicMenu.isSuccess) && columns.length === 0 && (
          <p className="px-6 font-display text-2xl text-mute">{t("vitrine.empty")}</p>
        )}
      </main>

      <footer className="vitrine-chrome mt-auto flex items-center justify-between gap-4 px-6 py-4 md:px-10">
        {user ? (
          <Link to={homePath(user.role)} className="text-[12.5px] text-faint hover:text-ink">
            {t("vitrine.back")}
          </Link>
        ) : (
          <Link to="/" className="text-[12.5px] text-faint hover:text-ink">
            {t("vitrine.guestBack")}
          </Link>
        )}
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
        existingProductIds={pickExistingIds}
      />
    </div>
  );
}

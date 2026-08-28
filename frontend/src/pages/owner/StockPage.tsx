import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { ReceivePanel } from "../../components/ReceivePanel";
import { StockBalancesTable } from "../../components/stock/StockBalancesTable";
import { StockCreateForm } from "../../components/stock/StockCreateForm";
import { StockImportDialog, StockMakeProductDialog } from "../../components/stock/StockDialogs";
import { Button, Card, PageTitle } from "../../components/ui";
import { useLocale, useT } from "../../i18n";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { costPerBase, defaultStockCreate, stockBalance } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { StockItem } from "../../types";

type ImportPreviewRow = Awaited<ReturnType<typeof api.previewStockImport>>["rows"][number];

const PAGE_SIZE = 50;
const emptyCreate = defaultStockCreate();

export function StockPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [create, setCreate] = useState(emptyCreate);
  const [createPhoto, setCreatePhoto] = useState<File | null>(null);
  const [createPreview, setCreatePreview] = useState<string | null>(null);
  const [receive, setReceive] = useState<StockItem | null | "open">(null);
  const [q, setQ] = useState("");
  const [makeFor, setMakeFor] = useState<StockItem | null>(null);
  const [makePrice, setMakePrice] = useState("");
  const [makeCategoryId, setMakeCategoryId] = useState<number | "">("");
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportPreviewRow[] | null>(null);
  const [importOk, setImportOk] = useState(0);
  const [importErr, setImportErr] = useState(0);
  const importInput = useRef<HTMLInputElement>(null);
  const debouncedQ = useDebouncedValue(q, 250);

  const stock = useInfiniteQuery({
    queryKey: ["stock", shopId, debouncedQ],
    queryFn: ({ pageParam }) =>
      api.stock(shopId, {
        q: debouncedQ.trim() || undefined,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
  });
  const stats = useQuery({
    queryKey: ["stock-stats", shopId],
    queryFn: () => api.stockStats(shopId),
  });
  const lowStock = useQuery({
    queryKey: ["stock-low", shopId],
    queryFn: () => api.stock(shopId, { is_low: true, limit: 40 }),
  });
  const categories = useQuery({ queryKey: ["categories", shopId], queryFn: () => api.categories(shopId) });
  const revisions = useQuery({
    queryKey: ["stock-revisions", shopId],
    queryFn: () => api.stockRevisions(shopId),
  });
  const hasDraft = (revisions.data ?? []).some((r) => r.status === "draft");

  function refreshStock() {
    void qc.invalidateQueries({ queryKey: ["stock", shopId] });
    void qc.invalidateQueries({ queryKey: ["stock-stats", shopId] });
    void qc.invalidateQueries({ queryKey: ["stock-low", shopId] });
  }

  const add = useMutation({
    mutationFn: async () => {
      const item = await api.createStock(shopId, {
        name: create.name,
        sku: create.sku.trim() || null,
        base_unit: create.base_unit,
        purchase_unit: create.purchase_unit,
        purchase_to_base: create.purchase_to_base,
        min_quantity: create.min_quantity,
        cost_per_base_unit: costPerBase(create.cost_per_purchase, create.purchase_to_base),
        is_ingredient: !create.on_pos,
      });
      if (createPhoto) await api.uploadStockImage(shopId, item.id, createPhoto);
      return { item, wantPos: create.on_pos };
    },
    onSuccess: ({ item, wantPos }) => {
      setCreate(emptyCreate);
      setCreatePhoto(null);
      setCreatePreview(null);
      setCreating(false);
      refreshStock();
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
      if (wantPos && !item.on_pos) {
        setMakeFor(item);
        setMakePrice("");
        setMakeCategoryId("");
      }
    },
  });
  const makeProduct = useMutation({
    mutationFn: () =>
      api.makeProductFromStock(shopId, makeFor!.id, {
        sale_price: makePrice,
        category_id: makeCategoryId === "" ? null : Number(makeCategoryId),
      }),
    onSuccess: () => {
      setMakeFor(null);
      setMakePrice("");
      setMakeCategoryId("");
      refreshStock();
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });
  const setOnPos = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) => api.patchStock(shopId, id, { on_pos: on }),
    onSuccess: () => {
      refreshStock();
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });

  function togglePos(item: StockItem, on: boolean) {
    if (on) {
      if (item.on_pos) return;
      if (item.has_pos_product) {
        setOnPos.mutate({ id: item.id, on: true });
        return;
      }
      setMakeFor(item);
      setMakePrice("");
      setMakeCategoryId("");
      makeProduct.reset();
      return;
    }
    if (!item.on_pos) return;
    setOnPos.mutate({ id: item.id, on: false });
  }
  const previewImport = useMutation({
    mutationFn: (file: File) => api.previewStockImport(shopId, file),
    onSuccess: (res) => {
      setImportRows(res.rows);
      setImportOk(res.ok_count);
      setImportErr(res.error_count);
    },
  });
  const confirmImport = useMutation({
    mutationFn: () => {
      const rows = (importRows ?? []).filter((r) => r.ok && r.data).map((r) => r.data!);
      return api.confirmStockImport(shopId, rows);
    },
    onSuccess: () => {
      setImportOpen(false);
      setImportRows(null);
      refreshStock();
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
    },
  });

  function toggleCreate() {
    if (creating) {
      add.reset();
      setCreate(emptyCreate);
      setCreatePhoto(null);
      setCreatePreview(null);
      setCreating(false);
      return;
    }
    setCreating(true);
  }

  const rows = useMemo(
    () => stock.data?.pages.flatMap((p) => p.items) ?? [],
    [stock.data],
  );
  const totalCount = stock.data?.pages[0]?.total ?? stats.data?.total_count ?? 0;
  const shelfTotal = Number(stats.data?.shelf_value ?? 0);
  const lowCount = stats.data?.low_count ?? 0;
  const lowItems = lowStock.data?.items ?? [];

  return (
    <div>
      <PageTitle
        kicker={t("stock.kicker")}
        title={t("stock.title")}
        hint={t("stock.hint")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={() => setReceive("open")} disabled={hasDraft}>
              {t("stock.income")}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setImportOpen(true);
                setImportRows(null);
                previewImport.reset();
                confirmImport.reset();
              }}
              disabled={hasDraft}
            >
              {t("stock.importBtn")}
            </Button>
            <Button variant={creating ? "quiet" : "primary"} onClick={toggleCreate}>
              {creating ? t("common.collapse") : t("stock.addItem")}
            </Button>
          </div>
        }
      />
      {hasDraft && (
        <Card className="mb-4 border border-maroon/30 bg-maroon/5">
          <p className="font-medium text-maroon">{t("stock.revisionPause")}</p>
          <p className="mt-1 text-sm text-mute">{t("stock.revisionPauseHint")}</p>
        </Card>
      )}
      {lowCount > 0 && (
        <Card className="mb-4 border border-alert/40 bg-alert/10">
          <p className="font-semibold text-alert">{t("stock.buy")}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {lowItems.map((i) => (
              <button
                key={i.id}
                type="button"
                className="underline decoration-maroon/40 underline-offset-4 hover:text-maroon"
                onClick={() => navigate(`/owner/stock/item/${i.id}`)}
              >
                {i.name} · {stockBalance(i)}
              </button>
            ))}
            {lowCount > lowItems.length && (
              <span className="text-mute">+{lowCount - lowItems.length}</span>
            )}
          </div>
        </Card>
      )}
      {creating && (
        <Card>
          <StockCreateForm
            create={create}
            onCreateChange={setCreate}
            createPreview={createPreview}
            onPhotoFile={(file) => {
              setCreatePhoto(file);
              setCreatePreview(URL.createObjectURL(file));
            }}
            onPhotoClear={() => {
              setCreatePhoto(null);
              setCreatePreview(null);
            }}
            onSave={() => add.mutate()}
            onCancel={toggleCreate}
            savePending={add.isPending}
            saveError={add.isError ? (add.error as Error) : null}
          />
        </Card>
      )}
      <StockBalancesTable
        t={t}
        q={q}
        onQChange={setQ}
        totalCount={totalCount}
        rowsLength={rows.length}
        lowCount={lowCount}
        shelfTotal={shelfTotal}
        rows={rows}
        isLoading={stock.isLoading}
        hasNextPage={Boolean(stock.hasNextPage)}
        isFetchingNextPage={stock.isFetchingNextPage}
        onLoadMore={() => void stock.fetchNextPage()}
        onRowClick={(item) => navigate(`/owner/stock/item/${item.id}`)}
        onTogglePos={togglePos}
        togglePosPendingId={setOnPos.isPending ? setOnPos.variables?.id : undefined}
      />
      {receive != null && (
        <ReceivePanel
          shopId={shopId}
          initialItem={receive === "open" ? null : receive}
          onClose={() => setReceive(null)}
        />
      )}
      <StockMakeProductDialog
        t={t}
        item={makeFor}
        makePrice={makePrice}
        onMakePriceChange={setMakePrice}
        makeCategoryId={makeCategoryId}
        onMakeCategoryIdChange={setMakeCategoryId}
        categories={categories.data}
        makeProduct={makeProduct}
        onClose={() => setMakeFor(null)}
      />
      <StockImportDialog
        t={t}
        locale={locale}
        shopId={shopId}
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          setImportRows(null);
        }}
        importInput={importInput}
        importRows={importRows}
        importOk={importOk}
        importErr={importErr}
        previewImport={previewImport}
        confirmImport={confirmImport}
      />
    </div>
  );
}

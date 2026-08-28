import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PhotoField } from "../../components/PhotoField";
import { ReceivePanel } from "../../components/ReceivePanel";
import { Button, Card, Check, Dialog, Field, Input, PageTitle, Select } from "../../components/ui";
import { useLocale, useT } from "../../i18n";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { BASE_UNITS, PURCHASE_UNITS, costPerBase, costPerPurchase, money, publicUrl, qty, shelfValue, shortDay, stockBalance, suggestPurchaseFactor, unitCost } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { StockItem } from "../../types";

type ImportPreviewRow = Awaited<ReturnType<typeof api.previewStockImport>>["rows"][number];

const PAGE_SIZE = 50;

function CostHint({
  purchasePrice,
  factor,
  purchaseUnit,
  baseUnit,
}: {
  purchasePrice: string;
  factor: string;
  purchaseUnit: string;
  baseUnit: string;
}) {
  const t = useT();
  const perBase = Number(costPerBase(purchasePrice, factor));
  const pack = Number(purchasePrice);
  const n = Number(factor);
  if (!n || n <= 0) {
    return (
      <p className="mt-1 text-[12.5px] text-mute">
        {t("stock.costHintUnits", { base: baseUnit, purchase: purchaseUnit })}
      </p>
    );
  }
  if (!(pack > 0) || (n === 1 && purchaseUnit === baseUnit)) {
    return <p className="mt-1 text-[12.5px] text-mute">{t("stock.costHintZero")}</p>;
  }
  return (
    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
      → {unitCost(perBase, baseUnit)}
    </p>
  );
}

const emptyCreate = {
  name: "",
  sku: "",
  base_unit: "мл",
  purchase_unit: "пачка",
  purchase_to_base: "1000",
  min_quantity: "0",
  cost_per_purchase: "0",
  on_pos: true,
};

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

  function setUnits(patch: Partial<typeof create>) {
    const next = { ...create, ...patch };
    if (patch.base_unit || patch.purchase_unit) {
      next.purchase_to_base = suggestPurchaseFactor(next.base_unit, next.purchase_unit);
    }
    setCreate(next);
  }

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
      <Card className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="md:col-span-3">
          <PhotoField
            src={createPreview}
            onFile={(file) => {
              setCreatePhoto(file);
              setCreatePreview(URL.createObjectURL(file));
            }}
            onClear={() => {
              setCreatePhoto(null);
              setCreatePreview(null);
            }}
            hint={t("stock.photoHint")}
          />
        </div>
        <Field label={t("stock.name")}>
          <Input
            placeholder={t("stock.namePh")}
            value={create.name}
            onChange={(e) => setCreate({ ...create, name: e.target.value })}
          />
        </Field>
        <Field label={t("stock.sku")} hint={t("stock.skuHint")}>
          <Input
            placeholder={t("stock.skuPh")}
            value={create.sku}
            onChange={(e) => setCreate({ ...create, sku: e.target.value })}
          />
        </Field>
        <Field label={t("stock.baseUnit")}>
          <Select value={create.base_unit} onChange={(e) => setUnits({ base_unit: e.target.value })}>
            {BASE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("stock.purchaseUnit")}>
          <Select value={create.purchase_unit} onChange={(e) => setUnits({ purchase_unit: e.target.value })}>
            {PURCHASE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("stock.oneEquals", { unit: create.purchase_unit })}>
          <Input
            value={create.purchase_to_base}
            onChange={(e) => setCreate({ ...create, purchase_to_base: e.target.value })}
            inputMode="decimal"
            placeholder={t("stock.howMany", { unit: create.base_unit })}
          />
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
            {create.base_unit}
          </p>
        </Field>
        <Field label={t("stock.minLabel", { unit: create.base_unit })} hint={t("stock.minHint")}>
          <Input
            value={create.min_quantity}
            onChange={(e) => setCreate({ ...create, min_quantity: e.target.value })}
            inputMode="decimal"
          />
        </Field>
        <Field label={t("stock.pricePer", { unit: create.purchase_unit })}>
          <Input
            value={create.cost_per_purchase}
            onChange={(e) => setCreate({ ...create, cost_per_purchase: e.target.value })}
            inputMode="decimal"
            placeholder={t("stock.pricePh")}
          />
          <CostHint
            purchasePrice={create.cost_per_purchase}
            factor={create.purchase_to_base}
            purchaseUnit={create.purchase_unit}
            baseUnit={create.base_unit}
          />
        </Field>
        <div className="md:col-span-3">
          <Check
            checked={create.on_pos}
            onChange={(on_pos) => setCreate({ ...create, on_pos })}
          >
            {t("stock.onPos")}
          </Check>
          <p className="mt-1 text-[12.5px] text-mute">{t("stock.onPosHint")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 md:col-span-3">
          <Button onClick={() => add.mutate()} disabled={!create.name || add.isPending}>
            {t("common.save")}
          </Button>
          <Button variant="ghost" onClick={toggleCreate}>
            {t("common.cancel")}
          </Button>
        </div>
        {add.isError && <p className="text-sm text-alert md:col-span-3">{(add.error as Error).message}</p>}
      </Card>
      )}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("stock.searchPh")}
          className="max-w-xs"
        />
        <p className="font-mono text-[12.5px] text-mute">
          {totalCount === 1
            ? t("stock.nItems", { n: totalCount })
            : t("stock.nItemsMany", { n: totalCount })}
          {rows.length < totalCount ? ` · ${rows.length}` : ""}
          {lowCount ? ` · ${t("stock.runningLow", { n: lowCount })}` : ""}
          {" · "}
          {t("stock.shelfSum", { n: money(shelfTotal) })}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg bg-cream shadow-soft">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
            <tr className="border-b border-line text-left">
              <th className="px-5 py-3.5">{t("stock.colItem")}</th>
              <th>{t("stock.colNow")}</th>
              <th>{t("stock.colMin")}</th>
              <th>{t("stock.colCost")}</th>
              <th className="text-right">{t("stock.colShelf")}</th>
              <th className="pr-5 text-right">{t("stock.colLastIn")}</th>
              <th className="pr-5 text-center">{t("stock.colOnPos")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const src = publicUrl(i.image_url);
              return (
              <tr
                key={i.id}
                className={`cursor-pointer border-b border-line last:border-0 ${i.is_low ? "bg-maroon/5" : ""}`}
                onClick={() => navigate(`/owner/stock/item/${i.id}`)}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {src ? (
                      <img src={src} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                    ) : (
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-paper font-mono text-[9px] uppercase tracking-wide text-mute">
                        {t("common.photo")}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">{i.name}</span>
                      {i.sku ? (
                        <span className="mt-0.5 block font-mono text-[11px] text-mute">{i.sku}</span>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="font-mono">{stockBalance(i)}</td>
                <td className="font-mono text-mute">{qty(i.min_quantity, i.base_unit)}</td>
                <td className="font-mono">
                  {unitCost(costPerPurchase(i.cost_per_base_unit, i.purchase_to_base), i.purchase_unit)}
                  {Number(i.purchase_to_base) !== 1 || i.purchase_unit !== i.base_unit ? (
                    <span className="mt-0.5 block text-[11px] text-mute">
                      {unitCost(i.cost_per_base_unit, i.base_unit)}
                    </span>
                  ) : null}
                </td>
                <td className="pr-4 text-right font-mono font-semibold">{money(shelfValue(i))}</td>
                <td className="pr-5 text-right font-mono text-[12.5px] text-mute">{shortDay(i.last_income_at)}</td>
                <td className="pr-5 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="h-5 w-5 cursor-pointer rounded-[4px] border-[1.5px] border-line-2 accent-maroon"
                    checked={Boolean(i.on_pos)}
                    disabled={setOnPos.isPending && setOnPos.variables?.id === i.id}
                    aria-label={t("stock.onPos")}
                    onChange={(e) => togglePos(i, e.target.checked)}
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && !stock.isLoading && (
          <p className="px-5 py-8 text-center text-sm text-mute">
            {q.trim() ? t("stock.emptySearch") : t("stock.empty")}
          </p>
        )}
      </div>
      {stock.hasNextPage && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="quiet"
            disabled={stock.isFetchingNextPage}
            onClick={() => void stock.fetchNextPage()}
          >
            {stock.isFetchingNextPage ? t("common.loading") : t("common.loadMore")}
          </Button>
        </div>
      )}
      {receive != null && (
        <ReceivePanel
          shopId={shopId}
          initialItem={receive === "open" ? null : receive}
          onClose={() => setReceive(null)}
        />
      )}
      <Dialog
        open={makeFor != null}
        title={t("stock.makeProductTitle")}
        hint={makeFor ? `${makeFor.name}. ${t("stock.makeProductHint")}` : undefined}
        onClose={() => setMakeFor(null)}
      >
        <div className="grid gap-3">
          <Field label={t("products.price")}>
            <Input
              value={makePrice}
              onChange={(e) => setMakePrice(e.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
          </Field>
          <Field label={t("products.category")}>
            <Select
              value={makeCategoryId === "" ? "" : String(makeCategoryId)}
              onChange={(e) => setMakeCategoryId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">{t("products.bulkNoCategory")}</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          {makeProduct.isError && (
            <p className="text-sm text-alert">{(makeProduct.error as Error).message}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => makeProduct.mutate()}
              disabled={!makePrice || Number(makePrice) <= 0 || makeProduct.isPending}
            >
              {t("common.save")}
            </Button>
            <Button variant="ghost" onClick={() => setMakeFor(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={importOpen}
        title={t("stock.importBtn")}
        wide
        onClose={() => {
          setImportOpen(false);
          setImportRows(null);
        }}
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="quiet"
              onClick={() => void api.downloadStockImportTemplate(shopId, locale)}
            >
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
            <p className="text-sm text-alert">{(previewImport.error as Error).message}</p>
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
                <p className="text-sm text-alert">{(confirmImport.error as Error).message}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => confirmImport.mutate()}
                  disabled={importOk === 0 || confirmImport.isPending}
                >
                  {t("stock.importConfirm")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setImportOpen(false);
                    setImportRows(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { PhotoField } from "../../components/PhotoField";
import { ReceivePanel } from "../../components/ReceivePanel";
import { StockSearchPicker } from "../../components/StockSearchPicker";
import { Button, Check, Field, Input, MoreMenu, PageTitle, Select } from "../../components/ui";
import { useLocale, useT } from "../../i18n";
import { dateLocaleTag } from "../../lib/i18nName";
import { WRITEOFF_REASONS, deltaBase, formatDelta, kindTitle, writeoffReasonLabel } from "../../lib/stock";
import { PURCHASE_UNITS, costPerBase, costPerPurchase, money, publicUrl, qty, shelfValue, shortDay, stockBalance, suggestPurchaseFactor, unitCost } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { StockItem } from "../../types";

export function StockItemPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const dateTag = dateLocaleTag(locale);
  const shopId = useAuth((s) => s.shopId)!;
  const { itemId } = useParams();
  const id = Number(itemId);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"receive" | "writeoff" | "regrade" | "transfer" | "edit" | "remove" | "makeProduct" | null>(
    null,
  );
  const [writeoff, setWriteoff] = useState({ qty: "", comment: "" });
  const [regrade, setRegrade] = useState({ toId: "", qtyFrom: "", qtyTo: "", comment: "" });
  const [transfer, setTransfer] = useState({ shopId: "", itemId: "", qty: "", qtyTo: "", comment: "" });
  const [makePrice, setMakePrice] = useState("");
  const [makeCategoryId, setMakeCategoryId] = useState<number | "">("");
  const [edit, setEdit] = useState({
    name: "",
    sku: "",
    purchase_unit: "",
    purchase_to_base: "",
    min_quantity: "",
    cost_per_purchase: "",
  });
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);

  const itemQ = useQuery({
    queryKey: ["stock-item", shopId, id],
    queryFn: () => api.stockItem(shopId, id),
    enabled: Number.isFinite(id),
  });
  const categories = useQuery({ queryKey: ["categories", shopId], queryFn: () => api.categories(shopId) });
  const shops = useQuery({ queryKey: ["shops"], queryFn: api.shops });
  const journal = useQuery({
    queryKey: ["stock-journal", shopId, String(id)],
    queryFn: () => api.stockJournal(shopId, id),
    enabled: Number.isFinite(id),
  });
  const item = itemQ.data;
  const branches = (shops.data ?? []).filter((s) => s.id !== shopId);
  const destShopId = Number(transfer.shopId) || null;
  const [regradeToItem, setRegradeToItem] = useState<StockItem | null>(null);
  const [destItemPick, setDestItemPick] = useState<StockItem | null>(null);

  useEffect(() => {
    if (panel !== "regrade") setRegradeToItem(null);
    if (panel !== "transfer") setDestItemPick(null);
  }, [panel]);

  useEffect(() => {
    if (!item || !destShopId || transfer.itemId || panel !== "transfer") return;
    void api.stock(destShopId, { q: item.name, limit: 5 }).then((page) => {
      const match = page.items.find((s) => s.name === item.name);
      if (match) {
        setDestItemPick(match);
        setTransfer((prev) => ({ ...prev, itemId: String(match.id) }));
      }
    });
  }, [item, destShopId, transfer.itemId, panel]);

  useEffect(() => {
    if (!item || panel !== "edit") return;
    setEdit({
      name: item.name,
      sku: item.sku ?? "",
      purchase_unit: item.purchase_unit,
      purchase_to_base: String(Number(item.purchase_to_base)),
      min_quantity: String(Number(item.min_quantity)),
      cost_per_purchase: costPerPurchase(item.cost_per_base_unit, item.purchase_to_base),
    });
    setEditPhoto(null);
    setEditPreview(null);
    setDropPhoto(false);
  }, [item, panel]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["stock", shopId] });
    void qc.invalidateQueries({ queryKey: ["stock-stats", shopId] });
    void qc.invalidateQueries({ queryKey: ["stock-low", shopId] });
    void qc.invalidateQueries({ queryKey: ["stock-pick"] });
    void qc.invalidateQueries({ queryKey: ["stock-item", shopId, id] });
    void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
  }

  const applyWriteoff = useMutation({
    mutationFn: () =>
      api.stockMove(shopId, id, {
        type: "writeoff",
        quantity: writeoff.qty,
        comment: writeoff.comment || null,
      }),
    onSuccess: () => {
      setPanel(null);
      setWriteoff({ qty: "", comment: "" });
      refresh();
    },
  });
  const applyRegrade = useMutation({
    mutationFn: () =>
      api.stockRegrade(shopId, id, {
        to_item_id: Number(regrade.toId),
        quantity_from: regrade.qtyFrom,
        quantity_to: regrade.qtyTo.trim() ? regrade.qtyTo : null,
        comment: regrade.comment || null,
      }),
    onSuccess: () => {
      setPanel(null);
      setRegrade({ toId: "", qtyFrom: "", qtyTo: "", comment: "" });
      refresh();
    },
  });
  const applyTransfer = useMutation({
    mutationFn: () =>
      api.stockTransfer(shopId, id, {
        to_shop_id: Number(transfer.shopId),
        to_item_id: Number(transfer.itemId),
        quantity: transfer.qty,
        quantity_to: transfer.qtyTo.trim() ? transfer.qtyTo : null,
        comment: transfer.comment || null,
      }),
    onSuccess: () => {
      setPanel(null);
      setTransfer({ shopId: "", itemId: "", qty: "", qtyTo: "", comment: "" });
      refresh();
      if (destShopId) void qc.invalidateQueries({ queryKey: ["stock", destShopId] });
    },
  });
  const saveEdit = useMutation({
    mutationFn: async () => {
      await api.patchStock(shopId, id, {
        name: edit.name,
        sku: edit.sku.trim() || null,
        purchase_unit: edit.purchase_unit,
        purchase_to_base: edit.purchase_to_base,
        min_quantity: edit.min_quantity,
        cost_per_base_unit: costPerBase(edit.cost_per_purchase, edit.purchase_to_base),
      });
      if (dropPhoto && !editPhoto) await api.deleteStockImage(shopId, id);
      if (editPhoto) await api.uploadStockImage(shopId, id, editPhoto);
    },
    onSuccess: () => {
      setPanel(null);
      refresh();
    },
  });
  const makeProduct = useMutation({
    mutationFn: () =>
      api.makeProductFromStock(shopId, id, {
        sale_price: makePrice,
        category_id: makeCategoryId === "" ? null : Number(makeCategoryId),
      }),
    onSuccess: () => {
      setPanel(null);
      setMakePrice("");
      setMakeCategoryId("");
      refresh();
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });
  const setOnPos = useMutation({
    mutationFn: (on: boolean) => api.patchStock(shopId, id, { on_pos: on }),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
    },
  });
  const drop = useMutation({
    mutationFn: () => api.deleteStock(shopId, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
      void qc.invalidateQueries({ queryKey: ["products", shopId] });
      navigate("/owner/stock");
    },
  });

  const destItem = destItemPick;
  const regradeTo = regradeToItem;
  const needRegradeTo = Boolean(item && regradeTo && item.base_unit !== regradeTo.base_unit);
  const needTransferTo = Boolean(item && destItem && item.base_unit !== destItem.base_unit);

  const groups = useMemo(() => {
    const rows = journal.data ?? [];
    const grouped: { day: string; rows: typeof rows }[] = [];
    for (const row of rows) {
      const day = new Date(row.created_at).toLocaleDateString(dateTag, { day: "numeric", month: "long" });
      const last = grouped[grouped.length - 1];
      if (last && last.day === day) last.rows.push(row);
      else grouped.push({ day, rows: [row] });
    }
    return grouped;
  }, [journal.data, dateTag]);

  if (itemQ.isError) {
    return (
      <div>
        <PageTitle kicker={t("stock.kicker")} title={t("stock.itemMissing")} />
        <Link to="/owner/stock">
          <Button variant="quiet">{t("stock.toStock")}</Button>
        </Link>
      </div>
    );
  }
  if (!item) {
    return (
      <div>
        <PageTitle kicker={t("stock.kicker")} title={t("stock.colItem")} hint={t("stock.itemLoading")} />
      </div>
    );
  }

  const photo = editPreview ?? (dropPhoto ? null : publicUrl(item.image_url));
  const meta = [
    t("stock.shelfNow", { n: money(shelfValue(item)) }),
    t("stock.min", { n: qty(item.min_quantity, item.base_unit) }),
    t("stock.cost", {
      n: unitCost(costPerPurchase(item.cost_per_base_unit, item.purchase_to_base), item.purchase_unit),
    }),
  ];
  if (Number(item.purchase_to_base) !== 1 || item.purchase_unit !== item.base_unit) {
    meta.push(unitCost(item.cost_per_base_unit, item.base_unit));
  }
  if (item.last_income_at) {
    meta.push(t("stock.lastIn", { n: shortDay(item.last_income_at) }));
  }

  return (
    <div>
      <PageTitle
        kicker={t("stock.kicker")}
        title={item.name}
        hint={t("stock.itemHint", { qty: stockBalance(item) })}
        action={
          <div className="flex items-center gap-2">
            <MoreMenu
              items={[
                { label: t("stock.receive"), onClick: () => setPanel("receive") },
                { label: t("stock.writeoff"), onClick: () => setPanel("writeoff") },
                { label: t("stock.regrade"), onClick: () => setPanel("regrade") },
                ...(branches.length > 0
                  ? [{ label: t("stock.transfer"), onClick: () => setPanel("transfer") }]
                  : []),
                { label: t("stock.edit"), onClick: () => setPanel("edit") },
                { label: t("common.delete"), danger: true, onClick: () => setPanel("remove") },
              ]}
            />
            <Link to={`/owner/stock/moves?item=${item.id}`}>
              <Button variant="quiet">{t("stock.hubMoves")}</Button>
            </Link>
            <Link to="/owner/stock">
              <Button variant="quiet">{t("stock.toStock")}</Button>
            </Link>
          </div>
        }
      />
      <div className="mb-6 flex flex-wrap items-start gap-6">
        {publicUrl(item.image_url) ? (
          <img src={publicUrl(item.image_url)!} alt="" className="h-24 w-24 rounded-md object-cover" />
        ) : (
          <div className="grid h-24 w-24 place-items-center rounded-md bg-cream font-mono text-[10px] uppercase tracking-wide text-mute">
            {t("common.photo")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[28px] font-semibold leading-none">{stockBalance(item)}</p>
          <p className="mt-2 text-sm text-mute">{meta.join(" · ")}</p>
          {item.is_low && <p className="mt-2 text-sm text-alert">{t("stock.low")}</p>}
          <div className="mt-4">
            <Check
              checked={Boolean(item.on_pos)}
              onChange={(on) => {
                if (on) {
                  if (item.has_pos_product) {
                    setOnPos.mutate(true);
                    return;
                  }
                  setMakePrice("");
                  setMakeCategoryId("");
                  makeProduct.reset();
                  setPanel("makeProduct");
                  return;
                }
                setOnPos.mutate(false);
              }}
            >
              {t("stock.onPos")}
            </Check>
            <p className="mt-1 text-[12.5px] text-mute">{t("stock.onPosHint")}</p>
          </div>
        </div>
      </div>
      <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.13em] text-faint">{t("stock.history")}</p>
      {groups.length === 0 ? (
        <p className="rounded-lg bg-cream px-5 py-8 text-sm text-mute shadow-soft">{t("stock.historyEmpty")}</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.day}>
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.13em] text-faint">{group.day}</p>
              <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
                {group.rows.map((row) => {
                  const d = deltaBase(row);
                  const plus = d != null && d > 0;
                  const minus = d != null && d < 0;
                  return (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-5 py-3.5 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium">{kindTitle(row.kind, d)}</p>
                        <p className="mt-0.5 text-[12.5px] text-mute">
                          {new Date(row.created_at).toLocaleTimeString(dateTag, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {row.actor_name ? ` · ${row.actor_name}` : ""}
                          {row.price_total != null ? ` · ${money(row.price_total)}` : ""}
                          {row.comment ? ` · ${row.comment}` : ""}
                        </p>
                      </div>
                      {formatDelta(row) && (
                        <p
                          className={`font-mono text-[15px] font-semibold ${
                            plus ? "text-turq" : minus ? "text-maroon" : "text-ink"
                          }`}
                        >
                          {formatDelta(row)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {panel === "receive" && (
        <ReceivePanel shopId={shopId} initialItem={item} onClose={() => setPanel(null)} />
      )}

      {panel === "writeoff" && (
        <Modal title={t("stock.writeoffTitle", { name: item.name })} onClose={() => setPanel(null)}>
          <p className="text-sm text-mute">{t("stock.writeoffHint", { unit: item.base_unit })}</p>
          <Field label={t("stock.howMuch", { unit: item.base_unit })}>
            <Input
              value={writeoff.qty}
              onChange={(e) => setWriteoff({ ...writeoff, qty: e.target.value })}
              inputMode="decimal"
              autoFocus
            />
          </Field>
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{t("stock.why")}</p>
            <div className="flex flex-wrap gap-2">
              {WRITEOFF_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className={`rounded-full border-[1.5px] px-3 py-1.5 text-[12.5px] ${
                    writeoff.comment === reason
                      ? "border-ink bg-ink text-paper"
                      : "border-line-2 text-ink-soft hover:border-ink"
                  }`}
                  onClick={() => setWriteoff({ ...writeoff, comment: reason })}
                >
                  {writeoffReasonLabel(reason)}
                </button>
              ))}
            </div>
            <Input
              className="mt-2"
              value={writeoff.comment}
              onChange={(e) => setWriteoff({ ...writeoff, comment: e.target.value })}
              placeholder={t("stock.writeoffPh")}
            />
          </div>
          {applyWriteoff.isError && <p className="text-sm text-alert">{(applyWriteoff.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button onClick={() => applyWriteoff.mutate()} disabled={!writeoff.qty || applyWriteoff.isPending}>
              {t("stock.writeoff")}
            </Button>
            <Button variant="ghost" onClick={() => setPanel(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </Modal>
      )}

      {panel === "regrade" && (
        <Modal title={t("stock.regradeTitle")} onClose={() => setPanel(null)}>
          <p className="text-sm text-mute">{t("stock.regradeHint")}</p>
          <Field label={t("stock.to")}>
            {regradeToItem ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-cream px-3 py-2 text-sm">
                <span>
                  {regradeToItem.name} · {regradeToItem.base_unit}
                </span>
                <button
                  type="button"
                  className="text-[12.5px] text-mute hover:text-maroon"
                  onClick={() => {
                    setRegradeToItem(null);
                    setRegrade({ ...regrade, toId: "" });
                  }}
                >
                  {t("common.remove")}
                </button>
              </div>
            ) : (
              <StockSearchPicker
                shopId={shopId}
                excludeIds={[id]}
                onPick={(s) => {
                  setRegradeToItem(s);
                  setRegrade({ ...regrade, toId: String(s.id) });
                }}
                placeholder={t("stock.searchPh")}
              />
            )}
          </Field>
          <Field label={t("stock.leaves", { unit: item.base_unit })}>
            <Input
              value={regrade.qtyFrom}
              onChange={(e) => setRegrade({ ...regrade, qtyFrom: e.target.value })}
              inputMode="decimal"
            />
          </Field>
          {needRegradeTo && (
            <Field label={t("stock.becomes", { unit: regradeTo?.base_unit ?? "" })}>
              <Input
                value={regrade.qtyTo}
                onChange={(e) => setRegrade({ ...regrade, qtyTo: e.target.value })}
                inputMode="decimal"
              />
            </Field>
          )}
          <Field label={t("common.comment")}>
            <Input
              value={regrade.comment}
              onChange={(e) => setRegrade({ ...regrade, comment: e.target.value })}
              placeholder={t("common.optional")}
            />
          </Field>
          {applyRegrade.isError && <p className="text-sm text-alert">{(applyRegrade.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button
              onClick={() => applyRegrade.mutate()}
              disabled={!regrade.toId || !regrade.qtyFrom || applyRegrade.isPending}
            >
              {t("stock.regrade")}
            </Button>
            <Button variant="ghost" onClick={() => setPanel(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </Modal>
      )}

      {panel === "transfer" && (
        <Modal title={t("stock.transferTitle")} onClose={() => setPanel(null)}>
          <p className="text-sm text-mute">{t("stock.transferHint")}</p>
          <Field label={t("stock.to")}>
            <Select
              value={transfer.shopId}
              onChange={(e) => {
                setDestItemPick(null);
                setTransfer({
                  shopId: e.target.value,
                  itemId: "",
                  qty: transfer.qty,
                  qtyTo: "",
                  comment: transfer.comment,
                });
              }}
            >
              <option value="">{t("stock.shopPh")}</option>
              {branches.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("stock.destItem")}>
            {!destShopId ? (
              <p className="text-sm text-mute">{t("stock.itemPh")}</p>
            ) : destItemPick ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-cream px-3 py-2 text-sm">
                <span>
                  {destItemPick.name} · {destItemPick.base_unit}
                </span>
                <button
                  type="button"
                  className="text-[12.5px] text-mute hover:text-maroon"
                  onClick={() => {
                    setDestItemPick(null);
                    setTransfer({ ...transfer, itemId: "" });
                  }}
                >
                  {t("common.remove")}
                </button>
              </div>
            ) : (
              <StockSearchPicker
                shopId={destShopId}
                onPick={(s) => {
                  setDestItemPick(s);
                  setTransfer({ ...transfer, itemId: String(s.id) });
                }}
                placeholder={t("stock.searchPh")}
              />
            )}
          </Field>
          <Field label={t("stock.leaves", { unit: item.base_unit })}>
            <Input
              value={transfer.qty}
              onChange={(e) => setTransfer({ ...transfer, qty: e.target.value })}
              inputMode="decimal"
            />
          </Field>
          {needTransferTo && (
            <Field label={t("stock.arrives", { unit: destItem?.base_unit ?? "" })}>
              <Input
                value={transfer.qtyTo}
                onChange={(e) => setTransfer({ ...transfer, qtyTo: e.target.value })}
                inputMode="decimal"
              />
            </Field>
          )}
          {applyTransfer.isError && <p className="text-sm text-alert">{(applyTransfer.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button
              onClick={() => applyTransfer.mutate()}
              disabled={!transfer.shopId || !transfer.itemId || !transfer.qty || applyTransfer.isPending}
            >
              {t("stock.send")}
            </Button>
            <Button variant="ghost" onClick={() => setPanel(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </Modal>
      )}

      {panel === "edit" && (
        <Modal title={t("stock.editTitle", { name: item.name })} onClose={() => setPanel(null)}>
          <p className="text-sm text-mute">{t("stock.editHint", { unit: item.base_unit })}</p>
          <PhotoField
            src={photo}
            onFile={(file) => {
              setDropPhoto(false);
              setEditPhoto(file);
              setEditPreview(URL.createObjectURL(file));
            }}
            onClear={() => {
              setEditPhoto(null);
              setEditPreview(null);
              setDropPhoto(true);
            }}
            hint={t("stock.photoHint")}
          />
          <Field label={t("stock.name")}>
            <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </Field>
          <Field label={t("stock.sku")} hint={t("stock.skuHint")}>
            <Input
              value={edit.sku}
              onChange={(e) => setEdit({ ...edit, sku: e.target.value })}
              placeholder={t("stock.skuPh")}
            />
          </Field>
          <Field label={t("stock.purchaseUnit")}>
            <Select
              value={edit.purchase_unit}
              onChange={(e) => {
                const purchase_unit = e.target.value;
                setEdit({
                  ...edit,
                  purchase_unit,
                  purchase_to_base: suggestPurchaseFactor(item.base_unit, purchase_unit),
                });
              }}
            >
              {[edit.purchase_unit, ...PURCHASE_UNITS.filter((u) => u !== edit.purchase_unit)].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("stock.oneEquals", { unit: edit.purchase_unit })}>
            <Input
              value={edit.purchase_to_base}
              onChange={(e) => setEdit({ ...edit, purchase_to_base: e.target.value })}
              inputMode="decimal"
            />
          </Field>
          <Field label={t("stock.minLabel", { unit: item.base_unit })}>
            <Input
              value={edit.min_quantity}
              onChange={(e) => setEdit({ ...edit, min_quantity: e.target.value })}
              inputMode="decimal"
            />
          </Field>
          <Field label={t("stock.pricePer", { unit: edit.purchase_unit })}>
            <Input
              value={edit.cost_per_purchase}
              onChange={(e) => setEdit({ ...edit, cost_per_purchase: e.target.value })}
              inputMode="decimal"
            />
          </Field>
          {saveEdit.isError && <p className="text-sm text-alert">{(saveEdit.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button onClick={() => saveEdit.mutate()} disabled={!edit.name || saveEdit.isPending}>
              {t("common.save")}
            </Button>
            <Button variant="ghost" onClick={() => setPanel(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </Modal>
      )}

      {panel === "makeProduct" && (
        <Modal title={t("stock.makeProductTitle")} onClose={() => setPanel(null)}>
          <p className="text-sm text-mute">{t("stock.makeProductHint")}</p>
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
          <div className="flex gap-2">
            <Button
              onClick={() => makeProduct.mutate()}
              disabled={!makePrice || Number(makePrice) <= 0 || makeProduct.isPending}
            >
              {t("common.save")}
            </Button>
            <Button variant="ghost" onClick={() => setPanel(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </Modal>
      )}

      {panel === "remove" && (
        <Modal title={t("stock.deleteTitle", { name: item.name })} onClose={() => setPanel(null)}>
          <p className="text-sm text-mute">{t("stock.deleteHint")}</p>
          {Number(item.quantity) > 0 && (
            <p className="text-sm text-alert">{t("stock.deleteQty", { qty: stockBalance(item) })}</p>
          )}
          {drop.isError && <p className="text-sm text-alert">{(drop.error as Error).message}</p>}
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => drop.mutate()} disabled={drop.isPending}>
              {t("common.delete")}
            </Button>
            <Button variant="ghost" onClick={() => setPanel(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-roast/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md space-y-3 overflow-auto rounded-lg bg-paper p-7 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-2xl font-normal">{title}</h2>
        {children}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { PosCartPanel, PosProductsPanel } from "../../components/pos/PosCartPanel";
import { PosMobileHeader } from "../../components/pos/PosMobileChrome";
import { PosShiftDialog, PosVariantPickDialog } from "../../components/pos/PosShiftDialog";
import { PosSidebar } from "../../components/pos/PosSidebar";
import { ReceivePanel } from "../../components/ReceivePanel";
import { SkipLink } from "../../components/SkipLink";
import { cartTotals, type Discount } from "../../lib/discount";
import { localizedName } from "../../lib/i18nName";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { money, payLabel } from "../../lib/utils";
import { storageGetMigrated, storageSetMigrated, STORAGE_KEYS } from "../../lib/migratedStorage";
import { usePosBarcodeScanner } from "../../hooks/usePosBarcodeScanner";
import { useCloseShiftMutation } from "../../hooks/useCloseShiftMutation";
import { activeVariants, productPriceLabel } from "../../lib/productVariants";
import { useLocale, useT } from "../../i18n";
import { useAuth } from "../../store/auth";
import { SCALE_ZOOM, SCALES, useUiScale } from "../../store/uiScale";
import type { CrewMember, Product, ProductVariant, ShiftSale } from "../../types";
import {
  linePrice,
  PRODUCT_PAGE,
  type DiscountDraft,
  type Line,
  type PosPanel,
} from "./types";

export function PosPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const { user, shopId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sid = shopId ?? user?.shop_id ?? 0;
  const scale = useUiScale((s) => s.scale);
  const setScale = useUiScale((s) => s.setScale);
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [cart, setCart] = useState<Line[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [cashOpen, setCashOpen] = useState("");
  const [cashClose, setCashClose] = useState("");
  const [moveAmount, setMoveAmount] = useState("");
  const [panel, setPanel] = useState<PosPanel>("none");
  const [refundTarget, setRefundTarget] = useState<ShiftSale | null>(null);
  const [restoreStock, setRestoreStock] = useState(false);
  const [seller, setSeller] = useState<{ id: number; name: string } | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [registerId, setRegisterId] = useState<number | null>(null);
  const [mobileCartExpanded, setMobileCartExpanded] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [productSearch, setProductSearch] = useState("");
  const debouncedSearch = useDebouncedValue(productSearch, 250);
  const [receiptDiscount, setReceiptDiscount] = useState<Discount | null>(null);
  const [lineDiscountEdit, setLineDiscountEdit] = useState<string | null>(null);
  const [lineDiscountDraft, setLineDiscountDraft] = useState<DiscountDraft>({ type: "percent", value: "" });
  const [receiptDiscountEdit, setReceiptDiscountEdit] = useState(false);
  const [receiptDiscountDraft, setReceiptDiscountDraft] = useState<DiscountDraft>({
    type: "percent",
    value: "",
  });
  const [variantPick, setVariantPick] = useState<Product | null>(null);
  const [findReceiptId, setFindReceiptId] = useState("");
  const [findReceiptError, setFindReceiptError] = useState<string | null>(null);
  const [cashPayOpen, setCashPayOpen] = useState(false);
  const [tendered, setTendered] = useState(0);
  const [headerOpen, setHeaderOpen] = useState(false);

  const shops = useQuery({
    queryKey: ["shops"],
    queryFn: api.shops,
    enabled: Boolean(user) && sid > 0,
  });
  const currentShop = shops.data?.find((s) => s.id === sid) ?? shops.data?.[0];
  const registers = useQuery({
    queryKey: ["cash-registers", sid],
    queryFn: () => api.cashRegisters(sid),
    enabled: Boolean(user) && sid > 0,
  });
  const products = useInfiniteQuery({
    queryKey: ["products", sid, categoryId, debouncedSearch],
    queryFn: ({ pageParam }) =>
      api.products(sid, {
        active_only: true,
        category_id: categoryId === "all" ? undefined : categoryId,
        q: debouncedSearch.trim() || undefined,
        limit: PRODUCT_PAGE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled: Boolean(user) && sid > 0,
  });
  const categories = useQuery({
    queryKey: ["categories", sid],
    queryFn: () => api.categories(sid),
    enabled: Boolean(user) && sid > 0,
  });
  const shift = useQuery({
    queryKey: ["shift", sid, registerId],
    queryFn: () => api.currentShift(sid, registerId ?? undefined),
    enabled: Boolean(user) && sid > 0 && registerId != null,
    refetchInterval: 20_000,
  });
  const crew = useQuery({
    queryKey: ["crew", sid],
    queryFn: () => api.crew(sid),
    enabled: Boolean(user) && sid > 0,
  });

  useEffect(() => {
    if (!user || sid <= 0) return;
    if (user.role === "barista") {
      setSeller({ id: user.id, name: user.full_name });
      return;
    }
    const raw = storageGetMigrated(STORAGE_KEYS.seller(sid).current, STORAGE_KEYS.seller(sid).legacy);
    if (raw) {
      try {
        setSeller(JSON.parse(raw) as { id: number; name: string });
        return;
      } catch {
        /* ignore */
      }
    }
    setSeller({ id: user.id, name: user.full_name });
  }, [user, sid]);

  useEffect(() => {
    const list = registers.data;
    if (!list?.length) return;
    const raw = storageGetMigrated(STORAGE_KEYS.register(sid).current, STORAGE_KEYS.register(sid).legacy);
    const saved = raw ? Number(raw) : NaN;
    if (Number.isFinite(saved) && list.some((r) => r.id === saved)) {
      setRegisterId(saved);
      return;
    }
    setRegisterId(list[0].id);
  }, [registers.data, sid]);

  function pickRegister(id: number) {
    setRegisterId(id);
    storageSetMigrated(STORAGE_KEYS.register(sid).current, STORAGE_KEYS.register(sid).legacy, String(id));
    setCart([]);
    setPanel("none");
  }

  function pickSeller(next: { id: number; name: string }) {
    setSeller(next);
    if (user?.role !== "barista") {
      storageSetMigrated(STORAGE_KEYS.seller(sid).current, STORAGE_KEYS.seller(sid).legacy, JSON.stringify(next));
    }
    setPanel("none");
  }

  function chooseSeller(member: CrewMember) {
    pickSeller({ id: member.id, name: member.full_name });
  }

  const visible = useMemo(
    () => products.data?.pages.flatMap((p) => p.items) ?? [],
    [products.data],
  );

  const totals = cartTotals(
    cart.map((l) => ({ price: linePrice(l), quantity: l.quantity, discount: l.discount })),
    receiptDiscount,
  );
  const total = totals.total;
  const shiftOpen = Boolean(shift.data);
  const revisionId = shift.data?.stock_revision_id ?? null;
  const salesFrozen = Boolean(revisionId);
  const canDiscount =
    user?.role === "owner" || user?.role === "super_admin" || Boolean(user?.can_apply_discount);

  function addWithVariant(product: Product, variant: ProductVariant | null) {
    if (!shiftOpen) {
      setNotice({ tone: "warn", text: t("pos.needShift") });
      setPanel("open");
      return;
    }
    if (salesFrozen) {
      setNotice({
        tone: "warn",
        text: t("pos.revisionSales", { id: revisionId! }),
      });
      return;
    }
    const vId = variant?.id ?? null;
    setCart((prev) => {
      const found = prev.find(
        (l) => l.product.id === product.id && (l.variant?.id ?? null) === vId,
      );
      if (found) {
        return prev.map((l) =>
          l.product.id === product.id && (l.variant?.id ?? null) === vId
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [...prev, { product, variant, quantity: 1 }];
    });
    setVariantPick(null);
  }

  function add(product: Product) {
    const variants = activeVariants(product);
    if (variants.length === 0) {
      addWithVariant(product, null);
      return;
    }
    if (variants.length === 1) {
      addWithVariant(product, variants[0]);
      return;
    }
    if (!shiftOpen) {
      setNotice({ tone: "warn", text: t("pos.needShift") });
      setPanel("open");
      return;
    }
    if (salesFrozen) {
      setNotice({
        tone: "warn",
        text: t("pos.revisionSales", { id: revisionId! }),
      });
      return;
    }
    setVariantPick(product);
  }

  const scanLock = useRef(false);
  async function scanCode(raw: string, { soft = false }: { soft?: boolean } = {}) {
    const code = raw.trim();
    if (!code || sid <= 0 || scanLock.current) return;
    scanLock.current = true;
    try {
      const product = await api.productByCode(sid, code);
      const variants = activeVariants(product);
      const matched =
        variants.find((v) => v.barcode === code) ??
        (variants.length === 1 ? variants[0] : variants.find((v) => v.is_default) ?? null);
      if (variants.length > 1 && !matched) {
        setVariantPick(product);
      } else {
        addWithVariant(product, matched);
      }
      setProductSearch("");
      const label = matched
        ? `${localizedName(product, locale)} — ${localizedName(matched, locale)}`
        : localizedName(product, locale);
      setNotice({
        tone: "ok",
        text: t("pos.scanAdded", { name: label }),
      });
    } catch {
      if (!soft) setNotice({ tone: "warn", text: t("pos.scanNotFound", { code }) });
    } finally {
      scanLock.current = false;
    }
  }

  usePosBarcodeScanner((raw) => scanCode(raw));

  function changeQty(productId: number, variantId: number | null, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.product.id === productId && (l.variant?.id ?? null) === variantId
            ? { ...l, quantity: l.quantity + delta }
            : l,
        )
        .filter((l) => l.quantity > 0),
    );
  }

  function applyDraft(draft: DiscountDraft): Discount | null {
    const value = Number(draft.value.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return null;
    return { type: draft.type, value };
  }

  async function findReceiptById() {
    const id = Number(findReceiptId.trim());
    setFindReceiptError(null);
    if (!Number.isFinite(id) || id <= 0) {
      setFindReceiptError(t("pos.findReceiptNotFound"));
      return;
    }
    try {
      const sale = await api.findSale(sid, id);
      if (sale.is_refunded) {
        setFindReceiptError(t("pos.findReceiptAlready"));
        return;
      }
      setRestoreStock(false);
      setRefundTarget({
        id: sale.id,
        total_amount: sale.total_amount,
        payment_type: sale.payment_type,
        is_refunded: sale.is_refunded,
        created_at: sale.created_at,
        discount_amount: sale.discount_amount,
      });
    } catch {
      setFindReceiptError(t("pos.findReceiptNotFound"));
    }
  }

  const sell = useMutation({
    mutationFn: (payment_type: "cash" | "card") =>
      api.createSale(
        sid,
        cart.map((l) => ({
          product_id: l.product.id,
          variant_id: l.variant?.id ?? null,
          quantity: l.quantity,
          discount: l.discount
            ? { type: l.discount.type, value: Number(l.discount.value) }
            : null,
        })),
        payment_type,
        seller?.id,
        registerId ?? undefined,
        receiptDiscount
          ? { type: receiptDiscount.type, value: Number(receiptDiscount.value) }
          : null,
      ),
    onSuccess: (sale) => {
      const parts = [
        t("pos.saleOk", { amount: money(sale.total_amount), pay: payLabel(sale.payment_type) }),
      ];
      if (sale.discount_amount && Number(sale.discount_amount) > 0) {
        parts.push(t("pos.discountOf", { n: money(sale.discount_amount) }));
      }
      if (sale.alerts.length) {
        parts.push(t("pos.stockLow", { names: sale.alerts.map((a) => a.name).join(", ") }));
      }
      if (sale.fiscal_status === "skipped") {
        parts.push(t("pos.fiscalOff"));
      } else if (sale.fiscal_status === "failed") {
        parts.push(t("pos.fiscalOfd", { error: sale.fiscal_error || t("pos.error") }));
      } else if (sale.fiscal_status === "sent" && sale.fiscal_receipt_url) {
        parts.push(t("pos.fiscalSent"));
      } else if (sale.fiscal_status === "pending") {
        parts.push(t("pos.fiscalPending"));
      }
      setCart([]);
      setReceiptDiscount(null);
      setLineDiscountEdit(null);
      setReceiptDiscountEdit(false);
      setCashPayOpen(false);
      setTendered(0);
      setNotice({
        tone: sale.alerts.length || sale.fiscal_status === "failed" ? "warn" : "ok",
        text: parts.join(" "),
      });
      void qc.invalidateQueries({ queryKey: ["shift", sid, registerId] });
    },
    onError: (err: Error) => setNotice({ tone: "warn", text: err.message }),
  });

  const changeDue = Math.max(0, Math.round((tendered - total) * 100) / 100);
  const tenderEnough = tendered + 1e-9 >= total && total > 0;

  function openCashPay() {
    setCashPayOpen(true);
    setTendered(0);
    setMobileCartExpanded(true);
  }

  function addNote(n: number) {
    setTendered((prev) => Math.round((prev + n) * 100) / 100);
  }

  function resetTender() {
    setCashPayOpen(false);
    setTendered(0);
  }

  const openShift = useMutation({
    mutationFn: () => api.openShift(sid, Number(cashOpen || 0), seller?.id, registerId ?? undefined),
    onSuccess: () => {
      setPanel("none");
      setNotice({ tone: "ok", text: t("pos.shiftOpened") });
      void qc.invalidateQueries({ queryKey: ["shift", sid, registerId] });
      void qc.invalidateQueries({ queryKey: ["cash-registers", sid] });
    },
  });
  const closeShift = useCloseShiftMutation(shift.data?.id, cashClose, (s) => {
    setPanel("none");
    const z = s.z_report_number ? ` ${t("pos.zReport", { n: s.z_report_number })}` : "";
    const diff = Number(s.cash_difference ?? 0);
    setNotice({
      tone: diff === 0 ? "ok" : "warn",
      text:
        (diff === 0
          ? t("pos.shiftClosedOk", { cash: money(s.closing_cash) })
          : t("pos.shiftClosedDiff", {
              expected: money(s.expected_cash),
              counted: money(s.closing_cash),
              diff: money(s.cash_difference),
            })) + z,
    });
    void qc.invalidateQueries({ queryKey: ["shift", sid, registerId] });
    void qc.invalidateQueries({ queryKey: ["cash-registers", sid] });
  });
  const refund = useMutation({
    mutationFn: (restore: boolean) => api.refundSale(sid, refundTarget!.id, restore),
    onSuccess: (sale, restore) => {
      setRefundTarget(null);
      setRestoreStock(false);
      setPanel("none");
      setNotice({
        tone: "ok",
        text: restore
          ? t("pos.refundOkRestored", { id: sale.id })
          : t("pos.refundOkKept", { id: sale.id }),
      });
      void qc.invalidateQueries({ queryKey: ["shift", sid, registerId] });
      void qc.invalidateQueries({ queryKey: ["stock", sid] });
    },
    onError: (err: Error) => setNotice({ tone: "warn", text: err.message }),
  });

  const cashMove = useMutation({
    mutationFn: (type: "deposit" | "withdrawal") =>
      api.cashMove(shift.data!.id, {
        type,
        amount: Number(moveAmount),
        comment: type === "withdrawal" ? t("pos.moveOut") : t("pos.moveIn"),
      }),
    onSuccess: (_, type) => {
      setPanel("none");
      setMoveAmount("");
      setNotice({
        tone: "ok",
        text: type === "deposit" ? t("pos.cashInOk") : t("pos.cashOutOk"),
      });
      void qc.invalidateQueries({ queryKey: ["shift", sid, registerId] });
    },
  });

  function openCashPanel(type: "deposit" | "withdrawal") {
    setMoveAmount("");
    cashMove.reset();
    setPanel(type);
  }

  const closePosPanel = useCallback(() => {
    if (refundTarget) {
      setRefundTarget(null);
      setRestoreStock(false);
      return;
    }
    if (panel === "receipts") {
      setFindReceiptId("");
      setFindReceiptError(null);
    }
    setPanel("none");
  }, [panel, refundTarget]);

  useEffect(() => {
    if (!user || panel !== "none" || receiveOpen || variantPick) return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [user, panel, receiveOpen, variantPick]);

  if (!user) return <Navigate to="/login" replace />;

  const isBarista = user.role === "barista";
  const registerList = registers.data ?? [];
  const currentRegister = registerList.find((r) => r.id === registerId) ?? registerList[0];
  const multiTill = registerList.length > 1;
  const scaleIdx = SCALES.indexOf(scale);
  const sellerName = seller?.name ?? user.full_name;
  const tillName = currentRegister?.name ?? t("pos.tillFallback");

  const panelTitle =
    panel === "open"
      ? t("pos.openShiftTitle")
      : panel === "close"
        ? t("pos.closeShiftTitle")
        : panel === "seller"
          ? t("pos.sellerTitle")
          : panel === "receipts" && refundTarget
            ? t("pos.refundTitle", { id: refundTarget.id })
              : panel === "receipts"
              ? t("pos.receipts")
              : panel === "deposit"
                ? t("pos.drawerInTitle")
                : panel === "withdrawal"
                  ? t("pos.drawerOutTitle")
                  : "";

  const panelHint =
    panel === "open"
      ? currentRegister
        ? t("pos.openShiftHintTill", { name: currentRegister.name })
        : t("pos.openShiftHint")
      : panel === "close"
        ? t("pos.closeShiftHint")
        : panel === "seller"
          ? t("pos.sellerHint")
          : panel === "receipts" && refundTarget
            ? `${money(refundTarget.total_amount)} · ${payLabel(refundTarget.payment_type)}. ${t("pos.refundAlwaysMoney")}`
            : panel === "receipts"
              ? t("pos.receiptsHint")
              : panel === "deposit"
                ? t("pos.drawerInHint")
                : panel === "withdrawal"
                  ? t("pos.drawerOutHint")
                  : undefined;

  const moreItems: Array<{ label: string; onClick?: () => void; disabled?: boolean; custom?: ReactNode }> = [
    {
      label: t("account.scale"),
      custom: (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-ink-soft">{t("account.scale")}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full border border-line-2 text-[15px] disabled:opacity-40"
              disabled={scaleIdx <= 0}
              onClick={() => setScale(SCALES[Math.max(0, scaleIdx - 1)])}
            >
              −
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full border border-line-2 text-[15px] disabled:opacity-40"
              disabled={scaleIdx >= SCALES.length - 1}
              onClick={() => setScale(SCALES[Math.min(SCALES.length - 1, scaleIdx + 1)])}
            >
              +
            </button>
          </div>
        </div>
      ),
    },
    ...(shift.data
      ? [
          {
            label: t("pos.receipts"),
            onClick: () => setPanel("receipts"),
          },
          {
            label: t("pos.moveIn"),
            onClick: () => openCashPanel("deposit"),
          },
          {
            label: t("pos.moveOut"),
            onClick: () => openCashPanel("withdrawal"),
          },
        ]
      : []),
    ...((user.role !== "barista" || user.can_receive_stock)
      ? [
          {
            label: t("pos.receive"),
            disabled: salesFrozen,
            onClick: () => {
              if (salesFrozen) {
                setNotice({
                  tone: "warn" as const,
                  text: t("pos.receiveBlocked", { id: revisionId! }),
                });
                return;
              }
              setReceiveOpen(true);
            },
          },
        ]
      : []),
    ...(user.role !== "barista"
      ? [
          {
            label: t("pos.toCabinet"),
            onClick: () => navigate("/owner"),
          },
        ]
      : []),
  ];

  const sidebar = (
    <PosSidebar
      t={t}
      locale={locale}
      currentShop={currentShop}
      isBarista={isBarista}
      sellerName={sellerName}
      tillName={tillName}
      headerOpen={headerOpen}
      onToggleHeader={() => setHeaderOpen((v) => !v)}
      onOpenSellerPanel={() => setPanel("seller")}
      multiTill={multiTill}
      registerList={registerList}
      registerId={registerId}
      onPickRegister={pickRegister}
      shift={shift.data}
      onOpenShift={() => setPanel("open")}
      onCloseShift={() => {
        setCashClose("");
        setPanel("close");
      }}
      moreItems={moreItems}
      categoryId={categoryId}
      onCategoryChange={setCategoryId}
      categories={categories.data}
      financeOpen={financeOpen}
      onToggleFinance={() => setFinanceOpen((v) => !v)}
    />
  );

  const productsPanel = (
    <PosProductsPanel
      t={t}
      locale={locale}
      productSearch={productSearch}
      onProductSearchChange={setProductSearch}
      searchInputRef={searchInputRef}
      categoryId={categoryId}
      categories={categories.data}
      onCategoryChange={setCategoryId}
      onSearchEnter={() => {
        const code = productSearch.trim();
        if (!code) return;
        void scanCode(code, { soft: !/^[0-9A-Za-z._-]{4,64}$/.test(code) });
      }}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
      shiftOpen={shiftOpen}
      salesFrozen={salesFrozen}
      revisionId={revisionId}
      visible={visible}
      onAddProduct={add}
      productPriceLabel={productPriceLabel}
      hasNextPage={Boolean(products.hasNextPage)}
      isFetchingNextPage={products.isFetchingNextPage}
      onLoadMore={() => void products.fetchNextPage()}
    />
  );

  const cartPanel = (
    <PosCartPanel
      t={t}
      locale={locale}
      cart={cart}
      setCart={setCart}
      canDiscount={canDiscount}
      lineDiscountEdit={lineDiscountEdit}
      setLineDiscountEdit={setLineDiscountEdit}
      lineDiscountDraft={lineDiscountDraft}
      setLineDiscountDraft={setLineDiscountDraft}
      receiptDiscount={receiptDiscount}
      setReceiptDiscount={setReceiptDiscount}
      receiptDiscountEdit={receiptDiscountEdit}
      setReceiptDiscountEdit={setReceiptDiscountEdit}
      receiptDiscountDraft={receiptDiscountDraft}
      setReceiptDiscountDraft={setReceiptDiscountDraft}
      applyDraft={applyDraft}
      changeQty={changeQty}
      totals={totals}
      total={total}
      shiftOpen={shiftOpen}
      salesFrozen={salesFrozen}
      cashPayOpen={cashPayOpen}
      tendered={tendered}
      setTendered={setTendered}
      changeDue={changeDue}
      tenderEnough={tenderEnough}
      sell={sell}
      onOpenCashPay={openCashPay}
      onResetTender={resetTender}
      onAddNote={addNote}
    />
  );

  const mobileCartPanel = (
    <PosCartPanel
      t={t}
      locale={locale}
      cart={cart}
      setCart={setCart}
      canDiscount={canDiscount}
      lineDiscountEdit={lineDiscountEdit}
      setLineDiscountEdit={setLineDiscountEdit}
      lineDiscountDraft={lineDiscountDraft}
      setLineDiscountDraft={setLineDiscountDraft}
      receiptDiscount={receiptDiscount}
      setReceiptDiscount={setReceiptDiscount}
      receiptDiscountEdit={receiptDiscountEdit}
      setReceiptDiscountEdit={setReceiptDiscountEdit}
      receiptDiscountDraft={receiptDiscountDraft}
      setReceiptDiscountDraft={setReceiptDiscountDraft}
      applyDraft={applyDraft}
      changeQty={changeQty}
      totals={totals}
      total={total}
      shiftOpen={shiftOpen}
      salesFrozen={salesFrozen}
      cashPayOpen={cashPayOpen}
      tendered={tendered}
      setTendered={setTendered}
      changeDue={changeDue}
      tenderEnough={tenderEnough}
      sell={sell}
      onOpenCashPay={openCashPay}
      onResetTender={resetTender}
      onAddNote={addNote}
      layout="sheet"
      cartExpanded={mobileCartExpanded}
      onToggleCartExpanded={() => setMobileCartExpanded((v) => !v)}
    />
  );

  return (
    <div className="h-dvh overflow-hidden bg-paper text-ink">
      <SkipLink />
      <div
        className="h-full"
        style={{ zoom: SCALE_ZOOM[scale], height: `calc(100dvh / ${SCALE_ZOOM[scale]})` }}
      >
        <div className="hidden h-full grid-cols-[224px_1fr_340px] gap-px lg:grid">
          {sidebar}
          {productsPanel}
          {cartPanel}
        </div>

        <div className="flex h-full flex-col lg:hidden">
          <PosMobileHeader
            t={t}
            currentShop={currentShop}
            isBarista={isBarista}
            sellerName={sellerName}
            tillName={tillName}
            headerOpen={headerOpen}
            onToggleHeader={() => setHeaderOpen((v) => !v)}
            onOpenSellerPanel={() => setPanel("seller")}
            multiTill={multiTill}
            registerList={registerList}
            registerId={registerId}
            onPickRegister={pickRegister}
            shift={shift.data}
            onOpenShift={() => setPanel("open")}
            onCloseShift={() => {
              setCashClose("");
              setPanel("close");
            }}
            moreItems={moreItems}
            financeOpen={financeOpen}
            onToggleFinance={() => setFinanceOpen((v) => !v)}
          />
          <div className="min-h-0 flex-1 overflow-hidden">{productsPanel}</div>
          {mobileCartPanel}
        </div>
      </div>

      <PosShiftDialog
        t={t}
        locale={locale}
        panel={panel}
        panelTitle={panelTitle}
        panelHint={panelHint}
        onClose={closePosPanel}
        cashOpen={cashOpen}
        onCashOpenChange={setCashOpen}
        openShift={openShift}
        shift={shift.data}
        cashClose={cashClose}
        onCashCloseChange={setCashClose}
        closeShift={closeShift}
        onOpenMovePanel={() => openCashPanel("withdrawal")}
        crew={crew.data}
        sellerId={seller?.id}
        onChooseSeller={chooseSeller}
        findReceiptId={findReceiptId}
        onFindReceiptIdChange={(value) => {
          setFindReceiptId(value);
          setFindReceiptError(null);
        }}
        findReceiptError={findReceiptError}
        onFindReceipt={() => {
          void findReceiptById();
        }}
        refundTarget={refundTarget}
        onRefundTarget={setRefundTarget}
        restoreStock={restoreStock}
        onRestoreStockChange={setRestoreStock}
        refund={refund}
        salesFrozen={salesFrozen}
        revisionId={revisionId}
        moveAmount={moveAmount}
        onMoveAmountChange={setMoveAmount}
        cashMove={cashMove}
      />
      {receiveOpen && <ReceivePanel shopId={sid} onClose={() => setReceiveOpen(false)} />}
      {variantPick && (
        <PosVariantPickDialog
          t={t}
          locale={locale}
          product={variantPick}
          onClose={() => setVariantPick(null)}
          onPick={(variant) => addWithVariant(variantPick, variant)}
        />
      )}
    </div>
  );
}

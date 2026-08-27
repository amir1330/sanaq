import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { ReceivePanel } from "../../components/ReceivePanel";
import { ShopBrand } from "../../components/ShopBrand";
import { Banner, Button, MoreMenu } from "../../components/ui";
import { money, payAction, payLabel } from "../../lib/utils";
import { storageGet, storageSet } from "../../lib/storage";
import { cartTotals, lineGross, lineTotal, type Discount } from "../../lib/discount";
import { dateLocaleTag, localizedName } from "../../lib/i18nName";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useLocale, useT } from "../../i18n";
import { useAuth } from "../../store/auth";
import { SCALE_ZOOM, SCALES, useUiScale } from "../../store/uiScale";
import type { CrewMember, Product, ProductVariant, ShiftSale } from "../../types";

type Line = {
  product: Product;
  variant: ProductVariant | null;
  quantity: number;
  discount?: Discount | null;
};
type MobileTab = "products" | "cart" | "shift";
type DiscountDraft = { type: Discount["type"]; value: string };

function lineKey(productId: number, variantId: number | null | undefined) {
  return `${productId}:${variantId ?? ""}`;
}

function linePrice(line: Line): string {
  return line.variant?.sale_price ?? line.product.sale_price;
}

function activeVariants(product: Product): ProductVariant[] {
  return (product.variants ?? []).filter((v) => v.is_active);
}

function productPriceLabel(product: Product): string {
  const vs = activeVariants(product);
  if (vs.length === 0) return money(product.sale_price);
  if (vs.length === 1) return money(vs[0].sale_price);
  const prices = vs.map((v) => Number(v.sale_price));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
}

const PRODUCT_PAGE = 60;
const CASH_NOTES = [10_000, 5_000, 1_000] as const;

function DiscountEditor({
  draft,
  onChange,
  onApply,
  onCancel,
  applyLabel,
  percentLabel,
  amountLabel,
}: {
  draft: DiscountDraft;
  onChange: (next: DiscountDraft) => void;
  onApply: () => void;
  onCancel: () => void;
  applyLabel: string;
  percentLabel: string;
  amountLabel: string;
}) {
  return (
    <div className="mt-2 space-y-2 rounded-md border border-line bg-paper px-2.5 py-2">
      <div className="flex gap-1">
        <Button
          variant={draft.type === "percent" ? "primary" : "quiet"}
          className="flex-1"
          onClick={() => onChange({ ...draft, type: "percent" })}
        >
          {percentLabel}
        </Button>
        <Button
          variant={draft.type === "amount" ? "primary" : "quiet"}
          className="flex-1"
          onClick={() => onChange({ ...draft, type: "amount" })}
        >
          {amountLabel}
        </Button>
      </div>
      <input
        className="w-full rounded-md border-[1.5px] border-line-2 bg-cream px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
        value={draft.value}
        onChange={(e) => onChange({ ...draft, value: e.target.value })}
        inputMode="decimal"
        autoFocus
      />
      <div className="flex gap-2">
        <Button variant="confirm" className="flex-1" onClick={onApply}>
          {applyLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          ×
        </Button>
      </div>
    </div>
  );
}

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
  const [moveType, setMoveType] = useState<"deposit" | "withdrawal">("withdrawal");
  const [panel, setPanel] = useState<"none" | "open" | "close" | "move" | "seller" | "receipts">("none");
  const [refundTarget, setRefundTarget] = useState<ShiftSale | null>(null);
  const [restoreStock, setRestoreStock] = useState(false);
  const [seller, setSeller] = useState<{ id: number; name: string } | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [registerId, setRegisterId] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("products");
  const [financeOpen, setFinanceOpen] = useState(false);
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
  const [printReceipts, setPrintReceipts] = useState(true);
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
    const raw = storageGet(`coffeeos-seller-${sid}`);
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
    const raw = storageGet(`coffeeos-register-${sid}`);
    const saved = raw ? Number(raw) : NaN;
    if (Number.isFinite(saved) && list.some((r) => r.id === saved)) {
      setRegisterId(saved);
      return;
    }
    setRegisterId(list[0].id);
  }, [registers.data, sid]);

  function pickRegister(id: number) {
    setRegisterId(id);
    storageSet(`coffeeos-register-${sid}`, String(id));
    setCart([]);
    setPanel("none");
  }

  function pickSeller(next: { id: number; name: string }) {
    setSeller(next);
    if (user?.role !== "barista") {
      storageSet(`coffeeos-seller-${sid}`, JSON.stringify(next));
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
      setMobileTab("shift");
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
      setMobileTab("shift");
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
      setMobileTab("cart");
    } catch {
      if (!soft) setNotice({ tone: "warn", text: t("pos.scanNotFound", { code }) });
    } finally {
      scanLock.current = false;
    }
  }
  const scanCodeRef = useRef(scanCode);
  scanCodeRef.current = scanCode;

  useEffect(() => {
    let buf = "";
    let lastAt = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = Boolean(
        target?.closest("input, textarea, select, [contenteditable='true']"),
      );
      if (inField) return;
      if (e.key === "Enter") {
        if (buf.length >= 3) {
          e.preventDefault();
          void scanCodeRef.current(buf);
        }
        buf = "";
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const now = Date.now();
        if (now - lastAt > 80) buf = "";
        buf += e.key;
        lastAt = now;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    setMobileTab("cart");
  }

  function addNote(n: number) {
    setTendered((prev) => Math.round((prev + n) * 100) / 100);
  }

  function resetTender() {
    setCashPayOpen(false);
    setTendered(0);
  }

  const openShift = useMutation({    mutationFn: () => api.openShift(sid, Number(cashOpen || 0), seller?.id, registerId ?? undefined),
    onSuccess: () => {
      setPanel("none");
      setNotice({ tone: "ok", text: t("pos.shiftOpened") });
      void qc.invalidateQueries({ queryKey: ["shift", sid, registerId] });
      void qc.invalidateQueries({ queryKey: ["cash-registers", sid] });
    },
  });
  const closeShift = useMutation({
    mutationFn: (force: boolean) => api.closeShift(shift.data!.id, Number(cashClose || 0), force),
    onSuccess: (s) => {
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
    },
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
    mutationFn: () =>
      api.cashMove(shift.data!.id, {
        type: moveType,
        amount: Number(moveAmount),
        comment: moveType === "withdrawal" ? t("pos.moveOut") : t("pos.moveIn"),
      }),
    onSuccess: () => {
      setPanel("none");
      setMoveAmount("");
      setNotice({
        tone: "ok",
        text: moveType === "deposit" ? t("pos.cashInOk") : t("pos.cashOutOk"),
      });
      void qc.invalidateQueries({ queryKey: ["shift", sid, registerId] });
    },
  });

  if (!user) return <Navigate to="/login" replace />;

  const isBarista = user.role === "barista";
  const registerList = registers.data ?? [];
  const currentRegister = registerList.find((r) => r.id === registerId) ?? registerList[0];
  const multiTill = registerList.length > 1;
  const scaleIdx = SCALES.indexOf(scale);
  const sellerName = seller?.name ?? user.full_name;
  const tillName = currentRegister?.name ?? t("pos.tillFallback");

  const moreItems = [
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
            label: t("pos.drawer"),
            onClick: () => {
              setMoveType("withdrawal" as const);
              setMoveAmount("");
              setPanel("move");
            },
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

  const headerBlock = (
    <div className="space-y-2 rounded-md bg-paper-2 p-2.5">
      <div className="px-1.5 py-1">
        <ShopBrand shop={currentShop} fallback={t("pos.tillFallback")} size="sm" markClass="h-4 w-5 text-gold" />
        {currentShop?.address && (
          <p className="mt-1 truncate text-[12px] text-ink-soft">{currentShop.address}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!isBarista ? (
          <button
            type="button"
            onClick={() => setPanel("seller")}
            className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-ink hover:bg-paper"
            title={t("pos.changeSeller")}
          >
            {sellerName}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate px-2 py-1.5 text-[13px] font-medium text-ink">
            {sellerName}
          </span>
        )}
        <button
          type="button"
          onClick={() => setHeaderOpen((v) => !v)}
          className="shrink-0 rounded-md px-2 py-1.5 text-[12px] text-ink-soft hover:bg-paper hover:text-ink"
          aria-expanded={headerOpen}
        >
          <span className="max-w-[7.5rem] truncate">{tillName}</span>
          <span className="ml-1" aria-hidden>
            {headerOpen ? "▴" : "▾"}
          </span>
        </button>
      </div>
      {headerOpen && (
        <div className="space-y-2 border-t border-line px-1.5 pt-2">
          {multiTill ? (
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                {t("pos.tillLabel")}
              </p>
              {registerList.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickRegister(r.id)}
                  className={`min-h-10 w-full rounded-md px-3 py-2 text-left text-[13px] ${
                    r.id === registerId
                      ? "bg-paper font-semibold text-ink"
                      : "text-ink-soft hover:bg-paper/60"
                  }`}
                >
                  <span className="block">{r.name}</span>
                  <span className="text-[11px] text-faint">
                    {r.has_open_shift || (r.id === registerId && shift.data)
                      ? t("pos.shiftOpen")
                      : t("pos.shiftClosed")}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-ink-soft">
              {tillName}
              {shift.data ? ` · ${t("pos.shiftOpen")}` : ` · ${t("pos.shiftClosed")}`}
            </p>
          )}
          {currentShop && !currentShop.webkassa_enabled && (
            <p className="text-[11px] text-gold">{t("pos.ofdOff")}</p>
          )}
          {(shift.data?.fiscal_pending_count ?? 0) > 0 && (
            <p className="text-[11px] text-gold">
              {t("pos.ofdPending", { n: shift.data?.fiscal_pending_count ?? 0 })}
            </p>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 pt-0.5">
        {shift.data ? (
          <Button
            variant="confirm"
            className="min-w-0 flex-1"
            onClick={() => {
              setCashClose("");
              setPanel("close");
            }}
          >
            {t("pos.closeShift")}
          </Button>
        ) : (
          <Button variant="confirm" className="min-w-0 flex-1" onClick={() => setPanel("open")}>
            {t("pos.openShift")}
          </Button>
        )}
        <MoreMenu label="⋮" items={moreItems} />
      </div>
    </div>
  );

  const categoriesBlock = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-1 pb-2">
        <button
          type="button"
          className={`min-h-11 w-full rounded-md px-3.5 py-[11px] text-left text-[13.5px] ${
            categoryId === "all" ? "bg-paper-2 font-semibold text-ink" : "text-ink-soft"
          }`}
          onClick={() => {
            setCategoryId("all");
            setMobileTab("products");
          }}
        >
          {t("pos.allProducts")}
        </button>
        {categories.data?.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`min-h-11 w-full rounded-md px-3.5 py-[11px] text-left text-[13.5px] ${
              categoryId === c.id ? "bg-paper-2 font-semibold text-ink" : "text-ink-soft"
            }`}
            onClick={() => {
              setCategoryId(c.id);
              setMobileTab("products");
            }}
          >
            {localizedName(c, locale)}
          </button>
        ))}
      </div>
    </div>
  );

  const shiftOpsBlock = shift.data ? (
    <div className="space-y-2.5 text-[12.5px]">
      <button
        type="button"
        onClick={() => setFinanceOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md bg-paper-2 px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="text-ink-soft">{t("pos.cashNow")}</span>
          <span className="font-mono font-semibold text-ink">{money(shift.data.expected_cash)}</span>
        </span>
        <span className="text-ink-soft" aria-hidden>
          {financeOpen ? "▲" : "▼"}
        </span>
      </button>
      {financeOpen && (
        <div className="rounded-md bg-paper-2 px-4 py-3.5">
          <div className="flex justify-between py-1">
            <span>{t("pay.cash")}</span>
            <span className="font-mono font-semibold text-gold">{money(shift.data.cash_revenue)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>{t("pay.card")}</span>
            <span className="font-mono font-semibold text-turq">{money(shift.data.card_revenue)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>{t("pos.receipts")}</span>
            <span className="font-mono font-semibold">{shift.data.sales_count}</span>
          </div>
          <div className="mt-2 border-t border-line pt-2">
            <div className="flex justify-between py-1">
              <span className="text-ink">{t("pos.cashNow")}</span>
              <span className="font-mono font-semibold">{money(shift.data.expected_cash)}</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-faint">
              {t("pos.start", { n: money(shift.data.opening_cash) })}
              {Number(shift.data.cash_revenue) ? t("pos.plusCash", { n: money(shift.data.cash_revenue) }) : ""}
              {Number(shift.data.deposits) ? t("pos.plusIn", { n: money(shift.data.deposits) }) : ""}
              {Number(shift.data.withdrawals) ? t("pos.minusOut", { n: money(shift.data.withdrawals) }) : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  ) : null;

  const leftColumn = (
    <aside className="flex h-full flex-col gap-3 overflow-hidden px-[18px] py-6">
      <div className="shrink-0 space-y-3">
        {headerBlock}
        {shiftOpsBlock}
      </div>
      <div className="min-h-0 flex-1 border-t border-line pt-3">{categoriesBlock}</div>
    </aside>
  );

  const productsColumn = (
    <section className="flex h-full flex-col overflow-hidden bg-paper-2">
      <div className="sticky top-0 z-10 border-b border-line bg-paper-2 p-4 sm:px-6 sm:pt-6 sm:pb-3">
        <input
          className="w-full rounded-md border-[1.5px] border-line-2 bg-paper px-4 py-2.5 text-[14px] text-ink outline-none focus:border-ink"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const code = productSearch.trim();
            if (!code) return;
            // Exact barcode → cart; plain text search stays as filter
            void scanCode(code, { soft: !/^[0-9A-Za-z._-]{4,64}$/.test(code) });
          }}
          placeholder={t("pos.searchProducts")}
          autoComplete="off"
          enterKeyHint="done"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 sm:pt-3">
        {notice && (
          <Banner tone={notice.tone}>
            {notice.text}{" "}
            <button type="button" className="underline" onClick={() => setNotice(null)}>
              {t("pos.hide")}
            </button>
          </Banner>
        )}
        {!shiftOpen && <Banner tone="warn">{t("pos.closedBanner")}</Banner>}
        {salesFrozen && <Banner tone="warn">{t("pos.revisionBanner", { id: revisionId! })}</Banner>}
        <div className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-2 md:grid-cols-3">
          {visible.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p)}
              className={`min-h-[5.5rem] rounded-lg border-[1.5px] border-transparent bg-paper px-3 py-4 text-left text-ink transition hover:-translate-y-0.5 hover:border-gold sm:px-4 sm:py-[18px] ${!shiftOpen || salesFrozen ? "opacity-50" : ""}`}
            >
              <p className="truncate font-mono text-[9.5px] uppercase tracking-wide text-ink-soft">
                {localizedName(
                  {
                    name: p.category_name ?? "",
                    name_kk: p.category_name_kk,
                    name_en: p.category_name_en,
                  },
                  locale,
                )}
              </p>
              <p className="mt-2 break-words text-[14.5px] font-medium leading-snug">{localizedName(p, locale)}</p>
              {p.barcode ? (
                <p className="mt-1 font-mono text-[11px] text-ink-soft">{p.barcode}</p>
              ) : null}
              <p className="mt-3 font-mono text-sm font-semibold text-gold">{productPriceLabel(p)}</p>
            </button>
          ))}
        </div>
        {products.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="quiet"
              disabled={products.isFetchingNextPage}
              onClick={() => void products.fetchNextPage()}
            >
              {products.isFetchingNextPage ? t("common.loading") : t("common.loadMore")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );

  const cartColumn = (
    <aside className="flex h-full flex-col overflow-y-auto px-5 py-6">
      <h4 className="mb-4 shrink-0 font-display text-[19px] font-normal">{t("pos.cart")}</h4>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {cart.length === 0 && (
          <p className="py-5 text-center text-[13px] text-ink-soft">{t("pos.cartEmpty")}</p>
        )}
        {cart.map((l) => {
          const key = lineKey(l.product.id, l.variant?.id);
          const price = linePrice(l);
          const gross = lineGross(price, l.quantity);
          const net = lineTotal(price, l.quantity, l.discount);
          const hasDisc = Boolean(l.discount && Number(l.discount.value) > 0);
          const title = l.variant
            ? `${localizedName(l.product, locale)} — ${localizedName(l.variant, locale)}`
            : localizedName(l.product, locale);
          return (
            <div key={key} className="rounded-md bg-paper-2 px-3.5 py-2.5 text-[13.5px]">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-base leading-none text-ink lg:h-[22px] lg:w-[22px] lg:text-xs"
                    onClick={() => changeQty(l.product.id, l.variant?.id ?? null, -1)}
                  >
                    −
                  </button>
                  <span className="min-w-[1.25rem] text-center">{l.quantity}</span>
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-base leading-none text-ink lg:h-[22px] lg:w-[22px] lg:text-xs"
                    onClick={() => changeQty(l.product.id, l.variant?.id ?? null, 1)}
                  >
                    +
                  </button>
                </div>
                <span className="min-w-0 flex-1 break-words">{title}</span>
                <span className="shrink-0 text-right font-mono font-semibold text-gold">
                  {hasDisc ? (
                    <>
                      <span className="block text-[11px] font-normal text-ink-soft line-through">
                        {money(gross)}
                      </span>
                      {money(net)}
                    </>
                  ) : (
                    money(net)
                  )}
                </span>
              </div>
              {hasDisc && (
                <p className="mt-1 text-[11px] text-ink-soft">
                  {t("pos.discountOf", { n: money(gross - net) })}
                </p>
              )}
              {canDiscount && (
                <div className="mt-1.5">
                  {lineDiscountEdit === key ? (
                    <DiscountEditor
                      draft={lineDiscountDraft}
                      onChange={setLineDiscountDraft}
                      applyLabel={t("pos.discountApply")}
                      percentLabel={t("pos.discountPercent")}
                      amountLabel={t("pos.discountAmount")}
                      onApply={() => {
                        const next = applyDraft(lineDiscountDraft);
                        setCart((prev) =>
                          prev.map((row) =>
                            lineKey(row.product.id, row.variant?.id) === key
                              ? { ...row, discount: next }
                              : row,
                          ),
                        );
                        setLineDiscountEdit(null);
                      }}
                      onCancel={() => setLineDiscountEdit(null)}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-[11px] text-ink-soft underline"
                        onClick={() => {
                          setLineDiscountEdit(key);
                          setLineDiscountDraft({
                            type: l.discount?.type ?? "percent",
                            value: l.discount ? String(l.discount.value) : "",
                          });
                        }}
                      >
                        {hasDisc ? t("pos.discountItem") : t("pos.discountAdd")}
                      </button>
                      {hasDisc && (
                        <button
                          type="button"
                          className="text-[11px] text-maroon underline"
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((row) =>
                                lineKey(row.product.id, row.variant?.id) === key
                                  ? { ...row, discount: null }
                                  : row,
                              ),
                            )
                          }
                        >
                          {t("pos.discountRemove")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 mt-3.5 border-t border-line bg-paper pt-4">
        {canDiscount && (
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span className="text-ink-soft">{t("pos.discountReceipt")}</span>
              {receiptDiscount && Number(receiptDiscount.value) > 0 ? (
                <button
                  type="button"
                  className="text-maroon underline"
                  onClick={() => {
                    setReceiptDiscount(null);
                    setReceiptDiscountEdit(false);
                  }}
                >
                  {t("pos.discountRemove")}
                </button>
              ) : (
                <button
                  type="button"
                  className="underline text-ink-soft"
                  onClick={() => {
                    setReceiptDiscountEdit(true);
                    setReceiptDiscountDraft({ type: "percent", value: "" });
                  }}
                >
                  {t("pos.discountAdd")}
                </button>
              )}
            </div>
            {receiptDiscount && Number(receiptDiscount.value) > 0 && !receiptDiscountEdit && (
              <p className="text-[12px] text-ink-soft">
                {receiptDiscount.type === "percent"
                  ? `${receiptDiscount.value}%`
                  : money(receiptDiscount.value)}{" "}
                → −{money(totals.receiptDiscount)}
              </p>
            )}
            {receiptDiscountEdit && (
              <DiscountEditor
                draft={receiptDiscountDraft}
                onChange={setReceiptDiscountDraft}
                applyLabel={t("pos.discountApply")}
                percentLabel={t("pos.discountPercent")}
                amountLabel={t("pos.discountAmount")}
                onApply={() => {
                  setReceiptDiscount(applyDraft(receiptDiscountDraft));
                  setReceiptDiscountEdit(false);
                }}
                onCancel={() => setReceiptDiscountEdit(false)}
              />
            )}
          </div>
        )}
        <div className="mb-3 space-y-1.5 rounded-md border border-line bg-paper-2 px-3 py-3 font-mono text-[13px]">
          <div className="flex justify-between text-ink-soft">
            <span>{t("pos.subtotal")}</span>
            <span>{money(totals.subtotal)}</span>
          </div>
          {totals.discountTotal > 0 && (
            <div className="flex justify-between text-ink-soft">
              <span>{t("pos.discountItem")}</span>
              <span>−{money(totals.discountTotal)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between text-ink">
            <span>{t("pos.toPay")}</span>
            <b className="text-[22px] font-semibold">{money(total)}</b>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>{t("pos.amountReceived")}</span>
            <span>{money(cashPayOpen || tendered > 0 ? tendered : 0)}</span>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>{t("pos.changeDue")}</span>
            <span className={changeDue > 0 ? "font-semibold text-ink" : ""}>{money(changeDue)}</span>
          </div>
          <label className="mt-1 flex cursor-pointer items-center gap-2 font-sans text-[12.5px] text-ink-soft">
            <input
              type="checkbox"
              className="h-4 w-4 accent-maroon"
              checked={printReceipts}
              onChange={(e) => setPrintReceipts(e.target.checked)}
            />
            <span>{t("pos.printReceipts")}</span>
          </label>
        </div>

        {cashPayOpen ? (
          <div className="mb-3 space-y-2.5 rounded-md border border-line bg-cream px-3 py-3">
            <p className="font-sans text-[12.5px] text-ink-soft">{t("pos.tenderHint")}</p>
            <input
              className="w-full rounded-md border-[1.5px] border-line-2 bg-paper px-3 py-2.5 font-mono text-[18px] text-ink outline-none focus:border-ink"
              value={tendered ? String(tendered) : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
                const n = Number(raw);
                setTendered(Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0);
              }}
              inputMode="decimal"
              placeholder="0"
              autoFocus
            />
            <div className="grid grid-cols-3 gap-2">
              {CASH_NOTES.map((n) => (
                <Button key={n} variant="quiet" className="w-full font-mono" onClick={() => addNote(n)}>
                  +{n.toLocaleString("ru-RU")}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="quiet" onClick={() => setTendered(total)} disabled={total <= 0}>
                {t("pos.tenderExact")}
              </Button>
              <Button variant="ghost" onClick={() => setTendered(0)}>
                {t("pos.tenderClear")}
              </Button>
            </div>
            <Button
              variant="confirm"
              size="lg"
              className="w-full"
              disabled={!shiftOpen || salesFrozen || !tenderEnough || sell.isPending}
              onClick={() => sell.mutate("cash")}
            >
              {sell.isPending ? t("pos.writing") : t("pos.confirmCash")}
            </Button>
            <Button variant="ghost" className="w-full" onClick={resetTender}>
              {t("common.cancel")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="confirm"
              size="lg"
              className="w-full"
              disabled={!shiftOpen || salesFrozen || cart.length === 0 || sell.isPending}
              onClick={openCashPay}
            >
              {payAction("cash")}
            </Button>
            <Button
              variant="sky"
              size="lg"
              className="w-full"
              disabled={!shiftOpen || salesFrozen || cart.length === 0 || sell.isPending}
              onClick={() => {
                resetTender();
                sell.mutate("card");
              }}
            >
              {payAction("card")}
            </Button>
          </div>
        )}
        {cart.length > 0 && (
          <Button
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => {
              setCart([]);
              setReceiptDiscount(null);
              resetTender();
            }}
          >
            {t("pos.clearCart")}
          </Button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="h-dvh overflow-hidden bg-paper text-ink">
      <div
        className="h-full"
        style={{ zoom: SCALE_ZOOM[scale], height: `calc(100dvh / ${SCALE_ZOOM[scale]})` }}
      >
        <div className="hidden h-full grid-cols-[224px_1fr_340px] gap-px lg:grid">
          {leftColumn}
          {productsColumn}
          {cartColumn}
        </div>

        <div className="flex h-full flex-col lg:hidden">
          <div className="min-h-0 flex-1 overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
            <div className={`h-full ${mobileTab === "shift" ? "block" : "hidden"}`}>{leftColumn}</div>
            <div className={`h-full ${mobileTab === "products" ? "block" : "hidden"}`}>{productsColumn}</div>
            <div className={`h-full ${mobileTab === "cart" ? "block" : "hidden"}`}>{cartColumn}</div>
          </div>
          <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-3 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
            {(
              [
                { id: "products" as const, label: t("pos.tabProducts") },
                { id: "cart" as const, label: t("pos.tabCart") },
                { id: "shift" as const, label: t("pos.tabShift") },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTab(tab.id)}
                className={`flex min-h-14 flex-col items-center justify-center text-[12.5px] font-semibold ${
                  mobileTab === tab.id ? "bg-paper-2 text-ink" : "text-ink-soft"
                }`}
              >
                {tab.label}
                {tab.id === "cart" && cart.length > 0 && (
                  <span className="mt-0.5 font-mono text-[10px] text-gold">{cart.length}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {panel !== "none" && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-roast/70 p-4">
          <div className="w-full max-w-sm rounded-lg bg-paper p-7 text-ink shadow-soft">
            {panel === "open" && (
              <>
                <h2 className="font-display text-2xl font-normal">{t("pos.openShiftTitle")}</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  {currentRegister
                    ? t("pos.openShiftHintTill", { name: currentRegister.name })
                    : t("pos.openShiftHint")}
                </p>
                <label className="mt-5 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  {t("pos.cashInDrawer")}
                  <input
                    className="mt-2 w-full rounded-md border-[1.5px] border-line-2 bg-cream px-4 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
                    value={cashOpen}
                    onChange={(e) => setCashOpen(e.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    autoFocus
                  />
                </label>
                <div className="mt-6 flex gap-3">
                  <Button variant="confirm" className="flex-1" onClick={() => openShift.mutate()}>
                    {t("pos.openShift")}
                  </Button>
                  <Button variant="ghost" className="text-ink-soft" onClick={() => setPanel("none")}>
                    {t("common.back")}
                  </Button>
                </div>
              </>
            )}
            {panel === "close" && (
              <>
                <h2 className="font-display text-2xl font-normal">{t("pos.closeShiftTitle")}</h2>
                <p className="mt-2 text-sm text-ink-soft">{t("pos.closeShiftHint")}</p>
                <div className="mt-4 rounded-md bg-paper-2 px-4 py-3 text-sm">
                  <div className="flex justify-between py-0.5">
                    <span className="text-ink-soft">{t("pos.closeStart")}</span>
                    <span className="font-mono">{money(shift.data?.opening_cash)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-ink-soft">{t("pos.closeCashSales")}</span>
                    <span className="font-mono">{money(shift.data?.cash_revenue)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-ink-soft">{t("pos.closeDeposits")}</span>
                    <span className="font-mono">{money(shift.data?.deposits)}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-ink-soft">{t("pos.closeWithdrawals")}</span>
                    <span className="font-mono">{money(shift.data?.withdrawals)}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-line pt-2 font-medium">
                    <span>{t("pos.closeExpected")}</span>
                    <span className="font-mono">{money(shift.data?.expected_cash)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-3 text-left text-[13px] text-ink-soft underline hover:text-ink"
                  onClick={() => {
                    setMoveType("withdrawal");
                    setMoveAmount("");
                    setPanel("move");
                  }}
                >
                  {t("pos.closeWithdrawFirst")}
                </button>
                <label className="mt-4 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  {t("pos.closeCounted")}
                  <input
                    className="mt-2 w-full rounded-md border-[1.5px] border-line-2 bg-cream px-4 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
                    value={cashClose}
                    onChange={(e) => setCashClose(e.target.value)}
                    placeholder={String(shift.data?.expected_cash ?? "")}
                    inputMode="decimal"
                    autoFocus
                  />
                </label>
                {(shift.data?.fiscal_pending_count ?? 0) > 0 && (
                  <p className="mt-3 text-sm text-alert">
                    {t("pos.closePendingOfd", { n: shift.data?.fiscal_pending_count ?? 0 })}
                  </p>
                )}
                {closeShift.isError && <p className="mt-3 text-sm text-alert">{(closeShift.error as Error).message}</p>}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    variant="confirm"
                    className="flex-1"
                    disabled={cashClose.trim() === "" || closeShift.isPending}
                    onClick={() => closeShift.mutate(false)}
                  >
                    {t("pos.closeShift")}
                  </Button>
                  <Button variant="ghost" className="text-ink-soft" onClick={() => setPanel("none")}>
                    {t("common.back")}
                  </Button>
                  {closeShift.isError && (
                    <Button variant="danger" onClick={() => closeShift.mutate(true)}>
                      {t("pos.closeAnyway")}
                    </Button>
                  )}
                </div>
              </>
            )}
            {panel === "seller" && (
              <>
                <h2 className="font-display text-2xl font-normal">{t("pos.sellerTitle")}</h2>
                <p className="mt-2 text-sm text-ink-soft">{t("pos.sellerHint")}</p>
                <div className="mt-4">
                  {(crew.data ?? []).map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className={`block w-full border-b border-line py-2.5 text-left text-sm ${
                        seller?.id === member.id ? "text-ink" : "text-ink-soft"
                      }`}
                      onClick={() => chooseSeller(member)}
                    >
                      {member.full_name}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" className="mt-4 text-ink-soft" onClick={() => setPanel("none")}>
                  {t("common.back")}
                </Button>
              </>
            )}
            {panel === "receipts" && !refundTarget && (
              <>
                <h2 className="font-display text-2xl font-normal">{t("pos.receipts")}</h2>
                <p className="mt-2 text-sm text-ink-soft">{t("pos.receiptsHint")}</p>
                <div className="mt-4 rounded-md border border-line bg-paper-2 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                    {t("pos.findReceipt")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-md border-[1.5px] border-line-2 bg-cream px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
                      value={findReceiptId}
                      onChange={(e) => {
                        setFindReceiptId(e.target.value);
                        setFindReceiptError(null);
                      }}
                      placeholder={t("pos.findReceiptPh")}
                      inputMode="numeric"
                    />
                    <Button
                      variant="quiet"
                      onClick={() => {
                        void findReceiptById();
                      }}
                    >
                      {t("pos.findReceiptGo")}
                    </Button>
                  </div>
                  {findReceiptError && <p className="mt-2 text-sm text-alert">{findReceiptError}</p>}
                </div>
                <div className="mt-4 max-h-72 overflow-auto">
                  {(shift.data?.sales ?? []).length === 0 && (
                    <p className="py-4 text-sm text-ink-soft">{t("pos.noReceipts")}</p>
                  )}
                  {(shift.data?.sales ?? []).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between border-b border-line py-2.5 text-sm">
                      <div>
                        <p className={sale.is_refunded ? "text-ink-soft line-through" : ""}>
                          №{sale.id} · {money(sale.total_amount)} · {payLabel(sale.payment_type)}
                          {sale.discount_amount && Number(sale.discount_amount) > 0
                            ? ` · ${t("pos.discountOf", { n: money(sale.discount_amount) })}`
                            : ""}
                        </p>
                        <p className="font-mono text-[10px] text-faint">
                          {new Date(sale.created_at).toLocaleTimeString(dateLocaleTag(locale), {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {sale.barista_name ? ` · ${sale.barista_name}` : ""}
                        </p>
                      </div>
                      {!sale.is_refunded && (
                        <button
                          type="button"
                          className="underline"
                          onClick={() => {
                            setRestoreStock(false);
                            setRefundTarget(sale);
                          }}
                        >
                          {t("pos.refund")}
                        </button>
                      )}
                      {sale.is_refunded && <span className="text-ink-soft">{t("pos.refunded")}</span>}
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  className="mt-4 text-ink-soft"
                  onClick={() => {
                    setPanel("none");
                    setFindReceiptId("");
                    setFindReceiptError(null);
                  }}
                >
                  {t("common.back")}
                </Button>
              </>
            )}
            {panel === "receipts" && refundTarget && (
              <>
                <h2 className="font-display text-2xl font-normal">
                  {t("pos.refundTitle", { id: refundTarget.id })}
                </h2>
                <p className="mt-2 text-sm text-ink-soft">
                  {money(refundTarget.total_amount)} · {payLabel(refundTarget.payment_type)}. {t("pos.refundAlwaysMoney")}
                </p>
                <fieldset className="mt-5 space-y-3">
                  <legend className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                    {t("pos.refundAsk")}
                  </legend>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line-2 px-3 py-3 has-[:checked]:border-ink">
                    <input
                      type="radio"
                      className="mt-1"
                      name="refund-stock"
                      checked={!restoreStock}
                      onChange={() => setRestoreStock(false)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{t("pos.refundGiven")}</span>
                      <span className="mt-0.5 block text-[13px] text-ink-soft">{t("pos.refundGivenNote")}</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line-2 px-3 py-3 has-[:checked]:border-ink">
                    <input
                      type="radio"
                      className="mt-1"
                      name="refund-stock"
                      checked={restoreStock}
                      onChange={() => setRestoreStock(true)}
                    />
                    <span>
                      <span className="block text-sm font-medium">{t("pos.refundKept")}</span>
                      <span className="mt-0.5 block text-[13px] text-ink-soft">{t("pos.refundKeptNote")}</span>
                    </span>
                  </label>
                </fieldset>
                {refund.isError && <p className="mt-3 text-sm text-alert">{(refund.error as Error).message}</p>}
                {salesFrozen && (
                  <p className="mt-3 text-sm text-alert">{t("pos.refundRevision", { id: revisionId! })}</p>
                )}
                <div className="mt-6 flex gap-3">
                  <Button
                    variant="danger"
                    className="flex-1"
                    disabled={refund.isPending || salesFrozen}
                    onClick={() => refund.mutate(restoreStock)}
                  >
                    {refund.isPending ? t("pos.refundPending") : t("pos.refundSubmit")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-ink-soft"
                    onClick={() => {
                      setRefundTarget(null);
                      setRestoreStock(false);
                    }}
                  >
                    {t("common.back")}
                  </Button>
                </div>
              </>
            )}
            {panel === "move" && (
              <>
                <h2 className="font-display text-2xl font-normal">
                  {moveType === "withdrawal" ? t("pos.drawerOutTitle") : t("pos.drawerInTitle")}
                </h2>
                <p className="mt-2 text-sm text-ink-soft">
                  {moveType === "withdrawal" ? t("pos.drawerOutHint") : t("pos.drawerInHint")}
                </p>
                <p className="mt-3 rounded-md bg-paper-2 px-3 py-2 font-mono text-[13px]">
                  {t("pos.drawerNow", { n: money(shift.data?.expected_cash) })}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant={moveType === "deposit" ? "confirm" : "quiet"}
                    className="flex-1"
                    onClick={() => setMoveType("deposit")}
                  >
                    {t("pos.moveIn")}
                  </Button>
                  <Button
                    variant={moveType === "withdrawal" ? "danger" : "quiet"}
                    className="flex-1"
                    onClick={() => setMoveType("withdrawal")}
                  >
                    {t("pos.moveOut")}
                  </Button>
                </div>
                <label className="mt-5 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  {t("expenses.amount")}, ₸
                  <input
                    className="mt-2 w-full rounded-md border-[1.5px] border-line-2 bg-cream px-4 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
                    value={moveAmount}
                    onChange={(e) => setMoveAmount(e.target.value)}
                    inputMode="decimal"
                    autoFocus
                  />
                </label>
                {Number(moveAmount) > 0 && (
                  <p className="mt-3 text-sm text-ink-soft">
                    {t("pos.afterMove", {
                      n: money(
                        Number(shift.data?.expected_cash ?? 0) +
                          (moveType === "deposit" ? Number(moveAmount) : -Number(moveAmount)),
                      ),
                    })}
                  </p>
                )}
                {cashMove.isError && (
                  <p className="mt-3 text-sm text-alert">{(cashMove.error as Error).message}</p>
                )}
                <div className="mt-6 flex gap-3">
                  <Button
                    variant={moveType === "withdrawal" ? "danger" : "confirm"}
                    className="flex-1"
                    disabled={!moveAmount || Number(moveAmount) <= 0 || cashMove.isPending}
                    onClick={() => cashMove.mutate()}
                  >
                    {cashMove.isPending
                      ? t("pos.writing")
                      : moveType === "withdrawal"
                        ? t("pos.moveOut")
                        : t("pos.moveIn")}
                  </Button>
                  <Button variant="ghost" className="text-ink-soft" onClick={() => setPanel("none")}>
                    {t("common.back")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {receiveOpen && <ReceivePanel shopId={sid} onClose={() => setReceiveOpen(false)} />}
      {variantPick && (
        <div
          className="fixed inset-0 z-40 grid place-items-end bg-roast/50 p-0 sm:place-items-center sm:p-4"
          onClick={() => setVariantPick(null)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-t-lg bg-paper p-6 shadow-soft sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-2xl font-normal">{t("pos.pickVariant")}</h2>
            <p className="text-sm text-mute">
              {t("pos.pickVariantHint", { name: localizedName(variantPick, locale) })}
            </p>
            <div className="grid gap-2">
              {activeVariants(variantPick).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="flex items-center justify-between rounded-md border-[1.5px] border-line bg-cream px-4 py-3 text-left hover:border-ink"
                  onClick={() => addWithVariant(variantPick, v)}
                >
                  <span className="font-medium">{localizedName(v, locale)}</span>
                  <span className="font-mono font-semibold text-gold">{money(v.sale_price)}</span>
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setVariantPick(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { ReceivePanel } from "../../components/ReceivePanel";
import { ShopBrand } from "../../components/ShopBrand";
import { Banner, Button } from "../../components/ui";
import { money, payAction, payLabel } from "../../lib/utils";
import { storageGet, storageSet } from "../../lib/storage";
import { dateLocaleTag, localizedName } from "../../lib/i18nName";
import { useLocale, useT } from "../../i18n";
import { useAuth } from "../../store/auth";
import { SCALE_ZOOM, useUiScale, type UiScale } from "../../store/uiScale";
import type { CrewMember, Product, ShiftSale } from "../../types";

type Line = { product: Product; quantity: number };
type MobileTab = "products" | "cart" | "shift";

const SCALES: UiScale[] = ["sm", "md", "lg", "xl"];

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
  const products = useQuery({
    queryKey: ["products", sid],
    queryFn: () => api.products(sid),
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

  const visible = useMemo(() => {
    const list = (products.data ?? []).filter((p) => p.is_active);
    if (categoryId === "all") return list;
    return list.filter((p) => p.category_id === categoryId);
  }, [products.data, categoryId]);

  const total = cart.reduce((s, l) => s + Number(l.product.sale_price) * l.quantity, 0);
  const shiftOpen = Boolean(shift.data);
  const revisionId = shift.data?.stock_revision_id ?? null;
  const salesFrozen = Boolean(revisionId);

  function add(product: Product) {
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
    setCart((prev) => {
      const found = prev.find((l) => l.product.id === product.id);
      if (found) return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(id: number, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  const sell = useMutation({
    mutationFn: (payment_type: "cash" | "card") =>
      api.createSale(
        sid,
        cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        payment_type,
        seller?.id,
        registerId ?? undefined,
      ),
    onSuccess: (sale) => {
      const parts = [
        t("pos.saleOk", { amount: money(sale.total_amount), pay: payLabel(sale.payment_type) }),
      ];
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
      setNotice({
        tone: sale.alerts.length || sale.fiscal_status === "failed" ? "warn" : "ok",
        text: parts.join(" "),
      });
      void qc.invalidateQueries({ queryKey: ["shift", sid, registerId] });
    },
    onError: (err: Error) => setNotice({ tone: "warn", text: err.message }),
  });

  const openShift = useMutation({
    mutationFn: () => api.openShift(sid, Number(cashOpen || 0), seller?.id, registerId ?? undefined),
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
  const scaleLabels: Record<UiScale, string> = {
    sm: t("account.scaleSm"),
    md: t("account.scaleMd"),
    lg: t("account.scaleLg"),
    xl: t("account.scaleXl"),
  };

  const headerBlock = (
    <div className="space-y-3 rounded-md bg-paper-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 rounded-md bg-paper px-3 py-2.5">
            <ShopBrand shop={currentShop} fallback={t("pos.tillFallback")} size="md" markClass="h-5 w-7 text-gold" />
          </div>
          {currentShop?.address && (
            <p className="mt-1.5 px-1 text-[11px] text-ink-soft">{currentShop.address}</p>
          )}
        </div>
      </div>
      <div>
        <p className="mb-1.5 px-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
          {t("account.scale")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SCALES.map((s) => (
            <Button key={s} variant={scale === s ? "primary" : "quiet"} onClick={() => setScale(s)}>
              {scaleLabels[s]}
            </Button>
          ))}
        </div>
      </div>
      {multiTill && (
        <div className="space-y-1.5">
          <p className="px-1 text-[10px] font-mono uppercase tracking-wider text-ink-soft">{t("pos.tillLabel")}</p>
          <div className="flex flex-col gap-1">
            {registerList.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pickRegister(r.id)}
                className={`min-h-11 rounded-md px-3.5 py-2.5 text-left text-[13px] ${
                  r.id === registerId
                    ? "bg-paper font-semibold text-ink"
                    : "text-ink-soft hover:bg-paper/60"
                }`}
              >
                <span className="block">{r.name}</span>
                <span className="text-[11px] text-faint">
                  {r.has_open_shift || (r.id === registerId && shift.data) ? t("pos.shiftOpen") : t("pos.shiftClosed")}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!multiTill && currentRegister && (
        <p className="px-1 text-[11px] text-ink-soft">{currentRegister.name}</p>
      )}
      {currentShop && !currentShop.webkassa_enabled && (
        <p className="px-1 text-[11px] text-gold">{t("pos.ofdOff")}</p>
      )}
      {(shift.data?.fiscal_pending_count ?? 0) > 0 && (
        <p className="px-1 text-[11px] text-gold">
          {t("pos.ofdPending", { n: shift.data?.fiscal_pending_count ?? 0 })}
        </p>
      )}
      <div className="flex min-h-11 items-center justify-between rounded-full bg-paper py-2 pl-4 pr-2 text-[12.5px]">
        <span>{seller?.name ?? user.full_name}</span>
        {!isBarista && (
          <Button variant="gold" onClick={() => setPanel("seller")}>
            {t("pos.changeSeller")}
          </Button>
        )}
      </div>
    </div>
  );

  const categoriesBlock = (
    <div className="border-t border-line pt-4">
      <div className="max-h-[40vh] space-y-1 overflow-y-auto">
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

  const shiftOpsBlock = (
    <div className="sticky bottom-0 space-y-2.5 border-t border-line bg-paper pt-3 text-[12.5px]">
      {shift.data ? (
        <>
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
          <Button variant="quiet" className="w-full" onClick={() => setPanel("receipts")}>
            {t("pos.receipts")}
          </Button>
          <Button
            variant="quiet"
            className="w-full"
            onClick={() => {
              setMoveType("withdrawal");
              setMoveAmount("");
              setPanel("move");
            }}
          >
            {t("pos.drawer")}
          </Button>
          <Button
            variant="confirm"
            className="w-full"
            onClick={() => {
              setCashClose("");
              setPanel("close");
            }}
          >
            {t("pos.closeShift")}
          </Button>
        </>
      ) : (
        <Button variant="confirm" className="w-full" onClick={() => setPanel("open")}>
          {t("pos.openShift")}
        </Button>
      )}
      <div className="space-y-2 border-t border-line pt-2.5">
        {(user.role !== "barista" || user.can_receive_stock) && (
          <Button
            variant="quiet"
            className="w-full"
            onClick={() => {
              if (salesFrozen) {
                setNotice({
                  tone: "warn",
                  text: t("pos.receiveBlocked", { id: revisionId! }),
                });
                return;
              }
              setReceiveOpen(true);
            }}
            disabled={salesFrozen}
          >
            {t("pos.receive")}
          </Button>
        )}
        {user.role !== "barista" && (
          <Button variant="ghost" className="w-full justify-start px-0" onClick={() => navigate("/owner")}>
            {t("pos.toCabinet")}
          </Button>
        )}
      </div>
    </div>
  );

  const leftColumn = (
    <aside className="flex h-full flex-col gap-4 overflow-y-auto px-[18px] py-6">
      {headerBlock}
      {categoriesBlock}
      {shiftOpsBlock}
    </aside>
  );

  const productsColumn = (
    <section className="h-full overflow-y-auto bg-paper-2 p-4 sm:p-6">
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
            <p className="mt-3 font-mono text-sm font-semibold text-gold">{money(p.sale_price)}</p>
          </button>
        ))}
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
        {cart.map((l) => (
          <div
            key={l.product.id}
            className="flex items-center gap-2.5 rounded-md bg-paper-2 px-3.5 py-2.5 text-[13.5px]"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-base leading-none text-ink lg:h-[22px] lg:w-[22px] lg:text-xs"
                onClick={() => changeQty(l.product.id, -1)}
              >
                −
              </button>
              <span className="min-w-[1.25rem] text-center">{l.quantity}</span>
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-base leading-none text-ink lg:h-[22px] lg:w-[22px] lg:text-xs"
                onClick={() => changeQty(l.product.id, 1)}
              >
                +
              </button>
            </div>
            <span className="min-w-0 flex-1 break-words">{localizedName(l.product, locale)}</span>
            <span className="shrink-0 font-mono font-semibold text-gold">
              {money(Number(l.product.sale_price) * l.quantity)}
            </span>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 mt-3.5 border-t border-line bg-paper pt-4">
        <div className="mb-[18px] flex items-baseline justify-between text-[13px] text-ink-soft">
          <span>{t("pos.toPay")}</span>
          <b className="font-mono text-[25px] font-semibold text-ink">{money(total)}</b>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="confirm"
            size="lg"
            className="w-full"
            disabled={!shiftOpen || salesFrozen || cart.length === 0 || sell.isPending}
            onClick={() => sell.mutate("cash")}
          >
            {payAction("cash")}
          </Button>
          <Button
            variant="sky"
            size="lg"
            className="w-full"
            disabled={!shiftOpen || salesFrozen || cart.length === 0 || sell.isPending}
            onClick={() => sell.mutate("card")}
          >
            {payAction("card")}
          </Button>
        </div>
        {cart.length > 0 && (
          <Button variant="ghost" className="mt-3 w-full" onClick={() => setCart([])}>
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
                <div className="mt-4 max-h-72 overflow-auto">
                  {(shift.data?.sales ?? []).length === 0 && (
                    <p className="py-4 text-sm text-ink-soft">{t("pos.noReceipts")}</p>
                  )}
                  {(shift.data?.sales ?? []).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between border-b border-line py-2.5 text-sm">
                      <div>
                        <p className={sale.is_refunded ? "text-ink-soft line-through" : ""}>
                          №{sale.id} · {money(sale.total_amount)} · {payLabel(sale.payment_type)}
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
                <Button variant="ghost" className="mt-4 text-ink-soft" onClick={() => setPanel("none")}>
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
    </div>
  );
}

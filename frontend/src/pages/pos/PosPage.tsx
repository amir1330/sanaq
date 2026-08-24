import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { ReceivePanel } from "../../components/ReceivePanel";
import { ShopBrand } from "../../components/ShopBrand";
import { Banner, Button } from "../../components/ui";
import { rememberPosShop, rememberedPosShop } from "../../lib/posShop";
import { money, payAction, payLabel } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { CrewMember, Product, ShiftSale } from "../../types";
import { PosClockIn } from "./PosClockIn";

type Line = { product: Product; quantity: number };

export function PosPage() {
  const { user, shopId } = useAuth();
  const remembered = rememberedPosShop();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sid = shopId ?? user?.shop_id ?? 0;
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
  const [sellerPin, setSellerPin] = useState("");
  const [sellerError, setSellerError] = useState("");
  const [pendingSeller, setPendingSeller] = useState<CrewMember | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const shops = useQuery({
    queryKey: ["shops"],
    queryFn: api.shops,
    enabled: Boolean(user) && sid > 0,
  });
  const currentShop = shops.data?.find((s) => s.id === sid) ?? shops.data?.[0];
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
    queryKey: ["shift", sid],
    queryFn: () => api.currentShift(sid),
    enabled: Boolean(user) && sid > 0,
  });
  const crew = useQuery({
    queryKey: ["crew", sid],
    queryFn: () => api.crew(sid),
    enabled: Boolean(user) && sid > 0,
  });

  useEffect(() => {
    if (!user || sid <= 0) return;
    const raw = localStorage.getItem(`coffeeos-seller-${sid}`);
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
    if (sid > 0) rememberPosShop(sid);
  }, [sid]);

  function pickSeller(next: { id: number; name: string }) {
    setSeller(next);
    localStorage.setItem(`coffeeos-seller-${sid}`, JSON.stringify(next));
    setPanel("none");
    setSellerPin("");
    setSellerError("");
    setPendingSeller(null);
  }

  async function chooseSeller(member: CrewMember) {
    setSellerError("");
    if (user?.role !== "barista" || member.id === user.id) {
      pickSeller({ id: member.id, name: member.full_name });
      return;
    }
    setPendingSeller(member);
  }

  async function confirmSellerPin() {
    if (!pendingSeller) return;
    setSellerError("");
    try {
      const found = await api.identifyPin(sid, sellerPin);
      if (found.id !== pendingSeller.id) {
        setSellerError("Этот PIN от другого человека.");
        return;
      }
      setPendingSeller(null);
      pickSeller({ id: found.id, name: found.full_name });
    } catch {
      setSellerError("Неверный PIN.");
    }
  }

  const visible = useMemo(() => {
    const list = (products.data ?? []).filter((p) => p.is_active);
    if (categoryId === "all") return list;
    return list.filter((p) => p.category_id === categoryId);
  }, [products.data, categoryId]);

  const total = cart.reduce((s, l) => s + Number(l.product.sale_price) * l.quantity, 0);
  const shiftOpen = Boolean(shift.data);

  function add(product: Product) {
    if (!shiftOpen) {
      setNotice({ tone: "warn", text: "Сначала открой смену — иначе пробить чек нельзя." });
      setPanel("open");
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
      ),
    onSuccess: (sale) => {
      const extra = sale.alerts.length
        ? ` На складе мало: ${sale.alerts.map((a) => a.name).join(", ")}.`
        : "";
      setCart([]);
      const fiscal =
        sale.fiscal_status === "skipped"
          ? " Фискальный чек не отправляется — Webkassa выключена."
          : sale.fiscal_status === "failed"
            ? ` ОФД: ${sale.fiscal_error || "ошибка"}`
            : sale.fiscal_status === "sent" && sale.fiscal_receipt_url
              ? " Чек ушёл в ОФД."
              : sale.fiscal_status === "pending"
                ? " Фискальный чек уходит в фоне."
                : "";
      setNotice({
        tone: sale.alerts.length || sale.fiscal_status === "failed" ? "warn" : "ok",
        text: `Чек пробит · ${money(sale.total_amount)} · ${payLabel(sale.payment_type)}.${extra}${fiscal}`,
      });
      void qc.invalidateQueries({ queryKey: ["shift", sid] });
    },
    onError: (err: Error) => setNotice({ tone: "warn", text: err.message }),
  });

  const openShift = useMutation({
    mutationFn: () => api.openShift(sid, Number(cashOpen || 0), seller?.id),
    onSuccess: () => {
      setPanel("none");
      setNotice({ tone: "ok", text: "Смена открыта. Можно продавать." });
      void qc.invalidateQueries({ queryKey: ["shift", sid] });
    },
  });
  const closeShift = useMutation({
    mutationFn: (force: boolean) => api.closeShift(shift.data!.id, Number(cashClose || 0), force),
    onSuccess: (s) => {
      setPanel("none");
      const z = s.z_report_number ? ` Z-отчёт ${s.z_report_number} ушёл в ОФД.` : "";
      const diff = Number(s.cash_difference ?? 0);
      setNotice({
        tone: diff === 0 ? "ok" : "warn",
        text:
          diff === 0
            ? `Смена закрыта. Касса сошлась: ${money(s.closing_cash)}.${z}`
            : `Смена закрыта. В ящике должно быть ${money(s.expected_cash)}, пересчитали ${money(s.closing_cash)}. Расхождение ${money(s.cash_difference)}.${z}`,
      });
      void qc.invalidateQueries({ queryKey: ["shift", sid] });
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
          ? `Чек ${sale.id} возвращён, остаток вернулся на склад.`
          : `Чек ${sale.id} возвращён. Склад не трогали — товар уже отдали.`,
      });
      void qc.invalidateQueries({ queryKey: ["shift", sid] });
      void qc.invalidateQueries({ queryKey: ["stock", sid] });
    },
    onError: (err: Error) => setNotice({ tone: "warn", text: err.message }),
  });

  const cashMove = useMutation({
    mutationFn: () =>
      api.cashMove(shift.data!.id, {
        type: moveType,
        amount: Number(moveAmount),
        comment: moveType === "withdrawal" ? "Изъятие" : "Внесение",
      }),
    onSuccess: () => {
      setPanel("none");
      setMoveAmount("");
      setNotice({
        tone: "ok",
        text: moveType === "deposit" ? "Наличные внесены в ящик." : "Наличные изъяты из ящика.",
      });
      void qc.invalidateQueries({ queryKey: ["shift", sid] });
    },
  });

  if (!user) return <PosClockIn shopId={remembered} />;

  return (
    <div className="grid min-h-screen grid-cols-1 bg-paper text-ink lg:grid-cols-[224px_1fr_340px] lg:gap-px">
      <aside className="flex flex-col gap-5 px-[18px] py-6">
        <div className="flex items-center gap-2.5 rounded-md bg-paper-2 px-3.5 py-3">
          <ShopBrand shop={currentShop} fallback="Касса" size="md" markClass="h-5 w-7 text-gold" />
        </div>
        {currentShop?.address && (
          <p className="-mt-3 px-3.5 text-[11px] text-ink-soft">{currentShop.address}</p>
        )}
        {currentShop && !currentShop.webkassa_enabled && (
          <p className="px-3.5 text-[11px] text-gold">ОФД выключен — чеки не фискализируются</p>
        )}
        {(shift.data?.fiscal_pending_count ?? 0) > 0 && (
          <p className="px-3.5 text-[11px] text-gold">
            Не ушло в Webkassa: {shift.data?.fiscal_pending_count}
          </p>
        )}
        <div className="flex items-center justify-between rounded-full bg-paper-2 py-2 pl-4 pr-2 text-[12.5px]">
          <span>{seller?.name ?? user?.full_name}</span>
          <button
            className="rounded-full bg-gold px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-roast"
            onClick={() => setPanel("seller")}
          >
            Сменить
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <button
            className={`rounded-md px-3.5 py-[11px] text-left text-[13.5px] ${
              categoryId === "all" ? "bg-paper-2 font-semibold text-ink" : "text-ink-soft"
            }`}
            onClick={() => setCategoryId("all")}
          >
            Все товары
          </button>
          {categories.data?.map((c) => (
            <button
              key={c.id}
              className={`rounded-md px-3.5 py-[11px] text-left text-[13.5px] ${
                categoryId === c.id ? "bg-paper-2 font-semibold text-ink" : "text-ink-soft"
              }`}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="space-y-2.5 text-[12.5px]">
          {shift.data ? (
            <>
              <div className="rounded-md bg-paper-2 px-4 py-3.5">
                <div className="flex justify-between py-1">
                  <span>Наличными</span>
                  <span className="font-mono font-semibold text-gold">{money(shift.data.cash_revenue)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Безналично</span>
                  <span className="font-mono font-semibold text-turq">{money(shift.data.card_revenue)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Чеков</span>
                  <span className="font-mono font-semibold">{shift.data.sales_count}</span>
                </div>
              </div>
              <button
                className="w-full rounded-full border-[1.5px] border-line py-3 text-[12.5px] text-ink-soft hover:border-ink hover:bg-ink hover:text-paper"
                onClick={() => setPanel("receipts")}
              >
                Чеки смены
              </button>
              <button
                className="w-full rounded-full border-[1.5px] border-line py-3 text-[12.5px] text-ink-soft hover:border-ink hover:bg-ink hover:text-paper"
                onClick={() => setPanel("move")}
              >
                Внести / изъять
              </button>
              <button
                className="w-full rounded-full border-[1.5px] border-gold py-3 text-[12.5px] text-gold hover:bg-gold hover:text-roast"
                onClick={() => setPanel("close")}
              >
                Закрыть смену
              </button>
            </>
          ) : (
            <button
              className="w-full rounded-full border-[1.5px] border-gold py-3 text-[12.5px] text-gold hover:bg-gold hover:text-roast"
              onClick={() => setPanel("open")}
            >
              Открыть смену
            </button>
          )}
          {(user?.role !== "barista" || user?.can_receive_stock) && (
            <button
              className="w-full rounded-full border-[1.5px] border-line py-3 text-[12.5px] text-ink-soft hover:border-ink hover:bg-ink hover:text-paper"
              onClick={() => setReceiveOpen(true)}
            >
              Приёмка
            </button>
          )}
          {user?.role !== "barista" && (
            <button
              className="pt-1 text-left text-[12.5px] text-ink-soft hover:text-ink"
              onClick={() => navigate("/owner")}
            >
              В кабинет
            </button>
          )}
        </div>
      </aside>

      <section className="overflow-auto bg-paper-2 p-6">
        {notice && (
          <Banner tone={notice.tone}>
            {notice.text}{" "}
            <button className="underline" onClick={() => setNotice(null)}>
              скрыть
            </button>
          </Banner>
        )}
        {!shiftOpen && (
          <Banner tone="warn">Смена закрыта. Открой смену — потом можно продавать.</Banner>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {visible.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p)}
              className={`rounded-lg border-[1.5px] border-transparent bg-paper px-4 py-[18px] text-left text-ink transition hover:-translate-y-0.5 hover:border-gold ${!shiftOpen ? "opacity-50" : ""}`}
            >
              <p className="font-mono text-[9.5px] uppercase tracking-wide text-ink-soft">{p.category_name}</p>
              <p className="mt-2 text-[14.5px] font-medium">{p.name}</p>
              <p className="mt-3 font-mono text-sm font-semibold text-gold">{money(p.sale_price)}</p>
            </button>
          ))}
        </div>
      </section>

      <aside className="flex flex-col px-5 py-6">
        <h4 className="mb-4 font-display text-[19px] font-normal">Чек</h4>
        <div className="flex min-h-[200px] flex-1 flex-col gap-2 overflow-auto">
          {cart.length === 0 && (
            <p className="py-5 text-center text-[13px] text-ink-soft">Чек пустой — коснитесь товара слева</p>
          )}
          {cart.map((l) => (
            <div key={l.product.id} className="flex items-center gap-2.5 rounded-md bg-paper-2 px-3.5 py-2.5 text-[13.5px]">
              <div className="flex items-center gap-2">
                <button
                  className="h-[22px] w-[22px] rounded-full border border-line text-xs leading-none text-ink"
                  onClick={() => changeQty(l.product.id, -1)}
                >
                  −
                </button>
                <span>{l.quantity}</span>
                <button
                  className="h-[22px] w-[22px] rounded-full border border-line text-xs leading-none text-ink"
                  onClick={() => changeQty(l.product.id, 1)}
                >
                  +
                </button>
              </div>
              <span className="flex-1">{l.product.name}</span>
              <span className="font-mono font-semibold text-gold">{money(Number(l.product.sale_price) * l.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3.5 border-t border-line pt-4">
          <div className="mb-[18px] flex items-baseline justify-between text-[13px] text-ink-soft">
            <span>К оплате</span>
            <b className="font-mono text-[25px] font-semibold text-ink">{money(total)}</b>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              disabled={!shiftOpen || cart.length === 0 || sell.isPending}
              onClick={() => sell.mutate("cash")}
              className="rounded-full bg-gold py-[15px] text-[13px] font-bold text-roast hover:bg-sun-hot disabled:opacity-40"
            >
              {payAction("cash")}
            </button>
            <button
              disabled={!shiftOpen || cart.length === 0 || sell.isPending}
              onClick={() => sell.mutate("card")}
              className="rounded-full bg-turq py-[15px] text-[13px] font-bold text-roast hover:bg-sky-deep disabled:opacity-40"
            >
              {payAction("card")}
            </button>
          </div>
          {cart.length > 0 && (
            <button className="mt-3 w-full text-center text-sm text-ink-soft underline" onClick={() => setCart([])}>
              Очистить чек
            </button>
          )}
        </div>
      </aside>

      {panel !== "none" && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-roast/70 p-4">
          <div className="w-full max-w-sm rounded-lg bg-paper p-7 text-ink shadow-soft">
            {panel === "open" && (
              <>
                <h2 className="font-display text-2xl font-normal">Открыть смену</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  Пересчитай купюры в ящике и впиши сумму. Это стартовая касса.
                </p>
                <label className="mt-5 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  Наличные в ящике, ₸
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
                  <Button className="flex-1 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper" onClick={() => openShift.mutate()}>
                    Открыть смену
                  </Button>
                  <Button variant="ghost" className="text-ink-soft" onClick={() => setPanel("none")}>
                    Назад
                  </Button>
                </div>
              </>
            )}
            {panel === "close" && (
              <>
                <h2 className="font-display text-2xl font-normal">Закрыть смену</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  По продажам в ящике должно быть {money(shift.data?.expected_cash)}. Пересчитай факт.
                </p>
                <label className="mt-5 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  Сколько наличных насчитал, ₸
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
                    {shift.data?.fiscal_pending_count} чеков ещё не в ОФД. Закрытие без этого — риск штрафа.
                  </p>
                )}
                {closeShift.isError && <p className="mt-3 text-sm text-alert">{(closeShift.error as Error).message}</p>}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button className="flex-1 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper" onClick={() => closeShift.mutate(false)}>
                    Закрыть смену
                  </Button>
                  <Button variant="ghost" className="text-ink-soft" onClick={() => setPanel("none")}>
                    Назад
                  </Button>
                  {closeShift.isError && (
                    <Button variant="danger" onClick={() => closeShift.mutate(true)}>
                      Закрыть всё равно
                    </Button>
                  )}
                </div>
              </>
            )}
            {panel === "seller" && (
              <>
                <h2 className="font-display text-2xl font-normal">Кто на кассе</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  Ящик общий. Чеки пишутся на того, кого выберешь.
                </p>
                <div className="mt-4">
                  {(crew.data ?? []).map((member) => (
                    <button
                      key={member.id}
                      className={`block w-full border-b border-line py-2.5 text-left text-sm ${
                        seller?.id === member.id ? "text-ink" : "text-ink-soft"
                      }`}
                      onClick={() => void chooseSeller(member)}
                    >
                      {member.full_name}
                    </button>
                  ))}
                </div>
                {pendingSeller && (
                  <label className="mt-5 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                    PIN · {pendingSeller.full_name}
                    <input
                      className="mt-2 w-full rounded-md border-[1.5px] border-line-2 bg-cream px-4 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
                      value={sellerPin}
                      onChange={(e) => setSellerPin(e.target.value)}
                      inputMode="numeric"
                      autoFocus
                    />
                    <Button
                      className="mt-4 w-full border-ink bg-transparent text-ink hover:bg-ink hover:text-paper"
                      disabled={sellerPin.length < 4}
                      onClick={() => void confirmSellerPin()}
                    >
                      Это я
                    </Button>
                  </label>
                )}
                {sellerError && <p className="mt-2 text-sm text-alert">{sellerError}</p>}
                <Button variant="ghost" className="mt-4 text-ink-soft" onClick={() => setPanel("none")}>
                  Назад
                </Button>
              </>
            )}
            {panel === "receipts" && !refundTarget && (
              <>
                <h2 className="font-display text-2xl font-normal">Чеки смены</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  Возврат по умолчанию только деньги. На склад — только если товар ещё не отдали.
                </p>
                <div className="mt-4 max-h-72 overflow-auto">
                  {(shift.data?.sales ?? []).length === 0 && (
                    <p className="py-4 text-sm text-ink-soft">Пока нет чеков.</p>
                  )}
                  {(shift.data?.sales ?? []).map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between border-b border-line py-2.5 text-sm">
                      <div>
                        <p className={sale.is_refunded ? "text-ink-soft line-through" : ""}>
                          №{sale.id} · {money(sale.total_amount)} · {payLabel(sale.payment_type)}
                        </p>
                        <p className="font-mono text-[10px] text-faint">
                          {new Date(sale.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          {sale.barista_name ? ` · ${sale.barista_name}` : ""}
                        </p>
                      </div>
                      {!sale.is_refunded && (
                        <button
                          className="underline"
                          onClick={() => {
                            setRestoreStock(false);
                            setRefundTarget(sale);
                          }}
                        >
                          Вернуть
                        </button>
                      )}
                      {sale.is_refunded && <span className="text-ink-soft">возврат</span>}
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="mt-4 text-ink-soft" onClick={() => setPanel("none")}>
                  Назад
                </Button>
              </>
            )}
            {panel === "receipts" && refundTarget && (
              <>
                <h2 className="font-display text-2xl font-normal">Вернуть чек №{refundTarget.id}</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  {money(refundTarget.total_amount)} · {payLabel(refundTarget.payment_type)}. Если уже отдали —
                  склад не трогаем, иначе на бумаге появится то, чего нет.
                </p>
                <label className="mt-5 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={restoreStock}
                    onChange={(e) => setRestoreStock(e.target.checked)}
                  />
                  <span>Товар не отдали, вернуть на склад</span>
                </label>
                {refund.isError && <p className="mt-3 text-sm text-alert">{(refund.error as Error).message}</p>}
                <div className="mt-6 flex gap-3">
                  <Button
                    className="flex-1 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper"
                    disabled={refund.isPending}
                    onClick={() => refund.mutate(restoreStock)}
                  >
                    Вернуть
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-ink-soft"
                    onClick={() => {
                      setRefundTarget(null);
                      setRestoreStock(false);
                    }}
                  >
                    Назад
                  </Button>
                </div>
              </>
            )}
            {panel === "move" && (
              <>
                <h2 className="font-display text-2xl font-normal">Наличные в ящике</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  Внести — положил размен. Изъять — забрал в сейф.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-px border border-line bg-line">
                  <button
                    className={`py-3 text-[12.5px] ${moveType === "deposit" ? "bg-ink text-paper" : "bg-paper text-ink-soft"}`}
                    onClick={() => setMoveType("deposit")}
                  >
                    Внести
                  </button>
                  <button
                    className={`py-3 text-[12.5px] ${moveType === "withdrawal" ? "bg-ink text-paper" : "bg-paper text-ink-soft"}`}
                    onClick={() => setMoveType("withdrawal")}
                  >
                    Изъять
                  </button>
                </div>
                <label className="mt-5 block font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  Сумма, ₸
                  <input
                    className="mt-2 w-full rounded-md border-[1.5px] border-line-2 bg-cream px-4 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
                    value={moveAmount}
                    onChange={(e) => setMoveAmount(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <div className="mt-6 flex gap-3">
                  <Button
                    className="flex-1 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper"
                    disabled={!moveAmount}
                    onClick={() => cashMove.mutate()}
                  >
                    Записать
                  </Button>
                  <Button variant="ghost" className="text-ink-soft" onClick={() => setPanel("none")}>
                    Назад
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

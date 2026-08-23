import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { ReceivePanel } from "../../components/ReceivePanel";
import { ShopBrand } from "../../components/ShopBrand";
import { Banner, Button } from "../../components/ui";
import { money, payAction, payLabel } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { CrewMember, Product } from "../../types";

type Line = { product: Product; quantity: number };

export function PosPage() {
  const { user, shopId, logout } = useAuth();
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
  const [panel, setPanel] = useState<"none" | "open" | "close" | "move" | "seller">("none");
  const [seller, setSeller] = useState<{ id: number; name: string } | null>(null);
  const [sellerPin, setSellerPin] = useState("");
  const [sellerError, setSellerError] = useState("");
  const [pendingSeller, setPendingSeller] = useState<CrewMember | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const shops = useQuery({
    queryKey: ["shops"],
    queryFn: api.shops,
    enabled: sid > 0,
  });
  const currentShop = shops.data?.find((s) => s.id === sid) ?? shops.data?.[0];
  const products = useQuery({
    queryKey: ["products", sid],
    queryFn: () => api.products(sid),
    enabled: sid > 0,
  });
  const categories = useQuery({
    queryKey: ["categories", sid],
    queryFn: () => api.categories(sid),
    enabled: sid > 0,
  });
  const shift = useQuery({
    queryKey: ["shift", sid],
    queryFn: () => api.currentShift(sid),
    enabled: sid > 0,
  });
  const crew = useQuery({
    queryKey: ["crew", sid],
    queryFn: () => api.crew(sid),
    enabled: sid > 0,
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
    const list = products.data ?? [];
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
      setNotice({
        tone: sale.alerts.length ? "warn" : "ok",
        text: `Чек пробит · ${money(sale.total_amount)} · ${payLabel(sale.payment_type)}.${extra}`,
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
    mutationFn: () => api.closeShift(shift.data!.id, Number(cashClose || 0)),
    onSuccess: (s) => {
      setPanel("none");
      const diff = Number(s.cash_difference ?? 0);
      setNotice({
        tone: diff === 0 ? "ok" : "warn",
        text:
          diff === 0
            ? `Смена закрыта. Касса сошлась: ${money(s.closing_cash)}.`
            : `Смена закрыта. В ящике должно быть ${money(s.expected_cash)}, пересчитали ${money(s.closing_cash)}. Расхождение ${money(s.cash_difference)}.`,
      });
      void qc.invalidateQueries({ queryKey: ["shift", sid] });
    },
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

  return (
    <div className="grid min-h-screen grid-cols-1 bg-paper lg:grid-cols-[220px_1fr_360px]">
      <aside className="border-r border-line bg-foam p-5">
        <ShopBrand shop={currentShop} fallback="Касса" size="md" />
        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-mute">Касса</p>
        <button className="mt-1 text-left" onClick={() => setPanel("seller")}>
          <p className="text-lg font-medium">{seller?.name ?? user?.full_name}</p>
          <p className="text-sm text-sky underline">Сменить человека</p>
        </button>
        <div className="mt-8 space-y-1">
          <p className="px-3 pb-1 text-[11px] uppercase tracking-wider text-mute">Категории</p>
          <button
            className={`block w-full px-3 py-2 text-left text-sm ${categoryId === "all" ? "bg-ink text-paper" : "text-mute hover:text-ink"}`}
            onClick={() => setCategoryId("all")}
          >
            Всё меню
          </button>
          {categories.data?.map((c) => (
            <button
              key={c.id}
              className={`block w-full px-3 py-2 text-left text-sm ${categoryId === c.id ? "bg-ink text-paper" : "text-mute hover:text-ink"}`}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-10 space-y-2 text-sm">
          {shift.data ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-sky">Смена открыта</p>
              <p>Наличный {money(shift.data.cash_revenue)}</p>
              <p>Безналичный {money(shift.data.card_revenue)}</p>
              <p className="text-mute">{shift.data.sales_count} чеков за смену</p>
              {(shift.data.sellers ?? []).map((row) => (
                <p key={row.barista_id} className="text-mute">
                  {row.barista_name}: {money(row.revenue)}
                </p>
              ))}
              <Button variant="foam" className="w-full" onClick={() => setPanel("move")}>
                Внести / изъять наличные
              </Button>
              <Button variant="ink" className="w-full" onClick={() => setPanel("close")}>
                Закрыть смену
              </Button>
            </>
          ) : (
            <Button className="w-full" onClick={() => setPanel("open")}>
              Открыть смену
            </Button>
          )}
          {(user?.role !== "barista" || user?.can_receive_stock) && (
            <Button variant="foam" className="w-full" onClick={() => setReceiveOpen(true)}>
              Приёмка товара
            </Button>
          )}
          <button
            className="w-full text-left text-sm text-mute underline"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Выйти
          </button>
        </div>
      </aside>

      <section className="relative p-4">
        {notice && (
          <Banner tone={notice.tone}>
            {notice.text}{" "}
            <button className="underline" onClick={() => setNotice(null)}>
              скрыть
            </button>
          </Banner>
        )}
        {!shiftOpen && (
          <Banner tone="warn">
            Смена закрыта. Нажми «Открыть смену», посчитай наличные в ящике — потом можно продавать.
          </Banner>
        )}
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p)}
              className={`aspect-[5/4] bg-foam p-4 text-left transition hover:bg-paper ${!shiftOpen ? "opacity-50" : ""}`}
            >
              <p className="text-[11px] uppercase tracking-wider text-mute">{p.category_name}</p>
              <p className="mt-3 text-lg font-medium leading-tight">{p.name}</p>
              <p className="mt-6 text-sm text-sky">{money(p.sale_price)}</p>
            </button>
          ))}
        </div>
      </section>

      <aside className="border-l border-line bg-foam">
        <div className="flex h-full flex-col px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Текущий чек</p>
          <p className="mt-1 text-sm text-mute">Нажми товар слева, чтобы добавить</p>
          <div className="mt-5 min-h-[200px] flex-1 space-y-2">
            {cart.length === 0 && (
              <p className="border border-dashed border-line px-3 py-8 text-center text-sm text-mute">
                Чек пустой
              </p>
            )}
            {cart.map((l) => (
              <div key={l.product.id} className="flex items-center gap-2 border border-line px-2 py-2 text-sm">
                <button
                  className="h-9 w-9 border border-line text-lg"
                  onClick={() => changeQty(l.product.id, -1)}
                  aria-label="Убрать одну"
                >
                  −
                </button>
                <span className="flex-1">
                  {l.product.name}
                  <span className="mt-0.5 block text-xs text-mute">
                    {l.quantity} × {money(l.product.sale_price)}
                  </span>
                </span>
                <span>{money(Number(l.product.sale_price) * l.quantity)}</span>
                <button
                  className="h-9 w-9 border border-line text-lg"
                  onClick={() => changeQty(l.product.id, 1)}
                  aria-label="Добавить ещё"
                >
                  +
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-line pt-4">
            <div className="flex items-end justify-between">
              <span className="text-sm text-mute">К оплате</span>
              <span className="text-2xl font-medium text-sun">{money(total)}</span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <Button
                variant="ink"
                className="h-14 text-base"
                disabled={!shiftOpen || cart.length === 0 || sell.isPending}
                onClick={() => sell.mutate("cash")}
              >
                {payAction("cash")}
              </Button>
              <Button
                variant="sky"
                className="h-14 text-base"
                disabled={!shiftOpen || cart.length === 0 || sell.isPending}
                onClick={() => sell.mutate("card")}
              >
                {payAction("card")}
              </Button>
            </div>
            <p className="mt-2 text-xs text-mute">
              Безнал — карта, Kaspi, перевод. Нал — купюры в ящик.
            </p>
            {cart.length > 0 && (
              <button className="mt-3 w-full text-center text-sm text-mute underline" onClick={() => setCart([])}>
                Очистить чек
              </button>
            )}
          </div>
        </div>
      </aside>

      {panel !== "none" && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4">
          <div className="w-full max-w-sm border border-line bg-foam p-6">
            {panel === "open" && (
              <>
                <h2 className="text-2xl font-medium">Открыть смену</h2>
                <p className="mt-2 text-sm text-mute">
                  Пересчитай купюры в ящике и впиши сумму. Это стартовая касса.
                </p>
                <label className="mt-4 block text-sm text-mute">
                  Наличные в ящике сейчас, ₸
                  <input
                    className="mt-1 w-full border border-line px-3 py-2 text-ink"
                    value={cashOpen}
                    onChange={(e) => setCashOpen(e.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    autoFocus
                  />
                </label>
                <div className="mt-4 flex gap-2">
                  <Button className="flex-1" onClick={() => openShift.mutate()}>
                    Открыть смену
                  </Button>
                  <Button variant="ghost" onClick={() => setPanel("none")}>
                    Назад
                  </Button>
                </div>
              </>
            )}
            {panel === "close" && (
              <>
                <h2 className="text-2xl font-medium">Закрыть смену</h2>
                <p className="mt-2 text-sm text-mute">
                  По продажам в ящике должно быть {money(shift.data?.expected_cash)}. Пересчитай факт.
                </p>
                <label className="mt-4 block text-sm text-mute">
                  Сколько наличных насчитал, ₸
                  <input
                    className="mt-1 w-full border border-line px-3 py-2"
                    value={cashClose}
                    onChange={(e) => setCashClose(e.target.value)}
                    placeholder={String(shift.data?.expected_cash ?? "")}
                    inputMode="decimal"
                    autoFocus
                  />
                </label>
                <div className="mt-4 flex gap-2">
                  <Button className="flex-1" onClick={() => closeShift.mutate()}>
                    Закрыть смену
                  </Button>
                  <Button variant="ghost" onClick={() => setPanel("none")}>
                    Назад
                  </Button>
                </div>
              </>
            )}
            {panel === "seller" && (
              <>
                <h2 className="text-2xl font-medium">Кто на кассе</h2>
                <p className="mt-2 text-sm text-mute">
                  Ящик общий. Чеки пишутся на того, кого выберешь. Смену закрывать не надо.
                </p>
                <div className="mt-4 space-y-1">
                  {(crew.data ?? []).map((member) => (
                    <button
                      key={member.id}
                      className={`block w-full px-3 py-2 text-left text-sm ${
                        seller?.id === member.id ? "bg-ink text-paper" : "hover:bg-paper"
                      }`}
                      onClick={() => void chooseSeller(member)}
                    >
                      {member.full_name}
                    </button>
                  ))}
                </div>
                {pendingSeller && (
                  <label className="mt-4 block text-sm text-mute">
                    PIN · {pendingSeller.full_name}
                    <input
                      className="mt-1 w-full border border-line px-3 py-2"
                      value={sellerPin}
                      onChange={(e) => setSellerPin(e.target.value)}
                      inputMode="numeric"
                      autoFocus
                    />
                    <Button className="mt-2 w-full" disabled={sellerPin.length < 4} onClick={() => void confirmSellerPin()}>
                      Это я
                    </Button>
                  </label>
                )}
                {sellerError && <p className="mt-2 text-sm text-rust">{sellerError}</p>}
                <div className="mt-4">
                  <Button variant="ghost" onClick={() => setPanel("none")}>
                    Назад
                  </Button>
                </div>
              </>
            )}
            {panel === "move" && (
              <>
                <h2 className="text-2xl font-medium">Наличные в ящике</h2>
                <p className="mt-2 text-sm text-mute">
                  Внести — положил свои/размен. Изъять — забрал в сейф или себе.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant={moveType === "deposit" ? "primary" : "foam"}
                    onClick={() => setMoveType("deposit")}
                  >
                    Внести
                  </Button>
                  <Button
                    variant={moveType === "withdrawal" ? "primary" : "foam"}
                    onClick={() => setMoveType("withdrawal")}
                  >
                    Изъять
                  </Button>
                </div>
                <label className="mt-4 block text-sm text-mute">
                  Сумма, ₸
                  <input
                    className="mt-1 w-full border border-line px-3 py-2"
                    value={moveAmount}
                    onChange={(e) => setMoveAmount(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
                <div className="mt-4 flex gap-2">
                  <Button className="flex-1" disabled={!moveAmount} onClick={() => cashMove.mutate()}>
                    Записать
                  </Button>
                  <Button variant="ghost" onClick={() => setPanel("none")}>
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

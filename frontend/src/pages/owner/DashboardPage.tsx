import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../api/client";
import { Card, Empty, PageTitle } from "../../components/ui";
import { money, payLabel, startOfPeriod } from "../../lib/utils";
import { useAuth } from "../../store/auth";

export function DashboardPage() {
  const shopId = useAuth((s) => s.shopId);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const range = startOfPeriod(period);

  const summary = useQuery({
    queryKey: ["summary", shopId, range.from, range.to],
    queryFn: () => api.summary(shopId!, range.from, range.to),
    enabled: !!shopId,
  });
  const top = useQuery({
    queryKey: ["top", shopId, range.from, range.to],
    queryFn: () => api.topProducts(shopId!, range.from, range.to),
    enabled: !!shopId,
  });
  const daily = useQuery({
    queryKey: ["daily", shopId, range.from, range.to],
    queryFn: () => api.daily(shopId!, range.from, range.to),
    enabled: !!shopId,
  });
  const sellers = useQuery({
    queryKey: ["sellers", shopId, range.from, range.to],
    queryFn: () => api.sellers(shopId!, range.from, range.to),
    enabled: !!shopId,
  });

  const s = summary.data;
  const chart = (daily.data ?? []).map((d) => ({
    day: new Date(d.day).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
    [payLabel("cash")]: Number(d.cash_revenue),
    [payLabel("card")]: Number(d.card_revenue),
  }));

  return (
    <div>
      <PageTitle
        kicker="Владелец"
        title="Деньги"
        hint="Выручка — что пробили. Прибыль — выручка минус себестоимость рецептов. Чистыми — ещё минус расходы."
        action={
          <div className="flex gap-px border border-line bg-line">
            {(["today", "week", "month"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`bg-foam px-3 py-1.5 text-sm ${period === p ? "!bg-ink text-paper" : ""}`}
              >
                {p === "today" ? "Сегодня" : p === "week" ? "7 дней" : "Этот месяц"}
              </button>
            ))}
          </div>
        }
      />
      <div className="grid gap-px bg-line md:grid-cols-4">
        <Stat label="Выручка" hint="Все чеки" value={money(s?.revenue)} />
        <Stat label="Прибыль" hint="Минус себестоимость" value={money(s?.profit)} />
        <Stat label="Расходы" hint="Аренда, зарплата…" value={money(s?.expenses)} />
        <Stat label="Чистыми" hint="Прибыль минус расходы" value={money(s?.net_profit)} />
      </div>
      <div className="mt-px grid gap-px bg-line lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-0">
          <p className="text-[11px] uppercase tracking-wider text-mute">Как платили</p>
          <div className="mt-2 h-64">
            {(daily.data ?? []).length === 0 ? (
              <Empty>Продаж за период нет — открой кассу и пробей первый чек.</Empty>
            ) : (
              <ResponsiveContainer>
                <BarChart data={chart}>
                  <XAxis dataKey="day" tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }} />
                  <YAxis tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }} />
                  <Tooltip />
                  <Bar dataKey={payLabel("cash")} fill="#101211" />
                  <Bar dataKey={payLabel("card")} fill="#0E7C86" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="mt-3 text-sm text-mute">
            Наличный {money(s?.cash_revenue)} · безналичный {money(s?.card_revenue)} · {s?.sales_count ?? 0} чеков
          </p>
        </Card>
        <Card className="border-0">
          <p className="text-[11px] uppercase tracking-wider text-mute">Кто продал</p>
          <ul className="mt-3 space-y-3">
            {(sellers.data ?? []).map((p) => (
              <li key={p.barista_id} className="flex justify-between gap-3">
                <span>
                  {p.barista_name}
                  <span className="ml-2 text-xs text-mute">{p.sales_count} чек.</span>
                </span>
                <span className="text-sm">{money(p.revenue)}</span>
              </li>
            ))}
            {(sellers.data ?? []).length === 0 && (
              <p className="text-sm text-mute">Пока никто не пробивал за период.</p>
            )}
          </ul>
        </Card>
      </div>
      <div className="mt-px">
        <Card className="border-0">
          <p className="text-[11px] uppercase tracking-wider text-mute">Что берут чаще</p>
          <ul className="mt-3 space-y-3">
            {(top.data ?? []).map((p) => (
              <li key={p.product_id} className="flex justify-between gap-3">
                <span>
                  {p.name}
                  <span className="ml-2 text-xs text-mute">×{p.quantity}</span>
                </span>
                <span className="text-sm">{money(p.revenue)}</span>
              </li>
            ))}
            {(top.data ?? []).length === 0 && (
              <p className="text-sm text-mute">Пока пусто — появятся после продаж.</p>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <Card className="border-0">
      <p className="text-[11px] uppercase tracking-wider text-mute">{label}</p>
      <p className="mt-2 text-2xl font-medium">{value}</p>
      <p className="mt-1 text-xs text-mute">{hint}</p>
    </Card>
  );
}

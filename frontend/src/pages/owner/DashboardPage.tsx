import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Empty, Field, Input } from "../../components/ui";
import { money, startOfPeriod, type Period } from "../../lib/utils";
import { useAuth } from "../../store/auth";

export function DashboardPage() {
  const shopId = useAuth((s) => s.shopId);
  const [period, setPeriod] = useState<Period>("week");
  const preset = period === "custom" ? null : startOfPeriod(period);
  const [from, setFrom] = useState(preset?.from ?? startOfPeriod("week").from);
  const [to, setTo] = useState(preset?.to ?? startOfPeriod("week").to);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    if (period === "custom") return;
    const next = startOfPeriod(period);
    setFrom(next.from);
    setTo(next.to);
  }, [period]);

  const rangeOk = from <= to;
  const summary = useQuery({
    queryKey: ["summary", shopId, from, to],
    queryFn: () => api.summary(shopId!, from, to),
    enabled: !!shopId && rangeOk,
  });
  const top = useQuery({
    queryKey: ["top", shopId, from, to],
    queryFn: () => api.topProducts(shopId!, from, to),
    enabled: !!shopId && rangeOk,
  });
  const daily = useQuery({
    queryKey: ["daily", shopId, from, to],
    queryFn: () => api.daily(shopId!, from, to),
    enabled: !!shopId && rangeOk,
  });

  const s = summary.data;
  const days = daily.data ?? [];
  const maxBar = Math.max(1, ...days.map((d) => Number(d.cash_revenue) + Number(d.card_revenue)));

  async function exportCsv() {
    if (!shopId || !rangeOk) return;
    setExporting(true);
    setExportError("");
    try {
      await api.exportReport(shopId, from, to);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Не скачалось");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex border border-line-2">
            {(["today", "week", "month", "custom"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`border-r border-line-2 px-4 py-2 text-xs last:border-r-0 ${
                  period === p ? "bg-ink text-paper" : "text-ink-soft"
                }`}
              >
                {p === "today" ? "Сегодня" : p === "week" ? "7 дней" : p === "month" ? "Этот месяц" : "Свои даты"}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="flex gap-4">
              <Field label="С">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="По">
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
        <Button variant="quiet" disabled={!shopId || !rangeOk || exporting} onClick={() => void exportCsv()}>
          {exporting ? "Собираем…" : "Скачать CSV"}
        </Button>
      </div>
      {!rangeOk && <p className="mb-4 text-sm text-alert">Дата «с» должна быть раньше «по».</p>}
      {exportError && <p className="mb-4 text-sm text-alert">{exportError}</p>}

      <div className="mb-px grid border border-line md:grid-cols-4">
        <Tile label="Выручка" value={money(s?.revenue)} />
        <Tile label="Прибыль" value={money(s?.profit)} gold />
        <Tile label="Расходы" value={money(s?.expenses)} />
        <Tile label="Чистыми" value={money(s?.net_profit)} last />
      </div>

      <div className="border border-t-0 border-line px-6 py-8">
        <h4 className="font-display text-[17px] font-normal">Наличные и безналичные</h4>
        <div className="mb-7 mt-1.5 flex gap-5 text-xs text-ink-soft">
          <span>
            <i className="mr-2 inline-block h-[7px] w-[7px] bg-gold" />
            Наличными
          </span>
          <span>
            <i className="mr-2 inline-block h-[7px] w-[7px] bg-turq" />
            Безналично
          </span>
        </div>
        {days.length === 0 ? (
          <Empty>Продаж за период нет — открой кассу и пробей первый чек.</Empty>
        ) : (
          <div className="flex h-[130px] items-end gap-[22px]">
            {days.map((d) => {
              const cash = Number(d.cash_revenue);
              const card = Number(d.card_revenue);
              const h = 110;
              const goldH = (cash / maxBar) * h;
              const turqH = (card / maxBar) * h;
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full max-w-[22px] flex-col-reverse" style={{ height: goldH + turqH }}>
                    <div className="bg-gold" style={{ height: goldH }} />
                    <div className="bg-turq" style={{ height: turqH }} />
                  </div>
                  <div className="font-mono text-[10px] tracking-wide text-faint">
                    {new Date(d.day).toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "").toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border border-t-0 border-line">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <th className="px-6 py-3.5">Товар</th>
              <th className="px-6 py-3.5">Продано</th>
              <th className="px-6 py-3.5">Выручка</th>
              <th className="px-6 py-3.5">Себестоимость</th>
            </tr>
          </thead>
          <tbody>
            {(top.data ?? []).map((p) => (
              <tr key={p.product_id} className="border-b border-line last:border-0">
                <td className="px-6 py-3.5 text-ink-soft">{p.name}</td>
                <td className="px-6 py-3.5 text-ink-soft">{p.quantity}</td>
                <td className="px-6 py-3.5 font-mono font-semibold text-ink">{money(p.revenue)}</td>
                <td className="px-6 py-3.5 font-mono font-semibold text-ink">
                  {money(Number(p.revenue) - Number(p.profit))}
                </td>
              </tr>
            ))}
            {(top.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-sm text-mute">
                  Пока пусто — появятся после продаж.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  gold,
  last,
}: {
  label: string;
  value: string;
  gold?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`px-6 py-6 ${last ? "" : "border-b border-line md:border-b-0 md:border-r"}`}>
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">{label}</p>
      <p className={`mt-2.5 font-mono text-[23px] font-semibold ${gold ? "text-gold" : "text-ink"}`}>{value}</p>
    </div>
  );
}

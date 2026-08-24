import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const shops = useQuery({ queryKey: ["shops"], queryFn: api.shops });
  const shop = shops.data?.find((s) => s.id === shopId);
  const summary = useQuery({
    queryKey: ["summary", shopId, from, to],
    queryFn: () => api.summary(shopId!, from, to),
    enabled: !!shopId && rangeOk,
  });
  const fiscal = useQuery({
    queryKey: ["fiscal", shopId, from, to],
    queryFn: () => api.fiscalReceipts(shopId!, from, to),
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
          <div className="flex gap-2">
            {(["today", "week", "month", "custom"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full border-[1.5px] px-4 py-2 text-[12.5px] ${
                  period === p
                    ? "border-ink bg-ink text-paper"
                    : "border-line-2 text-ink-soft hover:border-ink hover:text-ink"
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
      {shop && !shop.webkassa_enabled && (
        <p className="mb-4 rounded-md bg-maroon/10 px-4 py-3 text-sm text-maroon">
          Продажи не фискализируются. Касса Webkassa выключена в настройках.
        </p>
      )}
      {s && (s.fiscal_failed_count || 0) + (s.fiscal_pending_count || 0) > 0 && (
        <p className="mb-4 rounded-md bg-maroon/10 px-4 py-3 text-sm text-maroon">
          Не фискализировано: {(s.fiscal_failed_count || 0) + (s.fiscal_pending_count || 0)} чеков за период.
        </p>
      )}
      {!rangeOk && <p className="mb-4 text-sm text-alert">Дата «с» должна быть раньше «по».</p>}
      {exportError && <p className="mb-4 text-sm text-alert">{exportError}</p>}

      <div className="mb-5 grid gap-3.5 md:grid-cols-4">
        <Tile label="Выручка" value={money(s?.revenue)} />
        <Tile label="Прибыль" value={money(s?.profit)} profit />
        <Tile label="Расходы" value={money(s?.expenses)} />
        <Tile label="Чистыми" value={money(s?.net_profit)} />
      </div>
      {s && (
        <p className={`mb-5 rounded-md px-5 py-3 text-sm ${Number(s.revision_shortage || 0) > 0 ? "bg-maroon/10 text-maroon" : "bg-cream text-mute"}`}>
          Недостачи по ревизиям: −{money(s.revision_shortage || 0)}. Уже вычтены из «Чистыми».
        </p>
      )}

      <div className="mb-4 rounded-lg bg-cream px-[26px] py-7 shadow-soft">
        <h4 className="font-display text-[19px] font-normal">Наличные и безналичные</h4>
        <div className="mb-[26px] mt-1.5 flex gap-5 text-xs text-ink-soft">
          <span>
            <i className="mr-2 inline-block h-2 w-2 rounded-full bg-gold" />
            Наличными
          </span>
          <span>
            <i className="mr-2 inline-block h-2 w-2 rounded-full bg-turq" />
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
                  <div className="flex w-full max-w-[26px] flex-col-reverse overflow-hidden rounded-lg" style={{ height: goldH + turqH }}>
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

      <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
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

      {(fiscal.data ?? []).length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg bg-cream shadow-soft">
          <div className="px-6 py-3">
            <h4 className="font-display text-[17px] font-normal">Чеки без ОФД</h4>
            <p className="text-sm text-mute">Ошибка Webkassa или ещё не ушло. Можно отправить снова.</p>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
                <th className="px-6 py-3">Когда</th>
                <th>Чек</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Ошибка</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(fiscal.data ?? []).map((row) => (
                <FiscalRow key={row.id} shopId={shopId!} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FiscalRow({
  shopId,
  row,
}: {
  shopId: number;
  row: { id: number; created_at: string; total_amount: string; fiscal_status: string; fiscal_error: string | null };
}) {
  const qc = useQueryClient();
  const retry = useMutation({
    mutationFn: () => api.retryFiscal(shopId, row.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fiscal", shopId] });
      void qc.invalidateQueries({ queryKey: ["summary", shopId] });
    },
  });
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-6 py-3 font-mono text-xs">{new Date(row.created_at).toLocaleString("ru-RU")}</td>
      <td className="px-6 py-3 font-mono">#{row.id}</td>
      <td className="px-6 py-3 font-mono">{money(row.total_amount)}</td>
      <td className="px-6 py-3">{row.fiscal_status === "failed" ? "ошибка" : "ждёт"}</td>
      <td className="px-6 py-3 text-mute">{row.fiscal_error || "—"}</td>
      <td className="px-6 py-3 text-right">
        <button className="underline" disabled={retry.isPending} onClick={() => retry.mutate()}>
          Повторить
        </button>
      </td>
    </tr>
  );
}

function Tile({
  label,
  value,
  profit,
}: {
  label: string;
  value: string;
  profit?: boolean;
}) {
  return (
    <div className="rounded-lg bg-cream px-[22px] py-5 shadow-soft">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">{label}</p>
      <p className={`mt-2.5 font-mono text-2xl font-semibold ${profit ? "text-maroon" : "text-ink"}`}>{value}</p>
    </div>
  );
}

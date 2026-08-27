import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Empty, Input, pill } from "../../components/ui";
import { useLocale, useT } from "../../i18n";
import { dateLocaleTag, localizedName } from "../../lib/i18nName";
import { money, startOfPeriod, type Period } from "../../lib/utils";
import { useAuth } from "../../store/auth";

export function DashboardPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
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
  const dateTag = dateLocaleTag(locale);

  async function exportCsv() {
    if (!shopId || !rangeOk) return;
    setExporting(true);
    setExportError("");
    try {
      await api.exportReport(shopId, from, to);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t("dashboard.exportFail"));
    } finally {
      setExporting(false);
    }
  }

  const periodLabel = (p: Period) =>
    p === "today"
      ? t("dashboard.periodToday")
      : p === "week"
        ? t("dashboard.periodWeek")
        : p === "month"
          ? t("dashboard.periodMonth")
          : t("dashboard.periodCustom");

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "week", "month", "custom"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`${pill} ${
                period === p
                  ? "border-ink bg-ink text-paper"
                  : "border-line-2 text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {periodLabel(p)}
            </button>
          ))}
          {period === "custom" && (
            <>
              <label className="inline-flex h-10 items-center gap-2">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
                  {t("dashboard.from")}
                </span>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-10 w-[11.5rem] py-0"
                />
              </label>
              <label className="inline-flex h-10 items-center gap-2">
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
                  {t("dashboard.to")}
                </span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-10 w-[11.5rem] py-0"
                />
              </label>
            </>
          )}
        </div>
        <Button variant="quiet" disabled={!shopId || !rangeOk || exporting} onClick={() => void exportCsv()}>
          {exporting ? t("dashboard.exporting") : t("dashboard.exportCsv")}
        </Button>
      </div>
      {shop && !shop.webkassa_enabled && (
        <p className="mb-4 rounded-md bg-maroon/10 px-4 py-3 text-sm text-maroon">{t("dashboard.webkassaOff")}</p>
      )}
      {s && (s.fiscal_failed_count || 0) + (s.fiscal_pending_count || 0) > 0 && (
        <p className="mb-4 rounded-md bg-maroon/10 px-4 py-3 text-sm text-maroon">
          {t("dashboard.fiscalPending", {
            n: (s.fiscal_failed_count || 0) + (s.fiscal_pending_count || 0),
          })}
        </p>
      )}
      {!rangeOk && <p className="mb-4 text-sm text-alert">{t("dashboard.rangeError")}</p>}
      {exportError && <p className="mb-4 text-sm text-alert">{exportError}</p>}

      <div className="mb-5 grid gap-3.5 md:grid-cols-4">
        <Tile label={t("dashboard.revenue")} value={money(s?.revenue)} />
        <Tile label={t("dashboard.profit")} value={money(s?.profit)} profit />
        <Tile label={t("dashboard.expenses")} value={money(s?.expenses)} />
        <Tile label={t("dashboard.netProfit")} value={money(s?.net_profit)} />
      </div>
      {s && (
        <p className="mb-5 text-sm leading-relaxed text-mute">
          {t("dashboard.explain", { shortage: money(s.revision_shortage || 0) })}
        </p>
      )}

      <div className="mb-4 rounded-lg bg-cream px-[26px] py-7 shadow-soft">
        <h4 className="font-display text-[19px] font-normal">{t("dashboard.cashCard")}</h4>
        <div className="mb-[26px] mt-1.5 flex gap-5 text-xs text-ink-soft">
          <span>
            <i className="mr-2 inline-block h-2 w-2 rounded-full bg-gold" />
            {t("dashboard.cash")}
          </span>
          <span>
            <i className="mr-2 inline-block h-2 w-2 rounded-full bg-turq" />
            {t("dashboard.card")}
          </span>
        </div>
        {days.length === 0 ? (
          <Empty>{t("dashboard.noSales")}</Empty>
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
                  <div
                    className="flex w-full max-w-[26px] flex-col-reverse overflow-hidden rounded-lg"
                    style={{ height: goldH + turqH }}
                  >
                    <div className="bg-gold" style={{ height: goldH }} />
                    <div className="bg-turq" style={{ height: turqH }} />
                  </div>
                  <div className="font-mono text-[10px] tracking-wide text-faint">
                    {new Date(d.day)
                      .toLocaleDateString(dateTag, { weekday: "short" })
                      .replace(".", "")
                      .toUpperCase()}
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
              <th className="px-6 py-3.5">{t("dashboard.colProduct")}</th>
              <th className="px-6 py-3.5">{t("dashboard.colSold")}</th>
              <th className="px-6 py-3.5">{t("dashboard.colRevenue")}</th>
              <th className="px-6 py-3.5">{t("dashboard.colCost")}</th>
            </tr>
          </thead>
          <tbody>
            {(top.data ?? []).map((p) => (
              <tr key={`${p.product_id}:${p.variant_id ?? ""}`} className="border-b border-line last:border-0">
                <td className="px-6 py-3.5 text-ink-soft">
                  {localizedName(p, locale)}
                  {p.variant_name ? ` — ${p.variant_name}` : ""}
                </td>
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
                  {t("dashboard.topEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(fiscal.data ?? []).length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg bg-cream shadow-soft">
          <div className="px-6 py-3">
            <h4 className="font-display text-[17px] font-normal">{t("dashboard.fiscalTitle")}</h4>
            <p className="text-sm text-mute">{t("dashboard.fiscalHint")}</p>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
                <th className="px-6 py-3">{t("dashboard.colWhen")}</th>
                <th>{t("dashboard.colReceipt")}</th>
                <th>{t("dashboard.colAmount")}</th>
                <th>{t("dashboard.colStatus")}</th>
                <th>{t("dashboard.colError")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(fiscal.data ?? []).map((row) => (
                <FiscalRow key={row.id} shopId={shopId!} row={row} dateTag={dateTag} />
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
  dateTag,
}: {
  shopId: number;
  dateTag: string;
  row: { id: number; created_at: string; total_amount: string; fiscal_status: string; fiscal_error: string | null };
}) {
  const t = useT();
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
      <td className="px-6 py-3 font-mono text-xs">{new Date(row.created_at).toLocaleString(dateTag)}</td>
      <td className="px-6 py-3 font-mono">#{row.id}</td>
      <td className="px-6 py-3 font-mono">{money(row.total_amount)}</td>
      <td className="px-6 py-3">
        {row.fiscal_status === "failed" ? t("dashboard.statusFail") : t("dashboard.statusPending")}
      </td>
      <td className="px-6 py-3 text-mute">{row.fiscal_error || "—"}</td>
      <td className="px-6 py-3 text-right">
        <button className="underline" disabled={retry.isPending} onClick={() => retry.mutate()}>
          {t("dashboard.retry")}
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

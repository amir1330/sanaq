import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Dialog, Field, Input, PageTitle } from "../../components/ui";
import { useCloseShiftMutation } from "../../hooks/useCloseShiftMutation";
import { useLocale, useT } from "../../i18n";
import { dateLocaleTag } from "../../lib/i18nName";
import { money, payLabel } from "../../lib/utils";
import { useAuth } from "../../store/auth";

export function ShiftsPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const dateTag = dateLocaleTag(locale);
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const shifts = useQuery({ queryKey: ["shifts", shopId], queryFn: () => api.shifts(shopId) });
  const [closeId, setCloseId] = useState<number | null>(null);
  const [cashClose, setCashClose] = useState("");

  const closeShift = useCloseShiftMutation(closeId, cashClose, () => {
    setCloseId(null);
    setCashClose("");
    void qc.invalidateQueries({ queryKey: ["shifts", shopId] });
  });

  return (
    <div>
      <PageTitle kicker={t("shifts.kicker")} title={t("shifts.title")} hint={t("shifts.hint")} />
      <div className="border border-line">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-mute">
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3">{t("shifts.colWhen")}</th>
              <th>{t("shifts.colTill")}</th>
              <th>{t("shifts.colOpened")}</th>
              <th>{t("shifts.colSellers")}</th>
              <th>{payLabel("cash")}</th>
              <th>{payLabel("card")}</th>
              <th>{t("shifts.colExpected")}</th>
              <th>{t("shifts.colCounted")}</th>
              <th>{t("shifts.colDiff")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(shifts.data ?? []).map((s) => {
              const diff = s.cash_difference == null ? null : Number(s.cash_difference);
              return (
                <tr key={s.id} className="border-b border-line/70 align-top">
                  <td className="px-4 py-3">
                    {new Date(s.opened_at).toLocaleString(dateTag)}
                    <div className="text-mute">
                      {s.status === "open" ? t("shifts.open") : t("shifts.closed")}
                    </div>
                  </td>
                  <td className="py-3">{s.cash_register_name ?? t("common.none")}</td>
                  <td className="py-3">{s.barista_name}</td>
                  <td className="py-3">
                    {(s.sellers ?? []).length === 0 && (
                      <span className="text-mute">{t("shifts.noReceipts")}</span>
                    )}
                    {(s.sellers ?? []).map((seller) => (
                      <div key={seller.barista_id}>
                        {seller.barista_name} · {money(seller.revenue)}
                        <span className="text-mute">{t("shifts.receipts", { n: seller.sales_count })}</span>
                      </div>
                    ))}
                  </td>
                  <td className="py-3">{money(s.cash_revenue)}</td>
                  <td className="py-3">{money(s.card_revenue)}</td>
                  <td className="py-3">{money(s.expected_cash)}</td>
                  <td className="py-3">
                    {s.closing_cash == null ? t("common.none") : money(s.closing_cash)}
                  </td>
                  <td className={`py-3 ${diff && diff !== 0 ? "text-alert" : ""}`}>
                    {diff == null ? t("common.none") : money(diff)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status === "open" && (
                      <button className="underline" onClick={() => setCloseId(s.id)}>
                        {t("shifts.close")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {closeId !== null && (
        <Dialog open title={t("shifts.closeTitle")} hint={t("shifts.closeHint")} onClose={() => setCloseId(null)}>
          <Field label={t("shifts.colCounted")}>
            <Input
              value={cashClose}
              onChange={(e) => setCashClose(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              autoFocus
            />
          </Field>
          {closeShift.isError && (
            <p className="text-sm text-rust">{(closeShift.error as Error).message}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" onClick={() => closeShift.mutate(false)}>
              {t("shifts.close")}
            </Button>
            <Button variant="ghost" onClick={() => setCloseId(null)}>
              {t("common.back")}
            </Button>
            {closeShift.isError && (
              <Button variant="danger" onClick={() => closeShift.mutate(true)}>
                {t("shifts.closeAnyway")}
              </Button>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, PageTitle } from "../../components/ui";
import { money, payLabel } from "../../lib/utils";
import { useAuth } from "../../store/auth";

export function ShiftsPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const shifts = useQuery({ queryKey: ["shifts", shopId], queryFn: () => api.shifts(shopId) });
  const [closeId, setCloseId] = useState<number | null>(null);
  const [cashClose, setCashClose] = useState("");

  const closeShift = useMutation({
    mutationFn: (force: boolean) => api.closeShift(closeId!, Number(cashClose || 0), force),
    onSuccess: () => {
      setCloseId(null);
      setCashClose("");
      void qc.invalidateQueries({ queryKey: ["shifts", shopId] });
    },
  });

  return (
    <div>
      <PageTitle
        kicker="Касса"
        title="Смены"
        hint="Смена = один ящик. Если касс несколько — у каждой своя смена. Старт + нал − изъятия = сколько должно лежать. Изъятие делают на кассе, пока смена открыта."
      />
      <div className="border border-line">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-mute">
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3">Когда</th>
              <th>Касса</th>
              <th>Открыл</th>
              <th>Кто продал</th>
              <th>{payLabel("cash")}</th>
              <th>{payLabel("card")}</th>
              <th>Должно быть</th>
              <th>Пересчитали</th>
              <th>Расхождение</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(shifts.data ?? []).map((s) => {
              const diff = s.cash_difference == null ? null : Number(s.cash_difference);
              return (
                <tr key={s.id} className="border-b border-line/70 align-top">
                  <td className="px-4 py-3">
                    {new Date(s.opened_at).toLocaleString("ru-RU")}
                    <div className="text-mute">{s.status === "open" ? "открыта" : "закрыта"}</div>
                  </td>
                  <td className="py-3">{s.cash_register_name ?? "—"}</td>
                  <td className="py-3">{s.barista_name}</td>
                  <td className="py-3">
                    {(s.sellers ?? []).length === 0 && <span className="text-mute">нет чеков</span>}
                    {(s.sellers ?? []).map((seller) => (
                      <div key={seller.barista_id}>
                        {seller.barista_name} · {money(seller.revenue)}
                        <span className="text-mute"> · {seller.sales_count} чек.</span>
                      </div>
                    ))}
                  </td>
                  <td className="py-3">{money(s.cash_revenue)}</td>
                  <td className="py-3">{money(s.card_revenue)}</td>
                  <td className="py-3">{money(s.expected_cash)}</td>
                  <td className="py-3">{s.closing_cash == null ? "—" : money(s.closing_cash)}</td>
                  <td className={`py-3 ${diff && diff !== 0 ? "text-alert" : ""}`}>
                    {diff == null ? "—" : money(diff)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status === "open" && (
                      <button className="underline" onClick={() => setCloseId(s.id)}>
                        Закрыть
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
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4">
          <div className="w-full max-w-sm border border-line bg-paper p-7">
            <h2 className="font-display text-2xl font-normal">Закрыть смену</h2>
            <p className="mt-2 text-sm text-mute">Сколько наличных в ящике сейчас.</p>
            <input
              className="mt-4 w-full border border-line px-3 py-2"
              value={cashClose}
              onChange={(e) => setCashClose(e.target.value)}
              placeholder="0"
              inputMode="decimal"
              autoFocus
            />
            {closeShift.isError && (
              <p className="mt-2 text-sm text-rust">{(closeShift.error as Error).message}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="flex-1" onClick={() => closeShift.mutate(false)}>
                Закрыть
              </Button>
              <Button variant="ghost" onClick={() => setCloseId(null)}>
                Назад
              </Button>
              {closeShift.isError && (
                <Button variant="danger" onClick={() => closeShift.mutate(true)}>
                  Закрыть всё равно
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

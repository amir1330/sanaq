import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Empty, Field, Input, PageTitle, Select } from "../../components/ui";
import { money } from "../../lib/utils";
import { useAuth } from "../../store/auth";

/** Операционные траты. Закупка товара и порча — склад. */
const cats = ["аренда", "зарплата", "коммуналка", "реклама", "прочее"] as const;

export function ExpensesPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["expenses", shopId], queryFn: () => api.expenses(shopId) });
  const [form, setForm] = useState({ category: "аренда" as string, amount: "", comment: "" });
  const add = useMutation({
    mutationFn: () =>
      api.createExpense(shopId, {
        category: form.category,
        amount: form.amount,
        comment: form.comment.trim() || null,
      }),
    onSuccess: () => {
      setForm({ ...form, amount: "", comment: "" });
      void qc.invalidateQueries({ queryKey: ["expenses", shopId] });
    },
  });

  const rows = list.data ?? [];
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.category, (map.get(row.category) ?? 0) + Number(row.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const total = byCategory.reduce((sum, [, v]) => sum + v, 0);
  const canSave = Number(form.amount) > 0;

  return (
    <div>
      <PageTitle
        kicker="Деньги"
        title="Расходы"
        hint="Сюда — аренда, зарплата, реклама, коммуналка. Закупку молока и стаканов пиши как Приход на складе. Порчу — Списать в карточке позиции."
      />

      <Card className="mb-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Статья">
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {cats.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Сумма">
            <Input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              inputMode="decimal"
              placeholder="0"
            />
          </Field>
          <Field label="Комментарий">
            <Input
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="за март · необязательно"
            />
          </Field>
        </div>
        {add.isError && <p className="text-sm text-rust">{(add.error as Error).message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-mute">
            Товар и порча — на{" "}
            <Link className="underline hover:text-ink" to="/owner/stock">
              складе
            </Link>
            .
          </p>
          <Button disabled={!canSave || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? "Пишем…" : "Записать"}
          </Button>
        </div>
      </Card>

      {rows.length > 0 && byCategory.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-cream px-4 py-3 shadow-soft">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">Всего</p>
            <p className="mt-1 font-mono text-lg">{money(total)}</p>
          </div>
          {byCategory.slice(0, 3).map(([cat, sum]) => (
            <div key={cat} className="rounded-lg bg-cream px-4 py-3 shadow-soft">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{cat}</p>
              <p className="mt-1 font-mono text-lg">{money(sum)}</p>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Empty>Пока пусто. Запиши аренду или зарплату сверху.</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">Дата</th>
                <th>Статья</th>
                <th>Комментарий</th>
                <th className="px-4 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-ink/5">
                  <td className="px-4 py-3 font-mono">
                    {new Date(e.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td>{e.category}</td>
                  <td className="text-ink/60">{e.comment || "—"}</td>
                  <td className="px-4 text-right font-mono">{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

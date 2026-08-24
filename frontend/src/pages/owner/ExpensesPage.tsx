import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Empty, Field, Input, PageTitle, Select } from "../../components/ui";
import { money } from "../../lib/utils";
import { useAuth } from "../../store/auth";

const cats = ["аренда", "зарплата", "коммуналка", "закупка", "прочее"];

export function ExpensesPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["expenses", shopId], queryFn: () => api.expenses(shopId) });
  const [form, setForm] = useState({ category: "аренда", amount: "", comment: "" });
  const add = useMutation({
    mutationFn: () => api.createExpense(shopId, form),
    onSuccess: () => {
      setForm({ ...form, amount: "", comment: "" });
      void qc.invalidateQueries({ queryKey: ["expenses", shopId] });
    },
  });

  return (
    <div>
      <PageTitle
        kicker="Деньги"
        title="Расходы"
        hint="Аренда, зарплата, коммуналка — то, что платишь мимо кассы. Закупка молока и стаканов — это Приход на складе, не сюда. На сводке: выручка − себестоимость чеков = прибыль, минус эти расходы и недостачи = чистыми."
      />
      <Card className="mb-4 grid gap-3 md:grid-cols-4">
        <Field label="Статья">
          <Select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Сумма">
          <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Комментарий">
          <Input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
        </Field>
        <div className="flex items-end">
          <Button className="w-full" onClick={() => add.mutate()}>
            Записать
          </Button>
        </div>
      </Card>
      {(list.data ?? []).length === 0 ? (
        <Empty>Расходов за это время нет. Аренду и зарплату запиши сверху — закупки товара идут через склад.</Empty>
      ) : (
      <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
        <table className="w-full text-sm">
          <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
            <tr className="border-b border-ink/10 text-left">
              <th className="px-4 py-3">Дата</th>
              <th>Статья</th>
              <th>Комментарий</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((e) => (
              <tr key={e.id} className="border-b border-ink/5">
                <td className="px-4 py-3 font-mono">
                  {new Date(e.created_at).toLocaleDateString("ru-RU")}
                </td>
                <td>{e.category}</td>
                <td className="text-ink/60">{e.comment}</td>
                <td className="font-mono">{money(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

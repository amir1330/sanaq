import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Empty, Field, Input, PageTitle, Select } from "../../components/ui";
import { useLocale, useT } from "../../i18n";
import { dateLocaleTag } from "../../lib/i18nName";
import { money } from "../../lib/utils";
import { useAuth } from "../../store/auth";

/** Stored as Russian slugs; labels come from expenses.cat* keys. */
const cats = ["аренда", "зарплата", "коммуналка", "реклама", "прочее"] as const;

const CAT_KEYS = {
  аренда: "expenses.catRent",
  зарплата: "expenses.catPayroll",
  коммуналка: "expenses.catUtilities",
  реклама: "expenses.catAds",
  прочее: "expenses.catOther",
} as const;

function catLabel(t: ReturnType<typeof useT>, category: string): string {
  const key = CAT_KEYS[category as keyof typeof CAT_KEYS];
  return key ? t(key) : category;
}

export function ExpensesPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const dateTag = dateLocaleTag(locale);
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

  const stockNote = t("expenses.stockNote");
  const stockLink = t("expenses.stockLink");
  const stockLinkIdx = stockNote.indexOf(stockLink);

  return (
    <div>
      <PageTitle kicker={t("expenses.kicker")} title={t("expenses.title")} hint={t("expenses.hint")} />

      <Card className="mb-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("expenses.article")}>
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {cats.map((c) => (
                <option key={c} value={c}>
                  {catLabel(t, c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("expenses.amount")}>
            <Input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              inputMode="decimal"
              placeholder="0"
            />
          </Field>
          <Field label={t("common.comment")}>
            <Input
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder={t("expenses.commentPh")}
            />
          </Field>
        </div>
        {add.isError && <p className="text-sm text-rust">{(add.error as Error).message}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-mute">
            {stockLinkIdx < 0 ? (
              stockNote
            ) : (
              <>
                {stockNote.slice(0, stockLinkIdx)}
                <Link className="underline hover:text-ink" to="/owner/stock">
                  {stockLink}
                </Link>
                {stockNote.slice(stockLinkIdx + stockLink.length)}
              </>
            )}
          </p>
          <Button disabled={!canSave || add.isPending} onClick={() => add.mutate()}>
            {add.isPending ? t("common.writing") : t("expenses.record")}
          </Button>
        </div>
      </Card>

      {rows.length > 0 && byCategory.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-cream px-4 py-3 shadow-soft">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{t("common.total")}</p>
            <p className="mt-1 font-mono text-lg">{money(total)}</p>
          </div>
          {byCategory.slice(0, 3).map(([cat, sum]) => (
            <div key={cat} className="rounded-lg bg-cream px-4 py-3 shadow-soft">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                {catLabel(t, cat)}
              </p>
              <p className="mt-1 font-mono text-lg">{money(sum)}</p>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Empty>{t("expenses.empty")}</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">{t("expenses.colDate")}</th>
                <th>{t("expenses.colArticle")}</th>
                <th>{t("expenses.colComment")}</th>
                <th className="px-4 text-right">{t("expenses.colAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-ink/5">
                  <td className="px-4 py-3 font-mono">
                    {new Date(e.created_at).toLocaleDateString(dateTag)}
                  </td>
                  <td>{catLabel(t, e.category)}</td>
                  <td className="text-ink/60">{e.comment || t("common.none")}</td>
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

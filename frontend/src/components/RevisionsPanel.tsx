import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { money, qty } from "../lib/utils";
import type { StockRevision, StockRevisionLine } from "../types";
import { Button, Empty, Field, Input, Select } from "./ui";

type Filter = "all" | "open" | "diff";

function when(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: StockRevision["status"]): string {
  if (status === "draft") return "черновик";
  if (status === "posted") return "проведена";
  return "отменена";
}

function lineDiff(line: StockRevisionLine, counted: string): number | null {
  if (counted.trim() === "") return null;
  const n = Number(counted);
  if (Number.isNaN(n)) return null;
  return n - Number(line.expected_quantity);
}

function lineValue(line: StockRevisionLine, counted: string): number | null {
  const diff = lineDiff(line, counted);
  if (diff == null) return null;
  return diff * Number(line.cost_per_base_unit);
}

export function RevisionsHistory({ shopId }: { shopId: number }) {
  const list = useQuery({
    queryKey: ["stock-revisions", shopId],
    queryFn: () => api.stockRevisions(shopId),
  });
  const history = (list.data ?? []).filter((r) => r.status !== "draft");
  const [openId, setOpenId] = useState<number | null>(null);
  const opened = history.find((r) => r.id === openId) ?? null;

  if (history.length === 0) {
    return <Empty>Ревизий ещё не было. Нажми «Новая ревизия» — система снимет снимок, касса встанет.</Empty>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
        <table className="w-full text-sm">
          <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
            <tr className="border-b border-ink/10 text-left">
              <th className="px-4 py-3">Когда</th>
              <th>Статус</th>
              <th>Посчитано</th>
              <th>Недостача / излишек</th>
              <th>На сумму</th>
              <th>Кто</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id} className="border-b border-ink/5">
                <td className="px-4 py-3 font-mono text-xs">{when(row.posted_at || row.cancelled_at || row.created_at)}</td>
                <td>
                  №{row.id} · {statusLabel(row.status)}
                </td>
                <td className="font-mono">
                  {row.counted_count}/{row.line_count}
                </td>
                <td className="font-mono">
                  {row.status === "posted" ? `${row.shortage_count} / ${row.surplus_count}` : "—"}
                </td>
                <td className={`font-mono ${Number(row.difference_value) < 0 ? "text-alert" : ""}`}>
                  {row.status === "posted" ? money(row.difference_value) : "—"}
                </td>
                <td className="text-mute">{row.posted_by_name || row.created_by_name || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button className="underline" onClick={() => void api.exportStockRevision(shopId, row.id)}>
                      Excel
                    </button>
                    <Link className="underline" to={`/owner/stock/revisions/${row.id}`}>
                      Открыть
                    </Link>
                    <button className="underline" onClick={() => setOpenId(row.id)}>
                      Строки
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {opened && <RevisionLinesDialog revision={opened} onClose={() => setOpenId(null)} />}
    </>
  );
}

export function RevisionWorkspace({
  shopId,
  revision,
  onClosed,
}: {
  shopId: number;
  revision: StockRevision;
  onClosed?: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const readOnly = revision.status !== "draft";
  const [counts, setCounts] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      revision.lines
        .filter((l) => l.stock_item_id)
        .map((l) => [l.stock_item_id, l.counted_quantity == null ? "" : String(Number(l.counted_quantity))]),
    ),
  );
  const [notes, setNotes] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      revision.lines
        .filter((l) => l.stock_item_id)
        .map((l) => [l.stock_item_id, l.comment ?? ""]),
    ),
  );
  const [comment, setComment] = useState(revision.comment ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState<"post" | "cancel" | null>(null);

  const rows = useMemo(() => {
    return revision.lines.filter((line) => {
      if (!line.stock_item_id) return filter === "all";
      const counted = counts[line.stock_item_id] ?? "";
      const diff = lineDiff(line, counted);
      if (filter === "open") return counted.trim() === "";
      if (filter === "diff") return diff != null && diff !== 0;
      return true;
    });
  }, [revision.lines, counts, filter]);

  const countedN = revision.lines.filter(
    (l) => l.stock_item_id && (counts[l.stock_item_id] ?? "").trim() !== "",
  ).length;
  const liveValue = revision.lines.reduce((sum, line) => {
    if (!line.stock_item_id) return sum;
    return sum + (lineValue(line, counts[line.stock_item_id] ?? "") ?? 0);
  }, 0);

  function payload() {
    return {
      comment: comment.trim() || null,
      lines: revision.lines
        .filter((l): l is StockRevisionLine & { stock_item_id: number } => l.stock_item_id != null)
        .map((l) => ({
          stock_item_id: l.stock_item_id,
          counted_quantity: (counts[l.stock_item_id] ?? "").trim() === "" ? null : counts[l.stock_item_id],
          comment: notes[l.stock_item_id]?.trim() || null,
        })),
    };
  }

  function afterClose() {
    void qc.invalidateQueries({ queryKey: ["stock-revisions", shopId] });
    void qc.invalidateQueries({ queryKey: ["stock-revision", shopId, revision.id] });
    void qc.invalidateQueries({ queryKey: ["stock", shopId] });
    void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
    void qc.invalidateQueries({ queryKey: ["shift", shopId] });
    onClosed?.();
    navigate("/owner/stock/revisions");
  }

  const save = useMutation({
    mutationFn: () => api.patchStockRevision(shopId, revision.id, payload()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stock-revisions", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-revision", shopId, revision.id] });
    },
  });
  const post = useMutation({
    mutationFn: async (withExcel: boolean) => {
      await api.patchStockRevision(shopId, revision.id, payload());
      const posted = await api.postStockRevision(shopId, revision.id);
      if (withExcel) await api.exportStockRevision(shopId, revision.id);
      return posted;
    },
    onSuccess: () => {
      setConfirm(null);
      afterClose();
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelStockRevision(shopId, revision.id),
    onSuccess: () => {
      setConfirm(null);
      afterClose();
    },
  });

  return (
    <div>
      <div className="mb-5 rounded-lg bg-maroon/10 px-5 py-4 text-sm text-maroon">
        {readOnly ? (
          <p>
            Ревизия №{revision.id} · {statusLabel(revision.status)}. Снимок: {when(revision.created_at)}.
          </p>
        ) : (
          <p>
            Ревизия №{revision.id} открыта с {when(revision.created_at)}. Касса и склад заморожены: продажи,
            приходы и списания недоступны, пока не проведёшь или не отменишь.
          </p>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-mute">
            Посчитано {countedN} из {revision.line_count}. Расхождение:{" "}
            <span className={liveValue < 0 ? "text-alert" : "font-medium text-ink"}>{money(liveValue)}</span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-faint">
            Колонка «Система» — снимок на {when(revision.created_at)}, не живой остаток.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="min-w-40">
            <option value="all">Все позиции</option>
            <option value="open">Не посчитано</option>
            <option value="diff">Только расхождения</option>
          </Select>
          <Button variant="quiet" onClick={() => void api.exportStockRevision(shopId, revision.id)}>
            Excel
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg bg-cream shadow-soft">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
            <tr className="border-b border-ink/10 text-left">
              <th className="px-4 py-3">Позиция</th>
              <th>Система</th>
              <th>Факт</th>
              <th>Δ</th>
              <th>На сумму</th>
              <th>Заметка</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((line) => {
              const id = line.stock_item_id;
              const counted = id ? (counts[id] ?? "") : "";
              const diff = lineDiff(line, counted);
              const value = lineValue(line, counted);
              return (
                <tr key={line.id} className="border-b border-ink/5">
                  <td className="px-4 py-3">{line.stock_item_name}</td>
                  <td className="font-mono">{qty(line.expected_quantity, line.base_unit)}</td>
                  <td className="py-2">
                    {id && !readOnly ? (
                      <input
                        className="w-28 border-0 border-b border-line-2 bg-transparent py-1 font-mono outline-none focus:border-ink"
                        value={counted}
                        inputMode="decimal"
                        placeholder={line.base_unit}
                        onChange={(e) => setCounts({ ...counts, [id]: e.target.value })}
                      />
                    ) : (
                      <span className="font-mono">
                        {line.counted_quantity == null ? "—" : qty(line.counted_quantity, line.base_unit)}
                      </span>
                    )}
                  </td>
                  <td className={`font-mono ${diff != null && diff < 0 ? "text-alert" : ""}`}>
                    {diff == null ? "—" : `${diff > 0 ? "+" : ""}${qty(diff, line.base_unit)}`}
                  </td>
                  <td className={`font-mono ${value != null && value < 0 ? "text-alert" : ""}`}>
                    {value == null ? "—" : money(value)}
                  </td>
                  <td>
                    {id && !readOnly ? (
                      <input
                        className="w-full border-0 border-b border-line-2 bg-transparent py-1 text-sm outline-none focus:border-ink"
                        value={notes[id] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [id]: e.target.value })}
                        placeholder="бой, пролив…"
                      />
                    ) : (
                      <span className="text-mute">{line.comment || "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <>
          <Field label="Комментарий к ревизии">
            <Input
              className="mt-3"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="утро после выходных"
            />
          </Field>
          {(save.isError || post.isError || cancel.isError) && (
            <p className="mt-3 text-sm text-alert">
              {((save.error || post.error || cancel.error) as Error).message}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="quiet" onClick={() => save.mutate()} disabled={save.isPending}>
              Сохранить
            </Button>
            <Button onClick={() => setConfirm("post")} disabled={countedN === 0}>
              Провести
            </Button>
            <Button variant="ghost" onClick={() => setConfirm("cancel")}>
              Отменить ревизию
            </Button>
          </div>
        </>
      )}

      {confirm && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-roast/60 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-paper p-7 shadow-soft">
            {confirm === "post" ? (
              <>
                <h2 className="font-display text-2xl font-normal">Провести ревизию?</h2>
                <p className="text-sm text-mute">
                  Остатки по посчитанным позициям станут как в «Факт». Незаполненные строки не трогаем. После
                  проведения касса снова откроется. Можно сразу скачать Excel.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => post.mutate(true)} disabled={post.isPending}>
                    Провести и Excel
                  </Button>
                  <Button onClick={() => post.mutate(false)} disabled={post.isPending} variant="quiet">
                    Только провести
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirm(null)}>
                    Назад
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-normal">Отменить черновик?</h2>
                <p className="text-sm text-mute">Остатки не изменятся. Касса снова заработает.</p>
                <div className="flex gap-2">
                  <Button variant="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                    Отменить ревизию
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirm(null)}>
                    Назад
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RevisionLinesDialog({
  revision,
  onClose,
}: {
  revision: StockRevision;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-roast/60 p-4" onClick={onClose} role="presentation">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-paper p-7 shadow-soft"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-normal">Ревизия №{revision.id}</h2>
            <p className="mt-1 text-sm text-mute">
              {statusLabel(revision.status)} · снимок {when(revision.created_at)}
              {revision.comment ? ` · ${revision.comment}` : ""}
            </p>
          </div>
          <button className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
            <tr className="border-b border-ink/10 text-left">
              <th className="py-2">Позиция</th>
              <th>Система</th>
              <th>Факт</th>
              <th>Δ</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {revision.lines.map((line) => {
              const diff = line.difference_quantity == null ? null : Number(line.difference_quantity);
              return (
                <tr key={line.id} className="border-b border-ink/5">
                  <td className="py-2">{line.stock_item_name}</td>
                  <td className="font-mono">{qty(line.expected_quantity, line.base_unit)}</td>
                  <td className="font-mono">
                    {line.counted_quantity == null ? "—" : qty(line.counted_quantity, line.base_unit)}
                  </td>
                  <td className={`font-mono ${diff != null && diff < 0 ? "text-alert" : ""}`}>
                    {diff == null ? "—" : `${diff > 0 ? "+" : ""}${qty(diff, line.base_unit)}`}
                  </td>
                  <td className={`font-mono ${Number(line.value) < 0 ? "text-alert" : ""}`}>
                    {line.value == null ? "—" : money(line.value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

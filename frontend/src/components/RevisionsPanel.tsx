import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { money, qty } from "../lib/utils";
import type { StockRevision, StockRevisionLine } from "../types";
import { Button, Card, Empty, Field, Input, Select } from "./ui";

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

export function RevisionsPanel({
  shopId,
  part = "all",
}: {
  shopId: number;
  part?: "draft" | "history" | "all";
}) {
  const list = useQuery({
    queryKey: ["stock-revisions", shopId],
    queryFn: () => api.stockRevisions(shopId),
  });
  const draft = (list.data ?? []).find((r) => r.status === "draft") ?? null;
  const history = (list.data ?? []).filter((r) => r.status !== "draft");
  const [openId, setOpenId] = useState<number | null>(null);
  const opened = history.find((r) => r.id === openId) ?? null;
  const showDraft = part !== "history";
  const showHistory = part !== "draft";

  if (showDraft && !showHistory && !draft) return null;

  return (
    <div className={part === "history" ? "" : "mb-8"}>
      {showDraft && draft && <DraftSheet key={`${draft.id}-${draft.line_count}`} shopId={shopId} revision={draft} />}
      {showHistory && (
        <>
          {part === "all" && (
          <div className="mb-4">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">Ревизии</p>
            <h2 className="mt-1 font-display text-2xl font-normal text-ink">Пересчёты</h2>
            <p className="mt-1 text-sm text-mute">
              Колонка «Система» — живой остаток. Δ — то, чего не хватает на полке сверх чеков. Новую ревизию —
              кнопкой сверху.
            </p>
          </div>
          )}
          {history.length === 0 ? (
            <Empty>Ревизий ещё не было. На остатках нажми «Ревизия» — система снимет остатки, ты вводишь факт.</Empty>
          ) : (
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
                  <td>№{row.id} · {statusLabel(row.status)}</td>
                  <td className="font-mono">
                    {row.counted_count}/{row.line_count}
                  </td>
                  <td className="font-mono">
                    {row.status === "posted"
                      ? `${row.shortage_count} / ${row.surplus_count}`
                      : "—"}
                  </td>
                  <td className={`font-mono ${Number(row.difference_value) < 0 ? "text-alert" : ""}`}>
                    {row.status === "posted" ? money(row.difference_value) : "—"}
                  </td>
                  <td className="text-mute">{row.posted_by_name || row.created_by_name || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="underline" onClick={() => setOpenId(row.id)}>
                      Строки
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          )}
          {opened && (
            <RevisionLinesDialog
              revision={opened}
              onClose={() => setOpenId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function DraftSheet({ shopId, revision }: { shopId: number; revision: StockRevision }) {
  const qc = useQueryClient();
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

  const save = useMutation({
    mutationFn: () => api.patchStockRevision(shopId, revision.id, payload()),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["stock-revisions", shopId] }),
  });
  const post = useMutation({
    mutationFn: async () => {
      await api.patchStockRevision(shopId, revision.id, payload());
      return api.postStockRevision(shopId, revision.id);
    },
    onSuccess: () => {
      setConfirm(null);
      void qc.invalidateQueries({ queryKey: ["stock-revisions", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock", shopId] });
      void qc.invalidateQueries({ queryKey: ["stock-journal", shopId] });
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelStockRevision(shopId, revision.id),
    onSuccess: () => {
      setConfirm(null);
      void qc.invalidateQueries({ queryKey: ["stock-revisions", shopId] });
    },
  });

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">Ревизия №{revision.id}</p>
          <p className="mt-1 text-sm text-mute">
            Посчитано {countedN} из {revision.line_count}. Расхождение сейчас:{" "}
            <span className={liveValue < 0 ? "text-alert" : ""}>{money(liveValue)}</span>
          </p>
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="min-w-40">
          <option value="all">Все позиции</option>
          <option value="open">Не посчитано</option>
          <option value="diff">Только расхождения</option>
        </Select>
      </div>
      <div className="mt-4 overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
            <tr className="border-b border-ink/10 text-left">
              <th className="px-3 py-2">Позиция</th>
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
                  <td className="px-3 py-2">{line.stock_item_name}</td>
                  <td className="font-mono">{qty(line.expected_quantity, line.base_unit)}</td>
                  <td className="py-1">
                    {id ? (
                      <input
                        className="w-28 border-0 border-b border-line-2 bg-transparent py-1 font-mono outline-none focus:border-ink"
                        value={counted}
                        inputMode="decimal"
                        placeholder={line.base_unit}
                        onChange={(e) => setCounts({ ...counts, [id]: e.target.value })}
                      />
                    ) : (
                      <span className="text-mute">удалено</span>
                    )}
                  </td>
                  <td className={`font-mono ${diff != null && diff < 0 ? "text-alert" : ""}`}>
                    {diff == null ? "—" : `${diff > 0 ? "+" : ""}${qty(diff, line.base_unit)}`}
                  </td>
                  <td className={`font-mono ${value != null && value < 0 ? "text-alert" : ""}`}>
                    {value == null ? "—" : money(value)}
                  </td>
                  <td>
                    {id ? (
                      <input
                        className="w-full border-0 border-b border-line-2 bg-transparent py-1 text-sm outline-none focus:border-ink"
                        value={notes[id] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [id]: e.target.value })}
                        placeholder="бой, пролив…"
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Field label="Комментарий к ревизии">
        <Input
          className="mt-3"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="утро после выходных, перед инвентаризацией месяца"
        />
      </Field>
      {(save.isError || post.isError || cancel.isError) && (
        <p className="mt-3 text-sm text-alert">
          {((save.error || post.error || cancel.error) as Error).message}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="quiet" onClick={() => save.mutate()} disabled={save.isPending}>
          Сохранить черновик
        </Button>
        <Button onClick={() => setConfirm("post")} disabled={countedN === 0}>
          Провести
        </Button>
        <Button variant="ghost" onClick={() => setConfirm("cancel")}>
          Отменить
        </Button>
      </div>
      {confirm && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-sm space-y-3 border border-line bg-paper p-7">
            {confirm === "post" ? (
              <>
                <h2 className="text-2xl font-medium">Провести ревизию?</h2>
                <p className="text-sm text-mute">
                  Остатки по посчитанным позициям станут как в колонке «Факт». Незаполненные строки не трогаем.
                  В журнал уйдут корректировки «Ревизия №{revision.id}».
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => post.mutate()} disabled={post.isPending}>
                    Провести
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirm(null)}>
                    Назад
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-medium">Отменить черновик?</h2>
                <p className="text-sm text-mute">Остатки не изменятся. Черновик останется в истории как отменённый.</p>
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
    </Card>
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
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4" onClick={onClose} role="presentation">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto border border-line bg-paper p-7"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-normal">Ревизия №{revision.id}</h2>
            <p className="mt-1 text-sm text-mute">
              {statusLabel(revision.status)}
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

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useLocale, useT } from "../i18n";
import { dateLocaleTag } from "../lib/i18nName";
import { money, qty } from "../lib/utils";
import type { StockRevision, StockRevisionLine } from "../types";
import { Button, Dialog, Empty, Field, Input, Select } from "./ui";

type Filter = "all" | "open" | "diff";

function when(iso: string, dateTag: string): string {
  return new Date(iso).toLocaleString(dateTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(t: ReturnType<typeof useT>, status: StockRevision["status"]): string {
  if (status === "draft") return t("revisions.draft");
  if (status === "posted") return t("revisions.posted");
  return t("revisions.cancelled");
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
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const dateTag = dateLocaleTag(locale);
  const list = useQuery({
    queryKey: ["stock-revisions", shopId],
    queryFn: () => api.stockRevisions(shopId),
  });
  const history = (list.data ?? []).filter((r) => r.status !== "draft");
  const [openId, setOpenId] = useState<number | null>(null);
  const opened = history.find((r) => r.id === openId) ?? null;

  if (history.length === 0) {
    return <Empty>{t("revisions.empty")}</Empty>;
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
        <table className="w-full text-sm">
          <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
            <tr className="border-b border-ink/10 text-left">
              <th className="px-4 py-3">{t("revisions.colWhen")}</th>
              <th>{t("revisions.colStatus")}</th>
              <th>{t("revisions.colCounted")}</th>
              <th>{t("revisions.colDiff")}</th>
              <th>{t("revisions.colValue")}</th>
              <th>{t("revisions.colWho")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id} className="border-b border-ink/5">
                <td className="px-4 py-3 font-mono text-xs">
                  {when(row.posted_at || row.cancelled_at || row.created_at, dateTag)}
                </td>
                <td>
                  #{row.id} · {statusLabel(t, row.status)}
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
                      {t("common.open")}
                    </Link>
                    <button className="underline" onClick={() => setOpenId(row.id)}>
                      {t("revisions.lines")}
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
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const dateTag = dateLocaleTag(locale);
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
            {t("revisions.snapshot", {
              id: revision.id,
              status: statusLabel(t, revision.status),
              when: when(revision.created_at, dateTag),
            })}
          </p>
        ) : (
          <p>
            {t("revisions.frozen", {
              id: revision.id,
              when: when(revision.created_at, dateTag),
            })}
          </p>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-mute">
            {t("revisions.progress", {
              counted: countedN,
              total: revision.line_count,
              diff: money(liveValue),
            })}
          </p>
          <p className="mt-1 font-mono text-[11px] text-faint">
            {t("revisions.systemNote", { when: when(revision.created_at, dateTag) })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="min-w-40">
            <option value="all">{t("revisions.filterAll")}</option>
            <option value="open">{t("revisions.filterOpen")}</option>
            <option value="diff">{t("revisions.filterDiff")}</option>
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
              <th className="px-4 py-3">{t("revisions.colItem")}</th>
              <th>{t("revisions.colSystem")}</th>
              <th>{t("revisions.colFact")}</th>
              <th>Δ</th>
              <th>{t("revisions.colValue")}</th>
              <th>{t("revisions.colNote")}</th>
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
                        placeholder={t("revisions.notePh")}
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
          <Field label={t("revisions.comment")}>
            <Input
              className="mt-3"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("revisions.commentPh")}
            />
          </Field>
          {(save.isError || post.isError || cancel.isError) && (
            <p className="mt-3 text-sm text-alert">
              {((save.error || post.error || cancel.error) as Error).message}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="quiet" onClick={() => save.mutate()} disabled={save.isPending}>
              {t("common.save")}
            </Button>
            <Button onClick={() => setConfirm("post")} disabled={countedN === 0}>
              {t("revisions.post")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirm("cancel")}>
              {t("revisions.cancelRev")}
            </Button>
          </div>
        </>
      )}

      {confirm && (
        <Dialog
          open
          title={confirm === "post" ? t("revisions.postAsk") : t("revisions.cancelAsk")}
          hint={confirm === "post" ? t("revisions.postHint") : t("revisions.cancelHint")}
          onClose={() => setConfirm(null)}
        >
          {confirm === "post" ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => post.mutate(true)} disabled={post.isPending}>
                {t("revisions.postExcel")}
              </Button>
              <Button onClick={() => post.mutate(false)} disabled={post.isPending} variant="quiet">
                {t("revisions.postOnly")}
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                {t("common.back")}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                {t("revisions.cancelRev")}
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                {t("common.back")}
              </Button>
            </div>
          )}
        </Dialog>
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
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const dateTag = dateLocaleTag(locale);
  return (
    <Dialog
      open
      size="lg"
      title={`${t("stock.revision")} #${revision.id}`}
      hint={`${statusLabel(t, revision.status)} · ${when(revision.created_at, dateTag)}${revision.comment ? ` · ${revision.comment}` : ""}`}
      onClose={onClose}
    >
      <table className="w-full text-sm">
        <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
          <tr className="border-b border-ink/10 text-left">
            <th className="py-2">{t("revisions.colItem")}</th>
            <th>{t("revisions.colSystem")}</th>
            <th>{t("revisions.colFact")}</th>
            <th>Δ</th>
            <th>{t("revisions.sum")}</th>
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
    </Dialog>
  );
}

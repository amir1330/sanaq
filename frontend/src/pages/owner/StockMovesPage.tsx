import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { StockSearchPicker } from "../../components/StockSearchPicker";
import { Button, Empty, PageTitle, pill } from "../../components/ui";
import { useLocale, useT } from "../../i18n";
import { dateLocaleTag } from "../../lib/i18nName";
import { MOVE_KINDS, deltaBase, formatDelta, kindTitle } from "../../lib/stock";
import { money, qty, stockBalance } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { StockJournalEntry, StockJournalKind } from "../../types";

const CARD_KINDS: StockJournalKind[] = ["created", "updated", "deleted"];

const MOVE_TABS: { id: string; labelKey: string; kinds: StockJournalKind[] }[] = [
  { id: "moves", labelKey: "stock.tabAll", kinds: MOVE_KINDS },
  { id: "in", labelKey: "stock.tabIn", kinds: ["income", "refund", "transfer_in", "regrade_in"] },
  { id: "out", labelKey: "stock.tabOut", kinds: ["writeoff", "sale", "transfer_out", "regrade_out"] },
  { id: "revision", labelKey: "stock.tabRev", kinds: ["correction"] },
  { id: "cards", labelKey: "stock.tabCards", kinds: CARD_KINDS },
];

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

function clock(iso: string, dateTag: string): string {
  return new Date(iso).toLocaleTimeString(dateTag, { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string, dateTag: string, today: string, yesterday: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yday = new Date();
  yday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return capitalize(today);
  if (d.toDateString() === yday.toDateString()) return capitalize(yesterday);
  return d.toLocaleDateString(dateTag, { day: "numeric", month: "long" });
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

export function StockMovesPage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const dateTag = dateLocaleTag(locale);
  const shopId = useAuth((s) => s.shopId)!;
  const [params, setParams] = useSearchParams();
  const logItem = params.get("item") ?? "";
  const [logKind, setLogKind] = useState("moves");
  const [pickOpen, setPickOpen] = useState(false);
  const itemId = logItem ? Number(logItem) : null;
  const selectedItemQ = useQuery({
    queryKey: ["stock-item", shopId, itemId],
    queryFn: () => api.stockItem(shopId, itemId!),
    enabled: itemId != null && Number.isFinite(itemId),
  });
  const journal = useQuery({
    queryKey: ["stock-journal", shopId, logItem],
    queryFn: () => api.stockJournal(shopId, logItem ? Number(logItem) : undefined),
  });

  const kindFilter = MOVE_TABS.find((f) => f.id === logKind) ?? MOVE_TABS[0];
  const selectedItem = selectedItemQ.data ?? null;
  const ledger = useMemo(() => {
    const rows = (journal.data ?? []).filter((row) => kindFilter.kinds.includes(row.kind));
    const lines: { row: StockJournalEntry; delta: number | null; after?: number }[] = rows.map((row) => ({
      row,
      delta: deltaBase(row),
    }));
    if (selectedItem && kindFilter.id !== "cards") {
      let cursor = Number(selectedItem.quantity);
      for (const line of lines) {
        if (line.delta == null) continue;
        line.after = cursor;
        cursor -= line.delta;
      }
    }
    const today = t("common.today");
    const yesterday = t("common.yesterday");
    const groups: { day: string; lines: typeof lines }[] = [];
    for (const line of lines) {
      const key = dayKey(line.row.created_at);
      const last = groups[groups.length - 1];
      if (last && dayKey(last.lines[0].row.created_at) === key) last.lines.push(line);
      else groups.push({ day: dayLabel(line.row.created_at, dateTag, today, yesterday), lines: [line] });
    }
    return { groups, empty: lines.length === 0 };
  }, [journal.data, kindFilter, selectedItem, t, dateTag]);

  function setItem(id: string) {
    const next = new URLSearchParams(params);
    if (id) next.set("item", id);
    else next.delete("item");
    setParams(next, { replace: true });
    setPickOpen(false);
  }

  return (
    <div>
      <PageTitle
        kicker={t("stock.movesKicker")}
        title={t("stock.movesTitle")}
        hint={t("stock.movesHint")}
        action={
          <Link to="/owner/stock">
            <Button variant="quiet">{t("stock.toStock")}</Button>
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {MOVE_TABS.map((f) => (
          <button
            key={f.id}
            onClick={() => setLogKind(f.id)}
            className={`${pill} ${
              logKind === f.id
                ? "border-ink bg-ink text-paper"
                : "border-line-2 text-ink-soft hover:border-ink hover:text-ink"
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
        <Button variant="quiet" onClick={() => setPickOpen((v) => !v)}>
          {selectedItem ? selectedItem.name : t("stock.allItems")}
        </Button>
      </div>
      {pickOpen && (
        <div className="mb-4 max-w-md rounded-lg bg-cream p-3 shadow-soft">
          <button type="button" className="mb-2 text-sm underline" onClick={() => setItem("")}>
            {t("stock.showAll")}
          </button>
          <StockSearchPicker
            shopId={shopId}
            selectedId={itemId}
            onPick={(s) => setItem(String(s.id))}
            placeholder={t("stock.searchPh")}
          />
        </div>
      )}
      {selectedItem && (
        <p className="mb-4 rounded-md bg-cream px-5 py-3 text-sm shadow-soft">
          <span className="font-medium">{selectedItem.name}</span>
          <span className="text-mute"> · {t("stock.nowQty", { n: stockBalance(selectedItem) })}</span>
          <Link className="ml-3 underline" to={`/owner/stock/item/${selectedItem.id}`}>
            {t("stock.cardLink")}
          </Link>
          <button className="ml-3 underline" onClick={() => setItem("")}>
            {t("stock.showAll")}
          </button>
        </p>
      )}
      {ledger.empty ? (
        <Empty>{kindFilter.id === "cards" ? t("stock.emptyCards") : t("stock.emptyMoves")}</Empty>
      ) : (
        <div className="space-y-6">
          {ledger.groups.map((group) => (
            <div key={group.day}>
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.13em] text-faint">{group.day}</p>
              <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
                {group.lines.map((line) => {
                  const d = line.delta;
                  const plus = d != null && d > 0;
                  const minus = d != null && d < 0;
                  return (
                    <div
                      key={line.row.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-5 py-3.5 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink">
                          {kindTitle(line.row.kind, d)}
                          {kindFilter.id !== "cards" && logItem === "" ? (
                            <span className="font-normal text-ink-soft"> · {line.row.item_name}</span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-mute">
                          {clock(line.row.created_at, dateTag)}
                          {line.row.actor_name ? ` · ${line.row.actor_name}` : ""}
                          {line.row.price_total != null ? ` · ${money(line.row.price_total)}` : ""}
                          {line.row.comment ? ` · ${line.row.comment}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        {formatDelta(line.row) && (
                          <p
                            className={`font-mono text-[15px] font-semibold ${
                              plus ? "text-turq" : minus ? "text-maroon" : "text-ink"
                            }`}
                          >
                            {formatDelta(line.row)}
                          </p>
                        )}
                        {line.after != null && selectedItem && (
                          <p className="font-mono text-[11px] text-faint">
                            {t("stock.became", { n: qty(line.after, selectedItem.base_unit) })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

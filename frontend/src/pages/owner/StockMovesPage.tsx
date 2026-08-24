import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Empty, PageTitle, Select, pill } from "../../components/ui";
import { money, qty, stockBalance } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { StockJournalEntry, StockJournalKind } from "../../types";

const MOVE_KINDS: StockJournalKind[] = ["income", "writeoff", "correction", "sale", "refund"];
const CARD_KINDS: StockJournalKind[] = ["created", "updated", "deleted"];

const MOVE_TABS: { id: string; label: string; kinds: StockJournalKind[] }[] = [
  { id: "moves", label: "Всё по остатку", kinds: MOVE_KINDS },
  { id: "in", label: "Пришло", kinds: ["income", "refund"] },
  { id: "out", label: "Ушло", kinds: ["writeoff", "sale"] },
  { id: "revision", label: "Ревизии", kinds: ["correction"] },
  { id: "cards", label: "Карточки", kinds: CARD_KINDS },
];

function kindTitle(kind: StockJournalKind, delta: number | null): string {
  if (kind === "income") return "Пришло на склад";
  if (kind === "writeoff") return "Списали";
  if (kind === "sale") return "Ушло в чек";
  if (kind === "refund") return "Вернули на полку";
  if (kind === "correction") return delta != null && delta < 0 ? "Ревизия · недостача" : "Ревизия · излишек";
  if (kind === "created") return "Добавили карточку";
  if (kind === "updated") return "Изменили карточку";
  return "Удалили карточку";
}

function deltaBase(row: StockJournalEntry): number | null {
  if (row.quantity_base == null) return null;
  const n = Number(row.quantity_base);
  if (row.kind === "correction") return n;
  if (row.kind === "writeoff" || row.kind === "sale") return -Math.abs(n);
  if (row.kind === "income" || row.kind === "refund") return Math.abs(n);
  return null;
}

function formatDelta(row: StockJournalEntry): string | null {
  const d = deltaBase(row);
  if (d == null) return null;
  const sign = d < 0 ? "−" : "+";
  const main = `${sign}${qty(Math.abs(d), row.base_unit ?? undefined)}`;
  if (row.kind === "income" && row.quantity_purchase != null && row.purchase_unit) {
    return `+${qty(row.quantity_purchase, row.purchase_unit)} → ${main}`;
  }
  return main;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === yday.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

export function StockMovesPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const [params, setParams] = useSearchParams();
  const logItem = params.get("item") ?? "";
  const [logKind, setLogKind] = useState("moves");
  const stock = useQuery({ queryKey: ["stock", shopId], queryFn: () => api.stock(shopId) });
  const journal = useQuery({
    queryKey: ["stock-journal", shopId, logItem],
    queryFn: () => api.stockJournal(shopId, logItem ? Number(logItem) : undefined),
  });

  const kindFilter = MOVE_TABS.find((f) => f.id === logKind) ?? MOVE_TABS[0];
  const selectedItem = (stock.data ?? []).find((i) => String(i.id) === logItem) ?? null;
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
    const groups: { day: string; lines: typeof lines }[] = [];
    for (const line of lines) {
      const key = dayKey(line.row.created_at);
      const last = groups[groups.length - 1];
      if (last && dayKey(last.lines[0].row.created_at) === key) last.lines.push(line);
      else groups.push({ day: dayLabel(line.row.created_at), lines: [line] });
    }
    return { groups, empty: lines.length === 0 };
  }, [journal.data, kindFilter, selectedItem]);

  function setItem(id: string) {
    const next = new URLSearchParams(params);
    if (id) next.set("item", id);
    else next.delete("item");
    setParams(next, { replace: true });
  }

  return (
    <div>
      <PageTitle
        kicker="Движения"
        title="Почему менялся остаток"
        hint="Отдельный журнал: приход, чек, списание, ревизия. Остатки — в разделе Склад."
        action={
          <Link to="/owner/stock">
            <Button variant="quiet">К остаткам</Button>
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
            {f.label}
          </button>
        ))}
        <Select value={logItem} onChange={(e) => setItem(e.target.value)} className="h-10 min-w-44 py-0">
          <option value="">Все позиции</option>
          {(stock.data ?? []).map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </Select>
      </div>
      {selectedItem && (
        <p className="mb-4 rounded-md bg-cream px-5 py-3 text-sm shadow-soft">
          <span className="font-medium">{selectedItem.name}</span>
          <span className="text-mute"> · сейчас {stockBalance(selectedItem)}</span>
          <button className="ml-3 underline" onClick={() => setItem("")}>
            показать все
          </button>
        </p>
      )}
      {ledger.empty ? (
        <Empty>
          {kindFilter.id === "cards"
            ? "Карточки пока не меняли."
            : "Остаток ещё не двигался. Приход, чек или списание появятся здесь."}
        </Empty>
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
                          {clock(line.row.created_at)}
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
                            стало {qty(line.after, selectedItem.base_unit)}
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

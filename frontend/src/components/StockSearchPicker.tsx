import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { publicUrl, stockBalance } from "../lib/utils";
import type { StockItem } from "../types";
import { Input } from "./ui";

/** Searchable stock picker — never loads the full warehouse list. */
export function StockSearchPicker({
  shopId,
  excludeIds = [],
  onPick,
  selectedId,
  placeholder,
  className,
  emptyHint,
}: {
  shopId: number;
  excludeIds?: number[];
  onPick: (item: StockItem) => void;
  selectedId?: number | null;
  placeholder?: string;
  className?: string;
  emptyHint?: string;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 250);
  const stock = useQuery({
    queryKey: ["stock-pick", shopId, debouncedQ],
    queryFn: () =>
      api.stock(shopId, {
        q: debouncedQ.trim() || undefined,
        limit: 40,
      }),
    enabled: shopId > 0,
  });
  const items = (stock.data?.items ?? []).filter((i) => !excludeIds.includes(i.id));

  return (
    <div className={className}>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? t("common.search")}
      />
      <div className="mt-2 max-h-48 overflow-auto rounded-md bg-cream">
        {items.map((item) => {
          const src = publicUrl(item.image_url);
          const selected = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-paper ${
                selected ? "bg-paper font-medium" : ""
              }`}
              onClick={() => onPick(item)}
            >
              {src ? (
                <img src={src} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-paper font-mono text-[9px] uppercase text-mute">
                  +
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate">{item.name}</span>
              <span className="text-mute">{stockBalance(item)}</span>
              </span>
            </button>
          );
        })}
        {!stock.isLoading && items.length === 0 && (
          <p className="px-4 py-3 text-sm text-mute">{emptyHint ?? t("stock.emptySearch")}</p>
        )}
      </div>
    </div>
  );
}

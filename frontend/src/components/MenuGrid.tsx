import { money } from "../lib/utils";
import { localizedName } from "../lib/i18nName";
import type { Locale } from "../i18n/types";
import type { Category, MenuLayout, Product } from "../types";

export type MenuGridItem = Product;

type Props = {
  products: Product[];
  categories: Category[];
  layout: Pick<MenuLayout, "columns" | "show_dividers" | "card_style">;
  locale: Locale;
  disabled?: boolean;
  onPick: (product: Product) => void;
  categoryFilter?: number | "all";
  priceLabel: (product: Product) => string;
};

function gridClass(columns: number): string {
  if (columns <= 2) return "grid-cols-2";
  if (columns === 3) return "grid-cols-2 md:grid-cols-3";
  if (columns === 4) return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  return "grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
}

export function MenuGrid({
  products,
  categories,
  layout,
  locale,
  disabled,
  onPick,
  categoryFilter = "all",
  priceLabel,
}: Props) {
  const cols = Math.min(5, Math.max(2, layout.columns || 3));
  const showDividers = layout.show_dividers !== false;
  const cardStyle = layout.card_style || "photo";

  const sortedCats = [...categories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
  );

  const sections: { key: string; title: string | null; color?: string | null; items: Product[] }[] =
    [];

  if (categoryFilter !== "all") {
    sections.push({
      key: String(categoryFilter),
      title: null,
      items: products
        .filter((p) => p.category_id === categoryFilter)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)),
    });
  } else if (showDividers) {
    for (const c of sortedCats) {
      const items = products
        .filter((p) => p.category_id === c.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
      if (!items.length) continue;
      sections.push({
        key: String(c.id),
        title: localizedName(c, locale),
        color: c.color,
        items,
      });
    }
    const rest = products
      .filter((p) => !p.category_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
    if (rest.length) {
      sections.push({ key: "none", title: null, items: rest });
    }
  } else {
    sections.push({
      key: "all",
      title: null,
      items: [...products].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
      ),
    });
  }

  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.key}>
          {section.title && (
            <div
              className="col-span-full mb-3 flex items-center gap-2 border-b border-line pb-2"
              style={section.color ? { borderColor: section.color } : undefined}
            >
              {section.color ? (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: section.color }}
                  aria-hidden
                />
              ) : null}
              <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
                {section.title}
              </p>
            </div>
          )}
          <div className={`grid gap-3 ${gridClass(cols)}`}>
            {section.items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p)}
                disabled={disabled}
                className={`min-h-[5.5rem] rounded-lg border-[1.5px] border-transparent bg-paper px-3 py-4 text-left text-ink transition hover:-translate-y-0.5 hover:border-gold sm:px-4 sm:py-[18px] ${
                  disabled ? "opacity-50" : ""
                } ${cardStyle === "list" ? "min-h-0 py-3" : ""} ${
                  cardStyle === "compact" ? "min-h-[4.25rem] py-3" : ""
                }`}
              >
                {cardStyle !== "list" && (p.category_name || p.category_name_kk || p.category_name_en) ? (
                  <p className="truncate font-mono text-[9.5px] uppercase tracking-wide text-ink-soft">
                    {localizedName(
                      {
                        name: p.category_name ?? "",
                        name_kk: p.category_name_kk,
                        name_en: p.category_name_en,
                      },
                      locale,
                    )}
                  </p>
                ) : null}
                <p
                  className={`${cardStyle === "list" ? "mt-0" : "mt-2"} break-words text-[14.5px] font-medium leading-snug`}
                >
                  {localizedName(p, locale)}
                </p>
                {p.barcode || p.sku ? (
                  <p className="mt-1 font-mono text-[11px] text-ink-soft">{p.barcode || p.sku}</p>
                ) : null}
                <p
                  className={`${cardStyle === "list" ? "mt-1" : "mt-3"} font-mono text-sm font-semibold text-gold`}
                >
                  {priceLabel(p)}
                </p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function defaultPriceLabel(product: Product): string {
  const vs = (product.variants ?? []).filter((v) => v.is_active);
  if (vs.length === 0) return money(product.sale_price);
  if (vs.length === 1) return money(vs[0].sale_price);
  const prices = vs.map((v) => Number(v.sale_price));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Glyph } from "../components/Glyph";
import { ShopBrand } from "../components/ShopBrand";
import { cn } from "../lib/utils";
import type { Locale } from "../i18n/types";
import { useLocale, useT } from "../i18n";
import { localizedName } from "../lib/i18nName";
import { money, publicUrl } from "../lib/utils";
import { homePath, useAuth } from "../store/auth";
import type { Product, ProductVariant, VitrineColumn } from "../types";

const PAGE = 100;

type DisplayColumn = {
  id: string | number;
  name: string;
  items: DisplayItem[];
};

type DisplayItem = {
  id: string;
  product: Product;
  variant: ProductVariant | null;
};

function itemPrice(product: Product, variant: ProductVariant | null): string {
  if (variant) return money(variant.sale_price);
  const vs = (product.variants ?? []).filter((v) => v.is_active);
  if (vs.length === 0) return money(product.sale_price);
  if (vs.length === 1) return money(vs[0].sale_price);
  const prices = vs.map((v) => Number(v.sale_price));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
}

function layoutColumns(cols: VitrineColumn[], locale: Locale): DisplayColumn[] {
  return cols.map((col) => ({
    id: col.id,
    name: localizedName(
      { name: col.title, name_kk: col.title_kk, name_en: col.title_en },
      locale,
    ),
    items: col.items.map((item) => ({
      id: String(item.id),
      product: item.product,
      variant: item.variant ?? null,
    })),
  }));
}

export function VitrinePage() {
  const t = useT();
  const locale = useLocale((s) => s.locale);
  const { user, shopId } = useAuth();
  const sid = shopId ?? user?.shop_id ?? 0;
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [full, setFull] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const shops = useQuery({ queryKey: ["shops"], queryFn: api.shops, enabled: sid > 0 });
  const savedLayout = useQuery({
    queryKey: ["vitrine-layout", sid],
    queryFn: () => api.vitrineLayout(sid),
    enabled: sid > 0,
    refetchInterval: 20_000,
  });
  const products = useInfiniteQuery({
    queryKey: ["products", "vitrine", sid],
    queryFn: ({ pageParam }) =>
      api.products(sid, {
        active_only: true,
        limit: PAGE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled: sid > 0,
    refetchInterval: 20_000,
  });
  const categories = useQuery({
    queryKey: ["categories", sid],
    queryFn: () => api.categories(sid),
    enabled: sid > 0,
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (products.hasNextPage && !products.isFetchingNextPage) {
      void products.fetchNextPage();
    }
  }, [products.hasNextPage, products.isFetchingNextPage, products.data]);

  const shop = shops.data?.find((s) => s.id === sid) ?? shops.data?.[0];
  const otherLabel = t("vitrine.other");
  const allProducts = useMemo(
    () => products.data?.pages.flatMap((p) => p.items) ?? [],
    [products.data],
  );

  const columns = useMemo((): DisplayColumn[] => {
    const saved = savedLayout.data?.columns ?? [];
    if (saved.length > 0) {
      return layoutColumns(saved, locale);
    }
    const active = allProducts.filter((p) => p.is_active);
    const cats = categories.data ?? [];
    const blocks = cats
      .map((c) => ({
        id: c.id,
        name: localizedName(c, locale),
        items: active
          .filter((p) => p.category_id === c.id)
          .map((p) => ({ id: String(p.id), product: p, variant: null as ProductVariant | null })),
      }))
      .filter((b) => b.items.length > 0);
    const rest = active.filter((p) => !p.category_id || !cats.some((c) => c.id === p.category_id));
    if (rest.length) {
      blocks.push({
        id: 0,
        name: otherLabel,
        items: rest.map((p) => ({ id: String(p.id), product: p, variant: null })),
      });
    }
    return blocks;
  }, [savedLayout.data, allProducts, categories.data, otherLabel, locale]);

  async function toggleFull() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await rootRef.current?.requestFullscreen();
  }

  const timeLocale = locale === "en" ? "en-GB" : locale === "kk" ? "kk-KZ" : "ru-RU";
  const time = now.toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" });
  const gridCols =
    columns.length >= 3 ? "lg:grid-cols-2 xl:grid-cols-3" : columns.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1";

  return (
    <div ref={rootRef} className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="px-8 pt-7 md:px-12">
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <ShopBrand shop={shop} fallback={t("vitrine.menu")} size="md" markClass="h-6 w-8 text-maroon" />
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-faint">{t("vitrine.menu")}</p>
          </div>
          <p className="shrink-0 font-mono text-[28px] tabular-nums text-gold md:text-[34px]">{time}</p>
        </div>
      </header>

      <main
        className={cn(
          "grid flex-1 auto-rows-min gap-x-0 gap-y-12 px-8 py-8 md:px-12",
          gridCols,
        )}
      >
        {columns.map((col, i) => (
          <section key={col.id} className={cn("min-w-0 px-6", i > 0 && "border-l border-line")}>
            <div className="mb-5 flex flex-col items-center text-center">
              <Glyph name="ornament" className="h-6 w-full max-w-[220px] text-maroon md:h-7 md:max-w-[260px]" />
              <h2 className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
                {col.name}
              </h2>
            </div>
            <ul className="space-y-1">
              {col.items.map((item, rowIdx) => (
                <MenuRow
                  key={item.id}
                  product={item.product}
                  variant={item.variant}
                  striped={rowIdx % 2 === 1}
                />
              ))}
            </ul>
          </section>
        ))}
        {products.isSuccess && columns.length === 0 && (
          <p className="font-display text-2xl text-mute">{t("vitrine.empty")}</p>
        )}
      </main>

      <footer className="mt-auto flex items-center justify-between gap-4 px-8 py-4 md:px-12">
        <Link to={homePath(user?.role)} className="text-[12.5px] text-faint hover:text-ink">
          {t("vitrine.back")}
        </Link>
        <button type="button" className="text-[12.5px] text-faint hover:text-ink" onClick={() => void toggleFull()}>
          {full ? t("vitrine.exitFullscreen") : t("vitrine.fullscreen")}
        </button>
      </footer>
    </div>
  );
}

function MenuRow({
  product,
  variant,
  striped,
}: {
  product: Product;
  variant: ProductVariant | null;
  striped?: boolean;
}) {
  const locale = useLocale((s) => s.locale);
  const label = variant
    ? `${localizedName(product, locale)} — ${localizedName(variant, locale)}`
    : localizedName(product, locale);
  const src = publicUrl(product.image_url);
  return (
    <li
      className={cn(
        "flex items-end gap-3.5 rounded-md px-3 py-2",
        striped ? "bg-paper-2" : "bg-transparent",
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-md object-cover" />
      ) : (
        <span className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-md bg-paper-2 font-display text-2xl text-maroon">
          {label.slice(0, 1)}
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-baseline gap-2 pb-1">
        <h3 className="min-w-0 truncate font-display text-[26px] font-normal leading-none md:text-[30px]">
          {label}
        </h3>
        <span className="mb-[3px] min-w-6 flex-1 border-b border-dotted border-line-2" />
        <span className="shrink-0 font-mono text-[18px] font-semibold tabular-nums text-gold md:text-[20px]">
          {itemPrice(product, variant)}
        </span>
      </div>
    </li>
  );
}

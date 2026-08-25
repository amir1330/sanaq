import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Glyph } from "../components/Glyph";
import { ShopBrand } from "../components/ShopBrand";
import { useLocale, useT } from "../i18n";
import { localizedName } from "../lib/i18nName";
import { money, publicUrl } from "../lib/utils";
import { homePath, useAuth } from "../store/auth";
import type { Product } from "../types";

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
  const products = useQuery({
    queryKey: ["products", sid],
    queryFn: () => api.products(sid),
    enabled: sid > 0,
    refetchInterval: 20_000,
  });
  const categories = useQuery({
    queryKey: ["categories", sid],
    queryFn: () => api.categories(sid),
    enabled: sid > 0,
    refetchInterval: 20_000,
  });

  const shop = shops.data?.find((s) => s.id === sid) ?? shops.data?.[0];
  const otherLabel = t("vitrine.other");
  const columns = useMemo(() => {
    const active = (products.data ?? []).filter((p) => p.is_active);
    const cats = categories.data ?? [];
    const blocks = cats
      .map((c) => ({
        id: c.id,
        name: localizedName(c, locale),
        items: active.filter((p) => p.category_id === c.id),
      }))
      .filter((b) => b.items.length > 0);
    const rest = active.filter((p) => !p.category_id || !cats.some((c) => c.id === p.category_id));
    if (rest.length) blocks.push({ id: 0, name: otherLabel, items: rest });
    return blocks;
  }, [products.data, categories.data, otherLabel, locale]);

  async function toggleFull() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await rootRef.current?.requestFullscreen();
  }

  const timeLocale = locale === "en" ? "en-GB" : locale === "kk" ? "kk-KZ" : "ru-RU";
  const time = now.toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" });

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

      <main className="grid flex-1 auto-rows-min gap-x-12 gap-y-12 px-8 py-8 md:px-12 lg:grid-cols-2 xl:grid-cols-3">
        {columns.map((col) => (
          <section key={col.id} className="min-w-0">
            <div className="mb-5 flex flex-col items-center text-center">
              <Glyph name="ornament" className="h-6 w-full max-w-[220px] text-maroon md:h-7 md:max-w-[260px]" />
              <h2 className="mt-3 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
                {col.name}
              </h2>
            </div>
            <ul className="space-y-4">
              {col.items.map((p) => (
                <MenuRow key={p.id} product={p} />
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

function MenuRow({ product }: { product: Product }) {
  const locale = useLocale((s) => s.locale);
  const label = localizedName(product, locale);
  const src = publicUrl(product.image_url);
  return (
    <li className="flex items-end gap-3.5">
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
          {money(product.sale_price)}
        </span>
      </div>
    </li>
  );
}

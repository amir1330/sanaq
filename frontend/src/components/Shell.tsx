import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useAuth, useAuthSessionReady } from "../store/auth";
import { Brand } from "./Mark";
import { ShopBrand } from "./ShopBrand";
import { Button } from "./ui";

export function Shell({ kind }: { kind: "owner" | "admin" }) {
  const t = useT();
  const { shopId, setShopId } = useAuth();
  const sessionReady = useAuthSessionReady();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const shops = useQuery({
    queryKey: ["shops"],
    queryFn: api.shops,
    enabled: kind === "owner" && sessionReady,
  });
  const currentShop = shops.data?.find((s) => s.id === shopId) ?? shops.data?.[0];
  const links =
    kind === "owner"
      ? [
          { to: "/owner", label: t("nav.reports") },
          { to: "/owner/products", label: t("nav.products") },
          { to: "/owner/menu", label: t("nav.menu") },
          { to: "/owner/stock", label: t("nav.stock") },
          { to: "/owner/stock/revisions", label: t("nav.revisions") },
          { to: "/owner/staff", label: t("nav.staff") },
          { to: "/owner/expenses", label: t("nav.expenses") },
          { to: "/owner/shifts", label: t("nav.shifts") },
          { to: "/pos", label: t("nav.till") },
          { to: "/owner/settings", label: t("nav.settings") },
        ]
      : [
          { to: "/admin", label: t("nav.shops") },
          { to: "/admin/users", label: t("nav.users") },
          { to: "/admin/leads", label: t("nav.leads") },
          { to: "/admin/settings", label: t("nav.settings") },
        ];

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function linkClass(isActive: boolean, to: string) {
    const onStockCard = to === "/owner/stock" && location.pathname.startsWith("/owner/stock/item/");
    const on = isActive || onStockCard;
    return on
      ? "rounded-full bg-ink px-[15px] py-[9px] text-[12.5px] text-paper"
      : "rounded-full px-[15px] py-[9px] text-[12.5px] text-faint hover:text-ink";
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[1100px] px-4 pb-[70px] sm:px-8">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 py-[22px]">
          <button type="button" onClick={() => navigate(kind === "admin" ? "/admin" : "/owner")} className="min-w-0">
            {kind === "admin" ? (
              <Brand className="text-[17px]" markClass="h-[18px] w-[25px]" />
            ) : (
              <ShopBrand shop={currentShop} fallback={t("nav.pointFallback")} />
            )}
          </button>

          <nav className="hidden flex-wrap gap-1 rounded-full bg-cream p-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/owner" || l.to === "/admin" || l.to === "/owner/stock"}
                className={({ isActive }) => linkClass(isActive, l.to)}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="relative flex items-center gap-3 text-[12.5px] text-faint md:gap-4" ref={menuRef}>
            {kind === "owner" && (shops.data?.length ?? 0) > 1 && (
              <label className="hidden items-center gap-2 sm:flex">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{t("nav.branch")}</span>
                <select
                  className="max-w-48 rounded-full border-[1.5px] border-line-2 bg-transparent px-3 py-1 text-ink outline-none"
                  value={shopId ?? ""}
                  onChange={(e) => setShopId(Number(e.target.value))}
                >
                  {shops.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.address ? ` · ${s.address}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="md:hidden">
              <Button
                variant="quiet"
                aria-expanded={menuOpen}
                aria-label={t("common.menu")}
                onClick={() => setMenuOpen((o) => !o)}
              >
                {t("common.menu")}
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-40 mt-2 w-[min(100vw-2rem,16rem)] rounded-lg border border-line bg-paper p-2 shadow-soft">
                  {kind === "owner" && (shops.data?.length ?? 0) > 1 && (
                    <label className="mb-2 block border-b border-line px-2 pb-3 sm:hidden">
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                        {t("nav.branch")}
                      </span>
                      <select
                        className="mt-1 w-full rounded-md border-[1.5px] border-line-2 bg-transparent px-3 py-2 text-ink outline-none"
                        value={shopId ?? ""}
                        onChange={(e) => setShopId(Number(e.target.value))}
                      >
                        {shops.data?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {s.address ? ` · ${s.address}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <nav className="flex flex-col gap-0.5">
                    {links.map((l) => (
                      <NavLink
                        key={l.to}
                        to={l.to}
                        end={l.to === "/owner" || l.to === "/admin" || l.to === "/owner/stock"}
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) => {
                          const onStockCard =
                            l.to === "/owner/stock" && location.pathname.startsWith("/owner/stock/item/");
                          const on = isActive || onStockCard;
                          return on
                            ? "rounded-md bg-ink px-3 py-3 text-[13px] text-paper"
                            : "rounded-md px-3 py-3 text-[13px] text-ink-soft hover:bg-paper-2 hover:text-ink";
                        }}
                      >
                        {l.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>
              )}
            </div>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

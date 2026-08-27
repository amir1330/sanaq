import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useAuth, useAuthSessionReady } from "../store/auth";
import { Brand } from "./Mark";
import { ShopBrand } from "./ShopBrand";
import { Button } from "./ui";

type NavItem = { to: string; label: string; end?: boolean };
type NavGroup = { id: string; label: string; items: NavItem[] };

function isNavActive(pathname: string, to: string, end?: boolean) {
  if (to === "/owner/stock") {
    return (
      pathname === "/owner/stock" ||
      pathname.startsWith("/owner/stock/item/") ||
      pathname.startsWith("/owner/stock/moves")
    );
  }
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

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

  const groups: NavGroup[] = useMemo(
    () =>
      kind === "owner"
        ? [
            {
              id: "sales",
              label: t("nav.groupSales"),
              items: [
                { to: "/owner", label: t("nav.reports"), end: true },
                { to: "/pos", label: t("nav.till") },
                { to: "/owner/shifts", label: t("nav.shifts") },
              ],
            },
            {
              id: "menu",
              label: t("nav.groupMenu"),
              items: [{ to: "/owner/products", label: t("nav.products") }],
            },
            {
              id: "stock",
              label: t("nav.groupStock"),
              items: [
                { to: "/owner/stock", label: t("nav.stock"), end: true },
                { to: "/owner/stock/revisions", label: t("nav.revisions") },
              ],
            },
            {
              id: "team",
              label: t("nav.groupTeam"),
              items: [
                { to: "/owner/staff", label: t("nav.staff") },
                { to: "/owner/expenses", label: t("nav.expenses") },
              ],
            },
            {
              id: "settings",
              label: t("nav.groupOther"),
              items: [{ to: "/owner/settings", label: t("nav.settings") }],
            },
          ]
        : [
            {
              id: "platform",
              label: t("nav.groupPlatform"),
              items: [
                { to: "/admin", label: t("nav.shops"), end: true },
                { to: "/admin/users", label: t("nav.users") },
                { to: "/admin/leads", label: t("nav.leads") },
              ],
            },
            {
              id: "settings",
              label: t("nav.groupOther"),
              items: [{ to: "/admin/settings", label: t("nav.settings") }],
            },
          ],
    [kind, t],
  );

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

  function desktopLinkClass(active: boolean) {
    return active
      ? "rounded-full bg-ink px-[15px] py-[9px] text-[12.5px] text-paper"
      : "rounded-full px-[15px] py-[9px] text-[12.5px] text-faint hover:text-ink";
  }

  function mobileLinkClass(active: boolean) {
    return active
      ? "rounded-md bg-ink px-3 py-3 text-[13px] text-paper"
      : "rounded-md px-3 py-3 text-[13px] text-ink-soft hover:bg-paper-2 hover:text-ink";
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[1100px] px-4 pb-[70px] sm:px-8">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4 py-[22px]">
          <button type="button" onClick={() => navigate(kind === "admin" ? "/admin" : "/owner")} className="min-w-0">
            {kind === "admin" ? (
              <Brand className="text-[17px]" markClass="h-[18px] w-[25px]" />
            ) : (
              <ShopBrand shop={currentShop} fallback={t("nav.pointFallback")} />
            )}
          </button>

          <nav className="hidden flex-wrap items-end justify-end gap-x-4 gap-y-2 md:flex lg:gap-x-5">
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-1">
                <span className="px-2 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">{group.label}</span>
                <div className="flex gap-0.5 rounded-full bg-cream p-1">
                  {group.items.map((item) => {
                    const active = isNavActive(location.pathname, item.to, item.end);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={desktopLinkClass(active)}
                      >
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
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
                <div className="absolute right-0 top-full z-40 mt-2 w-[min(100vw-2rem,18rem)] rounded-lg border border-line bg-paper p-2 shadow-soft">
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
                  <nav className="flex flex-col gap-3">
                    {groups.map((group) => (
                      <div key={group.id}>
                        <p className="px-3 pb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                          {group.label}
                        </p>
                        <div className="flex flex-col gap-0.5">
                          {group.items.map((item) => {
                            const active = isNavActive(location.pathname, item.to, item.end);
                            return (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                onClick={() => setMenuOpen(false)}
                                className={mobileLinkClass(active)}
                              >
                                {item.label}
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
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

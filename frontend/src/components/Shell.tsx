import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useAuth, useAuthSessionReady } from "../store/auth";
import { cn } from "../lib/utils";
import { Brand } from "./Mark";
import { NavIcon, type NavIconName } from "./NavIcon";
import { ShopBrand } from "./ShopBrand";

type NavItem = { to: string; label: string; icon: NavIconName; end?: boolean; primary?: boolean };
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
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
                { to: "/pos", label: t("nav.till"), icon: "till", primary: true },
                { to: "/owner", label: t("nav.reports"), icon: "reports", end: true },
                { to: "/owner/shifts", label: t("nav.shifts"), icon: "shifts" },
              ],
            },
            {
              id: "menu",
              label: t("nav.groupMenu"),
              items: [{ to: "/owner/products", label: t("nav.products"), icon: "products" }],
            },
            {
              id: "stock",
              label: t("nav.groupStock"),
              items: [
                { to: "/owner/stock", label: t("nav.stock"), icon: "stock", end: true },
                { to: "/owner/stock/revisions", label: t("nav.revisions"), icon: "revisions" },
              ],
            },
            {
              id: "team",
              label: t("nav.groupTeam"),
              items: [
                { to: "/owner/staff", label: t("nav.staff"), icon: "staff" },
                { to: "/owner/expenses", label: t("nav.expenses"), icon: "expenses" },
              ],
            },
            {
              id: "settings",
              label: t("nav.groupOther"),
              items: [{ to: "/owner/settings", label: t("nav.settings"), icon: "settings" }],
            },
          ]
        : [
            {
              id: "platform",
              label: t("nav.groupPlatform"),
              items: [
                { to: "/admin", label: t("nav.shops"), icon: "shops", end: true },
                { to: "/admin/users", label: t("nav.users"), icon: "users" },
                { to: "/admin/leads", label: t("nav.leads"), icon: "leads" },
              ],
            },
            {
              id: "settings",
              label: t("nav.groupOther"),
              items: [{ to: "/admin/settings", label: t("nav.settings"), icon: "settings" }],
            },
          ],
    [kind, t],
  );

  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const mobileTabs = useMemo(() => {
    if (kind === "owner") {
      const till = allItems.find((i) => i.to === "/pos")!;
      const reports = allItems.find((i) => i.to === "/owner")!;
      const stock = allItems.find((i) => i.to === "/owner/stock")!;
      return [till, reports, stock];
    }
    const shopsItem = allItems.find((i) => i.to === "/admin")!;
    const users = allItems.find((i) => i.to === "/admin/users")!;
    const leads = allItems.find((i) => i.to === "/admin/leads")!;
    return [shopsItem, users, leads];
  }, [allItems, kind]);

  const moreItems = useMemo(
    () => allItems.filter((item) => !mobileTabs.some((tab) => tab.to === item.to)),
    [allItems, mobileTabs],
  );

  const moreActive = moreItems.some((item) => isNavActive(location.pathname, item.to, item.end));

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onPointer(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  function railLinkClass(active: boolean, primary?: boolean) {
    return cn(
      "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition",
      active
        ? "border-l-2 border-sun bg-paper-2 pl-[10px] text-ink"
        : "border-l-2 border-transparent text-ink-soft hover:bg-paper-2 hover:text-ink",
      primary && !active && "text-sun",
    );
  }

  function mobileTabClass(active: boolean) {
    return cn(
      "flex min-h-11 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium",
      active ? "text-sun" : "text-faint",
    );
  }

  return (
    <div className="min-h-screen bg-paper md:flex">
      <aside className="hidden w-rail shrink-0 flex-col border-r border-line bg-paper-2 md:fixed md:inset-y-0 md:left-0 md:flex">
        <div className="border-b border-line px-5 py-5">
          <button
            type="button"
            onClick={() => navigate(kind === "admin" ? "/admin" : "/owner")}
            className="min-w-0 text-left"
          >
            {kind === "admin" ? (
              <Brand className="text-[16px]" markClass="h-[17px] w-[24px]" />
            ) : (
              <ShopBrand shop={currentShop} fallback={t("nav.pointFallback")} />
            )}
          </button>
        </div>

        {kind === "owner" && (shops.data?.length ?? 0) > 1 && (
          <div className="border-b border-line px-4 py-4">
            <label className="block">
              <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                {t("nav.branch")}
              </span>
              <select
                className="w-full rounded-md border border-line-2 bg-paper px-3 py-2 text-[13px] text-ink outline-none focus:border-sun"
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
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group, groupIndex) => (
            <div key={group.id} className={cn(groupIndex > 0 && "mt-6")}>
              <p className="mb-2 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isNavActive(location.pathname, item.to, item.end);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={railLinkClass(active, item.primary)}
                    >
                      <NavIcon name={item.icon} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-5 py-4">
          <hr className="perforation-h mb-4" />
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">Sanaq</p>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:ml-rail">
        <main className="page-enter mx-auto w-full max-w-[1080px] flex-1 px-4 py-6 pb-24 sm:px-8 md:py-8 md:pb-10">
          <Outlet />
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-md md:hidden"
          aria-label={t("common.menu")}
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
            {mobileTabs.map((item) => {
              const active = isNavActive(location.pathname, item.to, item.end);
              return (
                <NavLink key={item.to} to={item.to} end={item.end} className={mobileTabClass(active)}>
                  <NavIcon name={item.icon} className={cn(active && "text-sun")} />
                  <span className="max-w-[4.5rem] truncate">{item.label}</span>
                </NavLink>
              );
            })}
            <div className="relative flex flex-1" ref={moreRef}>
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={mobileTabClass(moreOpen || moreActive)}
                onClick={() => setMoreOpen((o) => !o)}
              >
                <NavIcon name="more" className={cn((moreOpen || moreActive) && "text-sun")} />
                <span>{t("common.more")}</span>
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full right-0 z-40 mb-2 w-[min(100vw-2rem,16rem)] overflow-hidden rounded-md border border-line bg-paper shadow-soft"
                >
                  {kind === "owner" && (shops.data?.length ?? 0) > 1 && (
                    <label className="block border-b border-line px-4 py-3">
                      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                        {t("nav.branch")}
                      </span>
                      <select
                        className="w-full rounded-md border border-line-2 bg-paper-2 px-3 py-2 text-[13px] text-ink outline-none"
                        value={shopId ?? ""}
                        onChange={(e) => setShopId(Number(e.target.value))}
                      >
                        {shops.data?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {groups.map((group) => {
                    const items = group.items.filter((item) => !mobileTabs.some((tab) => tab.to === item.to));
                    if (items.length === 0) return null;
                    return (
                      <div key={group.id} className="border-b border-line px-2 py-2 last:border-0">
                        <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                          {group.label}
                        </p>
                        {items.map((item) => {
                          const active = isNavActive(location.pathname, item.to, item.end);
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end={item.end}
                              role="menuitem"
                              onClick={() => setMoreOpen(false)}
                              className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px]",
                                active ? "bg-paper-2 text-ink" : "text-ink-soft hover:bg-paper-2",
                              )}
                            >
                              <NavIcon name={item.icon} />
                              {item.label}
                            </NavLink>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}

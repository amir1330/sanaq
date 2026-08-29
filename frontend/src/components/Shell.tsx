import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useAuth, useAuthSessionReady } from "../store/auth";
import { cn } from "../lib/utils";
import { Brand } from "./Mark";
import { flattenNavLinks, isNavActive, NavRailGroups, railLinkClass, type NavGroupDef } from "./NavRail";
import { OWNER_MOBILE_TABS, OWNER_MORE_SECTIONS } from "./navRoutes";
import { NavIcon, type NavIconName } from "./NavIcon";
import { ShopBrand } from "./ShopBrand";
import { SkipLink } from "./SkipLink";
import { NotificationBell } from "./NotificationHost";

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

  const groups: NavGroupDef[] = useMemo(
    () =>
      kind === "owner"
        ? [
            {
              id: "today",
              label: t("nav.groupToday"),
              items: [
                { kind: "link", to: "/pos", label: t("nav.till"), icon: "till", primary: true },
                { kind: "link", to: "/vitrine", label: t("nav.vitrine"), icon: "vitrine" },
              ],
            },
            {
              id: "money",
              label: t("nav.groupMoney"),
              items: [
                { kind: "link", to: "/owner", label: t("nav.reports"), icon: "reports", end: true },
                { kind: "link", to: "/owner/expenses", label: t("nav.expenses"), icon: "expenses" },
                { kind: "link", to: "/owner/shifts", label: t("nav.shiftsHistory"), icon: "shifts" },
              ],
            },
            {
              id: "menu",
              label: t("nav.groupMenu"),
              items: [{ kind: "link", to: "/owner/products", label: t("nav.products"), icon: "products" }],
            },
            {
              id: "stock",
              label: t("nav.groupStock"),
              items: [
                {
                  kind: "submenu",
                  id: "stock",
                  label: t("nav.groupStock"),
                  icon: "stock",
                  children: [
                    { to: "/owner/stock", label: t("nav.stockBalances"), end: true },
                    { to: "/owner/stock/moves", label: t("nav.stockMoves") },
                    { to: "/owner/stock/revisions", label: t("nav.revisions") },
                  ],
                },
              ],
            },
            {
              id: "shop",
              label: t("nav.groupShop"),
              items: [
                { kind: "link", to: "/owner/staff", label: t("nav.staff"), icon: "staff" },
                {
                  kind: "submenu",
                  id: "settings",
                  label: t("nav.settings"),
                  icon: "settings",
                  children: [
                    { to: "/owner/settings", label: t("settings.tabBranch"), end: true },
                    { to: "/owner/settings/pos", label: t("settings.tabPos") },
                    { to: "/owner/settings/network", label: t("settings.tabNetwork") },
                  ],
                },
              ],
            },
          ]
        : [
            {
              id: "platform",
              label: t("nav.groupPlatform"),
              items: [
                { kind: "link", to: "/admin", label: t("nav.shops"), icon: "shops", end: true },
                { kind: "link", to: "/admin/users", label: t("nav.users"), icon: "users" },
                { kind: "link", to: "/admin/leads", label: t("nav.leads"), icon: "leads" },
              ],
            },
          ],
    [kind, t],
  );

  const footerLink = { to: "/owner/account", label: t("nav.account"), icon: "account" as NavIconName };

  const allItems = useMemo(() => flattenNavLinks(groups), [groups]);

  const mobileTabs = useMemo(() => {
    if (kind === "owner") {
      return OWNER_MOBILE_TABS.map((tab) => ({
        ...tab,
        label: t(tab.labelKey),
      }));
    }
    const shopsItem = allItems.find((i) => i.to === "/admin")!;
    const users = allItems.find((i) => i.to === "/admin/users")!;
    const leads = allItems.find((i) => i.to === "/admin/leads")!;
    return [shopsItem, users, leads];
  }, [allItems, kind, t]);

  const ownerMoreSections = useMemo(
    () =>
      OWNER_MORE_SECTIONS.map((section) => ({
        ...section,
        label: t(section.labelKey),
        items: section.items.map((item) => ({
          ...item,
          label: t(item.labelKey),
        })),
      })),
    [t],
  );

  const moreActive =
    kind === "owner"
      ? ownerMoreSections.some((section) =>
          section.items.some((item) =>
            isNavActive(location.pathname, item.to, { end: item.end, activeRule: item.activeRule }),
          ),
        )
      : allItems.some(
          (item) =>
            !mobileTabs.some((tab) => tab.to === item.to) &&
            isNavActive(location.pathname, item.to, item.end),
        );

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

  function mobileTabClass(active: boolean) {
    return cn(
      "flex min-h-14 min-w-[4.75rem] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium touch-manipulation",
      active ? "text-sun" : "text-faint",
    );
  }

  return (
    <div className="min-h-screen bg-paper md:flex">
      <SkipLink />
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
              <div className="min-w-0">
                <ShopBrand shop={currentShop} fallback={t("nav.pointFallback")} />
                <p className="mt-1.5 truncate text-[11px] leading-snug text-faint">
                  {currentShop?.address?.trim() || t("admin.noAddress")}
                </p>
              </div>
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
                className="w-full min-h-12 rounded-md border border-line-2 bg-paper px-3 py-2 text-[15px] text-ink outline-none focus:border-sun touch-manipulation"
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
          <NavRailGroups groups={groups} />
        </nav>

        <div className="border-t border-line px-3 py-3">
          {kind === "owner" ? (
            <NavLink
              to={footerLink.to}
              className={({ isActive }) => railLinkClass(isActive)}
            >
              <NavIcon name={footerLink.icon} />
              <span>{footerLink.label}</span>
            </NavLink>
          ) : (
            <NavLink to="/admin/settings" className={({ isActive }) => railLinkClass(isActive)}>
              <NavIcon name="account" />
              <span>{t("nav.account")}</span>
            </NavLink>
          )}
        </div>

        <div className="px-5 py-4">
          <hr className="perforation-h mb-4" />
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">Sanaq</p>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:ml-rail">
        <div className="fixed right-3 top-3 z-40 md:right-6 md:top-5">
          <NotificationBell />
        </div>
        <main id="main-content" className="page-enter mx-auto w-full max-w-[1080px] flex-1 px-4 py-6 pb-24 sm:px-8 md:py-8 md:pb-10">
          <Outlet />
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-md md:hidden"
          aria-label={t("common.menu")}
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
            {mobileTabs.map((item) => {
              const active =
                "activeRule" in item && item.activeRule !== undefined
                  ? isNavActive(location.pathname, item.to, {
                      end: item.end,
                      activeRule: item.activeRule,
                    })
                  : isNavActive(location.pathname, item.to, item.end);
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
                  className="absolute bottom-full right-0 z-40 mb-2 max-h-[min(70vh,24rem)] w-[min(100vw-2rem,18rem)] overflow-y-auto rounded-md border border-line bg-paper shadow-soft"
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
                  {kind === "owner"
                    ? ownerMoreSections.map((section) => (
                        <div key={section.id} className="border-b border-line px-2 py-2">
                          <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                            {section.label}
                          </p>
                          {section.items.map((item) => {
                            const active = isNavActive(location.pathname, item.to, {
                              end: item.end,
                              activeRule: item.activeRule,
                            });
                            return (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                role="menuitem"
                                onClick={() => setMoreOpen(false)}
                                className={cn(
                                  "flex min-h-12 items-center gap-3 rounded-md px-3 py-3 text-[15px] touch-manipulation",
                                  active ? "bg-paper-2 text-ink" : "text-ink-soft hover:bg-paper-2",
                                )}
                              >
                                <NavIcon name={item.icon} />
                                {item.label}
                              </NavLink>
                            );
                          })}
                        </div>
                      ))
                    : groups.map((group) => {
                        const items = group.items
                          .flatMap((item) => {
                            if (item.kind === "link") return [item];
                            return item.children.map((child) => ({
                              kind: "link" as const,
                              to: child.to,
                              label: child.label,
                              icon: item.icon,
                              end: child.end,
                            }));
                          })
                          .filter((item) => !mobileTabs.some((tab) => tab.to === item.to));
                        if (items.length === 0) return null;
                        return (
                          <div key={group.id} className="border-b border-line px-2 py-2">
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
                                    "flex min-h-12 items-center gap-3 rounded-md px-3 py-3 text-[15px] touch-manipulation",
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

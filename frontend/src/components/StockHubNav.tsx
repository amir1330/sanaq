import { NavLink, useLocation } from "react-router-dom";
import { useT } from "../i18n";
import { cn } from "../lib/utils";
import { pill } from "./ui";

const TABS = [
  { to: "/owner/stock", labelKey: "stock.hubBalances" as const, end: true },
  { to: "/owner/stock/moves", labelKey: "stock.hubMoves" as const },
  { to: "/owner/stock/revisions", labelKey: "stock.hubRevisions" as const },
];

function tabActive(pathname: string, to: string, end?: boolean) {
  if (to === "/owner/stock") {
    return pathname === "/owner/stock" || pathname.startsWith("/owner/stock/item/");
  }
  if (to === "/owner/stock/revisions") {
    return pathname === "/owner/stock/revisions" || pathname.startsWith("/owner/stock/revisions/");
  }
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

export function StockHubNav({ className }: { className?: string }) {
  const t = useT();
  const { pathname } = useLocation();

  return (
    <nav
      className={cn("mb-6 flex flex-wrap gap-2 border-b border-line pb-4", className)}
      aria-label={t("stock.hubLabel")}
    >
      {TABS.map((tab) => {
        const active = tabActive(pathname, tab.to, tab.end);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={cn(
              pill,
              active
                ? "border-ink bg-ink text-paper"
                : "border-line-2 text-ink-soft hover:border-ink hover:text-ink",
            )}
          >
            {t(tab.labelKey)}
          </NavLink>
        );
      })}
    </nav>
  );
}

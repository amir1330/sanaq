import type { NavIconName } from "./NavIcon";

export type NavActiveRule =
  | "exact"
  | "prefix"
  | { type: "prefix"; except?: string[] }
  | { type: "fn"; test: (pathname: string) => boolean };

export type NavActiveOptions = {
  end?: boolean;
  activeRule?: NavActiveRule;
};

/** Per-route active matching for sidebar and shared nav items. */
const ROUTE_ACTIVE_RULES: Record<string, NavActiveRule> = {
  "/owner/stock": {
    type: "fn",
    test: (pathname) => pathname === "/owner/stock" || pathname.startsWith("/owner/stock/item/"),
  },
  "/owner/stock/moves": "exact",
  "/owner/stock/revisions": {
    type: "fn",
    test: (pathname) =>
      pathname === "/owner/stock/revisions" || pathname.startsWith("/owner/stock/revisions/"),
  },
  "/owner/settings": "exact",
  "/owner/settings/pos": "exact",
  "/owner/settings/network": "exact",
  "/owner/account": "exact",
};

function evalNavActiveRule(pathname: string, to: string, rule: NavActiveRule): boolean {
  if (rule === "exact") return pathname === to;
  if (rule === "prefix") return pathname === to || pathname.startsWith(`${to}/`);
  if (rule.type === "fn") return rule.test(pathname);
  if (pathname === to) return true;
  if (!pathname.startsWith(`${to}/`)) return false;
  const rest = pathname.slice(to.length + 1);
  return !rule.except?.some((prefix) => rest === prefix || rest.startsWith(`${prefix}/`));
}

export function isNavActive(
  pathname: string,
  to: string,
  options?: boolean | NavActiveOptions,
): boolean {
  const opts: NavActiveOptions = typeof options === "boolean" ? { end: options } : (options ?? {});

  if (opts.activeRule) {
    return evalNavActiveRule(pathname, to, opts.activeRule);
  }

  const rule = ROUTE_ACTIVE_RULES[to];
  if (rule) {
    return evalNavActiveRule(pathname, to, rule);
  }

  if (opts.end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export type MobileTabDef = {
  to: string;
  icon: NavIconName;
  labelKey: "nav.till" | "nav.products" | "nav.vitrine" | "nav.stock";
  end?: boolean;
  activeRule?: NavActiveRule;
};

export const OWNER_MOBILE_TABS: MobileTabDef[] = [
  { to: "/pos", icon: "till", labelKey: "nav.till" },
  { to: "/owner/products", icon: "products", labelKey: "nav.products" },
  { to: "/vitrine", icon: "vitrine", labelKey: "nav.vitrine" },
  {
    to: "/owner/stock",
    icon: "stock",
    labelKey: "nav.stock",
    activeRule: {
      type: "fn",
      test: (pathname) => pathname.startsWith("/owner/stock"),
    },
  },
];

export type MoreMenuItemDef = {
  to: string;
  icon: NavIconName;
  labelKey:
    | "nav.reports"
    | "nav.expenses"
    | "nav.shiftsHistory"
    | "nav.staff"
    | "nav.settings"
    | "nav.account";
  end?: boolean;
  activeRule?: NavActiveRule;
};

export type MoreMenuSectionDef = {
  id: string;
  labelKey: "nav.groupMoney" | "nav.groupShop";
  items: MoreMenuItemDef[];
};

export const OWNER_MORE_SECTIONS: MoreMenuSectionDef[] = [
  {
    id: "money",
    labelKey: "nav.groupMoney",
    items: [
      { to: "/owner", icon: "reports", labelKey: "nav.reports", end: true },
      { to: "/owner/expenses", icon: "expenses", labelKey: "nav.expenses" },
      { to: "/owner/shifts", icon: "shifts", labelKey: "nav.shiftsHistory" },
    ],
  },
  {
    id: "shop",
    labelKey: "nav.groupShop",
    items: [
      { to: "/owner/staff", icon: "staff", labelKey: "nav.staff" },
      {
        to: "/owner/settings",
        icon: "settings",
        labelKey: "nav.settings",
        activeRule: {
          type: "fn",
          test: (pathname) => pathname.startsWith("/owner/settings"),
        },
      },
      { to: "/owner/account", icon: "account", labelKey: "nav.account" },
    ],
  },
];

export type SettingsTabDef = {
  to: string;
  labelKey: "settings.tabBranch" | "settings.tabPos" | "settings.tabNetwork";
  end?: boolean;
};

export const SETTINGS_TABS: SettingsTabDef[] = [
  { to: "/owner/settings", labelKey: "settings.tabBranch", end: true },
  { to: "/owner/settings/pos", labelKey: "settings.tabPos" },
  { to: "/owner/settings/network", labelKey: "settings.tabNetwork" },
];

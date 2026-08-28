import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NavIcon, type NavIconName } from "./NavIcon";
import { cn } from "../lib/utils";

export type NavLinkDef = {
  kind: "link";
  to: string;
  label: string;
  icon: NavIconName;
  end?: boolean;
  primary?: boolean;
};

export type NavSubmenuDef = {
  kind: "submenu";
  id: string;
  label: string;
  icon: NavIconName;
  children: Omit<NavLinkDef, "kind" | "icon">[];
};

export type NavEntry = NavLinkDef | NavSubmenuDef;

export type NavGroupDef = {
  id: string;
  label: string;
  collapsible?: boolean;
  items: NavEntry[];
};

export function isNavActive(pathname: string, to: string, end?: boolean) {
  if (to === "/owner/stock") {
    return pathname === "/owner/stock" || pathname.startsWith("/owner/stock/item/");
  }
  if (to === "/owner/stock/moves") {
    return pathname === "/owner/stock/moves";
  }
  if (to === "/owner/stock/revisions") {
    return pathname === "/owner/stock/revisions" || pathname.startsWith("/owner/stock/revisions/");
  }
  if (to === "/owner/settings") {
    return pathname === "/owner/settings";
  }
  if (to === "/owner/settings/pos") {
    return pathname === "/owner/settings/pos";
  }
  if (to === "/owner/settings/network") {
    return pathname === "/owner/settings/network";
  }
  if (to === "/owner/account") {
    return pathname === "/owner/account";
  }
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function groupHasActive(pathname: string, group: NavGroupDef) {
  return group.items.some((item) => {
    if (item.kind === "link") return isNavActive(pathname, item.to, item.end);
    return item.children.some((c) => isNavActive(pathname, c.to, c.end));
  });
}

function railLinkClass(active: boolean, primary?: boolean) {
  return cn(
    "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium transition",
    active
      ? "border-l-2 border-sun bg-paper-2 pl-[10px] text-ink"
      : "border-l-2 border-transparent text-ink-soft hover:bg-paper-2 hover:text-ink",
    primary && !active && "text-sun",
  );
}

function NavSubmenu({ item, pathname }: { item: NavSubmenuDef; pathname: string }) {
  const childActive = item.children.some((c) => isNavActive(pathname, c.to, c.end));
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          railLinkClass(childActive),
          "w-full justify-between",
        )}
      >
        <span className="flex items-center gap-3">
          <NavIcon name={item.icon} />
          {item.label}
        </span>
        <span className="font-mono text-xs text-faint" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-line pl-2">
          {item.children.map((child) => {
            const active = isNavActive(pathname, child.to, child.end);
            return (
              <NavLink key={child.to} to={child.to} end={child.end} className={railLinkClass(active)}>
                <span className="pl-6">{child.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavCollapsibleGroup({
  group,
  pathname,
}: {
  group: NavGroupDef;
  pathname: string;
}) {
  const active = groupHasActive(pathname, group);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mb-2 flex w-full items-center justify-between px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-faint hover:text-ink-soft"
      >
        <span>{group.label}</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-0.5">
          {group.items.map((item) =>
            item.kind === "submenu" ? (
              <NavSubmenu key={item.id} item={item} pathname={pathname} />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={railLinkClass(isNavActive(pathname, item.to, item.end), item.primary)}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function NavRailGroups({ groups }: { groups: NavGroupDef[] }) {
  const { pathname } = useLocation();

  return (
    <>
      {groups.map((group, groupIndex) => (
        <div key={group.id} className={cn(groupIndex > 0 && "mt-6")}>
          {group.collapsible ? (
            <NavCollapsibleGroup group={group} pathname={pathname} />
          ) : (
            <>
              <p className="mb-2 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) =>
                  item.kind === "submenu" ? (
                    <NavSubmenu key={item.id} item={item} pathname={pathname} />
                  ) : (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={railLinkClass(isNavActive(pathname, item.to, item.end), item.primary)}
                    >
                      <NavIcon name={item.icon} />
                      <span>{item.label}</span>
                    </NavLink>
                  ),
                )}
              </div>
            </>
          )}
        </div>
      ))}
    </>
  );
}

export function flattenNavLinks(groups: NavGroupDef[]): NavLinkDef[] {
  const out: NavLinkDef[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (item.kind === "link") out.push(item);
      else {
        for (const child of item.children) {
          out.push({ kind: "link", ...child, icon: item.icon });
        }
      }
    }
  }
  return out;
}

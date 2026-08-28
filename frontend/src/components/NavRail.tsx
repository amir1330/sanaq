import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { NavIcon, type NavIconName } from "./NavIcon";
import { cn } from "../lib/utils";
import { isNavActive } from "./navRoutes";

export { isNavActive } from "./navRoutes";

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

function groupHasActive(pathname: string, group: NavGroupDef) {
  return group.items.some((item) => {
    if (item.kind === "link") return isNavActive(pathname, item.to, item.end);
    return item.children.some((c) => isNavActive(pathname, c.to, c.end));
  });
}

export function railLinkClass(active: boolean, primary?: boolean) {
  return cn(
    "flex min-h-12 items-center gap-3 rounded-md px-3 py-3 text-[15px] font-medium transition touch-manipulation",
    active
      ? "border-l-[3px] border-sun bg-paper pl-[9px] text-ink"
      : "border-l-[3px] border-transparent text-ink-soft hover:bg-paper hover:text-ink",
    primary && !active && "text-sun",
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("h-4 w-4 shrink-0 text-faint transition-transform", open && "rotate-180")}
    >
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function NavSubmenu({ item, pathname }: { item: NavSubmenuDef; pathname: string }) {
  const childActive = item.children.some((c) => isNavActive(pathname, c.to, c.end));
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(railLinkClass(childActive), "w-full justify-between text-left")}
      >
        <span className="flex min-w-0 items-center gap-3">
          <NavIcon name={item.icon} className="h-5 w-5" />
          <span className="truncate">{item.label}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="ml-4 flex flex-col gap-0.5 border-l-2 border-line pl-2">
          {item.children.map((child) => {
            const active = isNavActive(pathname, child.to, child.end);
            return (
              <NavLink key={child.to} to={child.to} end={child.end} className={railLinkClass(active)}>
                <span className="truncate pl-1">{child.label}</span>
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
        className="mb-2 flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint hover:bg-paper hover:text-ink-soft touch-manipulation"
      >
        <span>{group.label}</span>
        <Chevron open={open} />
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
                <NavIcon name={item.icon} className="h-5 w-5" />
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
        <div key={group.id} className={cn(groupIndex > 0 && "mt-5")}>
          {group.collapsible ? (
            <NavCollapsibleGroup group={group} pathname={pathname} />
          ) : (
            <>
              <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{group.label}</p>
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
                      <NavIcon name={item.icon} className="h-5 w-5" />
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

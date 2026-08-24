import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth, useAuthSessionReady } from "../store/auth";
import { Brand } from "./Mark";
import { ShopBrand } from "./ShopBrand";

const ownerLinks = [
  { to: "/owner", label: "Отчёты" },
  { to: "/owner/products", label: "Товары" },
  { to: "/owner/stock", label: "Склад" },
  { to: "/owner/stock/revisions", label: "Ревизии" },
  { to: "/owner/staff", label: "Сотрудники" },
  { to: "/owner/expenses", label: "Расходы" },
  { to: "/owner/shifts", label: "Смены" },
  { to: "/pos", label: "Касса" },
  { to: "/owner/settings", label: "Настройки" },
];

const adminLinks = [
  { to: "/admin", label: "Точки" },
  { to: "/admin/users", label: "Пользователи" },
  { to: "/admin/leads", label: "Заявки" },
  { to: "/admin/settings", label: "Настройки" },
];

export function Shell({ kind }: { kind: "owner" | "admin" }) {
  const { shopId, setShopId } = useAuth();
  const sessionReady = useAuthSessionReady();
  const navigate = useNavigate();
  const location = useLocation();
  const shops = useQuery({
    queryKey: ["shops"],
    queryFn: api.shops,
    enabled: kind === "owner" && sessionReady,
  });
  const currentShop = shops.data?.find((s) => s.id === shopId) ?? shops.data?.[0];
  const links = kind === "owner" ? ownerLinks : adminLinks;

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[1100px] px-8 pb-[70px]">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 py-[22px]">
          <button onClick={() => navigate(kind === "admin" ? "/admin" : "/owner")} className="min-w-0">
            {kind === "admin" ? (
              <Brand className="text-[17px]" markClass="h-[18px] w-[25px]" />
            ) : (
              <ShopBrand shop={currentShop} fallback="Точка" />
            )}
          </button>
          <nav className="flex flex-wrap gap-1 rounded-full bg-cream p-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/owner" || l.to === "/admin" || l.to === "/owner/stock"}
                className={({ isActive }) => {
                  const onStockCard = l.to === "/owner/stock" && location.pathname.startsWith("/owner/stock/item/");
                  const on = isActive || onStockCard;
                  return on
                    ? "rounded-full bg-ink px-[15px] py-[9px] text-[12.5px] text-paper"
                    : "rounded-full px-[15px] py-[9px] text-[12.5px] text-faint hover:text-ink";
                }}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-[12.5px] text-faint">
            {kind === "owner" && (shops.data?.length ?? 0) > 1 && (
              <label className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em]">Филиал</span>
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
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

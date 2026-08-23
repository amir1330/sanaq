import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
import { Brand } from "./Mark";
import { ShopBrand } from "./ShopBrand";
import { ThemeToggle } from "./ThemeToggle";

const ownerLinks = [
  { to: "/owner", label: "Отчёты" },
  { to: "/owner/products", label: "Меню" },
  { to: "/owner/stock", label: "Склад" },
  { to: "/owner/staff", label: "Бариста" },
  { to: "/owner/expenses", label: "Расходы" },
  { to: "/owner/shifts", label: "Смены" },
  { to: "/pos", label: "Касса" },
  { to: "/owner/settings", label: "Настройки" },
];

const adminLinks = [
  { to: "/admin", label: "Кофейни" },
  { to: "/admin/leads", label: "Заявки" },
];

export function Shell({ kind }: { kind: "owner" | "admin" }) {
  const { user, shopId, setShopId, logout } = useAuth();
  const navigate = useNavigate();
  const shops = useQuery({ queryKey: ["shops"], queryFn: api.shops });
  const currentShop = shops.data?.find((s) => s.id === shopId) ?? shops.data?.[0];
  const links = kind === "owner" ? ownerLinks : adminLinks;

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-[1080px] px-8 pb-[70px]">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line py-6">
          <button onClick={() => navigate(kind === "admin" ? "/admin" : "/owner")} className="min-w-0">
            {kind === "admin" ? (
              <Brand className="text-[15.5px]" markClass="h-[17px] w-[17px]" />
            ) : (
              <ShopBrand shop={currentShop} fallback="Кофейня" />
            )}
          </button>
          <nav className="flex flex-1 flex-wrap justify-center gap-6 text-[13px]">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/owner" || l.to === "/admin"}
                className={({ isActive }) =>
                  isActive
                    ? "border-b border-ink pb-1 text-ink"
                    : "border-b border-transparent pb-1 text-faint hover:text-ink"
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-[12.5px] text-faint">
            {kind === "owner" && (shops.data?.length ?? 0) > 1 && (
              <select
                className="border-0 border-b border-line-2 bg-transparent py-1 text-ink outline-none"
                value={shopId ?? ""}
                onChange={(e) => setShopId(Number(e.target.value))}
              >
                {shops.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <ThemeToggle />
            <span>{user?.full_name}</span>
            <button
              className="hover:text-ink"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Выйти
            </button>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

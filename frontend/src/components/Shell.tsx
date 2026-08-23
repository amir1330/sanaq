import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
import { ShopBrand } from "./ShopBrand";

const ownerLinks = [
  { to: "/owner", label: "Деньги" },
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
      <header className="sticky top-0 z-20 border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <button
            onClick={() => navigate(kind === "admin" ? "/admin" : "/owner")}
            className="min-w-0"
          >
            <ShopBrand
              shop={kind === "owner" ? currentShop : null}
              fallback={kind === "admin" ? "CoffeeOS" : "Кофейня"}
            />
          </button>
          <nav className="flex flex-1 flex-wrap gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/owner" || l.to === "/admin"}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm ${isActive ? "bg-ink text-paper" : "text-mute hover:text-ink"}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          {kind === "owner" && (shops.data?.length ?? 0) > 1 && (
            <label className="flex items-center gap-2 text-sm text-mute">
              Точка
              <select
                className="border border-line bg-foam px-2 py-1.5 text-ink"
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
          <div className="text-right">
            <p className="text-sm">{user?.full_name}</p>
            <button
              className="text-sm text-mute underline"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Field, Input, PageTitle } from "../../components/ui";
import { money, publicUrl } from "../../lib/utils";

export function AdminPage() {
  const qc = useQueryClient();
  const shops = useQuery({ queryKey: ["admin-shops"], queryFn: api.adminShops });
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: api.adminStats });
  const [shop, setShop] = useState({ name: "", address: "Алматы", timezone: "Asia/Almaty" });
  const [owner, setOwner] = useState({
    shopId: 0,
    full_name: "",
    email: "",
    password: "",
  });

  const createShop = useMutation({
    mutationFn: () => api.createShop(shop),
    onSuccess: () => {
      setShop({ name: "", address: "Алматы", timezone: "Asia/Almaty" });
      void qc.invalidateQueries({ queryKey: ["admin-shops"] });
      void qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patchShop(id, { is_active }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-shops"] });
      void qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
  const createOwner = useMutation({
    mutationFn: () =>
      api.createOwner(owner.shopId, {
        full_name: owner.full_name,
        email: owner.email,
        password: owner.password,
      }),
    onSuccess: () => setOwner({ ...owner, full_name: "", email: "" }),
  });

  return (
    <div>
      <PageTitle
        kicker="Система"
        title="Кофейни"
        hint="Сначала создай точку, потом «Владелец» — ему придёт вход в свою кофейню."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink/45">Точек</p>
          <p className="mt-2 font-mono text-3xl">{stats.data?.shops_count ?? "—"}</p>
        </Card>
        <Card>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink/45">Активных</p>
          <p className="mt-2 font-mono text-3xl">{stats.data?.active_shops ?? "—"}</p>
        </Card>
        <Card>
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink/45">Пользователей</p>
          <p className="mt-2 font-mono text-3xl">{stats.data?.users_count ?? "—"}</p>
        </Card>
      </div>
      <Card className="mb-4 grid gap-3 md:grid-cols-4">
        <Field label="Название">
          <Input value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} />
        </Field>
        <Field label="Адрес">
          <Input value={shop.address} onChange={(e) => setShop({ ...shop, address: e.target.value })} />
        </Field>
        <Field label="Часовой пояс">
          <Input value={shop.timezone} onChange={(e) => setShop({ ...shop, timezone: e.target.value })} />
        </Field>
        <div className="flex items-end">
          <Button className="w-full" onClick={() => createShop.mutate()}>
            Создать точку
          </Button>
        </div>
      </Card>
      <div className="overflow-hidden rounded-lg bg-foam">
        <table className="w-full text-sm">
          <thead className="font-mono text-[11px] uppercase tracking-wider text-ink/45">
            <tr className="border-b border-ink/10 text-left">
              <th className="px-4 py-3">Точка</th>
              <th>30 дней выручка</th>
              <th>Прибыль</th>
              <th>Чеки</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(stats.data?.shops ?? shops.data ?? []).map((s) => {
              const row = "shop_id" in s ? s : null;
              const shopRow = shops.data?.find((x) => x.id === (row?.shop_id ?? (s as { id: number }).id));
              const id = row?.shop_id ?? (s as { id: number }).id;
              const name = row?.shop_name ?? (s as { name: string }).name;
              const active = row?.is_active ?? shopRow?.is_active ?? true;
              return (
                <tr key={id} className="border-b border-ink/5">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      {shopRow?.logo_url ? (
                        <img src={publicUrl(shopRow.logo_url) ?? ""} alt="" className="h-7 w-7 object-contain" />
                      ) : null}
                      {name}
                    </span>
                    {!active && <span className="ml-2 text-rust">выкл</span>}
                  </td>
                  <td className="font-mono">{row ? money(row.revenue) : "—"}</td>
                  <td className="font-mono">{row ? money(row.profit) : "—"}</td>
                  <td className="font-mono">{row?.sales_count ?? "—"}</td>
                  <td className="px-4 text-right">
                    <button className="underline" onClick={() => toggle.mutate({ id, is_active: !active })}>
                      {active ? "Выключить" : "Включить"}
                    </button>
                    <button className="ml-3 underline" onClick={() => setOwner({ ...owner, shopId: id })}>
                      Создать владельца
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {owner.shopId > 0 && (
        <Card className="mt-4 grid gap-3 md:grid-cols-4">
          <Field label={`Владелец для точки #${owner.shopId}`}>
            <Input
              placeholder="Имя"
              value={owner.full_name}
              onChange={(e) => setOwner({ ...owner, full_name: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <Input value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} />
          </Field>
          <Field label="Пароль">
            <Input value={owner.password} onChange={(e) => setOwner({ ...owner, password: e.target.value })} />
          </Field>
          <div className="flex items-end gap-2">
            <Button onClick={() => createOwner.mutate()}>Создать</Button>
            <Button variant="ghost" onClick={() => setOwner({ ...owner, shopId: 0 })}>
              Скрыть
            </Button>
          </div>
          {createOwner.isSuccess && <p className="text-sm text-pine">Owner создан</p>}
          {createOwner.isError && (
            <p className="text-sm text-rust">{(createOwner.error as Error).message}</p>
          )}
        </Card>
      )}
    </div>
  );
}

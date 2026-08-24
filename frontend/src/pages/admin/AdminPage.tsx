import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Dialog, Field, Input, PageTitle, Select } from "../../components/ui";
import { generatePassword, money, publicUrl, TIMEZONES } from "../../lib/utils";

type ShopForm = {
  name: string;
  address: string;
  timezone: string;
  existing_owner_email: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  owner_password: string;
};

const emptyShop = (): ShopForm => ({
  name: "",
  address: "",
  timezone: "Asia/Almaty",
  existing_owner_email: "",
  owner_name: "",
  owner_email: "",
  owner_phone: "",
  owner_password: "",
});

type OwnerForm = {
  shopId: number;
  shopName: string;
  full_name: string;
  email: string;
  phone: string;
  password: string;
};

export function AdminPage() {
  const qc = useQueryClient();
  const shops = useQuery({ queryKey: ["admin-shops"], queryFn: api.adminShops });
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: api.adminStats });
  const [createOpen, setCreateOpen] = useState(false);
  const [shopForm, setShopForm] = useState<ShopForm>(emptyShop);
  const [createdNote, setCreatedNote] = useState("");
  const [owner, setOwner] = useState<OwnerForm | null>(null);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["admin-shops"] });
    void qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  const createShop = useMutation({
    mutationFn: () =>
      api.createShop({
        name: shopForm.name.trim(),
        address: shopForm.address.trim() || undefined,
        timezone: shopForm.timezone,
        ...(shopForm.existing_owner_email.trim()
          ? { existing_owner_email: shopForm.existing_owner_email.trim() }
          : {
              owner: {
                full_name: shopForm.owner_name.trim(),
                email: shopForm.owner_email.trim(),
                phone: shopForm.owner_phone.trim() || undefined,
                password: shopForm.owner_password,
              },
            }),
      }),
    onSuccess: (shop) => {
      setCreatedNote(
        shopForm.existing_owner_email.trim()
          ? `Филиал «${shop.name}» привязан к ${shopForm.existing_owner_email.trim()}`
          : `Точка «${shop.name}» готова. Владелец входит как ${shopForm.owner_email.trim()}`,
      );
      setShopForm(emptyShop());
      setCreateOpen(false);
      refresh();
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      api.patchShop(id, { is_active }),
    onSuccess: refresh,
  });

  const createOwner = useMutation({
    mutationFn: () => {
      if (!owner) throw new Error("Нет точки");
      return api.createOwner(owner.shopId, {
        full_name: owner.full_name.trim(),
        email: owner.email.trim(),
        phone: owner.phone.trim() || undefined,
        password: owner.password,
      });
    },
    onSuccess: () => {
      setCreatedNote(`Владелец ${owner?.email} добавлен в «${owner?.shopName}»`);
      setOwner(null);
      refresh();
    },
  });

  const attachExisting = Boolean(shopForm.existing_owner_email.trim());
  const canCreate =
    shopForm.name.trim() &&
    (attachExisting ||
      (shopForm.owner_name.trim() && shopForm.owner_email.trim() && shopForm.owner_password.length >= 6));

  const rows = stats.data?.shops ?? [];

  return (
    <div>
      <PageTitle
        kicker="Система"
        title="Точки"
        hint="Точка и владелец — вместе. Отдельного человека к существующей точке — во вкладке «Пользователи»."
        action={
          <Button
            onClick={() => {
              setShopForm(emptyShop());
              setCreateOpen(true);
            }}
          >
            Новая точка
          </Button>
        }
      />

      {createdNote && (
        <p className="mb-4 border border-sky/30 bg-sky/10 px-4 py-3 text-sm text-ink">{createdNote}</p>
      )}

      <div className="mb-6 grid gap-px bg-line md:grid-cols-3">
        <Card className="border-0">
          <p className="text-[11px] uppercase tracking-wider text-mute">Точек</p>
          <p className="mt-2 text-3xl">{stats.data?.shops_count ?? "—"}</p>
        </Card>
        <Card className="border-0">
          <p className="text-[11px] uppercase tracking-wider text-mute">Активных</p>
          <p className="mt-2 text-3xl">{stats.data?.active_shops ?? "—"}</p>
        </Card>
        <Card className="border-0">
          <p className="text-[11px] uppercase tracking-wider text-mute">Пользователей</p>
          <p className="mt-2 text-3xl">{stats.data?.users_count ?? "—"}</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-mute">Пока нет точек. Нажми «Новая точка» — заведём заведение и вход для владельца.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => {
            const shop = shops.data?.find((s) => s.id === row.shop_id);
            return (
              <Card key={row.shop_id} className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex items-center gap-3">
                    {shop?.logo_url ? (
                      <img
                        src={publicUrl(shop.logo_url) ?? ""}
                        alt=""
                        className="h-16 w-16 rounded-md bg-paper object-contain p-1"
                      />
                    ) : (
                      <span className="grid h-16 w-16 place-items-center bg-sun text-roast text-sm">
                        {row.shop_name.slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <p className="text-lg font-medium">
                        {row.shop_name}
                        {!row.is_active && <span className="ml-2 text-sm text-alert">выкл</span>}
                      </p>
                      <p className="text-sm text-mute">
                        {shop?.address || "Адрес не указан"} · {shop?.timezone ?? "—"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-mute">
                    30 дней: {money(row.revenue)} выручки · {money(row.profit)} чистыми · {row.sales_count} чеков
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="foam"
                    onClick={() =>
                      setOwner({
                        shopId: row.shop_id,
                        shopName: row.shop_name,
                        full_name: "",
                        email: "",
                        phone: "",
                        password: "",
                      })
                    }
                  >
                    Владелец
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => toggle.mutate({ id: row.shop_id, is_active: !row.is_active })}
                  >
                    {row.is_active ? "Выключить" : "Включить"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новая точка"
        hint="Новый владелец — отдельная точка. Почта существующего — филиал в его кабинете."
        wide
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-mute">Точка</p>
            <Field label="Название">
              <Input
                value={shopForm.name}
                onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                placeholder="Например, Corner на Абая"
              />
            </Field>
            <Field label="Адрес">
              <Input
                value={shopForm.address}
                onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                placeholder="улица, город"
              />
            </Field>
            <Field label="Часовой пояс">
              <Select
                value={shopForm.timezone}
                onChange={(e) => setShopForm({ ...shopForm, timezone: e.target.value })}
              >
                {TIMEZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-mute">Владелец</p>
            <Field label="Почта существующего — если это филиал">
              <Input
                type="email"
                value={shopForm.existing_owner_email}
                onChange={(e) => setShopForm({ ...shopForm, existing_owner_email: e.target.value })}
                placeholder="owner@… — тогда поля ниже не нужны"
              />
            </Field>
            <Field label="Имя">
              <Input
                value={shopForm.owner_name}
                onChange={(e) => setShopForm({ ...shopForm, owner_name: e.target.value })}
              />
            </Field>
            <Field label="Почта для входа">
              <Input
                type="email"
                value={shopForm.owner_email}
                onChange={(e) => setShopForm({ ...shopForm, owner_email: e.target.value })}
                autoComplete="off"
              />
            </Field>
            <Field label="Телефон">
              <Input
                value={shopForm.owner_phone}
                onChange={(e) => setShopForm({ ...shopForm, owner_phone: e.target.value })}
                placeholder="+7…"
              />
            </Field>
            <Field label="Пароль, от 6 символов">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={shopForm.owner_password}
                  onChange={(e) => setShopForm({ ...shopForm, owner_password: e.target.value })}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="foam"
                  onClick={() => setShopForm({ ...shopForm, owner_password: generatePassword() })}
                >
                  Сгенерировать
                </Button>
              </div>
            </Field>
          </div>
        </div>
        {createShop.isError && (
          <p className="mt-4 text-sm text-alert">{(createShop.error as Error).message}</p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCreateOpen(false)}>
            Отмена
          </Button>
          <Button disabled={!canCreate || createShop.isPending} onClick={() => createShop.mutate()}>
            {createShop.isPending ? "Создаём…" : "Создать точку и вход"}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={!!owner}
        onClose={() => setOwner(null)}
        title={owner ? `Владелец для «${owner.shopName}»` : "Владелец"}
        hint="Ещё один человек с доступом в кабинет этой точки."
      >
        {owner && (
          <div className="space-y-3">
            <Field label="Имя">
              <Input value={owner.full_name} onChange={(e) => setOwner({ ...owner, full_name: e.target.value })} />
            </Field>
            <Field label="Почта">
              <Input
                type="email"
                value={owner.email}
                onChange={(e) => setOwner({ ...owner, email: e.target.value })}
              />
            </Field>
            <Field label="Телефон">
              <Input value={owner.phone} onChange={(e) => setOwner({ ...owner, phone: e.target.value })} />
            </Field>
            <Field label="Пароль">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={owner.password}
                  onChange={(e) => setOwner({ ...owner, password: e.target.value })}
                />
                <Button variant="foam" onClick={() => setOwner({ ...owner, password: generatePassword() })}>
                  Сгенерировать
                </Button>
              </div>
            </Field>
            {createOwner.isError && (
              <p className="text-sm text-alert">{(createOwner.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOwner(null)}>
                Отмена
              </Button>
              <Button
                disabled={
                  createOwner.isPending ||
                  !owner.full_name.trim() ||
                  !owner.email.trim() ||
                  owner.password.length < 6
                }
                onClick={() => createOwner.mutate()}
              >
                {createOwner.isPending ? "Создаём…" : "Добавить"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

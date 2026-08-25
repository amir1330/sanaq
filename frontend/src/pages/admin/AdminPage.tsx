import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Dialog, Field, Input, PageTitle, Select } from "../../components/ui";
import { useT } from "../../i18n";
import { generatePassword, money, publicUrl, TIMEZONES } from "../../lib/utils";
import { useAuthSessionReady } from "../../store/auth";
import { AdminLoadError, AdminStat } from "./adminUi";

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
  const t = useT();
  const qc = useQueryClient();
  const sessionReady = useAuthSessionReady();
  const shops = useQuery({
    queryKey: ["admin-shops"],
    queryFn: api.adminShops,
    enabled: sessionReady,
  });
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: api.adminStats,
    enabled: sessionReady,
  });
  const leads = useQuery({
    queryKey: ["admin-leads"],
    queryFn: api.adminLeads,
    enabled: sessionReady,
  });
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
          ? t("admin.branchLinked", { name: shop.name, email: shopForm.existing_owner_email.trim() })
          : t("admin.shopReady", { name: shop.name, email: shopForm.owner_email.trim() }),
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
      if (!owner) throw new Error(t("admin.noShop"));
      return api.createOwner(owner.shopId, {
        full_name: owner.full_name.trim(),
        email: owner.email.trim(),
        phone: owner.phone.trim() || undefined,
        password: owner.password,
      });
    },
    onSuccess: () => {
      setCreatedNote(t("admin.ownerAdded", { email: owner?.email ?? "", name: owner?.shopName ?? "" }));
      setOwner(null);
      refresh();
    },
  });

  const attachExisting = Boolean(shopForm.existing_owner_email.trim());
  const canCreate =
    shopForm.name.trim() &&
    (attachExisting ||
      (shopForm.owner_name.trim() && shopForm.owner_email.trim() && shopForm.owner_password.length >= 6));

  const rows =
    stats.data?.shops ??
    shops.data?.map((shop) => ({
      shop_id: shop.id,
      shop_name: shop.name,
      is_active: shop.is_active,
      revenue: 0,
      sales_count: 0,
      profit: 0,
    })) ??
    [];

  const statsLoading = !sessionReady || stats.isLoading || shops.isLoading;
  const statsError = stats.isError && shops.isError;
  const shopsCount = stats.data?.shops_count ?? shops.data?.length ?? 0;
  const activeShops = stats.data?.active_shops ?? shops.data?.filter((s) => s.is_active).length ?? 0;
  const usersCount = stats.data?.users_count;
  const newLeads = (leads.data ?? []).filter((l) => l.status === "new").length;

  return (
    <div>
      <PageTitle
        kicker={t("admin.shopsKicker")}
        title={t("admin.shopsTitle")}
        hint={t("admin.shopsHint")}
        action={
          <Button
            onClick={() => {
              setShopForm(emptyShop());
              setCreateOpen(true);
            }}
          >
            {t("admin.newShop")}
          </Button>
        }
      />

      {createdNote && (
        <p className="mb-4 border border-sky/30 bg-sky/10 px-4 py-3 text-sm text-ink">{createdNote}</p>
      )}
      {(stats.isError || shops.isError) && (
        <AdminLoadError
          message={((stats.error || shops.error) as Error | undefined)?.message || t("admin.loadFail")}
        />
      )}

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <AdminStat label={t("admin.shopsCount")} value={shopsCount} loading={statsLoading} error={statsError} />
        <AdminStat label={t("admin.activeCount")} value={activeShops} loading={statsLoading} error={statsError} />
        <AdminStat
          label={t("admin.usersCount")}
          value={usersCount ?? t("common.none")}
          loading={statsLoading && usersCount == null}
          error={stats.isError && usersCount == null}
        />
        <AdminStat
          label={t("admin.newLeads")}
          value={newLeads}
          loading={!sessionReady || leads.isLoading}
          error={leads.isError}
        />
      </div>

      {shops.isLoading && rows.length === 0 ? (
        <Card>
          <p className="text-sm text-mute">{t("admin.loadingShops")}</p>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-mute">{t("admin.noShops")}</p>
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
                        {!row.is_active && <span className="ml-2 text-sm text-alert">{t("common.off")}</span>}
                      </p>
                      <p className="text-sm text-mute">
                        {shop?.address || t("admin.noAddress")} · {shop?.timezone ?? t("common.none")}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-mute">
                    {t("admin.days30", {
                      revenue: money(row.revenue),
                      profit: money(row.profit),
                      sales: row.sales_count,
                    })}
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
                    {t("admin.owner")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => toggle.mutate({ id: row.shop_id, is_active: !row.is_active })}
                  >
                    {row.is_active ? t("common.disable") : t("common.enable")}
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
        title={t("admin.newShopTitle")}
        hint={t("admin.newShopHint")}
        wide
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-mute">{t("admin.shopSection")}</p>
            <Field label={t("settings.shopName")}>
              <Input
                value={shopForm.name}
                onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                placeholder={t("admin.shopNamePh")}
              />
            </Field>
            <Field label={t("settings.address")}>
              <Input
                value={shopForm.address}
                onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                placeholder={t("settings.addressPh")}
              />
            </Field>
            <Field label={t("settings.timezone")}>
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
            <p className="text-[11px] uppercase tracking-wider text-mute">{t("admin.ownerSection")}</p>
            <Field label={t("admin.existingOwner")}>
              <Input
                type="email"
                value={shopForm.existing_owner_email}
                onChange={(e) => setShopForm({ ...shopForm, existing_owner_email: e.target.value })}
                placeholder={t("admin.existingOwnerPh")}
              />
            </Field>
            <Field label={t("staff.name")}>
              <Input
                value={shopForm.owner_name}
                onChange={(e) => setShopForm({ ...shopForm, owner_name: e.target.value })}
              />
            </Field>
            <Field label={t("staff.email")}>
              <Input
                type="email"
                value={shopForm.owner_email}
                onChange={(e) => setShopForm({ ...shopForm, owner_email: e.target.value })}
                autoComplete="off"
              />
            </Field>
            <Field label={t("staff.phone")}>
              <Input
                value={shopForm.owner_phone}
                onChange={(e) => setShopForm({ ...shopForm, owner_phone: e.target.value })}
                placeholder={t("staff.phonePh")}
              />
            </Field>
            <Field label={t("admin.passwordMin")}>
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
                  {t("common.generate")}
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
            {t("common.cancel")}
          </Button>
          <Button disabled={!canCreate || createShop.isPending} onClick={() => createShop.mutate()}>
            {createShop.isPending ? t("admin.creating") : t("admin.createShop")}
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={!!owner}
        onClose={() => setOwner(null)}
        title={owner ? t("admin.ownerFor", { name: owner.shopName }) : t("admin.owner")}
        hint={t("admin.ownerHint")}
      >
        {owner && (
          <div className="space-y-3">
            <Field label={t("staff.name")}>
              <Input value={owner.full_name} onChange={(e) => setOwner({ ...owner, full_name: e.target.value })} />
            </Field>
            <Field label={t("landing.fieldEmail")}>
              <Input
                type="email"
                value={owner.email}
                onChange={(e) => setOwner({ ...owner, email: e.target.value })}
              />
            </Field>
            <Field label={t("staff.phone")}>
              <Input value={owner.phone} onChange={(e) => setOwner({ ...owner, phone: e.target.value })} />
            </Field>
            <Field label={t("staff.password")}>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={owner.password}
                  onChange={(e) => setOwner({ ...owner, password: e.target.value })}
                />
                <Button variant="foam" onClick={() => setOwner({ ...owner, password: generatePassword() })}>
                  {t("common.generate")}
                </Button>
              </div>
            </Field>
            {createOwner.isError && (
              <p className="text-sm text-alert">{(createOwner.error as Error).message}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setOwner(null)}>
                {t("common.cancel")}
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
                {createOwner.isPending ? t("admin.creating") : t("common.add")}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

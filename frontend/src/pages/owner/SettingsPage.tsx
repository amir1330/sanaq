import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Check, Field, Input, PageTitle, Select } from "../../components/ui";
import { isNavActive, SETTINGS_TABS } from "../../components/navRoutes";
import { useT } from "../../i18n";
import { cn, publicUrl, TIMEZONES } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { Shop } from "../../types";

type SettingsSection = "branch" | "pos" | "network";

export function SettingsPage({ section = "branch" }: { section?: SettingsSection }) {
  const t = useT();
  const { pathname } = useLocation();
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const shops = useQuery({ queryKey: ["shops"], queryFn: api.shops });
  const shop = shops.data?.find((s) => s.id === shopId) ?? shops.data?.[0];
  const tab = section;
  const [form, setForm] = useState({
    name: "",
    address: "",
    timezone: "Asia/Almaty",
  });
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!shop) return;
    setForm({
      name: shop.name,
      address: shop.address ?? "",
      timezone: shop.timezone,
    });
    setPreview(null);
  }, [shop]);

  function refreshShops() {
    void qc.invalidateQueries({ queryKey: ["shops"] });
  }

  const save = useMutation({
    mutationFn: () =>
      api.updateShopSettings(shopId, {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        timezone: form.timezone,
      }),
    onSuccess: refreshShops,
  });
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadLogo(shopId, file),
    onSuccess: () => {
      setPreview(null);
      refreshShops();
    },
  });
  const removeLogo = useMutation({
    mutationFn: () => api.deleteLogo(shopId),
    onSuccess: () => {
      setPreview(null);
      refreshShops();
    },
  });

  const logoSrc = preview ?? publicUrl(shop?.logo_url);
  const busy = save.isPending || upload.isPending || removeLogo.isPending;
  const error =
    (save.error as Error | null)?.message ||
    (upload.error as Error | null)?.message ||
    (removeLogo.error as Error | null)?.message;

  const sectionTitle =
    tab === "pos"
      ? t("settings.tabPos")
      : tab === "network"
        ? t("settings.tabNetwork")
        : t("settings.tabBranch");

  return (
    <div>
      <PageTitle
        kicker={t("nav.settings")}
        title={sectionTitle}
        hint={tab === "branch" ? t("settings.hint") : undefined}
      />

      <nav
        aria-label={t("nav.settings")}
        className="mb-6 flex gap-1 overflow-x-auto border-b border-line pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SETTINGS_TABS.map((item) => {
          const active = isNavActive(pathname, item.to, { end: item.end });
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                "min-h-11 shrink-0 border-b-2 px-4 py-2.5 text-[14px] font-medium touch-manipulation transition-colors",
                active
                  ? "border-sun text-ink"
                  : "border-transparent text-ink-soft hover:border-line-2 hover:text-ink",
              )}
            >
              {t(item.labelKey)}
            </NavLink>
          );
        })}
      </nav>

      {shop && tab === "branch" && (
        <p className="mb-4 rounded-md border border-line bg-paper-2 px-4 py-3 text-sm text-ink-soft">
          <span className="font-medium text-ink">{shop.name}</span>
          {shop.address ? <span className="text-mute"> · {shop.address}</span> : null}
          <span className="text-mute"> — {t("settings.editingHere")}</span>
        </p>
      )}

      {tab === "branch" && (
        <div className="space-y-4">
          <SectionHead title={t("settings.branchSection")} lead={t("settings.branchLead")} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <Card className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t("settings.shopName")}>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <Field label={t("settings.address")}>
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder={t("settings.addressPh")}
                  />
                </Field>
                <Field label={t("settings.timezone")}>
                  <Select
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  >
                    {[form.timezone, ...TIMEZONES.filter((z) => z !== form.timezone)].map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="flex justify-end">
                <Button disabled={busy || !form.name.trim()} onClick={() => save.mutate()}>
                  {save.isSuccess && !save.isPending ? t("settings.saved") : t("common.save")}
                </Button>
              </div>
            </Card>

            <Card>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
                {t("settings.logo")}
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-3 flex h-36 w-full items-center justify-center border border-dashed border-line bg-paper hover:border-ink"
              >
                {logoSrc ? (
                  <img src={logoSrc} alt="" className="max-h-28 max-w-full object-contain" />
                ) : (
                  <span className="px-4 text-center text-sm text-mute">{t("settings.logoHint")}</span>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setPreview(URL.createObjectURL(file));
                  upload.mutate(file);
                }}
              />
              <div className="mt-3 flex gap-2">
                <Button
                  variant="foam"
                  className="flex-1"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  {logoSrc ? t("settings.replace") : t("settings.upload")}
                </Button>
                {shop?.logo_url && (
                  <Button variant="ghost" onClick={() => removeLogo.mutate()} disabled={busy}>
                    {t("settings.removeLogo")}
                  </Button>
                )}
              </div>
            </Card>
          </div>
          {error && (
            <p role="alert" className="text-sm text-rust">{error}</p>
          )}
        </div>
      )}

      {tab === "pos" && (
        <div className="space-y-6">
          <CashRegistersCard shopId={shopId} />
          <WebkassaCard shopId={shopId} shop={shop} onSaved={refreshShops} />
        </div>
      )}
      {tab === "network" && <BranchesCard shopId={shopId} shops={shops.data ?? []} />}
    </div>
  );
}

function SectionHead({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mb-1">
      <h2 className="font-display text-[26px] font-normal leading-tight text-ink">{title}</h2>
      <p className="mt-1.5 max-w-xl text-sm text-mute">{lead}</p>
    </div>
  );
}

function CashRegistersCard({ shopId }: { shopId: number }) {
  const t = useT();
  const qc = useQueryClient();
  const registers = useQuery({
    queryKey: ["cash-registers", shopId, "all"],
    queryFn: () => api.cashRegisters(shopId, true),
  });
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["cash-registers", shopId] });
  }

  const create = useMutation({
    mutationFn: () => api.createCashRegister(shopId, name.trim()),
    onSuccess: () => {
      setName("");
      refresh();
    },
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.patchCashRegister(shopId, id, body),
    onSuccess: () => {
      setEditingId(null);
      refresh();
    },
  });

  const error =
    (create.error as Error | null)?.message || (patch.error as Error | null)?.message;
  const list = registers.data ?? [];

  return (
    <div className="space-y-4">
      <SectionHead title={t("settings.tills")} lead={t("settings.tillsLead")} />
      <Card className="space-y-4">
        {list.length === 0 ? (
          <p className="text-sm text-mute">{t("settings.tillsEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
            {list.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 bg-paper px-4 py-3 text-sm">
                {editingId === r.id ? (
                  <>
                    <Input
                      className="max-w-xs flex-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <Button
                      disabled={!editName.trim() || patch.isPending}
                      onClick={() => patch.mutate({ id: r.id, body: { name: editName.trim() } })}
                    >
                      {t("common.save")}
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)}>
                      {t("common.cancel")}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${r.is_active ? "text-ink" : "text-mute line-through"}`}>
                        {r.name}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-mute">
                        {r.has_open_shift
                          ? t("settings.tillOpen")
                          : r.is_active
                            ? t("settings.tillReady")
                            : t("settings.tillOff")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-[12.5px] underline text-mute hover:text-ink"
                      onClick={() => {
                        setEditingId(r.id);
                        setEditName(r.name);
                      }}
                    >
                      {t("common.rename")}
                    </button>
                    {r.is_active ? (
                      <button
                        type="button"
                        className="text-[12.5px] underline text-mute hover:text-ink"
                        onClick={() => patch.mutate({ id: r.id, body: { is_active: false } })}
                        disabled={patch.isPending}
                      >
                        {t("common.disable")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-[12.5px] underline text-mute hover:text-ink"
                        onClick={() => patch.mutate({ id: r.id, body: { is_active: true } })}
                        disabled={patch.isPending}
                      >
                        {t("common.enable")}
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Input
            className="max-w-xs flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings.tillAddPh")}
          />
          <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
            {t("settings.tillAdd")}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-rust">{error}</p>
        )}
      </Card>
    </div>
  );
}

function BranchesCard({ shopId, shops }: { shopId: number; shops: Shop[] }) {
  const t = useT();
  const qc = useQueryClient();
  const setShopId = useAuth((s) => s.setShopId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    address: "",
    timezone: "Asia/Almaty",
    copy_catalog: true,
  });

  const current = shops.find((s) => s.id === shopId) ?? shops[0];

  useEffect(() => {
    if (!current) return;
    setForm((f) => ({ ...f, timezone: current.timezone }));
  }, [current]);

  const add = useMutation({
    mutationFn: () =>
      api.createBranch({
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        timezone: form.timezone,
        copy_from_shop_id: shopId,
        copy_catalog: form.copy_catalog,
      }),
    onSuccess: (shop) => {
      setForm({
        name: "",
        address: "",
        timezone: current?.timezone ?? "Asia/Almaty",
        copy_catalog: true,
      });
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["shops"] });
      setShopId(shop.id);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHead title={t("settings.branches")} lead={t("settings.networkLead")} />
        <Button variant={open ? "ghost" : "primary"} onClick={() => setOpen((v) => !v)}>
          {open ? t("common.collapse") : t("settings.branchNew")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {shops.map((s) => {
          const active = s.id === shopId;
          return (
            <button
              key={s.id}
              type="button"
              disabled={active}
              onClick={() => setShopId(s.id)}
              className={`rounded-lg border px-4 py-4 text-left transition ${
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-cream text-ink hover:-translate-y-0.5 hover:border-ink"
              }`}
            >
              <p className="font-display text-[20px] font-normal leading-tight">{s.name}</p>
              <p className={`mt-1 text-sm ${active ? "text-paper/70" : "text-mute"}`}>
                {s.address || t("common.none")}
              </p>
              <p
                className={`mt-3 font-mono text-[10px] uppercase tracking-[0.1em] ${
                  active ? "text-paper/60" : "text-faint"
                }`}
              >
                {active ? t("settings.workingHere") : t("settings.switchHere")}
                {!s.is_active ? ` · ${t("common.off")}` : ""}
              </p>
            </button>
          );
        })}
      </div>

      {open && (
        <Card className="space-y-4">
          <p className="font-medium text-ink">{t("settings.branchNew")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("settings.branchName")}>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("settings.branchNamePh")}
              />
            </Field>
            <Field label={t("settings.address")}>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder={t("settings.addressPh")}
              />
            </Field>
            <Field label={t("settings.timezone")}>
              <Select
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              >
                {TIMEZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Check
                checked={form.copy_catalog}
                onChange={(copy_catalog) => setForm({ ...form, copy_catalog })}
              >
                {t("settings.copyCatalog")}
              </Check>
            </div>
          </div>
          {add.isError && (
            <p role="alert" className="text-sm text-alert">{(add.error as Error).message}</p>
          )}
          <Button disabled={!form.name.trim() || add.isPending} onClick={() => add.mutate()}>
            {t("settings.createBranch")}
          </Button>
        </Card>
      )}
    </div>
  );
}

function WebkassaCard({
  shopId,
  shop,
  onSaved,
}: {
  shopId: number;
  shop?: Shop;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    login: "",
    password: "",
    cashbox_number: "",
    api_key: "",
    enabled: false,
  });
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    if (!shop) return;
    setForm((prev) => ({
      ...prev,
      login: shop.webkassa_login ?? "",
      cashbox_number: shop.webkassa_cashbox_number ?? "",
      enabled: Boolean(shop.webkassa_enabled),
    }));
  }, [shop]);

  const save = useMutation({
    mutationFn: () =>
      api.updateWebkassa(shopId, {
        login: form.login,
        cashbox_number: form.cashbox_number,
        enabled: form.enabled,
        ...(form.password ? { password: form.password } : {}),
        ...(form.api_key ? { api_key: form.api_key } : {}),
      }),
    onSuccess: () => {
      setForm((f) => ({ ...f, password: "", api_key: "" }));
      onSaved();
    },
  });
  const test = useMutation({
    mutationFn: () => api.testWebkassa(shopId),
    onSuccess: (res) => setTestMsg(res.message),
    onError: (err: Error) => setTestMsg(err.message),
  });

  const on = Boolean(shop?.webkassa_enabled);

  return (
    <div className="space-y-4">
      <SectionHead title={t("settings.fiscal")} lead={t("settings.ofdLead")} />
      <Card className="space-y-4">
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            on ? "bg-turq/10 text-ink" : "bg-alert/10 text-alert"
          }`}
        >
          <p className="font-medium">{on ? t("settings.webkassaOn") : t("settings.webkassaOff")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("settings.wkLogin")}>
            <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
          </Field>
          <Field label={t("settings.wkPassword")}>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={shop?.webkassa_has_password ? t("settings.wkPasswordPh") : ""}
            />
          </Field>
          <Field label={t("settings.wkCashbox")}>
            <Input
              value={form.cashbox_number}
              onChange={(e) => setForm({ ...form, cashbox_number: e.target.value })}
            />
          </Field>
          <Field label={t("settings.wkApiKey")}>
            <Input
              type="password"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder={
                shop?.webkassa_has_api_key ? t("settings.wkApiKeySaved") : t("settings.wkApiKeyPh")
              }
            />
          </Field>
        </div>
        <Check checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })}>
          {t("settings.wkEnabled")}
        </Check>
        {save.isError && (
          <p role="alert" className="text-sm text-alert">{(save.error as Error).message}</p>
        )}
        {testMsg && <p className="text-sm text-mute">{testMsg}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {t("settings.wkSave")}
          </Button>
          <Button variant="foam" onClick={() => test.mutate()} disabled={test.isPending}>
            {t("settings.wkTest")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

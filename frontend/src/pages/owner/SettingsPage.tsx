import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { SessionCard } from "../../components/SessionCard";
import { Button, Card, Check, Field, Input, PageTitle, Select } from "../../components/ui";
import { useT } from "../../i18n";
import { publicUrl, TIMEZONES } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { Shop } from "../../types";

export function SettingsPage() {
  const t = useT();
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const shops = useQuery({ queryKey: ["shops"], queryFn: api.shops });
  const shop = shops.data?.find((s) => s.id === shopId) ?? shops.data?.[0];
  const [form, setForm] = useState({ name: "", address: "", timezone: "Asia/Almaty" });
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

  return (
    <div>
      <PageTitle
        kicker={t("settings.kicker")}
        title={t("settings.title")}
        hint={t("settings.hint")}
      />

      <SessionCard />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
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
          <p className="text-[11px] uppercase tracking-[0.14em] text-mute">{t("settings.logo")}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 flex h-40 w-full items-center justify-center border border-dashed border-line bg-paper hover:border-ink"
          >
            {logoSrc ? (
              <img src={logoSrc} alt="" className="max-h-32 max-w-full object-contain" />
            ) : (
              <span className="px-4 text-center text-sm text-mute">
                {t("settings.logoHint")}
              </span>
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
            <Button variant="foam" className="flex-1" onClick={() => fileRef.current?.click()} disabled={busy}>
              {logoSrc ? t("settings.replace") : t("settings.upload")}
            </Button>
            {shop?.logo_url && (
              <Button variant="ghost" onClick={() => removeLogo.mutate()} disabled={busy}>
                {t("settings.removeLogo")}
              </Button>
            )}
          </div>
          <p className="mt-3 text-sm text-mute">{t("settings.logoNote")}</p>
        </Card>
      </div>
      {error && <p className="mt-3 text-sm text-rust">{error}</p>}

      <Card className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">{t("settings.vitrine")}</p>
        <p className="mt-2 max-w-xl text-sm text-mute">{t("settings.vitrineHint")}</p>
        <div className="mt-4">
          <Link to="/vitrine">
            <Button variant="quiet">{t("settings.openVitrine")}</Button>
          </Link>
        </div>
      </Card>

      <CashRegistersCard shopId={shopId} />
      <BranchesCard shopId={shopId} shops={shops.data ?? []} />
      <WebkassaCard shopId={shopId} shop={shop} onSaved={refreshShops} />
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

  return (
    <Card className="mt-4 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">{t("settings.tills")}</p>
        <p className="mt-2 max-w-xl text-sm text-mute">{t("settings.tillsHint")}</p>
      </div>
      <ul className="divide-y divide-line border border-line">
        {(registers.data ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
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
                <span className={`flex-1 ${r.is_active ? "" : "text-mute line-through"}`}>{r.name}</span>
                {r.has_open_shift && (
                  <span className="text-[11px] uppercase tracking-wide text-gold">{t("settings.tillOpen")}</span>
                )}
                {!r.is_active && <span className="text-[11px] text-mute">{t("settings.tillOff")}</span>}
                <button
                  type="button"
                  className="underline text-mute hover:text-ink"
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
                    className="underline text-mute hover:text-ink"
                    onClick={() => patch.mutate({ id: r.id, body: { is_active: false } })}
                    disabled={patch.isPending}
                  >
                    {t("common.disable")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="underline text-mute hover:text-ink"
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
      <div className="flex flex-wrap gap-2">
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
      {error && <p className="text-sm text-rust">{error}</p>}
    </Card>
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
      setForm({ name: "", address: "", timezone: current?.timezone ?? "Asia/Almaty", copy_catalog: true });
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["shops"] });
      setShopId(shop.id);
    },
  });

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">
            {t("settings.network")}
          </p>
          <h2 className="mt-1 font-display text-2xl font-normal">{t("settings.branches")}</h2>
          <p className="mt-2 text-sm text-mute">{t("settings.branchesHint")}</p>
        </div>
        <Button variant={open ? "ghost" : "primary"} onClick={() => setOpen((v) => !v)}>
          {open ? t("common.collapse") : t("settings.branchNew")}
        </Button>
      </div>
      {shops.length > 1 && (
        <div className="mt-4 border border-line">
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">{t("nav.pointFallback")}</th>
                <th>{t("settings.address")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id} className="border-b border-ink/5">
                  <td className="px-4 py-3">
                    {s.name}
                    {s.id === shopId && <span className="ml-2 text-mute">{t("common.now")}</span>}
                    {!s.is_active && <span className="ml-2 text-alert">{t("common.off")}</span>}
                  </td>
                  <td className="text-mute">{s.address || t("common.none")}</td>
                  <td className="px-4 py-3 text-right">
                    {s.id !== shopId && (
                      <button className="underline" onClick={() => setShopId(s.id)}>
                        {t("common.open")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
            <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
              {TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          <Check checked={form.copy_catalog} onChange={(copy_catalog) => setForm({ ...form, copy_catalog })}>
            {t("settings.copyCatalog")}
          </Check>
          {add.isError && <p className="text-sm text-alert md:col-span-2">{(add.error as Error).message}</p>}
          <div className="md:col-span-2">
            <Button disabled={!form.name.trim() || add.isPending} onClick={() => add.mutate()}>
              {t("settings.createBranch")}
            </Button>
          </div>
        </div>
      )}
    </Card>
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

  return (
    <Card className="mt-6">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">
        {t("settings.fiscal")}
      </p>
      <h2 className="mt-1 font-display text-2xl font-normal">Webkassa</h2>
      {shop?.webkassa_enabled ? (
        <p className="mt-2 text-sm text-mute">{t("settings.webkassaOn")}</p>
      ) : (
        <p className="mt-2 text-sm text-alert">{t("settings.webkassaOff")}</p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
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
            placeholder={shop?.webkassa_has_api_key ? t("settings.wkApiKeySaved") : t("settings.wkApiKeyPh")}
          />
        </Field>
      </div>
      <div className="mt-4">
        <Check checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })}>
          {t("settings.wkEnabled")}
        </Check>
      </div>
      {save.isError && <p className="mt-2 text-sm text-alert">{(save.error as Error).message}</p>}
      {testMsg && <p className="mt-2 text-sm text-mute">{testMsg}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {t("settings.wkSave")}
        </Button>
        <Button variant="foam" onClick={() => test.mutate()} disabled={test.isPending}>
          {t("settings.wkTest")}
        </Button>
      </div>
    </Card>
  );
}

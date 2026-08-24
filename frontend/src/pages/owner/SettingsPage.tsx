import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { SessionCard } from "../../components/SessionCard";
import { Button, Card, Check, Field, Input, PageTitle, Select } from "../../components/ui";
import { publicUrl, TIMEZONES } from "../../lib/utils";
import { useAuth } from "../../store/auth";
import type { Shop } from "../../types";

export function SettingsPage() {
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
        kicker="Точка"
        title="Настройки"
        hint="Имя, тема и выход — сверху. Ниже — точка, логотип и касса ОФД."
      />

      <SessionCard />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="grid gap-4 md:grid-cols-2">
          <Field label="Название">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Адрес">
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="улица, город"
            />
          </Field>
          <Field label="Часовой пояс">
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
          <div className="flex items-end">
            <Button className="w-full" disabled={busy || !form.name.trim()} onClick={() => save.mutate()}>
              {save.isSuccess && !save.isPending ? "Сохранено" : "Сохранить"}
            </Button>
          </div>
        </Card>

        <Card>
          <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Логотип</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 flex h-40 w-full items-center justify-center border border-dashed border-line bg-paper hover:border-ink"
          >
            {logoSrc ? (
              <img src={logoSrc} alt="Логотип точки" className="max-h-32 max-w-full object-contain" />
            ) : (
              <span className="px-4 text-center text-sm text-mute">
                Нажми и выбери PNG, JPG, WEBP или SVG
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
              {logoSrc ? "Заменить" : "Загрузить"}
            </Button>
            {shop?.logo_url && (
              <Button variant="ghost" onClick={() => removeLogo.mutate()} disabled={busy}>
                Убрать
              </Button>
            )}
          </div>
          <p className="mt-3 text-sm text-mute">До 2 МБ. В шапке и на кассе логотип крупный — лучше квадрат.</p>
        </Card>
      </div>
      {error && <p className="mt-3 text-sm text-rust">{error}</p>}

      <Card className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-mute">Витрина</p>
        <p className="mt-2 max-w-xl text-sm text-mute">
          Меню на телевизоре у стойки: фото, название, цена. Открой на ТВ и нажми «На весь экран».
        </p>
        <div className="mt-4">
          <Link to="/vitrine">
            <Button variant="quiet">Открыть витрину</Button>
          </Link>
        </div>
      </Card>

      <BranchesCard shopId={shopId} shops={shops.data ?? []} />
      <WebkassaCard shopId={shopId} shop={shop} onSaved={refreshShops} />
    </div>
  );
}

function BranchesCard({ shopId, shops }: { shopId: number; shops: Shop[] }) {
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
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">Сеть</p>
          <h2 className="mt-1 font-display text-2xl font-normal">Филиалы</h2>
          <p className="mt-2 text-sm text-mute">
            Каждая точка — свой склад, касса, смена и касса Webkassa. Меню можно скопировать, остатки на новой точке
            будут нулевые.
          </p>
        </div>
        <Button variant={open ? "ghost" : "primary"} onClick={() => setOpen((v) => !v)}>
          {open ? "Свернуть" : "Новый филиал"}
        </Button>
      </div>
      {shops.length > 1 && (
        <div className="mt-4 border border-line">
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">Точка</th>
                <th>Адрес</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id} className="border-b border-ink/5">
                  <td className="px-4 py-3">
                    {s.name}
                    {s.id === shopId && <span className="ml-2 text-mute">сейчас</span>}
                    {!s.is_active && <span className="ml-2 text-alert">выкл</span>}
                  </td>
                  <td className="text-mute">{s.address || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {s.id !== shopId && (
                      <button className="underline" onClick={() => setShopId(s.id)}>
                        Открыть
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
          <Field label="Название филиала">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={current ? `${current.name} · Достык` : "Вторая точка"}
            />
          </Field>
          <Field label="Адрес">
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="улица, город"
            />
          </Field>
          <Field label="Часовой пояс">
            <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
              {TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </Field>
          <Check checked={form.copy_catalog} onChange={(copy_catalog) => setForm({ ...form, copy_catalog })}>
            Скопировать меню и склад с текущей точки. Остатки — ноль.
          </Check>
          {add.isError && <p className="text-sm text-alert md:col-span-2">{(add.error as Error).message}</p>}
          <div className="md:col-span-2">
            <Button disabled={!form.name.trim() || add.isPending} onClick={() => add.mutate()}>
              Создать филиал
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
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.13em] text-faint">Фискализация</p>
      <h2 className="mt-1 font-display text-2xl font-normal">Webkassa</h2>
      {shop?.webkassa_enabled ? (
        <p className="mt-2 text-sm text-mute">Чеки уходят в ОФД в фоне. Без аккаунта кассы Webkassa будет 401.</p>
      ) : (
        <p className="mt-2 text-sm text-alert">
          Продажи не фискализируются. Касса работает как раньше, в журнал пишется «пропущено».
        </p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Login кассы">
          <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        </Field>
        <Field label="Пароль кассы">
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={shop?.webkassa_has_password ? "сохранён, введи чтобы сменить" : ""}
          />
        </Field>
        <Field label="CashboxUniqueNumber">
          <Input
            value={form.cashbox_number}
            onChange={(e) => setForm({ ...form, cashbox_number: e.target.value })}
          />
        </Field>
        <Field label="API-KEY (если выдали отдельно)">
          <Input
            type="password"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder={shop?.webkassa_has_api_key ? "сохранён, введи чтобы сменить" : "можно оставить пустым"}
          />
        </Field>
      </div>
      <div className="mt-4">
        <Check checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })}>
          Включена — чеки уходят в Webkassa
        </Check>
      </div>
      {save.isError && <p className="mt-2 text-sm text-alert">{(save.error as Error).message}</p>}
      {testMsg && <p className="mt-2 text-sm text-mute">{testMsg}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Сохранить кассу
        </Button>
        <Button variant="foam" onClick={() => test.mutate()} disabled={test.isPending}>
          Проверить подключение
        </Button>
      </div>
    </Card>
  );
}

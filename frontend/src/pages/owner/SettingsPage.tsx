import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Field, Input, PageTitle } from "../../components/ui";
import { publicUrl } from "../../lib/utils";
import { useAuth } from "../../store/auth";

const timezones = ["Asia/Almaty", "Asia/Aqtobe", "Asia/Aqtau", "Europe/Helsinki", "UTC"];

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
        kicker="Кофейня"
        title="Настройки"
        hint="Название и логотип видны в шапке кабинета и на кассе."
      />

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
            <select
              className="w-full border border-line bg-foam px-3 py-2.5 text-ink outline-none focus:border-ink"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              {[form.timezone, ...timezones.filter((z) => z !== form.timezone)].map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
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
              <img src={logoSrc} alt="Логотип кофейни" className="max-h-32 max-w-full object-contain" />
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
          <p className="mt-3 text-sm text-mute">До 2 МБ. Квадрат смотрится лучше всего.</p>
        </Card>
      </div>
      {error && <p className="mt-3 text-sm text-rust">{error}</p>}
    </div>
  );
}

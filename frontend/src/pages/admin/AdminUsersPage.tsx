import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Check, Dialog, Empty, Field, Input, PageTitle, Select } from "../../components/ui";
import { generatePassword } from "../../lib/utils";

type RolePick = "owner" | "barista";

const emptyForm = () => ({
  shop_id: "",
  role: "owner" as RolePick,
  full_name: "",
  email: "",
  phone: "",
  password: "",
  pin_code: "",
  can_receive_stock: false,
});

const roleLabel: Record<string, string> = {
  owner: "владелец",
  barista: "кассир",
  super_admin: "админ",
};

export function AdminUsersPage() {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: api.adminUsers });
  const shops = useQuery({ queryKey: ["admin-shops"], queryFn: api.adminShops });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [note, setNote] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api.createAdminUser({
        shop_id: Number(form.shop_id),
        role: form.role,
        full_name: form.full_name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password || undefined,
        pin_code: form.pin_code || undefined,
        can_receive_stock: form.can_receive_stock,
      }),
    onSuccess: (user) => {
      const shop = shops.data?.find((s) => s.id === user.shop_id);
      setNote(
        user.role === "owner"
          ? `Владелец ${user.email} добавлен в «${shop?.name ?? user.shop_name}». Можно отдавать почту и пароль.`
          : `Кассир ${user.full_name} добавлен в «${shop?.name ?? user.shop_name}». PIN: ${form.pin_code}`,
      );
      setForm(emptyForm());
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const canSave = useMemo(() => {
    if (!form.shop_id || !form.full_name.trim()) return false;
    if (form.role === "owner") {
      return Boolean(form.email.trim()) && form.password.length >= 6;
    }
    return /^\d{4,8}$/.test(form.pin_code);
  }, [form]);

  const list = users.data ?? [];

  return (
    <div>
      <PageTitle
        kicker="Система"
        title="Пользователи"
        hint="Создавай владельца или кассира сразу, без заявки с лендинга."
        action={<Button onClick={() => setOpen(true)}>Добавить</Button>}
      />

      {note && <p className="mb-4 border border-sky/30 bg-sky/10 px-4 py-3 text-sm">{note}</p>}

      {!shops.data?.length ? (
        <Card>
          <p className="text-sm text-mute">Сначала заведи точку во вкладке «Точки», потом сюда — человека.</p>
        </Card>
      ) : list.length === 0 ? (
        <Empty>Пользователей ещё нет. Нажми «Добавить».</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">Имя</th>
                <th>Роль</th>
                <th>Точка</th>
                <th>Вход</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-b border-ink/5">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.full_name}</p>
                    {u.phone && <p className="text-mute">{u.phone}</p>}
                  </td>
                  <td>{roleLabel[u.role] ?? u.role}</td>
                  <td className="text-mute">{u.shop_name || "—"}</td>
                  <td className="font-mono text-xs">
                    {u.role === "owner" ? u.email || "—" : u.has_pin ? "PIN на кассе" : "—"}
                  </td>
                  <td>{u.is_active ? "активен" : "выкл"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Новый пользователь"
        hint="Заявка с сайта не нужна — заводишь сам, когда договорились."
      >
        <div className="space-y-3">
          <Field label="Точка">
            <Select value={form.shop_id} onChange={(e) => setForm({ ...form, shop_id: e.target.value })}>
              <option value="">Выбери точку</option>
              {(shops.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {!s.is_active ? " (выкл)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Роль">
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as RolePick })}
            >
              <option value="owner">Владелец — кабинет по почте</option>
              <option value="barista">Кассир — только касса по PIN</option>
            </Select>
          </Field>
          <Field label="Имя">
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Айгерим"
            />
          </Field>
          {form.role === "owner" ? (
            <>
              <Field label="Почта для входа">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  autoComplete="off"
                />
              </Field>
              <Field label="Телефон">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+7…"
                />
              </Field>
              <Field label="Пароль, от 6 символов">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="foam"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                  >
                    Сгенерировать
                  </Button>
                </div>
              </Field>
            </>
          ) : (
            <>
              <Field label="PIN кассы, 4 цифры">
                <Input
                  value={form.pin_code}
                  onChange={(e) =>
                    setForm({ ...form, pin_code: e.target.value.replace(/\D/g, "").slice(0, 8) })
                  }
                  inputMode="numeric"
                  placeholder="4821"
                />
              </Field>
              <Field label="Телефон, по желанию">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Check
                checked={form.can_receive_stock}
                onChange={(can_receive_stock) => setForm({ ...form, can_receive_stock })}
              >
                Можно делать приёмку на кассе
              </Check>
            </>
          )}
          {create.isError && <p className="text-sm text-alert">{(create.error as Error).message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button disabled={!canSave || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Создаём…" : "Создать"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

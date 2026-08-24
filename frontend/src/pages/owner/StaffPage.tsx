import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Check, Empty, Field, Input, PageTitle } from "../../components/ui";
import { generatePassword } from "../../lib/utils";
import { useAuth } from "../../store/auth";

const emptyForm = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  can_receive_stock: false,
};

export function StaffPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ["staff", shopId], queryFn: () => api.staff(shopId) });
  const [form, setForm] = useState(emptyForm);
  const [passwordEdit, setPasswordEdit] = useState<{ id: number; password: string } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createStaff(shopId, {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
        can_receive_stock: form.can_receive_stock,
      }),
    onSuccess: () => {
      setForm(emptyForm);
      void qc.invalidateQueries({ queryKey: ["staff", shopId] });
    },
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.patchStaff(shopId, id, body),
    onSuccess: () => {
      setPasswordEdit(null);
      void qc.invalidateQueries({ queryKey: ["staff", shopId] });
    },
  });

  const people = staff.data ?? [];
  const canAdd =
    form.full_name.trim().length > 0 && form.email.trim().includes("@") && form.password.length >= 6;

  return (
    <div>
      <PageTitle
        kicker="Люди"
        title="Сотрудники"
        hint="Почта и пароль — человек сам входит на сайте и попадает на кассу. Права: только касса или ещё приёмка."
      />
      <Card className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <Field label="Имя">
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Амина"
          />
        </Field>
        <Field label="Почта для входа">
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            autoComplete="off"
            placeholder="amina@…"
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
            <Button type="button" variant="foam" onClick={() => setForm({ ...form, password: generatePassword() })}>
              Сгенерировать
            </Button>
          </div>
        </Field>
        <Field label="Телефон">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+7…" />
        </Field>
        <div className="flex items-end pb-1">
          <Check
            checked={form.can_receive_stock}
            onChange={(can_receive_stock) => setForm({ ...form, can_receive_stock })}
          >
            Приёмка на кассе
          </Check>
        </div>
        <div className="flex items-end">
          <Button className="w-full" disabled={!canAdd || create.isPending} onClick={() => create.mutate()}>
            Добавить
          </Button>
        </div>
      </Card>
      {create.isError && <p className="mb-3 text-sm text-rust">{(create.error as Error).message}</p>}
      {patch.isError && <p className="mb-3 text-sm text-rust">{(patch.error as Error).message}</p>}
      {people.length === 0 ? (
        <Empty>Добавь сотрудника сверху — отдай почту и пароль, он войдёт через «Войти» и увидит только кассу.</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">Имя</th>
                <th>Почта</th>
                <th>Права</th>
                <th>Пароль</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {people.map((u) => (
                <tr key={u.id} className="border-b border-ink/5">
                  <td className="px-4 py-3">{u.full_name}</td>
                  <td className="font-mono text-xs">{u.email || "—"}</td>
                  <td>
                    <button
                      className="underline"
                      onClick={() =>
                        patch.mutate({ id: u.id, body: { can_receive_stock: !u.can_receive_stock } })
                      }
                    >
                      {u.can_receive_stock ? "касса + приёмка" : "только касса"}
                    </button>
                  </td>
                  <td>
                    {passwordEdit?.id === u.id ? (
                      <span className="flex items-center gap-2">
                        <Input
                          className="w-36"
                          value={passwordEdit.password}
                          onChange={(e) => setPasswordEdit({ id: u.id, password: e.target.value })}
                          placeholder="новый пароль"
                        />
                        <button
                          className="underline"
                          disabled={passwordEdit.password.length < 6 || patch.isPending}
                          onClick={() =>
                            patch.mutate({ id: u.id, body: { password: passwordEdit.password } })
                          }
                        >
                          Сохранить
                        </button>
                        <button className="text-mute underline" onClick={() => setPasswordEdit(null)}>
                          Отмена
                        </button>
                      </span>
                    ) : (
                      <button className="underline" onClick={() => setPasswordEdit({ id: u.id, password: "" })}>
                        сменить
                      </button>
                    )}
                  </td>
                  <td className="px-4 text-right">
                    <button
                      className="underline"
                      onClick={() => patch.mutate({ id: u.id, body: { is_active: !u.is_active } })}
                    >
                      {u.is_active ? "Выключить" : "Включить"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Empty, Field, Input, PageTitle } from "../../components/ui";
import { useAuth } from "../../store/auth";

const emptyForm = {
  full_name: "",
  pin_code: "",
  phone: "",
  can_receive_stock: false,
};

export function StaffPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ["staff", shopId], queryFn: () => api.staff(shopId) });
  const [form, setForm] = useState(emptyForm);
  const [pinEdit, setPinEdit] = useState<{ id: number; pin: string } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createStaff(shopId, {
        full_name: form.full_name.trim(),
        pin_code: form.pin_code,
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
      setPinEdit(null);
      void qc.invalidateQueries({ queryKey: ["staff", shopId] });
    },
  });

  const people = staff.data ?? [];
  const canAdd = form.full_name.trim().length > 0 && /^\d{4,8}$/.test(form.pin_code);

  return (
    <div>
      <PageTitle
        kicker="Люди"
        title="Кассиры"
        hint="Как в Poster: имя и PIN на кассу. Пароля нет — кассир не заходит в кабинет, только на планшет."
      />
      <Card className="mb-4 grid gap-3 md:grid-cols-5">
        <Field label="Имя">
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Амина"
          />
        </Field>
        <Field label="PIN кассы, 4 цифры">
          <Input
            placeholder="4821"
            value={form.pin_code}
            onChange={(e) => setForm({ ...form, pin_code: e.target.value.replace(/\D/g, "").slice(0, 8) })}
            inputMode="numeric"
          />
        </Field>
        <Field label="Телефон, по желанию">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={form.can_receive_stock}
            onChange={(e) => setForm({ ...form, can_receive_stock: e.target.checked })}
          />
          Приёмка
        </label>
        <div className="flex items-end">
          <Button className="w-full" disabled={!canAdd || create.isPending} onClick={() => create.mutate()}>
            Добавить
          </Button>
        </div>
      </Card>
      {create.isError && <p className="mb-3 text-sm text-rust">{(create.error as Error).message}</p>}
      {patch.isError && <p className="mb-3 text-sm text-rust">{(patch.error as Error).message}</p>}
      {people.length === 0 ? (
        <Empty>Пока никого. Добавь кассира сверху — он войдёт на кассе своим PIN.</Empty>
      ) : (
        <div className="border border-line">
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">Имя</th>
                <th>Контакт</th>
                <th>PIN</th>
                <th>Приёмка товара</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {people.map((u) => (
                <tr key={u.id} className="border-b border-ink/5">
                  <td className="px-4 py-3">{u.full_name}</td>
                  <td>{u.phone || u.email || "—"}</td>
                  <td>
                    {pinEdit?.id === u.id ? (
                      <span className="flex items-center gap-2">
                        <Input
                          className="w-24"
                          value={pinEdit.pin}
                          onChange={(e) =>
                            setPinEdit({ id: u.id, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })
                          }
                          inputMode="numeric"
                          placeholder="новый PIN"
                        />
                        <button
                          className="underline"
                          disabled={!/^\d{4,8}$/.test(pinEdit.pin) || patch.isPending}
                          onClick={() => patch.mutate({ id: u.id, body: { pin_code: pinEdit.pin } })}
                        >
                          Сохранить
                        </button>
                        <button className="text-mute underline" onClick={() => setPinEdit(null)}>
                          Отмена
                        </button>
                      </span>
                    ) : (
                      <button className="underline" onClick={() => setPinEdit({ id: u.id, pin: "" })}>
                        {u.has_pin ? "сменить" : "задать"}
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      className="underline"
                      onClick={() =>
                        patch.mutate({ id: u.id, body: { can_receive_stock: !u.can_receive_stock } })
                      }
                    >
                      {u.can_receive_stock ? "можно принимать" : "только касса"}
                    </button>
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

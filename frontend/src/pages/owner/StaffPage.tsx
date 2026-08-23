import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Field, Input, PageTitle } from "../../components/ui";
import { useAuth } from "../../store/auth";

export function StaffPage() {
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ["staff", shopId], queryFn: () => api.staff(shopId) });
  const [form, setForm] = useState({
    full_name: "",
    pin_code: "",
    password: "",
    phone: "",
    can_receive_stock: false,
  });

  const create = useMutation({
    mutationFn: () => api.createStaff(shopId, form),
    onSuccess: () => {
      setForm({ full_name: "", pin_code: "", password: "", phone: "", can_receive_stock: false });
      void qc.invalidateQueries({ queryKey: ["staff", shopId] });
    },
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.patchStaff(shopId, id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff", shopId] }),
  });

  return (
    <div>
      <PageTitle
        kicker="Люди"
        title="Бариста"
        hint="PIN — кто сейчас на кассе. Если человек один — включи «Приёмка», чтобы сам ставил закупки."
      />
      <Card className="mb-4 grid gap-3 md:grid-cols-6">
        <Field label="Имя">
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </Field>
        <Field label="PIN кассы, 4 цифры">
          <Input
            placeholder="1234"
            value={form.pin_code}
            onChange={(e) => setForm({ ...form, pin_code: e.target.value })}
            inputMode="numeric"
          />
        </Field>
        <Field label="Пароль">
          <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="Телефон">
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
          <Button className="w-full" onClick={() => create.mutate()}>
            Добавить
          </Button>
        </div>
      </Card>
      {create.isError && <p className="mb-3 text-sm text-rust">{(create.error as Error).message}</p>}
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
            {(staff.data ?? []).map((u) => (
              <tr key={u.id} className="border-b border-ink/5">
                <td className="px-4 py-3">{u.full_name}</td>
                <td>{u.phone || u.email}</td>
                <td>{u.has_pin ? "задан" : "нет"}</td>
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
    </div>
  );
}

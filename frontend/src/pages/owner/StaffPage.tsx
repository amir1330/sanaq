import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Check, Dialog, Empty, Field, Input, PageTitle } from "../../components/ui";
import { useT } from "../../i18n";
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
  const t = useT();
  const shopId = useAuth((s) => s.shopId)!;
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ["staff", shopId], queryFn: () => api.staff(shopId) });
  const [open, setOpen] = useState(false);
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
      setOpen(false);
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

  function closeDialog() {
    setOpen(false);
    setForm(emptyForm);
    create.reset();
  }

  return (
    <div>
      <PageTitle
        kicker={t("staff.kicker")}
        title={t("staff.title")}
        hint={t("staff.hint")}
        action={<Button onClick={() => setOpen(true)}>{t("common.add")}</Button>}
      />

      {patch.isError && <p className="mb-3 text-sm text-rust">{(patch.error as Error).message}</p>}

      {people.length === 0 ? (
        <Empty>{t("staff.empty")}</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">{t("staff.colName")}</th>
                <th>{t("staff.colEmail")}</th>
                <th>{t("staff.colRights")}</th>
                <th>{t("staff.colPassword")}</th>
                <th className="px-4 text-right">{t("staff.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {people.map((u) => (
                <tr key={u.id} className="border-b border-ink/5">
                  <td className="px-4 py-3">
                    <p>{u.full_name}</p>
                    {u.phone ? <p className="text-mute">{u.phone}</p> : null}
                  </td>
                  <td className="font-mono text-xs">{u.email || t("common.none")}</td>
                  <td>
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        patch.mutate({ id: u.id, body: { can_receive_stock: !u.can_receive_stock } })
                      }
                    >
                      {u.can_receive_stock ? t("staff.rightsPosStock") : t("staff.rightsPos")}
                    </button>
                  </td>
                  <td>
                    {passwordEdit?.id === u.id ? (
                      <div className="flex flex-wrap items-center gap-2 py-1">
                        <Input
                          className="w-36"
                          value={passwordEdit.password}
                          onChange={(e) => setPasswordEdit({ id: u.id, password: e.target.value })}
                          placeholder={t("staff.newPassword")}
                        />
                        <button
                          type="button"
                          className="underline"
                          disabled={passwordEdit.password.length < 6 || patch.isPending}
                          onClick={() =>
                            patch.mutate({ id: u.id, body: { password: passwordEdit.password } })
                          }
                        >
                          {t("common.save")}
                        </button>
                        <button type="button" className="text-mute underline" onClick={() => setPasswordEdit(null)}>
                          {t("common.cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="underline"
                        onClick={() => setPasswordEdit({ id: u.id, password: "" })}
                      >
                        {t("staff.change")}
                      </button>
                    )}
                  </td>
                  <td className="px-4 text-right">
                    <button
                      type="button"
                      className="underline"
                      onClick={() => patch.mutate({ id: u.id, body: { is_active: !u.is_active } })}
                    >
                      {u.is_active ? t("common.disable") : t("common.enable")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onClose={closeDialog} title={t("staff.newTitle")} hint={t("staff.newHint")}>
        <div className="space-y-4">
          <Field label={t("staff.name")}>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label={t("staff.email")}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="off"
            />
          </Field>
          <Field label={t("staff.password")}>
            <div className="flex gap-2">
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
                placeholder={t("staff.passwordPh")}
              />
              <Button
                type="button"
                variant="foam"
                className="shrink-0"
                onClick={() => setForm({ ...form, password: generatePassword() })}
              >
                {t("common.generate")}
              </Button>
            </div>
          </Field>
          <Field label={t("staff.phone")}>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={t("staff.phonePh")}
            />
          </Field>
          <Check
            checked={form.can_receive_stock}
            onChange={(can_receive_stock) => setForm({ ...form, can_receive_stock })}
          >
            {t("staff.canReceive")}
          </Check>
          {create.isError && <p className="text-sm text-rust">{(create.error as Error).message}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={!canAdd || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? t("staff.adding") : t("common.add")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

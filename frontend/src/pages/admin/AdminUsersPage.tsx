import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Button, Card, Check, Dialog, Empty, Field, Input, PageTitle, Select } from "../../components/ui";
import { useT } from "../../i18n";
import { generatePassword } from "../../lib/utils";
import { useAuthSessionReady } from "../../store/auth";
import { AdminLoadError } from "./adminUi";

type RolePick = "owner" | "barista";

const emptyForm = () => ({
  shop_id: "",
  role: "owner" as RolePick,
  full_name: "",
  email: "",
  phone: "",
  password: "",
  can_receive_stock: false,
});

export function AdminUsersPage() {
  const t = useT();
  const qc = useQueryClient();
  const sessionReady = useAuthSessionReady();
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: api.adminUsers,
    enabled: sessionReady,
  });
  const shops = useQuery({
    queryKey: ["admin-shops"],
    queryFn: api.adminShops,
    enabled: sessionReady,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [note, setNote] = useState("");

  const roleLabel = (role: string) => {
    if (role === "owner") return t("admin.roleOwner");
    if (role === "barista") return t("admin.roleStaff");
    if (role === "super_admin") return t("admin.roleAdmin");
    return role;
  };

  const create = useMutation({
    mutationFn: () =>
      api.createAdminUser({
        shop_id: Number(form.shop_id),
        role: form.role,
        full_name: form.full_name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password || undefined,
        can_receive_stock: form.can_receive_stock,
      }),
    onSuccess: (user) => {
      const shop = shops.data?.find((s) => s.id === user.shop_id);
      const name = shop?.name ?? user.shop_name ?? "";
      setNote(
        user.role === "owner"
          ? t("admin.userOwnerNote", { email: user.email ?? "", name })
          : t("admin.userStaffNote", { email: user.email ?? "", name }),
      );
      setForm(emptyForm());
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const canSave = useMemo(() => {
    if (!form.shop_id || !form.full_name.trim()) return false;
    return Boolean(form.email.trim()) && form.password.length >= 6;
  }, [form]);

  const list = users.data ?? [];

  return (
    <div>
      <PageTitle
        kicker={t("admin.usersKicker")}
        title={t("admin.usersTitle")}
        hint={t("admin.usersHint")}
        action={<Button onClick={() => setOpen(true)}>{t("common.add")}</Button>}
      />

      {note && <p className="mb-4 border border-sky/30 bg-sky/10 px-4 py-3 text-sm">{note}</p>}
      {users.isError && (
        <AdminLoadError message={(users.error as Error).message || t("admin.loadUsersFail")} />
      )}

      {!sessionReady || shops.isLoading ? (
        <Card>
          <p className="text-sm text-mute">{t("common.loading")}</p>
        </Card>
      ) : !shops.data?.length ? (
        <Card>
          <p className="text-sm text-mute">{t("admin.needShopFirst")}</p>
        </Card>
      ) : users.isLoading ? (
        <Card>
          <p className="text-sm text-mute">{t("admin.loadingUsers")}</p>
        </Card>
      ) : list.length === 0 ? (
        <Empty>{t("admin.noUsers")}</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg bg-cream shadow-soft">
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-faint">
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3">{t("admin.colName")}</th>
                <th>{t("admin.colRole")}</th>
                <th>{t("admin.colShop")}</th>
                <th>{t("admin.colLogin")}</th>
                <th>{t("admin.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="border-b border-ink/5">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.full_name}</p>
                    {u.phone && <p className="text-mute">{u.phone}</p>}
                  </td>
                  <td>{roleLabel(u.role)}</td>
                  <td className="text-mute">{u.shop_name || t("common.none")}</td>
                  <td className="font-mono text-xs">
                    {u.email || t("common.none")}
                    {u.role === "barista" && (
                      <span className="block font-sans text-[11px] text-mute">
                        {u.can_receive_stock ? t("admin.rightsPosStock") : t("admin.rightsPos")}
                      </span>
                    )}
                  </td>
                  <td>{u.is_active ? t("admin.active") : t("admin.inactive")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("admin.newUser")}
        hint={t("admin.newUserHint")}
      >
        <div className="space-y-3">
          <Field label={t("admin.colShop")}>
            <Select value={form.shop_id} onChange={(e) => setForm({ ...form, shop_id: e.target.value })}>
              <option value="">{t("admin.pickShop")}</option>
              {(shops.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {!s.is_active ? t("admin.shopOff") : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.role")}>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as RolePick })}>
              <option value="owner">{t("admin.roleOwnerOpt")}</option>
              <option value="barista">{t("admin.roleStaffOpt")}</option>
            </Select>
          </Field>
          <Field label={t("staff.name")}>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder={t("staff.namePh")}
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
          <Field label={t("staff.phone")}>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder={t("staff.phonePh")}
            />
          </Field>
          <Field label={t("admin.passwordMin")}>
            <div className="flex gap-2">
              <Input
                type="text"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
              <Button type="button" variant="foam" onClick={() => setForm({ ...form, password: generatePassword() })}>
                {t("common.generate")}
              </Button>
            </div>
          </Field>
          {form.role === "barista" && (
            <Check
              checked={form.can_receive_stock}
              onChange={(can_receive_stock) => setForm({ ...form, can_receive_stock })}
            >
              {t("admin.canReceive")}
            </Check>
          )}
          {create.isError && <p className="text-sm text-alert">{(create.error as Error).message}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button disabled={!canSave || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? t("admin.creating") : t("admin.create")}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

import { ReactNode } from "react";
import { useT } from "../../i18n";

export function AdminStat({
  label,
  value,
  loading,
  error,
}: {
  label: string;
  value: ReactNode;
  loading?: boolean;
  error?: boolean;
}) {
  const t = useT();
  return (
    <div className="rounded-lg bg-cream p-6 shadow-soft">
      <p className="text-[11px] uppercase tracking-wider text-mute">{label}</p>
      {loading ? (
        <p className="mt-2 font-mono text-3xl text-faint">…</p>
      ) : error ? (
        <p className="mt-2 text-sm text-alert">{t("admin.loadFailShort")}</p>
      ) : (
        <p className="mt-2 font-mono text-3xl text-ink">{value}</p>
      )}
    </div>
  );
}

export function AdminLoadError({ message }: { message: string }) {
  return (
    <p className="mb-4 border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-alert">{message}</p>
  );
}

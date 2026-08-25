import { Navigate, Outlet } from "react-router-dom";
import { useT } from "../i18n";
import { homePath, useAuth, useAuthReady } from "../store/auth";
import type { Role } from "../types";

export function Guard({ roles }: { roles: Role[] }) {
  const t = useT();
  const ready = useAuthReady();
  const user = useAuth((s) => s.user);
  const accessToken = useAuth((s) => s.accessToken);
  if (!ready) {
    return <p className="px-8 py-16 text-sm text-mute">{t("common.sessionLoading")}</p>;
  }
  if (!user || !accessToken) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homePath(user.role)} replace />;
  return <Outlet />;
}

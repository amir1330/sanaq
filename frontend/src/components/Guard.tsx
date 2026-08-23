import { Navigate, Outlet } from "react-router-dom";
import { homePath, useAuth } from "../store/auth";
import type { Role } from "../types";

export function Guard({ roles }: { roles: Role[] }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homePath(user.role)} replace />;
  return <Outlet />;
}

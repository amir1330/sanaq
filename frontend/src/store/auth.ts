import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { User } from "../types";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  shopId: number | null;
  setSession: (access: string, refresh: string, user: User) => void;
  setShopId: (id: number) => void;
  logout: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      shopId: null,
      setSession: (accessToken, refreshToken, user) => {
        const shopId = user.shop_id ?? user.owned_shop_ids[0] ?? get().shopId;
        set({ accessToken, refreshToken, user, shopId });
      },
      setShopId: (shopId) => set({ shopId }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, shopId: null }),
    }),
    { name: "coffeeos-auth" },
  ),
);

/** Wait until persisted auth is loaded before firing protected API calls. */
export function useAuthReady(): boolean {
  const [ready, setReady] = useState(() => useAuth.persist.hasHydrated());
  useEffect(() => {
    if (useAuth.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return useAuth.persist.onFinishHydration(() => setReady(true));
  }, []);
  return ready;
}

export function useAuthSessionReady(): boolean {
  const ready = useAuthReady();
  const accessToken = useAuth((s) => s.accessToken);
  const user = useAuth((s) => s.user);
  return ready && Boolean(accessToken && user);
}

export function homePath(role?: string | null): string {
  if (role === "super_admin") return "/admin";
  if (role === "owner") return "/owner";
  return "/pos";
}

import { storageGet, storageRemove, storageSet } from "./storage";

/** Read from `key`, falling back to `legacyKey` and migrating to `key` when found. */
export function storageGetMigrated(key: string, legacyKey: string): string | null {
  const current = storageGet(key);
  if (current !== null) return current;
  const legacy = storageGet(legacyKey);
  if (legacy === null) return null;
  storageSet(key, legacy);
  storageRemove(legacyKey);
  return legacy;
}

export function storageSetMigrated(key: string, legacyKey: string, value: string): void {
  storageSet(key, value);
  storageRemove(legacyKey);
}

export function storageRemoveMigrated(key: string, legacyKey: string): void {
  storageRemove(key);
  storageRemove(legacyKey);
}

export const STORAGE_KEYS = {
  auth: { current: "sanaq-auth", legacy: "coffeeos-auth" },
  theme: { current: "sanaq-theme", legacy: "coffeeos-theme" },
  uiScale: { current: "sanaq-ui-scale", legacy: "coffeeos-ui-scale" },
  seller: (shopId: number) => ({
    current: `sanaq-seller-${shopId}`,
    legacy: `coffeeos-seller-${shopId}`,
  }),
  register: (shopId: number) => ({
    current: `sanaq-register-${shopId}`,
    legacy: `coffeeos-register-${shopId}`,
  }),
} as const;

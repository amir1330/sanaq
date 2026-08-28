import type { StateStorage } from "zustand/middleware";
import { storageGetMigrated, storageRemoveMigrated, storageSetMigrated } from "./migratedStorage";

/** Zustand persist storage that migrates coffeeos-* keys to sanaq-* on read. */
export function createMigratedPersistStorage(legacyKey: string): StateStorage {
  return {
    getItem: (name) => storageGetMigrated(name, legacyKey),
    setItem: (name, value) => storageSetMigrated(name, legacyKey, value),
    removeItem: (name) => storageRemoveMigrated(name, legacyKey),
  };
}

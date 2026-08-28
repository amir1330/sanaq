import { describe, expect, it } from "vitest";
import { storageGetMigrated, storageSetMigrated, STORAGE_KEYS } from "./migratedStorage";

describe("storage key migration", () => {
  it("migrates legacy auth key to sanaq on read", () => {
    localStorage.setItem(STORAGE_KEYS.auth.legacy, JSON.stringify({ accessToken: "x" }));
    const raw = storageGetMigrated(STORAGE_KEYS.auth.current, STORAGE_KEYS.auth.legacy);
    expect(raw).toContain("x");
    expect(localStorage.getItem(STORAGE_KEYS.auth.current)).toContain("x");
    expect(localStorage.getItem(STORAGE_KEYS.auth.legacy)).toBeNull();
  });

  it("writes only to the new key", () => {
    storageSetMigrated(STORAGE_KEYS.theme.current, STORAGE_KEYS.theme.legacy, "dark");
    expect(localStorage.getItem(STORAGE_KEYS.theme.current)).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEYS.theme.legacy)).toBeNull();
  });
});

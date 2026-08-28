import { create } from "zustand";
import { storageGetMigrated, storageSetMigrated, STORAGE_KEYS } from "../lib/migratedStorage";

export type Theme = "light" | "dark";
export type ThemePreference = "auto" | Theme;

const KEY = STORAGE_KEYS.theme.current;
const LEGACY_KEY = STORAGE_KEYS.theme.legacy;

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "auto";
  const saved = storageGetMigrated(KEY, LEGACY_KEY);
  if (saved === "dark" || saved === "light" || saved === "auto") return saved;
  return "auto";
}

export function resolveTheme(preference: ThemePreference): Theme {
  return preference === "auto" ? systemTheme() : preference;
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

let mediaBound = false;

function bindSystemListener() {
  if (mediaBound || typeof window === "undefined") return;
  mediaBound = true;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const preference = useTheme.getState().preference;
    if (preference === "auto") applyTheme(systemTheme());
  });
}

type ThemeState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

export const useTheme = create<ThemeState>((set) => ({
  preference: readPreference(),
  setPreference: (preference) => {
    storageSetMigrated(KEY, LEGACY_KEY, preference);
    applyTheme(resolveTheme(preference));
    set({ preference });
  },
}));

export function bootTheme() {
  bindSystemListener();
  applyTheme(resolveTheme(useTheme.getState().preference));
}

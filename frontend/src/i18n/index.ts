import { create } from "zustand";
import en from "./locales/en";
import kk from "./locales/kk";
import ru from "./locales/ru";
import type { Locale, LocalePreference, Messages } from "./types";

export type { Locale, LocalePreference, Messages };
export { localeNames } from "./types";

const KEY = "sanaq-locale";

const catalogs: Record<Locale, Messages> = { ru, en, kk };

export function detectDeviceLocale(): Locale {
  if (typeof navigator === "undefined") return "ru";
  const tags = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const tag of tags) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "kk" || base === "kz") return "kk";
    if (base === "ru") return "ru";
    if (base === "en") return "en";
  }
  return "ru";
}

function readPreference(): LocalePreference {
  if (typeof window === "undefined") return "auto";
  const saved = window.localStorage.getItem(KEY);
  if (saved === "ru" || saved === "en" || saved === "kk" || saved === "auto") return saved;
  return "auto";
}

export function resolveLocale(preference: LocalePreference): Locale {
  return preference === "auto" ? detectDeviceLocale() : preference;
}

function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  const messages = catalogs[locale];
  document.documentElement.lang = messages.meta.docLang;
  document.title = messages.meta.title;
}

type Path = {
  [K in keyof Messages]: Messages[K] extends string
    ? K
    : {
        [P in keyof Messages[K]]: `${K & string}.${P & string}`;
      }[keyof Messages[K]];
}[keyof Messages];

function lookup(messages: Messages, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = messages;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(
  locale: Locale,
  key: Path | string,
  vars?: Record<string, string | number>,
): string {
  const raw = lookup(catalogs[locale], key) ?? lookup(catalogs.ru, key) ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] != null ? String(vars[name]) : `{${name}}`,
  );
}

type LocaleState = {
  preference: LocalePreference;
  locale: Locale;
  setPreference: (preference: LocalePreference) => void;
};

export const useLocale = create<LocaleState>((set) => {
  const preference = readPreference();
  const locale = resolveLocale(preference);
  return {
    preference,
    locale,
    setPreference: (next) => {
      window.localStorage.setItem(KEY, next);
      const resolved = resolveLocale(next);
      applyDocumentLocale(resolved);
      set({ preference: next, locale: resolved });
    },
  };
});

export function bootLocale() {
  applyDocumentLocale(useLocale.getState().locale);
}

/** Reactive translator bound to current locale. */
export function useT() {
  const locale = useLocale((s) => s.locale);
  return (key: Path | string, vars?: Record<string, string | number>) => translate(locale, key, vars);
}

export function t(key: Path | string, vars?: Record<string, string | number>): string {
  return translate(useLocale.getState().locale, key, vars);
}

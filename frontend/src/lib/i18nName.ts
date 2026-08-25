import type { Locale } from "../i18n/types";

export type LocalizedNamed = {
  name: string;
  name_kk?: string | null;
  name_en?: string | null;
};

/** Pick menu label for UI locale; falls back to primary `name`. */
export function localizedName(item: LocalizedNamed | null | undefined, locale: Locale): string {
  if (!item) return "";
  if (locale === "kk" && item.name_kk?.trim()) return item.name_kk.trim();
  if (locale === "en" && item.name_en?.trim()) return item.name_en.trim();
  return item.name;
}

export function dateLocaleTag(locale: Locale): string {
  if (locale === "kk") return "kk-KZ";
  if (locale === "en") return "en-GB";
  return "ru-RU";
}

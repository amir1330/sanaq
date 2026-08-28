import { useT } from "../i18n";

export function SkipLink({ targetId = "main-content" }: { targetId?: string }) {
  const t = useT();
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-line focus:bg-paper focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-ink focus:shadow-soft"
    >
      {t("common.skipToContent")}
    </a>
  );
}

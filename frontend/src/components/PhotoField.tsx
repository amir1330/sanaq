import { useRef } from "react";
import { useT } from "../i18n";
import { Button } from "./ui";

export function PhotoField({
  src,
  onFile,
  onClear,
  busy,
  label,
  hint,
  compact,
}: {
  src: string | null;
  onFile: (file: File) => void;
  onClear?: () => void;
  busy?: boolean;
  label?: string;
  hint?: string;
  compact?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const title = label ?? t("photo.label");
  if (compact) {
    return (
      <div>
        <button
          type="button"
          disabled={busy}
          onClick={() => ref.current?.click()}
          className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-md bg-cream text-[12.5px] text-mute hover:ring-1 hover:ring-ink disabled:opacity-40"
        >
          {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : t("common.photo")}
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
        {src && onClear && (
          <button type="button" className="mt-1 block text-[12px] text-mute hover:text-maroon" onClick={onClear}>
            {t("common.remove")}
          </button>
        )}
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-faint">{title}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        className="flex h-36 w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-line-2 bg-cream hover:border-ink disabled:opacity-40"
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="px-4 text-center text-sm text-mute">{t("photo.click")}</span>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" variant="quiet" onClick={() => ref.current?.click()} disabled={busy}>
          {src ? t("settings.replace") : t("photo.choose")}
        </Button>
        {src && onClear && (
          <Button type="button" variant="ghost" onClick={onClear} disabled={busy}>
            {t("common.remove")}
          </Button>
        )}
        <span className="text-[12.5px] text-mute">{hint}</span>
      </div>
    </div>
  );
}

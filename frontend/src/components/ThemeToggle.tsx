import { cn } from "../lib/utils";
import { useTheme } from "../store/theme";

export function ThemeToggle({ className, label }: { className?: string; label?: string }) {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn("text-[13.5px] text-ink-soft transition hover:text-ink", className)}
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
    >
      {label ?? (dark ? "Светлая" : "Тёмная")}
    </button>
  );
}

import { cn } from "../lib/utils";
import { Glyph } from "./Glyph";

export function Mark({ className }: { className?: string }) {
  return <Glyph name="muiz" className={cn("mark", className)} />;
}

export function Brand({
  name = "Sanaq",
  className,
  markClass,
}: {
  name?: string;
  className?: string;
  markClass?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-[11px] font-display text-[22px] leading-none", className)}>
      <Mark className={cn("h-[22px] w-[31px] text-sun", markClass)} />
      <span className="truncate">{name}</span>
    </span>
  );
}

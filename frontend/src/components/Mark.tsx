import { cn } from "../lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg className={cn("mark shrink-0", className)} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1="12" y1="1.5" x2="12" y2="22.5" stroke="currentColor" strokeWidth="1" />
      <line x1="1.5" y1="12" x2="22.5" y2="12" stroke="currentColor" strokeWidth="1" />
      <line x1="4.6" y1="4.6" x2="19.4" y2="19.4" stroke="currentColor" strokeWidth="1" />
      <line x1="19.4" y1="4.6" x2="4.6" y2="19.4" stroke="currentColor" strokeWidth="1" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function Brand({
  name = "CoffeeOS",
  className,
  markClass,
}: {
  name?: string;
  className?: string;
  markClass?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-3 font-display text-[19px] tracking-[0.01em]", className)}>
      <Mark className={cn("h-[22px] w-[22px]", markClass)} />
      <span className="truncate">{name}</span>
    </span>
  );
}

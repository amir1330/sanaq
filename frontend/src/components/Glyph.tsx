import sprite from "../ornaments.svg?raw";
import { cn } from "../lib/utils";

const boxes = {
  muiz: "0 0 1024 726",
  kassa: "144.1 137.2 67.6 67.7",
  sklad: "424.1 84.6 66.6 63.8",
  smeny: "370.0 139.7 52.5 42.6",
  dengi: "416.3 361.8 86.2 92.2",
  ornament: "30 313 676 128",
} as const;

export function OrnamentSprite() {
  return (
    <div
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: sprite }}
    />
  );
}

export function Glyph({
  name,
  className,
}: {
  name: keyof typeof boxes;
  className?: string;
}) {
  return (
    <svg className={cn("shrink-0", className)} viewBox={boxes[name]} aria-hidden>
      <use href={`#g-${name}`} />
    </svg>
  );
}

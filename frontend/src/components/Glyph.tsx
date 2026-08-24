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

function parseBox(box: string) {
  const [x, y, width, height] = box.split(/\s+/).map(Number);
  return { x, y, width, height };
}

export function Glyph({
  name,
  className,
}: {
  name: keyof typeof boxes;
  className?: string;
}) {
  if (name === "ornament" || name === "muiz") {
    const box = boxes[name];
    const { x, y, width, height } = parseBox(box);
    return (
      <svg
        className={cn("shrink-0", className)}
        viewBox={box}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <use href={`#g-${name}`} x={x} y={y} width={width} height={height} />
      </svg>
    );
  }

  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 24 24" aria-hidden>
      <use href={`#g-${name}`} width="24" height="24" />
    </svg>
  );
}

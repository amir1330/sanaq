import { publicUrl } from "../lib/utils";
import type { Shop } from "../types";

export function ShopBrand({
  shop,
  fallback = "CoffeeOS",
  size = "sm",
  showName = true,
}: {
  shop?: Shop | null;
  fallback?: string;
  size?: "sm" | "md";
  showName?: boolean;
}) {
  const src = publicUrl(shop?.logo_url);
  const name = shop?.name ?? fallback;
  const box = size === "md" ? "h-12 w-12" : "h-8 w-8";

  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      {src ? (
        <img src={src} alt="" className={`${box} shrink-0 object-contain`} />
      ) : (
        <span
          className={`${box} shrink-0 bg-sun`}
          aria-hidden
        />
      )}
      {showName && (
        <span
          className={
            size === "md"
              ? "truncate text-lg font-medium"
              : "truncate text-sm font-medium tracking-[0.12em] uppercase"
          }
        >
          {name}
        </span>
      )}
    </span>
  );
}

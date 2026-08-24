import { publicUrl } from "../lib/utils";
import type { Shop } from "../types";
import { Brand, Mark } from "./Mark";

export function ShopBrand({
  shop,
  fallback = "Sanaq",
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
  const box = size === "md" ? "h-5 w-5" : "h-[17px] w-[17px]";

  if (!showName) {
    return src ? <img src={src} alt="" className={`${box} object-contain`} /> : <Mark className={box} />;
  }

  if (src) {
    return (
      <span className="inline-flex min-w-0 items-center gap-3">
        <img src={src} alt="" className={`${box} shrink-0 object-contain`} />
        <span className={size === "md" ? "truncate font-semibold" : "truncate font-display text-[15.5px]"}>
          {name}
        </span>
      </span>
    );
  }

  return (
    <Brand
      name={name}
      className={size === "md" ? "text-[15px] font-semibold" : "text-[15.5px]"}
      markClass={box}
    />
  );
}

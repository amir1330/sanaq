import { publicUrl } from "../lib/utils";
import type { Shop } from "../types";
import { Brand, Mark } from "./Mark";

export function ShopBrand({
  shop,
  fallback = "Sanaq",
  size = "sm",
  showName = true,
  markClass,
}: {
  shop?: Shop | null;
  fallback?: string;
  size?: "sm" | "md";
  showName?: boolean;
  markClass?: string;
}) {
  const src = publicUrl(shop?.logo_url);
  const name = shop?.name ?? fallback;
  const box = size === "md" ? "h-[4.25rem] w-[4.25rem]" : "h-14 w-14";
  const markBox = size === "md" ? "h-6 w-8" : "h-[18px] w-[25px]";
  const logoClass = `${box} shrink-0 rounded-md bg-paper object-contain p-1`;

  if (!showName) {
    return src ? <img src={src} alt="" className={logoClass} /> : <Mark className={markBox} />;
  }

  if (src) {
    return (
      <span className="inline-flex min-w-0 items-center gap-3">
        <img src={src} alt="" className={logoClass} />
        <span className={size === "md" ? "truncate font-semibold" : "truncate font-display text-[17px]"}>
          {name}
        </span>
      </span>
    );
  }

  return (
    <Brand
      name={name}
      className={size === "md" ? "text-[14px] font-semibold" : "text-[17px]"}
      markClass={markClass ?? markBox}
    />
  );
}

const POS_SHOP_KEY = "coffeeos-pos-shop";

export function rememberPosShop(id: number) {
  if (id > 0) localStorage.setItem(POS_SHOP_KEY, String(id));
}

export function rememberedPosShop(): number | null {
  const n = Number(localStorage.getItem(POS_SHOP_KEY) || 0);
  return n > 0 ? n : null;
}

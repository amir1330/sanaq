import { create } from "zustand";
import { storageGet, storageSet } from "../lib/storage";

export type UiScale = "sm" | "md" | "lg" | "xl";

const KEY = "coffeeos-ui-scale";

/** CSS zoom factors for POS (MVP — fixed px text classes don't follow html font-size). */
export const SCALE_ZOOM: Record<UiScale, number> = {
  sm: 0.875,
  md: 1,
  lg: 1.125,
  xl: 1.25,
};

function readScale(): UiScale {
  const saved = storageGet(KEY);
  if (saved === "sm" || saved === "md" || saved === "lg" || saved === "xl") return saved;
  return "md";
}

type UiScaleState = {
  scale: UiScale;
  setScale: (scale: UiScale) => void;
};

export const useUiScale = create<UiScaleState>((set) => ({
  scale: readScale(),
  setScale: (scale) => {
    storageSet(KEY, scale);
    set({ scale });
  },
}));

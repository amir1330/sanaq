import { create } from "zustand";
import { storageGet, storageSet } from "../lib/storage";

export type UiScale = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

export const SCALES: UiScale[] = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];

const KEY = "coffeeos-ui-scale";

/** CSS zoom factors for POS (MVP — fixed px text classes don't follow html font-size). */
export const SCALE_ZOOM: Record<UiScale, number> = {
  sm: 0.875,
  md: 1,
  lg: 1.125,
  xl: 1.25,
  "2xl": 1.45,
  "3xl": 1.7,
  "4xl": 2,
};

function readScale(): UiScale {
  const saved = storageGet(KEY);
  if (saved && (SCALES as string[]).includes(saved)) return saved as UiScale;
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

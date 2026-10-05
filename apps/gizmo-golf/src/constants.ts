import { RGB } from "@ourizon/terrain";

export const BUILDING_PAD_CELL_SIZE = 180;
export const BUILDING_PAD_PROBABILITY = 0.5;

export const PAD_COLOR_BY_STRATEGY: Record<string, RGB> = {
  Earth: [0.55, 0.55, 0.55],
  Mars: [0.28, 0.14, 0.1],
  "Ocean Floor": [0.1, 0.12, 0.16],
};

export const padColorFor = (strategyName: string): RGB =>
  PAD_COLOR_BY_STRATEGY[strategyName] ?? [0.55, 0.55, 0.55];

export const HOLE_PIT_COLOR: RGB = [0.02, 0.01, 0.01];
export const HOLE_COLLAR_COLOR: RGB = [0.05, 0.03, 0.02];

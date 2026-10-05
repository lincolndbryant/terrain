import { createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const store = createStore();

export const coinScoreAtom = atomWithStorage("terrain_coin_score", 0);
export const holeScoreAtom = atomWithStorage("terrain_hole_score", 0);

export const lastCharPos = { x: 0, y: 5, z: 0 };

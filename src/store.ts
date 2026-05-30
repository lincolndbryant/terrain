import { createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";

// Module-level store survives Vite HMR — atoms keep their values when source files change.
export const store = createStore();

export const coinScoreAtom = atomWithStorage("terrain_coin_score", 0);
export const holeScoreAtom = atomWithStorage("terrain_hole_score", 0);

// Plain mutable object for character position — no React reactivity needed,
// just needs to survive HMR so the character doesn't teleport back to origin.
// y=5 is a safe fallback; GizmoMovement overwrites it on the first physics step.
export const lastCharPos = { x: 0, y: 5, z: 0 };

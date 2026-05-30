import { sampleTerrainHeight } from "../terrain/terrainHeight";
import { TERRAIN_TILE_SIZE } from "../constants";

export const HOLE_STEP = 40;
export const HOLE_RADIUS = 5;
export const HOLE_COLLAR_RADIUS = HOLE_RADIUS * 1.6;
export const HOLE_DEPTH = 14;

const HOLE_MAX_HEIGHT = 3;
const HOLE_MIN_HEIGHT = -6;
const HALF = TERRAIN_TILE_SIZE / 2;

export const h2 = (x: number, z: number): number => {
  let h = (Math.imul(x | 0, 127) ^ Math.imul(z | 0, 997) ^ 0x9e3779b9) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h;
};

export type HoleData = { cx: number; cy: number; cz: number };

export const findHoles = (cx: number, cz: number): HoleData[] => {
  const holes: HoleData[] = [];
  for (let x = cx - HALF; x <= cx + HALF; x += HOLE_STEP) {
    for (let z = cz - HALF; z <= cz + HALF; z += HOLE_STEP) {
      const hy = sampleTerrainHeight(x, z);
      if (hy > HOLE_MAX_HEIGHT || hy < HOLE_MIN_HEIGHT) {
        continue;
      }
      if (
        hy >= sampleTerrainHeight(x - HOLE_STEP, z) ||
        hy >= sampleTerrainHeight(x + HOLE_STEP, z) ||
        hy >= sampleTerrainHeight(x, z - HOLE_STEP) ||
        hy >= sampleTerrainHeight(x, z + HOLE_STEP)
      ) {
        continue;
      }
      if ((h2(Math.round(x), Math.round(z)) & 0xff) > 155) {
        continue;
      }
      holes.push({ cx: x, cy: hy, cz: z });
    }
  }
  return holes;
};

export const getHoleAtPoint = (
  x: number,
  z: number,
  holes: HoleData[],
  radius = HOLE_RADIUS,
): HoleData | null => {
  const r2 = radius * radius;
  for (const h of holes) {
    const dx = x - h.cx;
    const dz = z - h.cz;
    if (dx * dx + dz * dz < r2) {
      return h;
    }
  }
  return null;
};

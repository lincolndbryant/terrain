import { sampleTerrainHeight } from "../terrain/terrainHeight";
import { BUILDING_PAD_CELL_SIZE, BUILDING_PAD_PROBABILITY } from "../constants";

export type PadFloor = {
  cx: number;
  cz: number;
  hw: number;
  hd: number;
  height: number;
};

export type PadStep = {
  cx: number;
  cy: number;
  cz: number;
  hw: number;
  hh: number;
  hd: number;
};

export type PadCoin = {
  cx: number;
  cy: number;
  cz: number;
};

type Pad = {
  centerX: number;
  centerZ: number;
  halfW: number;
  halfD: number;
  height: number;
  steps: PadStep[];
  coins: PadCoin[];
};

// Direction unit vectors: 0=+X, 1=+Z, 2=-X, 3=-Z
const STEP_DX = [1, 0, -1, 0] as const;
const STEP_DZ = [0, 1, 0, -1] as const;
const STEP_DEPTH = 1.6; // half = 0.8, size in travel direction
const STEP_WIDTH = 2.4; // half = 1.2, size perpendicular to travel
const STEP_FIRST_H = 0.5; // height of the first block above pad
const STEP_RISE = 0.4; // height added per climbing step (≤ autostep limit)
const STEP_MAX_H = 8.0; // max cumulative height above pad
const STEP_MAX_N = 24; // max number of step blocks

const computeSteps = (
  padCX: number,
  padCZ: number,
  padHeight: number,
  padHalfW: number,
  padHalfD: number,
  seed: number,
): PadStep[] => {
  let s = seed >>> 0;
  const rng = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };

  const steps: PadStep[] = [];
  let x = padCX + ((rng() & 0xff) / 255 - 0.5) * padHalfW * 0.3;
  let z = padCZ + ((rng() & 0xff) / 255 - 0.5) * padHalfD * 0.3;
  let dir = rng() & 3;
  let cumH = 0;
  let run = 0;

  for (let i = 0; i < STEP_MAX_N; i++) {
    const r = rng();

    // Turn 90° after ≥2 steps (~30% chance per step)
    if (run >= 2 && (r & 0xf) < 5) {
      dir = (dir + (r & 0x10 ? 1 : 3)) & 3;
      run = 0;
    }

    // Flat bridge step (~12% chance after at least one climbing step)
    const bridge = cumH > 0 && ((r >> 8) & 0xff) < 30;
    const rise = bridge ? 0 : cumH === 0 ? STEP_FIRST_H : STEP_RISE;
    const newH = cumH + rise;
    if (newH > STEP_MAX_H) {
      break;
    }

    // Half-extents depend on travel axis
    const hw = STEP_DX[dir] !== 0 ? STEP_DEPTH / 2 : STEP_WIDTH / 2;
    const hd = STEP_DZ[dir] !== 0 ? STEP_DEPTH / 2 : STEP_WIDTH / 2;

    const nx = x + STEP_DX[dir] * STEP_DEPTH;
    const nz = z + STEP_DZ[dir] * STEP_DEPTH;

    // Stay inside pad bounds (1.2-unit margin)
    if (
      Math.abs(nx - padCX) + hw > padHalfW - 1.2 ||
      Math.abs(nz - padCZ) + hd > padHalfD - 1.2
    ) {
      dir = (dir + (r & 0x100 ? 1 : 3)) & 3;
      run = 0;
      continue;
    }

    x = nx;
    z = nz;
    cumH = newH;

    if (cumH <= 0) {
      continue;
    }

    // Block extends from padHeight (bottom) to padHeight + cumH (top)
    const hh = cumH / 2;
    steps.push({ cx: x, cy: padHeight + hh, cz: z, hw, hh, hd });
    run++;
  }

  return steps;
};

const uint32Hash = (a: number, b: number): number => {
  let h = ((a * 1234567) ^ (b * 7654321)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
};

const padCache = new Map<string, Pad | null>();

const getPadForCell = (cellX: number, cellZ: number): Pad | null => {
  const key = `${cellX}:${cellZ}`;
  if (padCache.has(key)) {
    return padCache.get(key) ?? null;
  }
  const h0 = uint32Hash(cellX, cellZ);
  if ((h0 & 0xffff) / 0xffff > BUILDING_PAD_PROBABILITY) {
    padCache.set(key, null);
    return null;
  }
  const h1 = uint32Hash(cellX ^ 0xabcd, cellZ ^ 0x1234);
  const h2 = uint32Hash(cellX ^ 0x5678, cellZ ^ 0xef01);
  const h3 = uint32Hash(cellX ^ 0x2345, cellZ ^ 0x6789);
  const margin = 30;
  const range = BUILDING_PAD_CELL_SIZE - 2 * margin;
  const offsetX = margin + ((h1 >>> 16) / 0xffff) * range;
  const offsetZ = margin + ((h1 & 0xffff) / 0xffff) * range;
  const centerX = cellX * BUILDING_PAD_CELL_SIZE + offsetX;
  const centerZ = cellZ * BUILDING_PAD_CELL_SIZE + offsetZ;
  const halfW = 20 + ((h2 >>> 24) / 255) * 35;
  const halfD = 15 + (((h2 >>> 16) & 0xff) / 255) * 25;
  const height = sampleTerrainHeight(centerX, centerZ);
  const steps = computeSteps(centerX, centerZ, height, halfW, halfD, h3);
  const topStep =
    steps.length > 0
      ? steps.reduce((a, b) => (a.cy + a.hh > b.cy + b.hh ? a : b))
      : null;
  const coins: PadCoin[] = topStep
    ? [{ cx: topStep.cx, cy: topStep.cy + topStep.hh + 1.5, cz: topStep.cz }]
    : [];
  const pad: Pad = { centerX, centerZ, halfW, halfD, height, steps, coins };
  padCache.set(key, pad);
  return pad;
};

export const getPadsInRegion = (
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): Pad[] => {
  const x0 = Math.floor(minX / BUILDING_PAD_CELL_SIZE);
  const x1 = Math.floor(maxX / BUILDING_PAD_CELL_SIZE);
  const z0 = Math.floor(minZ / BUILDING_PAD_CELL_SIZE);
  const z1 = Math.floor(maxZ / BUILDING_PAD_CELL_SIZE);
  const result: Pad[] = [];
  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      const pad = getPadForCell(cx, cz);
      if (pad) {
        result.push(pad);
      }
    }
  }
  return result;
};

export const getPadAtPoint = (worldX: number, worldZ: number): Pad | null => {
  const cellX = Math.floor(worldX / BUILDING_PAD_CELL_SIZE);
  const cellZ = Math.floor(worldZ / BUILDING_PAD_CELL_SIZE);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const pad = getPadForCell(cellX + dx, cellZ + dz);
      if (
        pad &&
        Math.abs(worldX - pad.centerX) <= pad.halfW &&
        Math.abs(worldZ - pad.centerZ) <= pad.halfD
      ) {
        return pad;
      }
    }
  }
  return null;
};

export const sampleGroundHeight = (worldX: number, worldZ: number): number => {
  const pad = getPadAtPoint(worldX, worldZ);
  return pad ? pad.height : sampleTerrainHeight(worldX, worldZ);
};

export const getCoinsInRegion = (
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): PadCoin[] => getPadsInRegion(minX, minZ, maxX, maxZ).flatMap((p) => p.coins);

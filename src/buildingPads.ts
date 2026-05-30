import { sampleTerrainHeight } from "./terrainHeight";
import { BUILDING_PAD_CELL_SIZE, BUILDING_PAD_PROBABILITY } from "./constants";

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

type Pad = {
  centerX: number;
  centerZ: number;
  halfW: number;
  halfD: number;
  height: number;
  steps: PadStep[];
};

const STEP_COUNT = 4;
const STEP_BASE_H = 0.55;
const STEP_RISE = 0.65;
const STEP_HALF_DEPTH = 0.8;
const STEP_HALF_WIDTH = 1.1;
const STEP_SPACING = STEP_HALF_DEPTH * 2 + 0.45;

const computeSteps = (
  padCX: number,
  padCZ: number,
  padHeight: number,
  padHalfW: number,
  padHalfD: number,
  seed: number,
): PadStep[] => {
  const dirIdx = seed & 3;
  const moveDX = dirIdx === 0 ? 1 : dirIdx === 1 ? -1 : 0;
  const moveDZ = dirIdx === 2 ? 1 : dirIdx === 3 ? -1 : 0;
  const startOffX = (((seed >>> 8) & 0x7f) / 127 - 0.5) * padHalfW * 0.5;
  const startOffZ = (((seed >>> 16) & 0x7f) / 127 - 0.5) * padHalfD * 0.5;
  const steps: PadStep[] = [];
  for (let i = 0; i < STEP_COUNT; i++) {
    const stepH = STEP_BASE_H + i * STEP_RISE;
    const cx = padCX + startOffX + moveDX * i * STEP_SPACING;
    const cz = padCZ + startOffZ + moveDZ * i * STEP_SPACING;
    if (
      Math.abs(cx - padCX) > padHalfW - STEP_HALF_DEPTH ||
      Math.abs(cz - padCZ) > padHalfD - STEP_HALF_DEPTH
    ) {
      break;
    }
    steps.push({
      cx,
      cy: padHeight + stepH / 2,
      cz,
      hw: moveDX !== 0 ? STEP_HALF_DEPTH : STEP_HALF_WIDTH,
      hh: stepH / 2,
      hd: moveDZ !== 0 ? STEP_HALF_DEPTH : STEP_HALF_WIDTH,
    });
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
  const pad: Pad = { centerX, centerZ, halfW, halfD, height, steps };
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

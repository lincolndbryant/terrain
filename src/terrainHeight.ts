import { fractalNoise } from "./noise";
import {
  TERRAIN_HEIGHT_SCALE,
  TERRAIN_NOISE_FREQUENCY,
  TERRAIN_NOISE_OCTAVES,
  TERRAIN_NOISE_LACUNARITY,
  TERRAIN_NOISE_GAIN,
  TERRAIN_MOUNTAIN_FREQUENCY,
  TERRAIN_MOUNTAIN_SCALE,
} from "./constants";

export const sampleBaseHeight = (worldX: number, worldZ: number): number =>
  fractalNoise(
    worldX * TERRAIN_NOISE_FREQUENCY,
    worldZ * TERRAIN_NOISE_FREQUENCY,
    TERRAIN_NOISE_OCTAVES,
    TERRAIN_NOISE_LACUNARITY,
    TERRAIN_NOISE_GAIN,
  ) * TERRAIN_HEIGHT_SCALE;

export const sampleTerrainHeight = (worldX: number, worldZ: number): number => {
  const base = sampleBaseHeight(worldX, worldZ);
  const continental = fractalNoise(
    worldX * TERRAIN_MOUNTAIN_FREQUENCY,
    worldZ * TERRAIN_MOUNTAIN_FREQUENCY,
    3,
    2.1,
    0.5,
  );
  const m = Math.max(0, continental - 0.1);
  return base + m * m * m * TERRAIN_MOUNTAIN_SCALE;
};

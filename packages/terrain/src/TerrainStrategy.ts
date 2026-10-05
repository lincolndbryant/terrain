import { RGB } from "./types";

export type TerrainStrategy = {
  name: string;
  skyColor: string;
  fogColor: string;
  defaultFogDensity: number;
  defaultViewDistance: number;
  roughness: number;
  metalness: number;
  colorForHeight: (height: number) => RGB;
};

export const earthStrategy: TerrainStrategy = {
  name: "Earth",
  skyColor: "#8fb4c8",
  fogColor: "#8fb4c8",
  defaultFogDensity: 50,
  defaultViewDistance: 50,
  roughness: 0.85,
  metalness: 0.0,
  colorForHeight: (h) => {
    if (h < -1.5) {
      return [0.18, 0.35, 0.56];
    }
    if (h < 0.5) {
      return [0.76, 0.66, 0.42];
    }
    if (h < 5.0) {
      return [0.29, 0.49, 0.35];
    }
    if (h < 9.0) {
      return [0.42, 0.36, 0.31];
    }
    if (h < 22.0) {
      return [0.32, 0.28, 0.26];
    }
    return [0.88, 0.93, 0.92];
  },
};

export const marsStrategy: TerrainStrategy = {
  name: "Mars",
  skyColor: "#b5581a",
  fogColor: "#c27040",
  defaultFogDensity: 65,
  defaultViewDistance: 35,
  roughness: 0.95,
  metalness: 0.0,
  colorForHeight: (h) => {
    if (h < -4.0) {
      return [0.2, 0.08, 0.06];
    }
    if (h < 0.0) {
      return [0.5, 0.2, 0.11];
    }
    if (h < 4.0) {
      return [0.62, 0.32, 0.16];
    }
    if (h < 7.5) {
      return [0.7, 0.46, 0.3];
    }
    return [0.8, 0.66, 0.58];
  },
};

export const oceanFloorStrategy: TerrainStrategy = {
  name: "Ocean Floor",
  skyColor: "#060e1c",
  fogColor: "#07111f",
  defaultFogDensity: 75,
  defaultViewDistance: 25,
  roughness: 0.4,
  metalness: 0.15,
  colorForHeight: (h) => {
    if (h < -5.0) {
      return [0.04, 0.04, 0.08];
    }
    if (h < -1.5) {
      return [0.07, 0.1, 0.18];
    }
    if (h < 2.0) {
      return [0.15, 0.19, 0.28];
    }
    if (h < 6.0) {
      return [0.26, 0.24, 0.23];
    }
    return [0.62, 0.52, 0.32];
  },
};

export const ALL_STRATEGIES: readonly TerrainStrategy[] = [
  earthStrategy,
  marsStrategy,
  oceanFloorStrategy,
];

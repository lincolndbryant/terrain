import { RGB } from "./types";

export type TerrainStrategy = {
  name: string;
  skyColor: string;
  fogColor: string;
  defaultFogDensity: number;
  defaultViewDistance: number;
  roughness: number;
  metalness: number;
  buildingPadColor: RGB;
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
  buildingPadColor: [0.55, 0.55, 0.55],
  colorForHeight: (h) => {
    if (h < -1.5) {
      return [0.18, 0.35, 0.56]; // deep water
    }
    if (h < 0.5) {
      return [0.76, 0.66, 0.42]; // sand
    }
    if (h < 5.0) {
      return [0.29, 0.49, 0.35]; // grass
    }
    if (h < 9.0) {
      return [0.42, 0.36, 0.31]; // rock
    }
    if (h < 22.0) {
      return [0.32, 0.28, 0.26]; // upper mountain
    }
    return [0.88, 0.93, 0.92]; // snow cap
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
  buildingPadColor: [0.28, 0.14, 0.1],
  colorForHeight: (h) => {
    if (h < -4.0) {
      return [0.2, 0.08, 0.06]; // crater floor
    }
    if (h < 0.0) {
      return [0.5, 0.2, 0.11]; // rusty lowlands
    }
    if (h < 4.0) {
      return [0.62, 0.32, 0.16]; // ochre plains
    }
    if (h < 7.5) {
      return [0.7, 0.46, 0.3]; // dusty highlands
    }
    return [0.8, 0.66, 0.58]; // pale summit
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
  buildingPadColor: [0.1, 0.12, 0.16],
  colorForHeight: (h) => {
    if (h < -5.0) {
      return [0.04, 0.04, 0.08]; // hadal trench
    }
    if (h < -1.5) {
      return [0.07, 0.1, 0.18]; // abyssal plain
    }
    if (h < 2.0) {
      return [0.15, 0.19, 0.28]; // continental slope
    }
    if (h < 6.0) {
      return [0.26, 0.24, 0.23]; // seamount basalt
    }
    return [0.62, 0.52, 0.32]; // hydrothermal minerals
  },
};

export const ALL_STRATEGIES: readonly TerrainStrategy[] = [
  earthStrategy,
  marsStrategy,
  oceanFloorStrategy,
];

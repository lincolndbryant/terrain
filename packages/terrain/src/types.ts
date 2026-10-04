export type Vec3 = [number, number, number];
export type RGB = [number, number, number];

export type HeightOverride = (worldX: number, worldZ: number) => number | null;
export type QuadColorOverride = (worldX: number, worldZ: number) => RGB | null;
export type OnTileCenter = (centerX: number, centerZ: number) => void;

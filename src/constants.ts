import { Vec3 } from "./types";

export const KEYBOARD_MOVE_SPEED = 0.12;
export const KEYBOARD_TURN_SPEED = 0.01;

// Camera setup — initial position gives ~10° downward pitch → ~1/3 sky at FOV 60
export const CAMERA_FOV = 60;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 700;
export const CAMERA_INITIAL_POSITION: Vec3 = [0, 1.7, 14];

// Orbit constraints
export const ORBIT_MIN_DISTANCE = 2;
export const ORBIT_MAX_DISTANCE = 80;
export const ORBIT_DAMPING_FACTOR = 0.06;
export const ORBIT_MIN_POLAR_ANGLE = Math.PI / 8;
export const ORBIT_MAX_POLAR_ANGLE = Math.PI * 0.44;

// Height of the orbit target above terrain (roughly character eye level)
export const CAMERA_TARGET_HEIGHT = 0.75;

export const TERRAIN_TILE_SIZE = 720;
export const TERRAIN_SEGMENTS = 128;
export const TERRAIN_HEIGHT_SCALE = 16;
export const TERRAIN_REGEN_DISTANCE = 120;
export const TERRAIN_SNAP_GRID = 90;
export const TERRAIN_NOISE_FREQUENCY = 0.018;
export const TERRAIN_NOISE_OCTAVES = 5;
export const TERRAIN_NOISE_LACUNARITY = 2.1;
export const TERRAIN_NOISE_GAIN = 0.5;

export const TERRAIN_MOUNTAIN_FREQUENCY = 0.003;
export const TERRAIN_MOUNTAIN_SCALE = 250;

export const BUILDING_PAD_CELL_SIZE = 180;
export const BUILDING_PAD_PROBABILITY = 0.5;

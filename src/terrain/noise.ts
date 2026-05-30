import { Vec3 } from "../types";

// Lookup table mapping permutation indices to gradient vectors for Perlin noise.
// 12 vectors point toward the edges/vertices of a cube, giving uniform gradient distribution.
const gradients: Vec3[] = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
];

// Doubled permutation table (512 entries) to avoid index wrapping in lookups.
const permutationTable = new Uint8Array(512);

const buildPermutationTable = (seed = 42): void => {
  const shuffled = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    shuffled[i] = i;
  }
  // Fisher-Yates shuffle using a linear congruential generator for the seed.
  let state = seed;
  for (let i = 255; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapTarget = state % (i + 1);
    [shuffled[i], shuffled[swapTarget]] = [shuffled[swapTarget], shuffled[i]];
  }
  for (let i = 0; i < 512; i++) {
    permutationTable[i] = shuffled[i & 255];
  }
};

buildPermutationTable();

const dotWithGradient = (gradient: Vec3, x: number, y: number): number =>
  gradient[0] * x + gradient[1] * y;

// Ken Perlin's quintic fade curve: smoothstep that has zero first and second derivatives at t=0,1.
const quinticFade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

const linearInterpolate = (a: number, b: number, t: number): number =>
  a + t * (b - a);

export const perlin = (x: number, y: number): number => {
  const cellX = Math.floor(x) & 255;
  const cellY = Math.floor(y) & 255;
  const localX = x - Math.floor(x);
  const localY = y - Math.floor(y);
  const fadeX = quinticFade(localX);
  const fadeY = quinticFade(localY);

  // Hash the four corners of the unit square to gradient indices.
  const g00 = permutationTable[permutationTable[cellX] + cellY];
  const g01 = permutationTable[permutationTable[cellX] + cellY + 1];
  const g10 = permutationTable[permutationTable[cellX + 1] + cellY];
  const g11 = permutationTable[permutationTable[cellX + 1] + cellY + 1];

  return linearInterpolate(
    linearInterpolate(
      dotWithGradient(gradients[g00 % 12], localX, localY),
      dotWithGradient(gradients[g10 % 12], localX - 1, localY),
      fadeX,
    ),
    linearInterpolate(
      dotWithGradient(gradients[g01 % 12], localX, localY - 1),
      dotWithGradient(gradients[g11 % 12], localX - 1, localY - 1),
      fadeX,
    ),
    fadeY,
  );
};

export const fractalNoise = (
  x: number,
  y: number,
  octaves = 6,
  lacunarity = 2.0,
  gain = 0.5,
): number => {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let normalisationSum = 0;
  for (let i = 0; i < octaves; i++) {
    total += perlin(x * frequency, y * frequency) * amplitude;
    normalisationSum += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return total / normalisationSum;
};

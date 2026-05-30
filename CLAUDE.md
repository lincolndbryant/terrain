# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server (Vite, http://localhost:7777/terrain/)
npm run build        # type-check + bundle
npm run preview      # serve the production build
npm run prettier:write  # format all files under src/
```

There are no tests. `npm run build` is the closest thing to a CI check — it will catch TypeScript errors.

## Code style

- Always use curly braces for `if` bodies, even single-line ones. Never put `return` on the same line as `if`.
- Always use `const` + arrow functions — never the `function` keyword. This applies to helpers, components, and exported functions alike.
- Always use `type` over `interface` for declarations.
- Never pad variable declarations to align `=` signs across lines. Each line is independently formatted — no C-style column alignment.
- Always run `npm prettier:write` after generating or editing source files so committed code is always formatter-clean.

## Architecture

A Vite + React + TypeScript app that renders an infinite procedural terrain in WebGL via `@react-three/fiber` (R3F) and Three.js.

### Terrain mesh (`Terrain.tsx`)

The terrain is a single non-indexed `BufferGeometry` whose `Float32Array` buffers are mutated in-place each time the camera drifts far enough from the current tile centre. This avoids GC pressure on the hot path.

- Geometry is built quad-by-quad in `fillBuffers()`: each quad emits two triangles with vertices in CCW order (from above) so normals point up and `flatShading` works correctly.
- Each face is coloured by the average height of its three vertices (sampled at the corner world positions), written directly as RGB floats. No `THREE.Color` allocations occur in the fill loop.
- Heights come from `fbm()` in `noise.ts` — fractal Brownian motion over a seeded Perlin permutation table. The noise is sampled at absolute world coordinates so the terrain is seamless across tile boundaries.
- Tile regeneration is triggered in `useFrame` when `camera.position` drifts more than `TERRAIN_REGEN_DISTANCE` from the snapped centre. The new centre is snapped to `TERRAIN_SNAP_GRID` to reduce regeneration frequency. The tile is large enough that `TERRAIN_TILE_SIZE/2 - TERRAIN_REGEN_DISTANCE` always exceeds the fog far plane, hiding the edge pop.

### Camera (`KeyboardMovement.tsx` + `App.tsx`)

`OrbitControls` (from `@react-three/drei`) handles mouse orbit/pan/zoom. `KeyboardMovement` runs alongside it in `useFrame`:

- `↑↓` translate `camera.position` and `controls.target` together along the flat XZ forward vector, so the orbit pivot travels with the camera.
- `←→` call `controls.rotateLeft()` to yaw the orbit.

The `OrbitControls` ref is typed as `OrbitControls` from `three-stdlib` (the underlying impl class that `@react-three/drei` wraps).

### Settings / fog (`SettingsPanel.tsx` + `App.tsx`)

Fog density is React state in `App`. On change, `fogRef.current.near/far` are mutated directly — no Canvas re-render. The fog `THREE.Fog` object is captured into `fogRef` inside `onCreated`.

### Constants and colours

`src/constants.ts` — all terrain tuning values (`TERRAIN_TILE_SIZE`, `TERRAIN_SEGMENTS`, `TERRAIN_HEIGHT_SCALE`, `TERRAIN_REGEN_DISTANCE`, `TERRAIN_SNAP_GRID`, `TERRAIN_NOISE_FREQUENCY`) plus biome colours and the sky hex string. Edit here to change terrain feel or palette.

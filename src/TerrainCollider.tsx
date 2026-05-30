import { useState, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, TrimeshCollider } from "@react-three/rapier";
import { sampleGroundHeight } from "./buildingPads";
import {
  TERRAIN_TILE_SIZE,
  TERRAIN_SEGMENTS,
  TERRAIN_REGEN_DISTANCE,
  TERRAIN_SNAP_GRID,
} from "./constants";

// Uses a TrimeshCollider built from the EXACT same vertex grid and TL-BR diagonal
// split as the visual terrain, eliminating any physics/visual surface mismatch.

const N = TERRAIN_SEGMENTS + 1;
const HALF = TERRAIN_TILE_SIZE / 2;
const STEP = TERRAIN_TILE_SIZE / TERRAIN_SEGMENTS;
const INDEX_COUNT = TERRAIN_SEGMENTS * TERRAIN_SEGMENTS * 6;

type TrimeshData = { vertices: Float32Array; indices: Uint32Array };

const buildTrimesh = (cx: number, cz: number): TrimeshData => {
  const vertices = new Float32Array(N * N * 3);
  for (let zi = 0; zi < N; zi++) {
    for (let xi = 0; xi < N; xi++) {
      const worldX = cx - HALF + xi * STEP;
      const worldZ = cz - HALF + zi * STEP;
      const base = (xi + zi * N) * 3;
      vertices[base] = worldX - cx;
      vertices[base + 1] = sampleGroundHeight(worldX, worldZ);
      vertices[base + 2] = worldZ - cz;
    }
  }

  const indices = new Uint32Array(INDEX_COUNT);
  let ii = 0;
  for (let zi = 0; zi < TERRAIN_SEGMENTS; zi++) {
    for (let xi = 0; xi < TERRAIN_SEGMENTS; xi++) {
      const tl = xi + zi * N;
      const tr = xi + 1 + zi * N;
      const bl = xi + (zi + 1) * N;
      const br = xi + 1 + (zi + 1) * N;
      // TL-BR diagonal, CCW from above → normals point up (matches visual terrain)
      indices[ii++] = tl;
      indices[ii++] = br;
      indices[ii++] = tr;
      indices[ii++] = tl;
      indices[ii++] = bl;
      indices[ii++] = br;
    }
  }

  return { vertices, indices };
};

type TileState = { cx: number; cz: number; mesh: TrimeshData; key: number };

const TerrainCollider = () => {
  const { camera } = useThree();
  const [tile, setTile] = useState<TileState>(() => ({
    cx: 0,
    cz: 0,
    mesh: buildTrimesh(0, 0),
    key: 0,
  }));
  const tileRef = useRef(tile);

  useFrame(() => {
    const t = tileRef.current;
    const dx = camera.position.x - t.cx;
    const dz = camera.position.z - t.cz;
    if (dx * dx + dz * dz < TERRAIN_REGEN_DISTANCE * TERRAIN_REGEN_DISTANCE) {
      return;
    }
    const cx =
      Math.round(camera.position.x / TERRAIN_SNAP_GRID) * TERRAIN_SNAP_GRID;
    const cz =
      Math.round(camera.position.z / TERRAIN_SNAP_GRID) * TERRAIN_SNAP_GRID;
    const next: TileState = {
      cx,
      cz,
      mesh: buildTrimesh(cx, cz),
      key: t.key + 1,
    };
    tileRef.current = next;
    setTile(next);
  });

  return (
    <RigidBody
      key={tile.key}
      type="fixed"
      position={[tile.cx, 0, tile.cz]}
      colliders={false}
    >
      <TrimeshCollider args={[tile.mesh.vertices, tile.mesh.indices]} />
    </RigidBody>
  );
};

export default TerrainCollider;

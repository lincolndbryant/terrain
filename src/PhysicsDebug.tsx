import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sampleGroundHeight } from "./buildingPads";
import {
  TERRAIN_TILE_SIZE,
  TERRAIN_SEGMENTS,
  TERRAIN_REGEN_DISTANCE,
  TERRAIN_SNAP_GRID,
} from "./constants";

// Mirrors the exact grid layout of TerrainCollider's HeightfieldCollider.
// Renders as a wireframe so physics collision geometry is visible over the
// visual terrain mesh.

const N = TERRAIN_SEGMENTS + 1;
const HALF = TERRAIN_TILE_SIZE / 2;
const STEP = TERRAIN_TILE_SIZE / TERRAIN_SEGMENTS;

const buildDebugGeo = (cx: number, cz: number): THREE.BufferGeometry => {
  const positions = new Float32Array(N * N * 3);
  for (let zi = 0; zi < N; zi++) {
    for (let xi = 0; xi < N; xi++) {
      const idx = (xi + zi * N) * 3;
      positions[idx] = cx - HALF + xi * STEP;
      positions[idx + 1] =
        sampleGroundHeight(cx - HALF + xi * STEP, cz - HALF + zi * STEP) + 0.05;
      positions[idx + 2] = cz - HALF + zi * STEP;
    }
  }

  // Two triangles per quad, TL-BR diagonal (Rapier's internal split)
  const indexCount = TERRAIN_SEGMENTS * TERRAIN_SEGMENTS * 6;
  const indices = new Uint32Array(indexCount);
  let ii = 0;
  for (let zi = 0; zi < TERRAIN_SEGMENTS; zi++) {
    for (let xi = 0; xi < TERRAIN_SEGMENTS; xi++) {
      const tl = xi + zi * N;
      const tr = xi + 1 + zi * N;
      const bl = xi + (zi + 1) * N;
      const br = xi + 1 + (zi + 1) * N;
      // TL-BR diagonal split (matches Rapier's heightfield triangulation)
      indices[ii++] = tl;
      indices[ii++] = bl;
      indices[ii++] = br;
      indices[ii++] = tl;
      indices[ii++] = br;
      indices[ii++] = tr;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
};

const PhysicsDebug = () => {
  const { camera } = useThree();
  const center = useRef(new THREE.Vector2(0, 0));
  const geoRef = useRef<THREE.BufferGeometry | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  const geo = useMemo(() => {
    const g = buildDebugGeo(0, 0);
    geoRef.current = g;
    return g;
  }, []);

  useFrame(() => {
    const cx = camera.position.x;
    const cz = camera.position.z;
    const dx = cx - center.current.x;
    const dz = cz - center.current.y;
    if (dx * dx + dz * dz < TERRAIN_REGEN_DISTANCE * TERRAIN_REGEN_DISTANCE) {
      return;
    }
    const snappedX = Math.round(cx / TERRAIN_SNAP_GRID) * TERRAIN_SNAP_GRID;
    const snappedZ = Math.round(cz / TERRAIN_SNAP_GRID) * TERRAIN_SNAP_GRID;
    center.current.set(snappedX, snappedZ);

    const newGeo = buildDebugGeo(snappedX, snappedZ);
    if (meshRef.current) {
      meshRef.current.geometry.dispose();
      meshRef.current.geometry = newGeo;
      geoRef.current = newGeo;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geo}>
      <meshBasicMaterial
        color="#00ffff"
        wireframe
        transparent
        opacity={0.35}
        depthTest={false}
      />
    </mesh>
  );
};

export default PhysicsDebug;

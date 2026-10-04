import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { RGB, HeightOverride, QuadColorOverride, OnTileCenter } from "./types";
import {
  TERRAIN_TILE_SIZE,
  TERRAIN_SEGMENTS,
  TERRAIN_REGEN_DISTANCE,
  TERRAIN_SNAP_GRID,
} from "./constants";
import { sampleTerrainHeight } from "./terrainHeight";
import { TerrainStrategy } from "./TerrainStrategy";

const VERT_COUNT = TERRAIN_SEGMENTS * TERRAIN_SEGMENTS * 6;

const writeVertex = (
  positions: Float32Array,
  colors: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  color: RGB,
): void => {
  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;
  colors[i * 3] = color[0];
  colors[i * 3 + 1] = color[1];
  colors[i * 3 + 2] = color[2];
};

const dim = (c: RGB, t: number): RGB => [c[0] * t, c[1] * t, c[2] * t];

const sampleHeight = (
  x: number,
  z: number,
  override: HeightOverride | undefined,
): number => {
  if (override) {
    const h = override(x, z);
    if (h !== null) {
      return h;
    }
  }
  return sampleTerrainHeight(x, z);
};

const populateTerrainBuffers = (
  positions: Float32Array,
  colors: Float32Array,
  centerX: number,
  centerZ: number,
  strategy: TerrainStrategy,
  heightOverride: HeightOverride | undefined,
  quadColorOverride: QuadColorOverride | undefined,
): void => {
  const quadSize = TERRAIN_TILE_SIZE / TERRAIN_SEGMENTS;
  const originX = centerX - TERRAIN_TILE_SIZE / 2;
  const originZ = centerZ - TERRAIN_TILE_SIZE / 2;
  let vertexIndex = 0;

  for (let row = 0; row < TERRAIN_SEGMENTS; row++) {
    for (let col = 0; col < TERRAIN_SEGMENTS; col++) {
      const x0 = originX + col * quadSize;
      const z0 = originZ + row * quadSize;
      const x1 = x0 + quadSize;
      const z1 = z0 + quadSize;

      const h00 = sampleHeight(x0, z0, heightOverride);
      const h10 = sampleHeight(x1, z0, heightOverride);
      const h01 = sampleHeight(x0, z1, heightOverride);
      const h11 = sampleHeight(x1, z1, heightOverride);

      const midX = (x0 + x1) / 2;
      const midZ = (z0 + z1) / 2;
      const overrideColor = quadColorOverride
        ? quadColorOverride(midX, midZ)
        : null;

      let colorTri1: RGB;
      let colorTri2: RGB;
      if (overrideColor) {
        colorTri1 = overrideColor;
        colorTri2 = overrideColor;
      } else {
        const slope1 = Math.min(
          1,
          (Math.abs(h10 - h00) + Math.abs(h11 - h00)) * 0.1,
        );
        const slope2 = Math.min(
          1,
          (Math.abs(h01 - h00) + Math.abs(h11 - h00)) * 0.1,
        );
        colorTri1 = dim(
          strategy.colorForHeight((h00 + h11 + h10) / 3),
          1 - slope1 * 0.3,
        );
        colorTri2 = dim(
          strategy.colorForHeight((h00 + h01 + h11) / 3),
          1 - slope2 * 0.3,
        );
      }

      // Triangle 1: TL, BR, TR (CCW from above → normal up)
      writeVertex(positions, colors, vertexIndex++, x0, h00, z0, colorTri1);
      writeVertex(positions, colors, vertexIndex++, x1, h11, z1, colorTri1);
      writeVertex(positions, colors, vertexIndex++, x1, h10, z0, colorTri1);

      // Triangle 2: TL, BL, BR
      writeVertex(positions, colors, vertexIndex++, x0, h00, z0, colorTri2);
      writeVertex(positions, colors, vertexIndex++, x0, h01, z1, colorTri2);
      writeVertex(positions, colors, vertexIndex++, x1, h11, z1, colorTri2);
    }
  }
};

type TerrainProps = {
  strategy: TerrainStrategy;
  heightOverride?: HeightOverride;
  quadColorOverride?: QuadColorOverride;
  onTileCenter?: OnTileCenter;
};

const Terrain = ({
  strategy,
  heightOverride,
  quadColorOverride,
  onTileCenter,
}: TerrainProps) => {
  const { camera } = useThree();
  const center = useRef(new THREE.Vector2(0, 0));
  const strategyRef = useRef(strategy);
  const heightOverrideRef = useRef(heightOverride);
  const quadColorOverrideRef = useRef(quadColorOverride);
  const onTileCenterRef = useRef(onTileCenter);

  heightOverrideRef.current = heightOverride;
  quadColorOverrideRef.current = quadColorOverride;
  onTileCenterRef.current = onTileCenter;

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(VERT_COUNT * 3);
    const colors = new Float32Array(VERT_COUNT * 3);
    onTileCenterRef.current?.(0, 0);
    populateTerrainBuffers(
      positions,
      colors,
      0,
      0,
      strategyRef.current,
      heightOverrideRef.current,
      quadColorOverrideRef.current,
    );
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: strategy.roughness,
        metalness: strategy.metalness,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Repopulate when strategy changes — positions stay valid.
  useEffect(() => {
    strategyRef.current = strategy;
    mat.roughness = strategy.roughness;
    mat.metalness = strategy.metalness;
    const positions = geo.attributes.position.array as Float32Array;
    const colors = geo.attributes.color.array as Float32Array;
    populateTerrainBuffers(
      positions,
      colors,
      center.current.x,
      center.current.y,
      strategy,
      heightOverrideRef.current,
      quadColorOverrideRef.current,
    );
    geo.attributes.color.needsUpdate = true;
  }, [strategy, geo, mat]);

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

    onTileCenterRef.current?.(snappedX, snappedZ);

    const positions = geo.attributes.position.array as Float32Array;
    const colors = geo.attributes.color.array as Float32Array;
    populateTerrainBuffers(
      positions,
      colors,
      snappedX,
      snappedZ,
      strategyRef.current,
      heightOverrideRef.current,
      quadColorOverrideRef.current,
    );
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  });

  return <mesh geometry={geo} material={mat} />;
};

export default Terrain;

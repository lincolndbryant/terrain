import { useMemo, useRef, useEffect } from "react";
import { RGB } from "../types";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  TERRAIN_TILE_SIZE,
  TERRAIN_SEGMENTS,
  TERRAIN_REGEN_DISTANCE,
  TERRAIN_SNAP_GRID,
} from "../constants";
import { sampleTerrainHeight } from "./terrainHeight";
import { getPadAtPoint } from "../buildings/buildingPads";
import { TerrainStrategy } from "./TerrainStrategy";

let _v = 0;
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    _v++;
  });
}

// Tile large enough that fog always hides the edge:
// TERRAIN_TILE_SIZE/2 - TERRAIN_REGEN_DISTANCE > fog far  →  360 - 120 = 240 < 650 max
// Keep fog view distance slider below ~35% when at tile edge or increase SIZE further.
const VERT_COUNT = TERRAIN_SEGMENTS * TERRAIN_SEGMENTS * 6; // 2 tris × 3 verts per quad

// Writes a single vertex (position + color) into the flat buffer arrays at slot i.
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

// Samples height at all four corners of each quad, then writes two triangles
// (CCW winding from above so normals point up) with flat per-face colors into
// the pre-allocated position and color GPU buffers.
const populateTerrainBuffers = (
  positions: Float32Array,
  colors: Float32Array,
  centerX: number,
  centerZ: number,
  strategy: TerrainStrategy,
): void => {
  const quadSize = TERRAIN_TILE_SIZE / TERRAIN_SEGMENTS;
  const originX = centerX - TERRAIN_TILE_SIZE / 2;
  const originZ = centerZ - TERRAIN_TILE_SIZE / 2;
  let vertexIndex = 0;

  const dim = (c: RGB, t: number): RGB => [c[0] * t, c[1] * t, c[2] * t];

  for (let row = 0; row < TERRAIN_SEGMENTS; row++) {
    for (let col = 0; col < TERRAIN_SEGMENTS; col++) {
      const x0 = originX + col * quadSize;
      const z0 = originZ + row * quadSize;
      const x1 = x0 + quadSize;
      const z1 = z0 + quadSize;

      let h00 = sampleTerrainHeight(x0, z0);
      let h10 = sampleTerrainHeight(x1, z0);
      let h01 = sampleTerrainHeight(x0, z1);
      let h11 = sampleTerrainHeight(x1, z1);

      // Override heights for vertices that land inside a building pad
      const p00 = getPadAtPoint(x0, z0);
      const p10 = getPadAtPoint(x1, z0);
      const p01 = getPadAtPoint(x0, z1);
      const p11 = getPadAtPoint(x1, z1);
      if (p00) {
        h00 = p00.height;
      }
      if (p10) {
        h10 = p10.height;
      }
      if (p01) {
        h01 = p01.height;
      }
      if (p11) {
        h11 = p11.height;
      }

      // Use quad centre to decide color (avoids per-triangle pad look-up)
      const padAtCenter = getPadAtPoint((x0 + x1) / 2, (z0 + z1) / 2);

      let colorTri1: RGB;
      let colorTri2: RGB;
      if (padAtCenter) {
        colorTri1 = strategy.buildingPadColor;
        colorTri2 = strategy.buildingPadColor;
      } else {
        // TL-BR diagonal: tri1=(TL,BR,TR), tri2=(TL,BL,BR)
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

      // Triangle 1: TL, BR, TR  (TL-BR diagonal, CCW from above → normal up)
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
};

const Terrain = ({ strategy }: TerrainProps) => {
  const { camera } = useThree();
  const center = useRef(new THREE.Vector2(0, 0));
  const strategyRef = useRef(strategy);
  const vRef = useRef(_v);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(VERT_COUNT * 3);
    const colors = new Float32Array(VERT_COUNT * 3);
    populateTerrainBuffers(positions, colors, 0, 0, strategyRef.current);
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  // When strategy changes, repopulate only colors — positions are unchanged.
  useEffect(() => {
    strategyRef.current = strategy;
    const positions = geo.attributes.position.array as Float32Array;
    const colors = geo.attributes.color.array as Float32Array;
    populateTerrainBuffers(
      positions,
      colors,
      center.current.x,
      center.current.y,
      strategy,
    );
    geo.attributes.color.needsUpdate = true;
  }, [strategy, geo]);

  useFrame(() => {
    // HMR: force repopulate when module updates
    if (vRef.current !== _v) {
      vRef.current = _v;
      center.current.set(Infinity, Infinity);
    }

    const cx = camera.position.x;
    const cz = camera.position.z;
    const dx = cx - center.current.x;
    const dz = cz - center.current.y;
    if (dx * dx + dz * dz < TERRAIN_REGEN_DISTANCE * TERRAIN_REGEN_DISTANCE) {
      return;
    }

    // Snap to grid so the pop happens less often and never overlaps fog
    const snappedX = Math.round(cx / TERRAIN_SNAP_GRID) * TERRAIN_SNAP_GRID;
    const snappedZ = Math.round(cz / TERRAIN_SNAP_GRID) * TERRAIN_SNAP_GRID;
    center.current.set(snappedX, snappedZ);

    const positions = geo.attributes.position.array as Float32Array;
    const colors = geo.attributes.color.array as Float32Array;
    populateTerrainBuffers(
      positions,
      colors,
      snappedX,
      snappedZ,
      strategyRef.current,
    );
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  });

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial
        vertexColors
        flatShading
        roughness={strategy.roughness}
        metalness={strategy.metalness}
        polygonOffset
        polygonOffsetFactor={2}
        polygonOffsetUnits={2}
      />
    </mesh>
  );
};

export default Terrain;

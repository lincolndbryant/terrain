import { useState, useRef, MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier, RigidBody } from "@react-three/rapier";
import { useSetAtom } from "jotai";
import * as THREE from "three";
import { Mask } from "@react-three/drei";
import { holeScoreAtom, lastCharPos } from "../store";
import { sampleTerrainHeight } from "../terrain/terrainHeight";
import {
  TERRAIN_TILE_SIZE,
  TERRAIN_REGEN_DISTANCE,
  TERRAIN_SNAP_GRID,
} from "../constants";
import type { RapierRigidBody } from "@react-three/rapier";

let _v = 0;
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    _v++;
  });
}

const HALF = TERRAIN_TILE_SIZE / 2;
const HOLE_STEP = 40;
const HOLE_MAX_HEIGHT = 3;
const HOLE_MIN_HEIGHT = -6;
// Radius used for ball suction, character detection, and terrain stencil cut
const HOLE_RADIUS = 4.0;
// How far the stencil mask extends (cuts terrain in a clean circle)
const HOLE_CUT_RADIUS = HOLE_RADIUS + 0.5;
// Character falls in if closer than this
const CHAR_FALL_RADIUS = HOLE_RADIUS - 0.8;
// Per-hole character cooldown (seconds) to avoid repeated trapping
const CHAR_COOLDOWN = 4;

const h2 = (x: number, z: number): number => {
  let h = (Math.imul(x | 0, 127) ^ Math.imul(z | 0, 997) ^ 0x9e3779b9) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h;
};

type HoleData = { cx: number; cy: number; cz: number };

const findHoles = (cx: number, cz: number): HoleData[] => {
  const holes: HoleData[] = [];
  for (let x = cx - HALF; x <= cx + HALF; x += HOLE_STEP) {
    for (let z = cz - HALF; z <= cz + HALF; z += HOLE_STEP) {
      const hy = sampleTerrainHeight(x, z);
      if (hy > HOLE_MAX_HEIGHT || hy < HOLE_MIN_HEIGHT) {
        continue;
      }
      if (
        hy >= sampleTerrainHeight(x - HOLE_STEP, z) ||
        hy >= sampleTerrainHeight(x + HOLE_STEP, z) ||
        hy >= sampleTerrainHeight(x, z - HOLE_STEP) ||
        hy >= sampleTerrainHeight(x, z + HOLE_STEP)
      ) {
        continue;
      }
      if ((h2(Math.round(x), Math.round(z)) & 0xff) > 155) {
        continue;
      }
      holes.push({ cx: x, cy: hy, cz: z });
    }
  }
  return holes;
};

// Deterministic ball spawn offset per hole
const ballOffset = (h: HoleData): [number, number] => {
  const seed = h2(Math.round(h.cx), Math.round(h.cz));
  const ox = ((seed & 0xff) / 255 - 0.5) * 12;
  const oz = (((seed >> 8) & 0xff) / 255 - 0.5) * 12;
  return [ox, oz];
};

type TileState = { cx: number; cz: number; holes: HoleData[]; key: number };

type Props = {
  bodyRef: MutableRefObject<RapierRigidBody | null>;
};

const GolfHoles = ({ bodyRef }: Props) => {
  const { camera } = useThree();
  const { world } = useRapier();
  const addScore = useSetAtom(holeScoreAtom);

  const [tile, setTile] = useState<TileState>(() => ({
    cx: 0,
    cz: 0,
    holes: findHoles(0, 0),
    key: 0,
  }));
  const tileRef = useRef(tile);
  const vRef = useRef(_v);

  const inProgress = useRef(new Map<number, number>());
  const holed = useRef(new Set<number>());
  // Per-hole cooldowns for character: hole index → remaining seconds
  const charCooldowns = useRef(new Map<number, number>());

  useFrame((_, delta) => {
    if (vRef.current !== _v) {
      vRef.current = _v;
      tileRef.current = { ...tileRef.current, cx: Infinity };
      inProgress.current.clear();
    }

    const t = tileRef.current;
    const dx = camera.position.x - t.cx;
    const dz = camera.position.z - t.cz;
    if (dx * dx + dz * dz >= TERRAIN_REGEN_DISTANCE * TERRAIN_REGEN_DISTANCE) {
      const cx =
        Math.round(camera.position.x / TERRAIN_SNAP_GRID) * TERRAIN_SNAP_GRID;
      const cz =
        Math.round(camera.position.z / TERRAIN_SNAP_GRID) * TERRAIN_SNAP_GRID;
      const next: TileState = {
        cx,
        cz,
        holes: findHoles(cx, cz),
        key: t.key + 1,
      };
      tileRef.current = next;
      inProgress.current.clear();
      charCooldowns.current.clear();
      setTile(next);
    }

    const holes = tileRef.current.holes;
    if (holes.length === 0) {
      return;
    }

    // Tick down character hole cooldowns
    charCooldowns.current.forEach((remaining, idx) => {
      const next = remaining - delta;
      if (next <= 0) {
        charCooldowns.current.delete(idx);
      } else {
        charCooldowns.current.set(idx, next);
      }
    });

    // Character fall-in detection
    const charBody = bodyRef.current;
    if (charBody) {
      const cp = charBody.translation();
      for (let i = 0; i < holes.length; i++) {
        if (charCooldowns.current.has(i)) {
          continue;
        }
        const h = holes[i];
        const cdx = cp.x - h.cx;
        const cdz = cp.z - h.cz;
        if (cdx * cdx + cdz * cdz < CHAR_FALL_RADIUS * CHAR_FALL_RADIUS) {
          // Eject to a safe spot just outside the hole
          const ejectX = h.cx + HOLE_RADIUS * 2.2;
          const ejectY = h.cy + 2.5;
          const ejectZ = h.cz;
          charBody.setNextKinematicTranslation({
            x: ejectX,
            y: ejectY,
            z: ejectZ,
          });
          lastCharPos.x = ejectX;
          lastCharPos.y = ejectY;
          lastCharPos.z = ejectZ;
          charCooldowns.current.set(i, CHAR_COOLDOWN);
          break;
        }
      }
    }

    // Ball detection
    world.forEachRigidBody((rb) => {
      if (!rb.isDynamic()) {
        return;
      }
      const handle = rb.handle;
      if (holed.current.has(handle)) {
        return;
      }
      const pos = rb.translation();
      for (const hole of holes) {
        const hdx = pos.x - hole.cx;
        const hdz = pos.z - hole.cz;
        if (hdx * hdx + hdz * hdz > HOLE_RADIUS * HOLE_RADIUS) {
          continue;
        }
        if (pos.y < hole.cy - 2 || pos.y > hole.cy + 2.5) {
          continue;
        }
        const elapsed = (inProgress.current.get(handle) ?? 0) + delta;
        inProgress.current.set(handle, elapsed);
        rb.setLinvel(
          {
            x: (hole.cx - pos.x) * 6,
            y: -14,
            z: (hole.cz - pos.z) * 6,
          },
          true,
        );
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        if (pos.y < hole.cy - 1.2 || elapsed > 1.2) {
          holed.current.add(handle);
          inProgress.current.delete(handle);
          rb.setTranslation({ x: 9999, y: 80, z: 9999 }, true);
          rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
          addScore((s) => s + 1);
        }
        break;
      }
    });
  });

  return (
    <>
      {tile.holes.map((h, i) => {
        const [bx, bz] = ballOffset(h);
        return (
          <group key={`${tile.key}-${i}`}>
            {/* Hole visuals */}
            <group position={[h.cx, h.cy, h.cz]}>
              {/* Terrain stencil mask — drei Mask cuts a circle in the terrain */}
              <Mask
                id={1}
                renderOrder={-1}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.1, 0]}
              >
                <circleGeometry args={[HOLE_CUT_RADIUS, 48]} />
              </Mask>
              {/* Dirt collar — sits over the cut edge */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                <ringGeometry
                  args={[HOLE_RADIUS * 0.88, HOLE_RADIUS * 1.28, 48]}
                />
                <meshLambertMaterial color="#5c4020" />
              </mesh>
              {/* Dark inner surround */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
                <ringGeometry
                  args={[HOLE_RADIUS * 0.45, HOLE_RADIUS * 0.88, 48]}
                />
                <meshBasicMaterial color="#1a1008" />
              </mesh>
              {/* Black centre cap */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
                <circleGeometry args={[HOLE_RADIUS * 0.45, 48]} />
                <meshBasicMaterial color="#000000" />
              </mesh>
              {/* Shaft — tapered tube, BackSide so walls visible from above */}
              <mesh position={[0, -6, 0]}>
                <cylinderGeometry
                  args={[HOLE_CUT_RADIUS, HOLE_RADIUS * 0.4, 12, 40, 1, true]}
                />
                <meshBasicMaterial color="#080604" side={THREE.BackSide} />
              </mesh>
              {/* Shaft bottom cap */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -12, 0]}>
                <circleGeometry args={[HOLE_RADIUS * 0.4, 32]} />
                <meshBasicMaterial color="#030201" />
              </mesh>
              {/* Flag pole */}
              <mesh position={[0, 1.0, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 2.0, 6]} />
                <meshLambertMaterial color="#b8b8b8" />
              </mesh>
              {/* Flag pennant */}
              <mesh position={[0.3, 1.8, 0]}>
                <planeGeometry args={[0.6, 0.36]} />
                <meshBasicMaterial color="#ff2222" side={THREE.DoubleSide} />
              </mesh>
            </group>
            {/* Ball near hole */}
            <RigidBody
              type="dynamic"
              position={[h.cx + bx, h.cy + 2, h.cz + bz]}
              restitution={0.75}
              friction={0.05}
              linearDamping={0.04}
              angularDamping={0.08}
            >
              <mesh>
                <sphereGeometry args={[0.5, 10, 8]} />
                <meshStandardMaterial color="#e05050" />
              </mesh>
            </RigidBody>
          </group>
        );
      })}
    </>
  );
};

export default GolfHoles;

import { useState, useRef, MutableRefObject, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier, RigidBody } from "@react-three/rapier";
import { useSetAtom } from "jotai";
import * as THREE from "three";
import { holeScoreAtom, lastCharPos } from "../store";
import { TERRAIN_REGEN_DISTANCE, TERRAIN_SNAP_GRID } from "../constants";
import type { RapierRigidBody } from "@react-three/rapier";
import {
  findHoles,
  h2,
  HoleData,
  HOLE_RADIUS,
  HOLE_COLLAR_RADIUS,
  HOLE_DEPTH,
} from "./holeLocations";

let _v = 0;
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    _v++;
  });
}

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

    // Ball detection — ball is holed when it reaches the pit floor
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
        if (pos.y < hole.cy - HOLE_DEPTH + 4 || elapsed > 1.2) {
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
            {/* Flag at the hole rim */}
            <group position={[h.cx + HOLE_COLLAR_RADIUS, h.cy, h.cz]}>
              <mesh position={[0, 1.0, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 2.0, 6]} />
                <meshLambertMaterial color="#b8b8b8" />
              </mesh>
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

import { useState, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { getPadsInRegion, type PadStep } from "./buildingPads";
import {
  TERRAIN_TILE_SIZE,
  TERRAIN_REGEN_DISTANCE,
  TERRAIN_SNAP_GRID,
} from "../constants";

let _v = 0;
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    _v++;
  });
}

const makeStoneTexture = (): THREE.CanvasTexture => {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const BW = 96;
  const BH = 48;
  ctx.fillStyle = "#585858";
  ctx.fillRect(0, 0, S, S);
  for (let row = 0; row * BH <= S; row++) {
    const shift = row & 1 ? BW / 2 : 0;
    for (let col = -1; (col - 1) * BW < S; col++) {
      const bx = col * BW + shift;
      const by = row * BH;
      const tone = 94 + (((col * 13) ^ (row * 7)) & 31);
      ctx.fillStyle = `rgb(${tone + 3},${tone},${tone - 2})`;
      ctx.fillRect(bx + 3, by + 3, BW - 5, BH - 5);
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = "#fff";
      ctx.fillRect(bx + 3, by + 3, BW - 5, 5);
      ctx.globalAlpha = 1;
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
};

const STONE_TEX = makeStoneTexture();

const HALF = TERRAIN_TILE_SIZE / 2;

type TileState = { cx: number; cz: number; steps: PadStep[]; key: number };

const collectSteps = (cx: number, cz: number): PadStep[] => {
  const pads = getPadsInRegion(cx - HALF, cz - HALF, cx + HALF, cz + HALF);
  return pads.flatMap((p) => p.steps);
};

const StepCubes = () => {
  const { camera } = useThree();
  const [tile, setTile] = useState<TileState>(() => ({
    cx: 0,
    cz: 0,
    steps: collectSteps(0, 0),
    key: 0,
  }));
  const tileRef = useRef(tile);
  const vRef = useRef(_v);

  useFrame(() => {
    const t = tileRef.current;

    // HMR: force regen when module updates
    if (vRef.current !== _v) {
      vRef.current = _v;
      tileRef.current = { ...t, cx: Infinity };
    }

    const dx = camera.position.x - tileRef.current.cx;
    const dz = camera.position.z - tileRef.current.cz;
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
      steps: collectSteps(cx, cz),
      key: t.key + 1,
    };
    tileRef.current = next;
    setTile(next);
  });

  return (
    <>
      {tile.steps.map((s, i) => (
        <RigidBody
          key={`${tile.key}-${i}`}
          type="fixed"
          position={[s.cx, s.cy, s.cz]}
          colliders="cuboid"
          restitution={0}
          friction={0.8}
        >
          <mesh>
            <boxGeometry args={[s.hw * 2, s.hh * 2, s.hd * 2]} />
            <meshStandardMaterial
              map={STONE_TEX}
              roughness={0.88}
              metalness={0.05}
            />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
};

export default StepCubes;

import { useState, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { getPadsInRegion, type PadStep } from "./buildingPads";
import {
  TERRAIN_TILE_SIZE,
  TERRAIN_REGEN_DISTANCE,
  TERRAIN_SNAP_GRID,
} from "./constants";

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
            <meshStandardMaterial color="#6b5045" roughness={0.9} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
};

export default StepCubes;

import { useRef, useMemo, RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSetAtom } from "jotai";
import type { RapierRigidBody } from "@react-three/rapier";
import { coinScoreAtom } from "../store";
import { getCoinsInRegion, type PadCoin } from "../buildings/buildingPads";
import { sampleTerrainHeight } from "../terrain/terrainHeight";
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

const HALF = TERRAIN_TILE_SIZE / 2;
const MTN_STEP = 45;
const MTN_MIN_H = 20;
const COLLECT_RADIUS = 2.0;
const FLASH_DURATION = 0.45;

const h2 = (x: number, z: number): number => {
  let h = (Math.imul(x | 0, 127) ^ Math.imul(z | 0, 997) ^ 0x9e3779b9) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  return h;
};

const collectCoins = (cx: number, cz: number): PadCoin[] => {
  const coins: PadCoin[] = getCoinsInRegion(
    cx - HALF,
    cz - HALF,
    cx + HALF,
    cz + HALF,
  );
  for (let x = cx - HALF; x <= cx + HALF; x += MTN_STEP) {
    for (let z = cz - HALF; z <= cz + HALF; z += MTN_STEP) {
      const hy = sampleTerrainHeight(x, z);
      if (hy < MTN_MIN_H) {
        continue;
      }
      if (
        hy < sampleTerrainHeight(x - MTN_STEP, z) ||
        hy < sampleTerrainHeight(x + MTN_STEP, z) ||
        hy < sampleTerrainHeight(x, z - MTN_STEP) ||
        hy < sampleTerrainHeight(x, z + MTN_STEP)
      ) {
        continue;
      }
      if ((h2(Math.round(x), Math.round(z)) & 0xff) > 175) {
        continue;
      }
      coins.push({ cx: x, cy: hy + 1.5, cz: z });
    }
  }
  return coins;
};

type CoinEntry = {
  coin: PadCoin;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  collected: boolean;
  flashT: number;
};

type Props = {
  bodyRef: RefObject<RapierRigidBody | null>;
};

const Coins = ({ bodyRef }: Props) => {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const addScore = useSetAtom(coinScoreAtom);
  const stateRef = useRef({
    cx: NaN,
    cz: NaN,
    entries: [] as CoinEntry[],
    t: 0,
    v: _v,
  });

  // Slightly thick coin with bevelled profile via lathe geometry for rounder edges
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.52, 0.52, 0.14, 48);
    return g;
  }, []);

  useFrame((_, delta) => {
    const st = stateRef.current;
    const group = groupRef.current;
    if (!group) {
      return;
    }

    st.t += delta;

    // HMR: new module version → force tile regen to pick up material/logic changes
    if (st.v !== _v) {
      st.v = _v;
      st.cx = NaN;
    }

    const dx = camera.position.x - st.cx;
    const dz = camera.position.z - st.cz;
    const needsRegen =
      isNaN(st.cx) ||
      dx * dx + dz * dz >= TERRAIN_REGEN_DISTANCE * TERRAIN_REGEN_DISTANCE;

    if (needsRegen) {
      const snx =
        Math.round(camera.position.x / TERRAIN_SNAP_GRID) * TERRAIN_SNAP_GRID;
      const snz =
        Math.round(camera.position.z / TERRAIN_SNAP_GRID) * TERRAIN_SNAP_GRID;
      st.cx = snx;
      st.cz = snz;
      st.entries.forEach((e) => {
        group.remove(e.mesh);
        e.mat.dispose();
      });
      st.entries = [];
      collectCoins(snx, snz).forEach((coin) => {
        const mat = new THREE.MeshStandardMaterial({
          color: "#f0c030",
          metalness: 1.0,
          roughness: 0.08,
          emissive: new THREE.Color("#7a4a00"),
          emissiveIntensity: 0.4,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(coin.cx, coin.cy, coin.cz);
        mesh.rotation.x = 0.35;
        // Warm point light parented to mesh — moves with it and pools on stone below
        const light = new THREE.PointLight("#ffcc44", 5, 12);
        light.position.set(0, 0, 0);
        mesh.add(light);
        group.add(mesh);
        st.entries.push({ coin, mesh, mat, collected: false, flashT: -1 });
      });
    }

    const body = bodyRef.current;
    const charPos = body ? body.translation() : null;

    st.entries.forEach((e, i) => {
      if (e.collected) {
        e.flashT += delta;
        const p = Math.max(0, 1 - e.flashT / FLASH_DURATION);
        e.mat.emissiveIntensity = p * 6;
        e.mesh.scale.setScalar(1 + p * 0.5);
        if (e.flashT >= FLASH_DURATION) {
          e.mesh.visible = false;
        }
        return;
      }

      // Proximity collection check
      if (charPos) {
        const cdx = charPos.x - e.coin.cx;
        const cdy = charPos.y - e.coin.cy;
        const cdz = charPos.z - e.coin.cz;
        if (
          cdx * cdx + cdy * cdy + cdz * cdz <
          COLLECT_RADIUS * COLLECT_RADIUS
        ) {
          e.collected = true;
          e.flashT = 0;
          e.mat.emissive.set("#ffcc44");
          e.mat.emissiveIntensity = 5;
          addScore((s) => s + 1);
          return;
        }
      }

      // Spin and bob — Phong specular creates natural shimmer from the directional light
      e.mesh.rotation.y = st.t * 1.8 + i * 1.27;
      e.mesh.position.y = e.coin.cy + Math.sin(st.t * 1.1 + i * 0.85) * 0.3;
    });
  });

  return <group ref={groupRef} />;
};

export default Coins;

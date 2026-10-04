import { useRef, useState, useEffect, useCallback, Suspense } from "react";
import { useAtom } from "jotai";
import { useThree } from "@react-three/fiber";
import { Routes, Route, useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import {
  Physics,
  RigidBody,
  CapsuleCollider,
  CuboidCollider,
} from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { Color, Fog, Group, Scene } from "three";
import { OrbitControls as OrbitControlsBase } from "three-stdlib";
import {
  Terrain,
  earthStrategy,
  ALL_STRATEGIES,
  TerrainStrategy,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_INITIAL_POSITION,
  CAMERA_NEAR,
  ORBIT_DAMPING_FACTOR,
  ORBIT_MAX_DISTANCE,
  ORBIT_MAX_POLAR_ANGLE,
  ORBIT_MIN_DISTANCE,
  ORBIT_MIN_POLAR_ANGLE,
  type RGB,
} from "@ourizon/terrain";
import { TerrainCollider } from "@ourizon/terrain/physics";
import { coinScoreAtom, holeScoreAtom, lastCharPos } from "./store";
import { padColorFor, HOLE_PIT_COLOR, HOLE_COLLAR_COLOR } from "./constants";
import { getPadAtPoint } from "./buildings/buildingPads";
import {
  findHoles,
  getHoleAtPoint,
  HoleData,
  HOLE_COLLAR_RADIUS,
  HOLE_DEPTH,
} from "./objects/holeLocations";
import PhysicsDebug from "./ui/PhysicsDebug";
import StepCubes from "./buildings/StepCubes";
import Coins from "./objects/Coins";
import GolfHoles from "./objects/GolfHoles";
import SettingsPanel from "./ui/SettingsPanel";
import Gizmo from "./characters/Gizmo";
import GizmoModel from "./characters/GizmoModel";
import GizmoMovement from "./characters/GizmoMovement";
import CharacterViewer from "./ui/CharacterViewer";

export type CharacterId = "model" | "builtin";

export const CHARACTER_OPTIONS: { id: CharacterId; label: string }[] = [
  { id: "builtin", label: "Gizmo · built-in" },
  { id: "model", label: "Gizmo · model" },
];

const fogNearFar = (
  density: number,
  viewDistance: number,
): [number, number] => {
  const far = 40 + (viewDistance / 100) * 610;
  const near = far * (1 - (density / 100) * 0.9);
  return [near, far];
};

const SELECT_STYLE: React.CSSProperties = {
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "rgba(255,255,255,0.82)",
  fontSize: 12,
  fontFamily: "monospace",
  padding: "5px 24px 5px 10px",
  borderRadius: 8,
  cursor: "pointer",
  letterSpacing: "0.04em",
  outline: "none",
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
};

const SELECT_ARROW_STYLE: React.CSSProperties = {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  color: "rgba(255,255,255,0.4)",
  fontSize: 10,
  lineHeight: "1",
};

type SelectFieldProps = {
  value: string;
  onChange: (value: string) => void;
  wrapperStyle?: React.CSSProperties;
  children: React.ReactNode;
};

export const SelectField = ({
  value,
  onChange,
  wrapperStyle,
  children,
}: SelectFieldProps) => (
  <div
    style={{ position: "relative", display: "inline-block", ...wrapperStyle }}
  >
    <select
      style={SELECT_STYLE}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
    <span style={SELECT_ARROW_STYLE}>▾</span>
  </div>
);

const AllowContextMenu = () => {
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const handler = (e: Event) => e.stopImmediatePropagation();
    el.addEventListener("contextmenu", handler, { capture: true });
    return () =>
      el.removeEventListener("contextmenu", handler, { capture: true });
  }, [gl]);
  return null;
};

const App = () => {
  const [characterId, setCharacterId] = useState<CharacterId>("builtin");

  return (
    <Routes>
      <Route
        path="/"
        element={
          <TerrainView
            characterId={characterId}
            onCharacterChange={setCharacterId}
          />
        }
      />
      <Route
        path="/characters"
        element={
          <CharacterViewer
            characterId={characterId}
            onCharacterChange={setCharacterId}
          />
        }
      />
    </Routes>
  );
};

type ActiveCharacterProps = {
  gizmoRef: React.MutableRefObject<Group | null>;
  bodyRef: React.MutableRefObject<RapierRigidBody | null>;
  movingRef: React.MutableRefObject<boolean>;
  jumpingRef: React.MutableRefObject<boolean>;
  kickingRef: React.MutableRefObject<number>;
  characterId: CharacterId;
};

const ActiveCharacter = ({
  gizmoRef,
  bodyRef,
  movingRef,
  jumpingRef,
  kickingRef,
  characterId,
}: ActiveCharacterProps) => {
  const initPos = lastCharPos;
  const mesh =
    characterId === "model" ? (
      <Suspense fallback={null}>
        <GizmoModel
          ref={gizmoRef}
          movingRef={movingRef}
          jumpingRef={jumpingRef}
        />
      </Suspense>
    ) : (
      <Gizmo
        ref={gizmoRef}
        movingRef={movingRef}
        jumpingRef={jumpingRef}
        kickingRef={kickingRef}
      />
    );
  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[initPos.x, initPos.y, initPos.z]}
    >
      <CapsuleCollider args={[0.4, 0.25]} position={[0, 0.65, 0]} />
      {mesh}
    </RigidBody>
  );
};

type TerrainViewProps = {
  characterId: CharacterId;
  onCharacterChange: (id: CharacterId) => void;
};

const TerrainView = ({ characterId, onCharacterChange }: TerrainViewProps) => {
  const navigate = useNavigate();
  const controlsRef = useRef<OrbitControlsBase | null>(null);
  const fogRef = useRef<Fog | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const gizmoRef = useRef<Group | null>(null);
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const movingRef = useRef(false);
  const jumpingRef = useRef(false);
  const kickingRef = useRef(0);
  const holesRef = useRef<HoleData[]>(findHoles(0, 0));
  const [fogDensity, setFogDensity] = useState(earthStrategy.defaultFogDensity);
  const [viewDistance, setViewDistance] = useState(
    earthStrategy.defaultViewDistance,
  );
  const [strategy, setStrategy] = useState<TerrainStrategy>(earthStrategy);
  const [debugPhysics, setDebugPhysics] = useState(false);
  const [coinScore] = useAtom(coinScoreAtom);
  const [holeScore] = useAtom(holeScoreAtom);

  const onTileCenter = useCallback((cx: number, cz: number) => {
    holesRef.current = findHoles(cx, cz);
  }, []);

  const heightOverride = useCallback((x: number, z: number): number | null => {
    const pad = getPadAtPoint(x, z);
    if (pad) {
      return pad.height;
    }
    const hole = getHoleAtPoint(x, z, holesRef.current);
    if (hole) {
      return hole.cy - HOLE_DEPTH;
    }
    return null;
  }, []);

  const quadColorOverride = useCallback(
    (x: number, z: number): RGB | null => {
      if (getHoleAtPoint(x, z, holesRef.current)) {
        return HOLE_PIT_COLOR;
      }
      if (getHoleAtPoint(x, z, holesRef.current, HOLE_COLLAR_RADIUS)) {
        return HOLE_COLLAR_COLOR;
      }
      if (getPadAtPoint(x, z)) {
        return padColorFor(strategy.name);
      }
      return null;
    },
    [strategy],
  );

  useEffect(() => {
    if (!fogRef.current) {
      return;
    }
    const [near, far] = fogNearFar(fogDensity, viewDistance);
    fogRef.current.near = near;
    fogRef.current.far = far;
  }, [fogDensity, viewDistance]);

  useEffect(() => {
    if (sceneRef.current) {
      (sceneRef.current.background as Color).set(strategy.skyColor);
    }
    if (fogRef.current) {
      fogRef.current.color.set(strategy.fogColor);
    }
    setFogDensity(strategy.defaultFogDensity);
    setViewDistance(strategy.defaultViewDistance);
  }, [strategy]);

  return (
    <>
      <Canvas
        camera={{
          fov: CAMERA_FOV,
          near: CAMERA_NEAR,
          far: CAMERA_FAR,
          position: CAMERA_INITIAL_POSITION,
        }}
        gl={{ antialias: true, stencil: true }}
        onCreated={({ scene }) => {
          sceneRef.current = scene;
          scene.background = new Color(strategy.skyColor);
          const [near, far] = fogNearFar(fogDensity, viewDistance);
          const fog = new Fog(strategy.fogColor, near, far);
          scene.fog = fog;
          fogRef.current = fog;
        }}
      >
        <AllowContextMenu />
        <ambientLight intensity={0.45} />
        <directionalLight position={[60, 80, 40]} intensity={1.6} />
        <hemisphereLight args={["#a8d0e6", "#6b8e4e", 0.5]} />
        <Environment
          preset="park"
          background={false}
          environmentIntensity={0.4}
        />

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={ORBIT_DAMPING_FACTOR}
          minDistance={ORBIT_MIN_DISTANCE}
          maxDistance={ORBIT_MAX_DISTANCE}
          minPolarAngle={ORBIT_MIN_POLAR_ANGLE}
          maxPolarAngle={ORBIT_MAX_POLAR_ANGLE}
          enablePan={false}
        />
        <Suspense fallback={null}>
          <Physics gravity={[0, -30, 0]}>
            <GizmoMovement
              controlsRef={controlsRef}
              gizmoRef={gizmoRef}
              bodyRef={bodyRef}
              movingRef={movingRef}
              jumpingRef={jumpingRef}
              kickingRef={kickingRef}
            />
            <ActiveCharacter
              gizmoRef={gizmoRef}
              bodyRef={bodyRef}
              movingRef={movingRef}
              jumpingRef={jumpingRef}
              kickingRef={kickingRef}
              characterId={characterId}
            />
            <TerrainCollider heightOverride={heightOverride} />
            <RigidBody type="fixed" position={[0, -200, 0]} colliders={false}>
              <CuboidCollider args={[1000, 1, 1000]} />
            </RigidBody>
            <StepCubes />
            <GolfHoles bodyRef={bodyRef} />
          </Physics>
        </Suspense>
        <Terrain
          strategy={strategy}
          heightOverride={heightOverride}
          quadColorOverride={quadColorOverride}
          onTileCenter={onTileCenter}
        />
        {debugPhysics && <PhysicsDebug />}
        <Coins bodyRef={bodyRef} />
      </Canvas>

      <div
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "rgba(255,255,255,0.9)",
          fontSize: 15,
          fontFamily: "monospace",
          padding: "6px 16px",
          borderRadius: 8,
          pointerEvents: "none",
          userSelect: "none",
          letterSpacing: "0.06em",
        }}
      >
        ◎ {coinScore} &nbsp;⛳ {holeScore}
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.7)",
          fontSize: 12,
          fontFamily: "monospace",
          background: "rgba(0,0,0,0.35)",
          padding: "6px 14px",
          borderRadius: 8,
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        ↑↓ move &nbsp;|&nbsp; ←→ turn &nbsp;|&nbsp; space — jump &nbsp;|&nbsp;
        drag — orbit &nbsp;|&nbsp; scroll — zoom
      </div>

      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <SelectField
          value={characterId}
          onChange={(v) => onCharacterChange(v as CharacterId)}
        >
          {CHARACTER_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>
        <button
          style={{
            background: debugPhysics
              ? "rgba(255,180,0,0.55)"
              : "rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.82)",
            fontSize: 12,
            fontFamily: "monospace",
            padding: "6px 14px",
            borderRadius: 8,
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
          onClick={() => setDebugPhysics((d) => !d)}
        >
          physics debug
        </button>
        <button
          style={{
            background: "rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.82)",
            fontSize: 12,
            fontFamily: "monospace",
            padding: "6px 14px",
            borderRadius: 8,
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
          onClick={() => navigate("/characters")}
        >
          characters →
        </button>
      </div>

      <SettingsPanel
        fogDensity={fogDensity}
        onFogDensity={setFogDensity}
        viewDistance={viewDistance}
        onViewDistance={setViewDistance}
        strategy={strategy}
        onStrategy={setStrategy}
        strategies={ALL_STRATEGIES}
      />
    </>
  );
};

export default App;

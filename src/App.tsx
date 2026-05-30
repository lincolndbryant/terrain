import { useRef, useState, useEffect, Suspense } from "react";
import { useThree } from "@react-three/fiber";
import { Routes, Route, useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Physics, RigidBody, CapsuleCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { Color, Fog, Group, Scene } from "three";
import { OrbitControls as OrbitControlsBase } from "three-stdlib";
import {
  earthStrategy,
  ALL_STRATEGIES,
  TerrainStrategy,
} from "./TerrainStrategy";
import {
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_INITIAL_POSITION,
  CAMERA_NEAR,
  ORBIT_DAMPING_FACTOR,
  ORBIT_MAX_DISTANCE,
  ORBIT_MAX_POLAR_ANGLE,
  ORBIT_MIN_DISTANCE,
  ORBIT_MIN_POLAR_ANGLE,
} from "./constants";
import { sampleGroundHeight } from "./buildingPads";

type OrbitControlsImpl = OrbitControlsBase;
import Terrain from "./Terrain";
import PhysicsDebug from "./PhysicsDebug";
import TerrainCollider from "./TerrainCollider";
import StepCubes from "./StepCubes";
import SettingsPanel from "./SettingsPanel";
import Gizmo from "./characters/Gizmo";
import GizmoModel from "./characters/GizmoModel";
import GizmoMovement from "./characters/GizmoMovement";
import CharacterViewer from "./CharacterViewer";

export type CharacterId = "model" | "builtin";

export const CHARACTER_OPTIONS: { id: CharacterId; label: string }[] = [
  { id: "builtin", label: "Gizmo · built-in" },
  { id: "model", label: "Gizmo · model" },
];

// viewDistance 0–100 → fog.far (40–650)
// fogDensity   0–100 → fog.near as fraction of far (0%=thin, 100%=thick)
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

// OrbitControls always calls preventDefault() on contextmenu, suppressing the
// browser's right-click menu. Intercept in capture phase before it can, and
// call stopImmediatePropagation() so OrbitControls' listener never fires.
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
  gizmoRef: React.RefObject<Group | null>;
  bodyRef: React.RefObject<RapierRigidBody | null>;
  movingRef: React.RefObject<boolean>;
  jumpingRef: React.RefObject<boolean>;
  characterId: CharacterId;
};

const ActiveCharacter = ({
  gizmoRef,
  bodyRef,
  movingRef,
  jumpingRef,
  characterId,
}: ActiveCharacterProps) => {
  const initialY = sampleGroundHeight(0, 0) + 4;
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
      <Gizmo ref={gizmoRef} movingRef={movingRef} jumpingRef={jumpingRef} />
    );
  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[0, initialY, 0]}
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
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const fogRef = useRef<Fog | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const gizmoRef = useRef<Group | null>(null);
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const movingRef = useRef(false);
  const jumpingRef = useRef(false);
  const [fogDensity, setFogDensity] = useState(earthStrategy.defaultFogDensity);
  const [viewDistance, setViewDistance] = useState(
    earthStrategy.defaultViewDistance,
  );
  const [strategy, setStrategy] = useState<TerrainStrategy>(earthStrategy);
  const [debugPhysics, setDebugPhysics] = useState(false);

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
        gl={{ antialias: true }}
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

        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={ORBIT_DAMPING_FACTOR}
          minDistance={ORBIT_MIN_DISTANCE}
          maxDistance={ORBIT_MAX_DISTANCE}
          minPolarAngle={ORBIT_MIN_POLAR_ANGLE}
          maxPolarAngle={ORBIT_MAX_POLAR_ANGLE}
          enableKeys={false}
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
            />
            <ActiveCharacter
              gizmoRef={gizmoRef}
              bodyRef={bodyRef}
              movingRef={movingRef}
              jumpingRef={jumpingRef}
              characterId={characterId}
            />
            <TerrainCollider />
            <StepCubes />
            {[-20, 0, 20].flatMap((x) =>
              [-20, 0, 20].map((z) => (
                <RigidBody
                  key={`sphere-${x}-${z}`}
                  type="dynamic"
                  position={[x, 30, z]}
                  restitution={0.3}
                  friction={0.8}
                >
                  <mesh>
                    <sphereGeometry args={[0.5, 10, 8]} />
                    <meshStandardMaterial color="#e05050" />
                  </mesh>
                </RigidBody>
              )),
            )}
          </Physics>
        </Suspense>
        <Terrain strategy={strategy} />
        {debugPhysics && <PhysicsDebug />}
      </Canvas>

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

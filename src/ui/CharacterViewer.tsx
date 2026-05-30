import { useRef, Suspense, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { Color } from "three";
import * as THREE from "three";
import GizmoModel from "../characters/GizmoModel";
import Gizmo from "../characters/Gizmo";
import { CharacterId, CHARACTER_OPTIONS, SelectField } from "../App";

const BUTTON_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.18)",
  color: "rgba(255,255,255,0.85)",
  fontSize: 13,
  fontFamily: "monospace",
  padding: "7px 16px",
  borderRadius: 8,
  cursor: "pointer",
  backdropFilter: "blur(4px)",
  letterSpacing: "0.04em",
};

const LABEL_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  color: "rgba(255,255,255,0.55)",
  fontSize: 13,
  fontFamily: "monospace",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  pointerEvents: "none",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const HINT_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: 48,
  left: "50%",
  transform: "translateX(-50%)",
  color: "rgba(255,255,255,0.28)",
  fontSize: 11,
  fontFamily: "monospace",
  pointerEvents: "none",
  userSelect: "none",
  whiteSpace: "nowrap",
};

type Props = {
  characterId: CharacterId;
  onCharacterChange: (id: CharacterId) => void;
};

const CharacterViewer = ({ characterId, onCharacterChange }: Props) => {
  const navigate = useNavigate();
  const movingRef = useRef(false);
  const jumpingRef = useRef(false);
  const gizmoRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const held = new Set<string>();
    const dn = (e: KeyboardEvent) => {
      held.add(e.code);
      movingRef.current = held.has("ArrowUp") || held.has("ArrowDown");
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.code);
      movingRef.current = held.has("ArrowUp") || held.has("ArrowDown");
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        position: "relative",
      }}
    >
      <Canvas
        camera={{ fov: 42, near: 0.1, far: 60, position: [0, 1.4, 4.2] }}
        gl={{ antialias: true }}
        onCreated={({ scene }) => {
          scene.background = new Color("#000000");
        }}
      >
        {/* Key light — warm, top-left-front */}
        <directionalLight
          position={[-2.5, 5, 3]}
          intensity={2.2}
          color="#ffe8d0"
        />
        {/* Fill light — cool, right side */}
        <pointLight position={[3.5, 2, 2]} intensity={1.0} color="#d0e4ff" />
        {/* Rim light — back-top */}
        <pointLight position={[0, 4, -3.5]} intensity={0.7} color="#ffffff" />
        {/* Soft ambient */}
        <ambientLight intensity={0.22} />

        <OrbitControls
          target={[0, 0.8, 0]}
          enableDamping
          dampingFactor={0.05}
          minDistance={1.2}
          maxDistance={12}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
        />

        {characterId === "model" ? (
          <Suspense fallback={null}>
            <GizmoModel
              ref={gizmoRef}
              movingRef={movingRef}
              jumpingRef={jumpingRef}
            />
          </Suspense>
        ) : (
          <Gizmo ref={gizmoRef} movingRef={movingRef} jumpingRef={jumpingRef} />
        )}

        {/* Subtle floor grid */}
        <Grid
          position={[0, 0, 0]}
          args={[6, 6]}
          cellSize={0.5}
          cellThickness={0.4}
          cellColor="#222222"
          sectionSize={1.5}
          sectionThickness={0.8}
          sectionColor="#333333"
          fadeDistance={8}
          fadeStrength={1.5}
          infiniteGrid={false}
        />
      </Canvas>

      <div
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <button style={BUTTON_STYLE} onClick={() => navigate("/")}>
          ← terrain
        </button>
        <SelectField
          value={characterId}
          onChange={(v) => onCharacterChange(v as CharacterId)}
          wrapperStyle={{ backdropFilter: "blur(4px)" }}
        >
          {CHARACTER_OPTIONS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div style={HINT_STYLE}>drag to orbit · scroll to zoom</div>
      <div style={LABEL_STYLE}>Gizmo &nbsp;·&nbsp; Morkie</div>
    </div>
  );
};

export default CharacterViewer;

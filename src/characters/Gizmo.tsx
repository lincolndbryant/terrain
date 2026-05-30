import { forwardRef, useRef, MutableRefObject } from "react";
import { Vec3 } from "../types";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const WALK_PHASE_SPEED = 16;
const WALK_LEG_SWING = 0.7;
const WALK_BOB_AMOUNT = 0.06;
const WALK_ROLL_AMOUNT = 0.12;
const JUMP_LEG_TUCK = 0.9;
const JUMP_LEG_TUCK_SPEED = 0.18;
const LEG_RETURN_SPEED = 0.3;
const KICK_EXTEND = 0.14; // seconds to swing leg forward
const KICK_TOTAL = 0.42; // total kick animation duration

const FUR_CREAM = "#e8dcc8";
const FUR_LIGHT = "#f0e8d8";
const FUR_TAN = "#c8b490";
const FUR_GOLDEN = "#c8922a";
const PAW_DARK = "#2a1a12";
const SNOUT_GREY = "#b8b0a8";
const EYE_DARK = "#100805";
const NOSE_DARK = "#e8829a";
const EYE_WHITE = "#f8f4ee";
const EYE_SHINE = "#5bb8f5";

type Props = {
  movingRef: MutableRefObject<boolean>;
  jumpingRef?: MutableRefObject<boolean>;
  kickingRef?: MutableRefObject<number>;
};

const LegGroup = ({
  position,
  phaseOffset,
  walkPhaseRef,
  movingRef,
  jumpingRef,
  kickingRef,
  isKickLeg,
}: {
  position: Vec3;
  phaseOffset: number;
  walkPhaseRef: MutableRefObject<number>;
  movingRef: MutableRefObject<boolean>;
  jumpingRef?: MutableRefObject<boolean>;
  kickingRef?: MutableRefObject<number>;
  isKickLeg?: boolean;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const lastKickSeenRef = useRef(-1);
  const kickTRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) {
      return;
    }

    // Detect a new kick signal on this leg
    if (
      isKickLeg &&
      kickingRef &&
      kickingRef.current !== lastKickSeenRef.current
    ) {
      lastKickSeenRef.current = kickingRef.current;
      kickTRef.current = 0.001;
    }

    // Kick animation overrides everything while active
    if (isKickLeg && kickTRef.current > 0) {
      kickTRef.current += delta;
      let kickAngle: number;
      if (kickTRef.current < KICK_EXTEND) {
        // Snap forward fast
        kickAngle = -1.7 * (kickTRef.current / KICK_EXTEND);
      } else {
        // Ease back
        const t = (kickTRef.current - KICK_EXTEND) / (KICK_TOTAL - KICK_EXTEND);
        kickAngle = -1.7 * (1 - t);
      }
      if (kickTRef.current >= KICK_TOTAL) {
        kickTRef.current = 0;
        // Fall through to normal animation this frame
      } else {
        groupRef.current.rotation.x +=
          (kickAngle - groupRef.current.rotation.x) * 0.7;
        return;
      }
    }

    const jumping = jumpingRef?.current ?? false;
    if (jumping) {
      groupRef.current.rotation.x +=
        (JUMP_LEG_TUCK - groupRef.current.rotation.x) * JUMP_LEG_TUCK_SPEED;
      return;
    }
    const swingAmt = movingRef.current ? WALK_LEG_SWING : 0;
    const target = swingAmt * Math.sin(walkPhaseRef.current + phaseOffset);
    groupRef.current.rotation.x +=
      (target - groupRef.current.rotation.x) * LEG_RETURN_SPEED;
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.068, 0.064, 0.44, 7]} />
        <meshLambertMaterial color={FUR_CREAM} />
      </mesh>
      <mesh position={[0, -0.44, 0]} scale={[1, 0.65, 1.1]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshLambertMaterial color={PAW_DARK} />
      </mesh>
    </group>
  );
};

const Gizmo = forwardRef<THREE.Group, Props>(
  ({ movingRef, jumpingRef, kickingRef }, ref) => {
    const walkPhaseRef = useRef(0);
    const bodyGroupRef = useRef<THREE.Group>(null);

    useFrame((_, delta) => {
      const jumping = jumpingRef?.current ?? false;

      if (movingRef.current && !jumping) {
        walkPhaseRef.current += delta * WALK_PHASE_SPEED;
      }

      if (bodyGroupRef.current) {
        if (jumping) {
          bodyGroupRef.current.scale.y +=
            (1.18 - bodyGroupRef.current.scale.y) * 0.15;
          bodyGroupRef.current.scale.x +=
            (0.88 - bodyGroupRef.current.scale.x) * 0.15;
          bodyGroupRef.current.rotation.z +=
            (0 - bodyGroupRef.current.rotation.z) * 0.15;
        } else {
          bodyGroupRef.current.scale.y +=
            (1 - bodyGroupRef.current.scale.y) * 0.2;
          bodyGroupRef.current.scale.x +=
            (1 - bodyGroupRef.current.scale.x) * 0.2;
          const bob = movingRef.current
            ? WALK_BOB_AMOUNT * Math.abs(Math.sin(walkPhaseRef.current))
            : 0;
          bodyGroupRef.current.position.y = bob;
          const roll = movingRef.current
            ? WALK_ROLL_AMOUNT * Math.sin(walkPhaseRef.current)
            : 0;
          bodyGroupRef.current.rotation.z +=
            (roll - bodyGroupRef.current.rotation.z) * 0.2;
        }
      }
    });

    return (
      <group ref={ref} name="gizmo">
        {/* Raises geometry so the lowest paw sits at y=0 */}
        <group position={[0, 0.15, 0]}>
          <group ref={bodyGroupRef} name="body-group">
            <mesh
              name="body-core"
              position={[0, 0.52, 0]}
              scale={[0.72, 0.58, 0.9]}
            >
              <sphereGeometry args={[0.5, 12, 10]} />
              <meshLambertMaterial color={FUR_CREAM} />
            </mesh>

            <mesh
              name="body-top-fluff"
              position={[0, 0.68, 0.05]}
              scale={[0.64, 0.46, 0.78]}
            >
              <sphereGeometry args={[0.5, 10, 8]} />
              <meshLambertMaterial color={FUR_LIGHT} />
            </mesh>

            <mesh
              name="chest-fluff"
              position={[0, 0.44, 0.32]}
              scale={[0.56, 0.5, 0.55]}
            >
              <sphereGeometry args={[0.5, 10, 8]} />
              <meshLambertMaterial color={FUR_LIGHT} />
            </mesh>

            <mesh
              name="neck"
              position={[0, 0.86, 0.22]}
              scale={[0.28, 0.3, 0.28]}
            >
              <sphereGeometry args={[0.5, 10, 8]} />
              <meshLambertMaterial color={FUR_CREAM} />
            </mesh>

            <mesh name="head" position={[0, 1.04, 0.4]}>
              <sphereGeometry args={[0.33, 14, 12]} />
              <meshLambertMaterial color={FUR_CREAM} />
            </mesh>

            {/* Golden crown patch — Yorkie-style cap marking */}
            <mesh
              name="head-crown"
              position={[0, 1.27, 0.3]}
              scale={[0.38, 0.17, 0.36]}
            >
              <sphereGeometry args={[0.5, 10, 8]} />
              <meshLambertMaterial color={FUR_GOLDEN} />
            </mesh>

            {/* Floppy ears hanging from the sides of the head */}
            <mesh
              name="ear-left"
              position={[-0.33, 0.97, 0.27]}
              scale={[0.15, 0.44, 0.11]}
              rotation={[0.15, 0, 0.1]}
            >
              <sphereGeometry args={[0.5, 8, 7]} />
              <meshLambertMaterial color={FUR_TAN} />
            </mesh>
            <mesh
              name="ear-right"
              position={[0.33, 0.97, 0.27]}
              scale={[0.15, 0.44, 0.11]}
              rotation={[0.15, 0, -0.1]}
            >
              <sphereGeometry args={[0.5, 8, 7]} />
              <meshLambertMaterial color={FUR_TAN} />
            </mesh>

            <mesh
              name="cheek-left"
              position={[-0.22, 1.02, 0.44]}
              scale={[0.34, 0.3, 0.3]}
            >
              <sphereGeometry args={[0.5, 8, 8]} />
              <meshLambertMaterial color={FUR_LIGHT} />
            </mesh>

            <mesh
              name="cheek-right"
              position={[0.22, 1.02, 0.44]}
              scale={[0.34, 0.3, 0.3]}
            >
              <sphereGeometry args={[0.5, 8, 8]} />
              <meshLambertMaterial color={FUR_LIGHT} />
            </mesh>

            <mesh
              name="snout"
              position={[0, 0.97, 0.66]}
              scale={[0.36, 0.27, 0.32]}
            >
              <sphereGeometry args={[0.5, 10, 8]} />
              <meshLambertMaterial color={SNOUT_GREY} />
            </mesh>

            <mesh
              name="nose"
              position={[0, 0.97, 0.83]}
              scale={[1, 0.72, 0.58]}
            >
              <dodecahedronGeometry args={[0.034, 0]} />
              <meshLambertMaterial color={NOSE_DARK} />
            </mesh>

            <mesh name="eye-left-sclera" position={[-0.12, 1.1, 0.69]}>
              <sphereGeometry args={[0.085, 10, 8]} />
              <meshLambertMaterial color={EYE_WHITE} />
            </mesh>
            <mesh name="eye-left-iris" position={[-0.12, 1.1, 0.74]}>
              <sphereGeometry args={[0.066, 10, 8]} />
              <meshLambertMaterial color={EYE_DARK} />
            </mesh>
            <mesh name="eye-left-shine" position={[-0.08, 1.14, 0.79]}>
              <circleGeometry args={[0.022, 16]} />
              <meshBasicMaterial color={EYE_SHINE} />
            </mesh>

            <mesh name="eye-right-sclera" position={[0.12, 1.1, 0.69]}>
              <sphereGeometry args={[0.085, 10, 8]} />
              <meshLambertMaterial color={EYE_WHITE} />
            </mesh>
            <mesh name="eye-right-iris" position={[0.12, 1.1, 0.74]}>
              <sphereGeometry args={[0.066, 10, 8]} />
              <meshLambertMaterial color={EYE_DARK} />
            </mesh>
            <mesh name="eye-right-shine" position={[0.16, 1.14, 0.79]}>
              <circleGeometry args={[0.022, 16]} />
              <meshBasicMaterial color={EYE_SHINE} />
            </mesh>

            <mesh
              name="tail-base"
              position={[0, 0.84, -0.5]}
              rotation={[-0.7, 0, 0.1]}
              scale={[0.46, 0.52, 0.4]}
            >
              <sphereGeometry args={[0.5, 8, 6]} />
              <meshLambertMaterial color={FUR_LIGHT} />
            </mesh>
            <mesh
              name="tail-tip"
              position={[0.04, 0.98, -0.58]}
              rotation={[-1.1, 0, 0.15]}
              scale={[0.34, 0.4, 0.3]}
            >
              <sphereGeometry args={[0.5, 8, 6]} />
              <meshLambertMaterial color={FUR_LIGHT} />
            </mesh>
          </group>

          <LegGroup
            position={[-0.24, 0.42, 0.38]}
            phaseOffset={0}
            walkPhaseRef={walkPhaseRef}
            movingRef={movingRef}
            jumpingRef={jumpingRef}
          />
          <LegGroup
            position={[0.24, 0.42, 0.38]}
            phaseOffset={Math.PI}
            walkPhaseRef={walkPhaseRef}
            movingRef={movingRef}
            jumpingRef={jumpingRef}
            kickingRef={kickingRef}
            isKickLeg
          />
          <LegGroup
            position={[-0.24, 0.38, -0.32]}
            phaseOffset={Math.PI}
            walkPhaseRef={walkPhaseRef}
            movingRef={movingRef}
            jumpingRef={jumpingRef}
          />
          <LegGroup
            position={[0.24, 0.38, -0.32]}
            phaseOffset={0}
            walkPhaseRef={walkPhaseRef}
            movingRef={movingRef}
            jumpingRef={jumpingRef}
          />
        </group>
      </group>
    );
  },
);

Gizmo.displayName = "Gizmo";

export default Gizmo;

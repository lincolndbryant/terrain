import { useRef, useEffect, RefObject, MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsBase } from "three-stdlib";
import { useRapier } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import {
  CAMERA_TARGET_HEIGHT,
  KEYBOARD_MOVE_SPEED,
  KEYBOARD_TURN_SPEED,
} from "../constants";
import { lastCharPos } from "../store";

const JUMP_SPEED = 10;
const GRAVITY = 30;
const KICK_RADIUS = 2.5;
const KICK_COOLDOWN = 0.4;

type Props = {
  controlsRef: RefObject<OrbitControlsBase | null>;
  gizmoRef: RefObject<THREE.Group | null>;
  bodyRef: RefObject<RapierRigidBody | null>;
  movingRef: MutableRefObject<boolean>;
  jumpingRef: MutableRefObject<boolean>;
  kickingRef: MutableRefObject<number>;
};

const GizmoMovement = ({
  controlsRef,
  gizmoRef,
  bodyRef,
  movingRef,
  jumpingRef,
  kickingRef,
}: Props): null => {
  const { camera } = useThree();
  const { world } = useRapier();
  const keys = useRef<Record<string, boolean>>({});
  const fwd = useRef(new THREE.Vector3());
  const offsetVec = useRef(new THREE.Vector3());
  const yAxis = useRef(new THREE.Vector3(0, 1, 0));
  const yVelRef = useRef(0);
  const wasGroundedRef = useRef(false);
  const spaceConsumed = useRef(false);
  const kickConsumed = useRef(false);
  const kickCooldown = useRef(0);
  const controllerRef = useRef<ReturnType<
    typeof world.createCharacterController
  > | null>(null);

  useEffect(() => {
    const controller = world.createCharacterController(0.04);
    controller.enableSnapToGround(0.4);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.enableAutostep(0.5, 0.2, true);
    controller.setMaxSlopeClimbAngle((55 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((35 * Math.PI) / 180);
    controllerRef.current = controller;
    return () => {
      controller.free();
      controllerRef.current = null;
    };
  }, [world]);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
      if (e.code === "Space") {
        spaceConsumed.current = false;
      }
      if (e.code === "KeyK") {
        kickConsumed.current = false;
      }
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    const body = bodyRef.current;
    const controller = controllerRef.current;
    if (!controls || !body || !controller) {
      return;
    }
    const k = keys.current;

    // --- Turn ---
    if (k["ArrowLeft"] || k["ArrowRight"]) {
      const angle = k["ArrowLeft"] ? KEYBOARD_TURN_SPEED : -KEYBOARD_TURN_SPEED;
      offsetVec.current.subVectors(camera.position, controls.target);
      offsetVec.current.applyAxisAngle(yAxis.current, angle);
      camera.position.copy(controls.target).add(offsetVec.current);
    }

    camera.getWorldDirection(fwd.current);
    fwd.current.y = 0;
    fwd.current.normalize();

    // --- XZ movement ---
    const speed =
      k["ShiftLeft"] || k["ShiftRight"]
        ? KEYBOARD_MOVE_SPEED * 2
        : KEYBOARD_MOVE_SPEED;
    let dx = 0;
    let dz = 0;
    if (k["ArrowUp"]) {
      dx += fwd.current.x * speed;
      dz += fwd.current.z * speed;
    }
    if (k["ArrowDown"]) {
      dx -= fwd.current.x * speed;
      dz -= fwd.current.z * speed;
    }
    const isMoving = dx !== 0 || dz !== 0;
    movingRef.current = isMoving;

    // --- Gravity: constant press when grounded, accumulate when airborne ---
    if (wasGroundedRef.current) {
      if (yVelRef.current < 0) {
        yVelRef.current = -2.0;
      }
    } else {
      yVelRef.current -= GRAVITY * delta;
      yVelRef.current = Math.max(yVelRef.current, -20);
    }

    // --- Jump ---
    if (k["Space"] && !spaceConsumed.current && wasGroundedRef.current) {
      yVelRef.current = JUMP_SPEED;
      spaceConsumed.current = true;
    }

    // --- Kick ---
    kickCooldown.current = Math.max(0, kickCooldown.current - delta);
    if (k["KeyK"] && !kickConsumed.current && kickCooldown.current === 0) {
      kickConsumed.current = true;
      kickCooldown.current = KICK_COOLDOWN;
      kickingRef.current += 1;
      const charPos = body.translation();
      world.forEachRigidBody((rb) => {
        if (!rb.isDynamic()) {
          return;
        }
        const rp = rb.translation();
        const ddx = rp.x - charPos.x;
        const ddy = rp.y - charPos.y;
        const ddz = rp.z - charPos.z;
        if (ddx * ddx + ddy * ddy + ddz * ddz > KICK_RADIUS * KICK_RADIUS) {
          return;
        }
        rb.applyImpulse(
          {
            x: fwd.current.x * 22 + ddx * 4,
            y: 18,
            z: fwd.current.z * 22 + ddz * 4,
          },
          true,
        );
      });
    }

    // --- Physics character controller step ---
    if (body.numColliders() === 0) {
      return;
    }
    const collider = body.collider(0);
    controller.computeColliderMovement(collider, {
      x: dx,
      y: yVelRef.current * delta,
      z: dz,
    });
    const movement = controller.computedMovement();

    wasGroundedRef.current = controller.computedGrounded();
    jumpingRef.current = !wasGroundedRef.current && yVelRef.current > 0;

    const pos = body.translation();
    const nextX = pos.x + movement.x;
    const nextY = pos.y + movement.y;
    const nextZ = pos.z + movement.z;
    body.setNextKinematicTranslation({ x: nextX, y: nextY, z: nextZ });
    lastCharPos.x = nextX;
    lastCharPos.y = nextY;
    lastCharPos.z = nextZ;

    // --- Visual rotation ---
    if (gizmoRef.current && isMoving) {
      gizmoRef.current.rotation.y = Math.atan2(fwd.current.x, fwd.current.z);
    }

    // --- Camera follow ---
    const targetY = nextY + CAMERA_TARGET_HEIGHT;
    const ddx = nextX - controls.target.x;
    const ddy = targetY - controls.target.y;
    const ddz = nextZ - controls.target.z;
    controls.target.set(nextX, targetY, nextZ);
    camera.position.x += ddx;
    camera.position.y += ddy;
    camera.position.z += ddz;
  });

  return null;
};

export default GizmoMovement;

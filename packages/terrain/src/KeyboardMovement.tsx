import { useRef, useEffect, RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls as OrbitControlsBase } from "three-stdlib";
import { KEYBOARD_MOVE_SPEED, KEYBOARD_TURN_SPEED } from "./constants";

type OrbitControlsImpl = OrbitControlsBase;

type Props = {
  controlsRef: RefObject<OrbitControlsImpl | null>;
};

const KeyboardMovement = ({ controlsRef }: Props): null => {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const fwd = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const yAxis = useRef(new THREE.Vector3(0, 1, 0));

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }
    const k = keys.current;

    if (k["ArrowLeft"] || k["ArrowRight"]) {
      const angle = k["ArrowLeft"] ? KEYBOARD_TURN_SPEED : -KEYBOARD_TURN_SPEED;
      offset.current.subVectors(camera.position, controls.target);
      offset.current.applyAxisAngle(yAxis.current, angle);
      camera.position.copy(controls.target).add(offset.current);
    }

    camera.getWorldDirection(fwd.current);
    fwd.current.y = 0;
    fwd.current.normalize();

    move.current.set(0, 0, 0);
    if (k["ArrowUp"]) {
      move.current.addScaledVector(fwd.current, KEYBOARD_MOVE_SPEED);
    }
    if (k["ArrowDown"]) {
      move.current.addScaledVector(fwd.current, -KEYBOARD_MOVE_SPEED);
    }

    if (move.current.lengthSq() > 0) {
      camera.position.add(move.current);
      controls.target.add(move.current);
    }
  });

  return null;
};

export default KeyboardMovement;

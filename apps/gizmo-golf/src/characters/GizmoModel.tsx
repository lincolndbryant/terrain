import { forwardRef, useRef, useMemo, RefObject } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

type Props = {
  movingRef: RefObject<boolean>;
  jumpingRef?: RefObject<boolean>;
};

const GizmoModel = forwardRef<THREE.Group, Props>(
  ({ movingRef, jumpingRef }, ref) => {
    const base = import.meta.env.BASE_URL;
    const materials = useLoader(MTLLoader, `${base}characters/Mesh_Puppy.mtl`);
    const obj = useLoader(
      OBJLoader,
      `${base}characters/Mesh_Puppy.obj`,
      (loader) => {
        materials.preload();
        (loader as OBJLoader).setMaterials(materials);
      },
    );

    const innerRef = useRef<THREE.Group>(null);
    const walkPhase = useRef(0);

    const scene = useMemo(() => {
      const clone = obj.clone(true);

      // Normalize scale so the model is ~1.5 units tall
      const box = new THREE.Box3().setFromObject(clone);
      const height = box.getSize(new THREE.Vector3()).y;
      const scale = 1.5 / height;
      clone.scale.setScalar(scale);

      // Sit bottom at Y = 0, center on XZ
      clone.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(clone);
      const center = box2.getCenter(new THREE.Vector3());
      clone.position.set(-center.x, -box2.min.y, -center.z);

      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          const mat = child.material;
          // MTL exports Kd 0,0,0 which blacks out the texture map — reset to white
          if (mat instanceof THREE.MeshPhongMaterial && mat.map) {
            mat.color.set(0xffffff);
            mat.side = THREE.DoubleSide;
          } else if (mat instanceof THREE.Material) {
            mat.side = THREE.DoubleSide;
          }
        }
      });

      return clone;
    }, [obj]);

    useFrame((_, delta) => {
      const jumping = jumpingRef?.current ?? false;
      const moving = movingRef.current;
      const inner = innerRef.current;
      if (!inner) {
        return;
      }

      if (moving && !jumping) {
        walkPhase.current += delta * 9;
      }

      if (jumping) {
        inner.scale.y += (1.15 - inner.scale.y) * 0.15;
        inner.scale.x += (0.88 - inner.scale.x) * 0.15;
        inner.scale.z += (0.88 - inner.scale.z) * 0.15;
      } else {
        inner.scale.y += (1 - inner.scale.y) * 0.2;
        inner.scale.x += (1 - inner.scale.x) * 0.2;
        inner.scale.z += (1 - inner.scale.z) * 0.2;
        const bob = moving
          ? 0.025 * Math.abs(Math.sin(walkPhase.current * 2))
          : 0;
        inner.position.y = bob;
      }
    });

    return (
      <group ref={ref}>
        <group ref={innerRef}>
          <primitive object={scene} />
        </group>
      </group>
    );
  },
);

GizmoModel.displayName = "GizmoModel";

export default GizmoModel;

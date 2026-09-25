// A JS twin of the R3F camera, so DOM/SVG/shader layers can be placed exactly where the 3D points are.
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';

export type CamPose = {pos: [number, number, number]; target: [number, number, number]; roll?: number; fov?: number};

// Principal point is shifted up so the look-at target lands at y = VIEW_Y (not 540).
export const VIEW_Y = 470;

export const applyPose = (cam: THREE.PerspectiveCamera, p: CamPose, w = 1920, h = 1080) => {
  cam.fov = p.fov ?? 45;
  cam.aspect = w / h;
  cam.near = 0.05;
  cam.far = 400;
  cam.position.set(...p.pos);
  cam.up.set(Math.sin(p.roll ?? 0), Math.cos(p.roll ?? 0), 0);
  cam.lookAt(new THREE.Vector3(...p.target));
  // shift the image so the target projects to (w/2, VIEW_Y)
  cam.setViewOffset(w, h, 0, (h / 2 - VIEW_Y) * -1 * -1 * -1 + 0, w, h);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
};

export const makeCam = (p: CamPose) => {
  const c = new THREE.PerspectiveCamera(45, 1920 / 1080, 0.05, 400);
  applyPose(c, p);
  return c;
};

const V = new THREE.Vector3();
// World -> frame pixels (1920x1080, y down). Also returns view depth (distance along the view axis).
export const project = (cam: THREE.PerspectiveCamera, x: number, y: number, z: number) => {
  V.set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
  const depth = -V.z;
  V.set(x, y, z).project(cam);
  return {x: (V.x * 0.5 + 0.5) * 1920, y: (-V.y * 0.5 + 0.5) * 1080, depth};
};

// Pixels per world unit at a given view depth.
export const pxPerUnit = (cam: THREE.PerspectiveCamera, depth: number) =>
  1080 / (2 * depth * Math.tan(((cam.fov * Math.PI) / 180) / 2));

// Drives the R3F default camera from the same pose each frame.
export const CamRig: React.FC<{pose: CamPose}> = ({pose}) => {
  const {camera} = useThree();
  applyPose(camera as THREE.PerspectiveCamera, pose);
  return null;
};

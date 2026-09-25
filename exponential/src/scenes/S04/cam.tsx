// Camera rig shared by S04 and S09: the same camera drives Three.js AND a JS projection, so SVG/HTML
// overlays (chart labels, HUD tags) stay locked to 3D positions under any camera move.
import React from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';

export type V3 = [number, number, number];
export type Cam = {pos: V3; target: V3; fov: number; roll?: number};

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): V3 => mul(a, 1 / Math.max(1e-9, Math.hypot(a[0], a[1], a[2])));
export const mix3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export const lerpCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: mix3(a.pos, b.pos, k),
  target: mix3(a.target, b.target, k),
  fov: a.fov + (b.fov - a.fov) * k,
  roll: (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * k,
});

// Camera basis identical to Object3D.lookAt + rotateZ(roll).
export const camBasis = (c: Cam) => {
  const f = norm(sub(c.target, c.pos));
  let r = norm(cross(f, [0, 1, 0]));
  let u = cross(r, f);
  const roll = c.roll ?? 0;
  if (roll) {
    const cs = Math.cos(roll);
    const sn = Math.sin(roll);
    const r2 = add(mul(r, cs), mul(u, sn));
    const u2 = sub(mul(u, cs), mul(r, sn));
    r = r2;
    u = u2;
  }
  return {f, r, u};
};

// World point -> screen px (1920x1080). k = px per world unit at that depth.
export const project = (c: Cam, p: V3, W = 1920, H = 1080) => {
  const {f, r, u} = camBasis(c);
  const d = sub(p, c.pos);
  const z = dot(d, f);
  const foc = H / 2 / Math.tan((c.fov * Math.PI) / 360);
  const zz = Math.max(z, 1e-3);
  return {x: W / 2 + (dot(d, r) / zz) * foc, y: H / 2 - (dot(d, u) / zz) * foc, z, k: foc / zz, vis: z > 0.05};
};

export const CameraRig: React.FC<{cam: Cam; near?: number; far?: number}> = ({cam, near = 0.1, far = 3000}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  camera.up.set(0, 1, 0);
  camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
  if (cam.roll) camera.rotateZ(cam.roll);
  camera.fov = cam.fov;
  camera.near = near;
  camera.far = far;
  camera.aspect = 1920 / 1080;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return null;
};

// Stable camera option object for <ThreeCanvas camera={...}> (R3F re-applies it if identity changes).
export const CAM_INIT = {fov: 45, position: [0, 0, 10] as V3, near: 0.1, far: 3000};

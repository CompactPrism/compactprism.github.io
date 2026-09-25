// Tiny pinhole camera shared by the GLSL ray setup, the SVG/Canvas projection and the PointCloud
// vertex transform, so every layer lines up exactly. Screen convention matches the shaders:
// uv = (fragCoord - 0.5 * res) / res.y ; ray = normalize(fw * f + rt * uv.x + up * uv.y).
import {E, clamp} from '../../lib/anim';

export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.sqrt(dot(a, a));
export const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
export const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export type Cam = {pos: V3; fw: V3; rt: V3; up: V3; f: number; fov: number};

// fov = vertical field of view in degrees.
export const lookAt = (pos: V3, target: V3, fov = 32, roll = 0): Cam => {
  const fw = norm(sub(target, pos));
  let rt = norm(cross(fw, [0, 1, 0]));
  let up = cross(rt, fw);
  if (roll) {
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    const r2 = add(mul(rt, c), mul(up, s));
    const u2 = add(mul(up, c), mul(rt, -s));
    rt = r2;
    up = u2;
  }
  const f = 0.5 / Math.tan(((fov / 2) * Math.PI) / 180);
  return {pos, fw, rt, up, f, fov};
};

export const W = 1920;
export const H = 1080;

// World point -> screen px. z = depth along the view axis; s = px per world unit at that depth.
export const project = (cam: Cam, p: V3) => {
  const d = sub(p, cam.pos);
  const z = dot(d, cam.fw);
  const zz = Math.max(z, 1e-3);
  const x = (dot(d, cam.rt) / zz) * cam.f;
  const y = (dot(d, cam.up) / zz) * cam.f;
  return {x: W / 2 + x * H, y: H / 2 - y * H, z, s: (cam.f * H) / zz};
};

// Uniforms for ShaderCanvas / PointCloud.
export const camUniforms = (cam: Cam) => ({
  uCamPos: cam.pos,
  uCamFw: cam.fw,
  uCamRt: cam.rt,
  uCamUp: cam.up,
  uFocal: cam.f,
});

// GLSL (ES 3.00) ray from the camera uniforms.
export const GLSL_CAM = /* glsl */ `
uniform vec3 uCamPos; uniform vec3 uCamFw; uniform vec3 uCamRt; uniform vec3 uCamUp; uniform float uFocal;
vec3 camRay(vec2 fc){ vec2 uv = (fc - .5 * uRes) / uRes.y; return normalize(uCamFw * uFocal + uCamRt * uv.x + uCamUp * uv.y); }
vec2 camProject(vec3 p){ vec3 d = p - uCamPos; float z = max(dot(d, uCamFw), 1e-3); return vec2(dot(d, uCamRt), dot(d, uCamUp)) / z * uFocal; }
`;

// PointCloud body prefix: converts world-space \`pos\` into the ThreeCanvas camera space
// (ThreeCanvas camera must sit at the origin looking down -Z with fov = cam.fov).
export const GLSL_PC_CAM = /* glsl */ `
vec3 toCam(vec3 p){ vec3 d = p - uCamPos; return vec3(dot(d, uCamRt), dot(d, uCamUp), -dot(d, uCamFw)); }
`;

// Keyframed camera path: each key has a time (s), a position and a look-at target.
export type Key = {t: number; pos: V3; tgt: V3; fov?: number; roll?: number};
export const camPath = (keys: Key[], t: number, ease: (x: number) => number = E.inOut): Cam => {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const u = b.t === a.t ? 1 : ease(clamp((t - a.t) / (b.t - a.t)));
  const fov = (a.fov ?? 32) + ((b.fov ?? 32) - (a.fov ?? 32)) * u;
  const roll = (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * u;
  return lookAt(mix3(a.pos, b.pos, u), mix3(a.tgt, b.tgt, u), fov, roll);
};

// Catmull-Rom through a list of points (for smooth, constantly moving camera paths).
export const catmull = (pts: V3[], u: number): V3 => {
  const n = pts.length - 1;
  const x = clamp(u) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n, i + 2)];
  const f2 = f * f;
  const f3 = f2 * f;
  const out: V3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3);
  }
  return out;
};

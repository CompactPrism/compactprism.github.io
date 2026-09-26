// Small deterministic three.js toolkit shared by S07 and S08: custom-attribute points, line segments,
// shader meshes, a camera rig and a JS projector (to pin DOM labels onto 3D positions).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import type {} from '@react-three/fiber';
import {useThree} from '@react-three/fiber';

// GLSL (three.js ShaderMaterial, GLSL1-style names) noise helpers.
export const NOISE3 = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash31(float p){ vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
vec3 _m289(vec3 x){ return x - floor(x * (1. / 289.)) * 289.; }
vec4 _m289(vec4 x){ return x - floor(x * (1. / 289.)) * 289.; }
vec4 _perm(vec4 x){ return _m289(((x * 34.) + 1.) * x); }
vec4 _tis(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1. / 6., 1. / 3.); const vec4 D = vec4(0., .5, 1., 2.);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1. - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = _m289(i);
  vec4 p = _perm(_perm(_perm(i.z + vec4(0., i1.z, i2.z, 1.)) + i.y + vec4(0., i1.y, i2.y, 1.)) + i.x + vec4(0., i1.x, i2.x, 1.));
  float n_ = .142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49. * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7. * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1. - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2. + 1.; vec4 s1 = floor(b1) * 2. + 1.; vec4 sh = -step(h, vec4(0.));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = _tis(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.); m = m * m;
  return 42. * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * snoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
vec3 curl(vec3 p){
  const float e = .1;
  vec3 dx = vec3(e, 0., 0.), dy = vec3(0., e, 0.), dz = vec3(0., 0., e);
  float x = snoise(p + dy) - snoise(p - dy) - snoise(p + dz) + snoise(p - dz);
  float y = snoise(p + dz) - snoise(p - dz) - snoise(p + dx) + snoise(p - dx);
  float z = snoise(p + dx) - snoise(p - dx) - snoise(p + dy) + snoise(p - dy);
  return normalize(vec3(x, y, z) + 1e-5);
}
vec3 fib(float i, float n){ float y = 1. - 2. * (i + .5) / n; float r = sqrt(max(0., 1. - y * y)); float a = i * 2.39996323; return vec3(cos(a) * r, y, sin(a) * r); }
`;

export type U = Record<string, number | number[]>;
export type Attr = {data: Float32Array; size: number};

const glslType = (v: number | number[]) =>
  typeof v === 'number' ? 'float' : v.length === 2 ? 'vec2' : v.length === 3 ? 'vec3' : 'vec4';
const decl = (u: U) =>
  Object.entries(u)
    .map(([k, v]) => `uniform ${glslType(v)} ${k};`)
    .join('\n');
const toVal = (v: number | number[]) =>
  typeof v === 'number'
    ? v
    : new (v.length === 2 ? THREE.Vector2 : v.length === 3 ? THREE.Vector3 : THREE.Vector4)(...(v as [number, number, number, number]));
const initUniforms = (u: U) => {
  const o: Record<string, {value: unknown}> = {};
  for (const [k, v] of Object.entries(u)) o[k] = {value: toVal(v)};
  return o;
};
const push = (m: THREE.ShaderMaterial, u: U) => {
  for (const [k, v] of Object.entries(u)) {
    const cur = m.uniforms[k];
    if (!cur) continue;
    if (typeof v === 'number') cur.value = v;
    else (cur.value as THREE.Vector4).set(...(v as [number, number, number, number]));
  }
};
const keyOf = (u: U) => Object.keys(u).sort().join(',');

export const mulberry = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const seedAttrs = (g: THREE.BufferGeometry, count: number, seed: number) => {
  const r = mulberry(seed * 9973 + 17);
  const a = new Float32Array(count * 4);
  const b = new Float32Array(count * 4);
  const idx = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 4; k++) {
      a[i * 4 + k] = r();
      b[i * 4 + k] = r();
    }
    idx[i] = i;
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(a, 4));
  g.setAttribute('aSeed2', new THREE.BufferAttribute(b, 4));
  g.setAttribute('aIndex', new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
};

const attrDecl = (attrs?: Record<string, Attr>) =>
  Object.entries(attrs ?? {})
    .map(([k, a]) => `attribute ${a.size === 1 ? 'float' : 'vec' + a.size} ${k};`)
    .join('\n');

const SPRITES = {
  soft: `float a = exp(-d * d * 18.) * vAlpha;`,
  spark: `float a = (exp(-d * d * 90.) + exp(-d * d * 14.) * .45) * vAlpha;`,
  disc: `float a = smoothstep(.5, .36, d) * vAlpha;`,
  bokeh: `float a = (smoothstep(.5, .42, d) * (.55 + .45 * smoothstep(.2, .47, d))) * vAlpha;`,
};

type PointsProps = {
  count: number;
  seed?: number;
  attrs?: Record<string, Attr>;
  body: string; // sets pos (vec3), size, color, alpha; optional occ (0 = pure additive light, 1 = occluding)
  uniforms?: U;
  sprite?: keyof typeof SPRITES;
  blending?: 'add' | 'normal';
  depthTest?: boolean;
  renderOrder?: number;
  glsl?: string; // extra functions, injected after the uniform declarations
};

// GPU particles with optional custom per-vertex attributes (also gets aSeed, aSeed2, aIndex).
export const GPoints: React.FC<PointsProps> = ({count, seed = 1, attrs, body, uniforms = {}, sprite = 'soft', blending = 'add', depthTest = false, renderOrder = 0, glsl = ''}) => {
  const {height} = useThree((s) => s.size);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    seedAttrs(g, count, seed);
    for (const [k, a] of Object.entries(attrs ?? {})) g.setAttribute(k, new THREE.BufferAttribute(a.data, a.size));
    return g;
  }, [count, seed, attrs]);
  const uk = keyOf(uniforms);
  const material = useMemo(() => {
    const vertexShader = `
      uniform float uPx;
      ${decl(uniforms)}
      attribute vec4 aSeed; attribute vec4 aSeed2; attribute float aIndex;
      ${attrDecl(attrs)}
      varying vec3 vColor; varying float vAlpha; varying float vOcc;
      ${NOISE3}
      ${glsl}
      void main(){
        vec3 pos = vec3(0.); float size = 2.0; vec3 color = vec3(1.); float alpha = 1.0; float occ = 0.;
        ${body}
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(0.0, size * uPx * (10.0 / max(0.001, -mv.z)));
        if (alpha < .003) gl_Position = vec4(2., 2., 2., 1.);
        vColor = color; vAlpha = alpha; vOcc = occ;
      }`;
    const fragmentShader = `varying vec3 vColor; varying float vAlpha; varying float vOcc;
      void main(){ vec2 c = gl_PointCoord - .5; float d = length(c);
        ${SPRITES[sprite]}
        if (a < .002) discard;
        gl_FragColor = vec4(vColor * a, a * vOcc); }`;
    return new THREE.ShaderMaterial({
      uniforms: {uPx: {value: 1}, ...initUniforms(uniforms)},
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest,
      blending: blending === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
      premultipliedAlpha: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, uk, sprite, blending, depthTest, attrs, glsl]);
  material.uniforms.uPx.value = height / 1080;
  push(material, uniforms);
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={renderOrder} />;
};

type LinesProps = {
  count: number; // vertices (2 per segment)
  attrs: Record<string, Attr>;
  body: string; // sets pos, color, alpha
  uniforms?: U;
  depthTest?: boolean;
  renderOrder?: number;
  glsl?: string;
};

// 1-px GPU line segments (additive light). Vertex i and i+1 form a segment.
export const GLines: React.FC<LinesProps> = ({count, attrs, body, uniforms = {}, depthTest = false, renderOrder = 0, glsl = ''}) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    for (const [k, a] of Object.entries(attrs)) g.setAttribute(k, new THREE.BufferAttribute(a.data, a.size));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [count, attrs]);
  const uk = keyOf(uniforms);
  const material = useMemo(() => {
    const vertexShader = `
      ${decl(uniforms)}
      ${attrDecl(attrs)}
      varying vec3 vColor; varying float vAlpha;
      ${NOISE3}
      ${glsl}
      void main(){
        vec3 pos = vec3(0.); vec3 color = vec3(1.); float alpha = 1.0;
        ${body}
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        vColor = color; vAlpha = alpha;
      }`;
    const fragmentShader = `varying vec3 vColor; varying float vAlpha;
      void main(){ if (vAlpha < .002) discard; gl_FragColor = vec4(vColor * vAlpha, 0.); }`;
    return new THREE.ShaderMaterial({
      uniforms: initUniforms(uniforms),
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, uk, depthTest, attrs, glsl]);
  push(material, uniforms);
  return <lineSegments geometry={geometry} material={material} frustumCulled={false} renderOrder={renderOrder} />;
};

type MeshProps = {
  geometry: THREE.BufferGeometry;
  vert: string; // full vertex main() body+decls (NOISE3 + uniforms prepended)
  frag: string; // full fragment shader after uniforms (NOISE3 prepended)
  uniforms?: U;
  transparent?: boolean;
  additive?: boolean;
  depthWrite?: boolean;
  side?: 'front' | 'back' | 'double';
  renderOrder?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
};

export const GMesh: React.FC<MeshProps> = ({geometry, vert, frag, uniforms = {}, transparent = false, additive = false, depthWrite = true, side = 'front', renderOrder = 0, position, rotation, scale}) => {
  const uk = keyOf(uniforms);
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: initUniforms(uniforms),
      vertexShader: `${decl(uniforms)}\n${NOISE3}\n${vert}`,
      fragmentShader: `${decl(uniforms)}\n${NOISE3}\n${frag}`,
      transparent: transparent || additive,
      depthWrite,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      premultipliedAlpha: true,
      side: side === 'back' ? THREE.BackSide : side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vert, frag, uk, transparent, additive, depthWrite, side]);
  push(material, uniforms);
  const sc: [number, number, number] | undefined = typeof scale === 'number' ? [scale, scale, scale] : scale;
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={renderOrder} position={position} rotation={rotation} scale={sc} />;
};

// ---------------- camera ----------------
export type V3 = [number, number, number];
export type CamSpec = {pos: V3; target: V3; fov: number; roll?: number};

export const makeCamera = (c: CamSpec, aspect = 16 / 9) => {
  const cam = new THREE.PerspectiveCamera(c.fov, aspect, 0.02, 400);
  cam.position.set(...c.pos);
  const r = c.roll ?? 0;
  cam.up.set(Math.sin(r), Math.cos(r), 0);
  cam.lookAt(...c.target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
};

// Applies a CamSpec to the R3F default camera (render-time, deterministic).
export const Cam: React.FC<{spec: CamSpec}> = ({spec}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.near = 0.02;
  camera.far = 400;
  camera.fov = spec.fov;
  camera.aspect = 16 / 9;
  camera.position.set(...spec.pos);
  const r = spec.roll ?? 0;
  camera.up.set(Math.sin(r), Math.cos(r), 0);
  camera.lookAt(...spec.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return null;
};

// World point -> screen px (1920x1080). depth = distance along view.
export const project = (cam: THREE.PerspectiveCamera, p: V3) => {
  const v = new THREE.Vector3(...p);
  const d = v.clone().applyMatrix4(cam.matrixWorldInverse);
  v.project(cam);
  return {x: (v.x + 1) * 960, y: (1 - v.y) * 540, depth: -d.z, visible: -d.z > 0};
};

// Pixel size of a world length at a given depth.
export const pxPerUnit = (cam: THREE.PerspectiveCamera, depth: number) => 540 / (Math.tan((cam.fov * Math.PI) / 360) * depth);

export const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

// Screen px + view depth -> world point, for a given camera.
export const unprojectAt = (cam: THREE.PerspectiveCamera, x: number, y: number, depth: number): V3 => {
  const v = new THREE.Vector3(x / 960 - 1, 1 - y / 540, 0.5).unproject(cam).sub(cam.position).normalize();
  const fwd = new THREE.Vector3();
  cam.getWorldDirection(fwd);
  return cam.position.clone().add(v.multiplyScalar(depth / v.dot(fwd))).toArray() as V3;
};

// Smooth keyframed path (cubic Hermite, Catmull-Rom tangents, zero velocity at the ends).
export const spline = (keys: {t: number; p: V3}[], t: number): V3 => {
  if (t <= keys[0].t) return keys[0].p;
  const n = keys.length;
  if (t >= keys[n - 1].t) return keys[n - 1].p;
  let i = 0;
  while (t > keys[i + 1].t) i++;
  const k0 = keys[i];
  const k1 = keys[i + 1];
  const h = k1.t - k0.t;
  const s = (t - k0.t) / h;
  const tan = (j: number): V3 => {
    if (j <= 0 || j >= n - 1) return [0, 0, 0];
    const a = keys[j - 1];
    const b = keys[j + 1];
    const d = b.t - a.t;
    return [(b.p[0] - a.p[0]) / d, (b.p[1] - a.p[1]) / d, (b.p[2] - a.p[2]) / d];
  };
  const m0 = tan(i);
  const m1 = tan(i + 1);
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1;
  const h10 = s3 - 2 * s2 + s;
  const h01 = -2 * s3 + 3 * s2;
  const h11 = s3 - s2;
  return [0, 1, 2].map((c) => h00 * k0.p[c] + h10 * h * m0[c] + h01 * k1.p[c] + h11 * h * m1[c]) as V3;
};

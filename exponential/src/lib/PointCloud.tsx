// GPU particle field. Every particle's position is computed in the vertex shader from its random
// seeds and uTime, so it is fully deterministic (any frame renders identically, in any order).
//
// Usage (inside <ThreeCanvas> from @remotion/three):
//   <PointCloud count={60000} seed={7} uniforms={{uMorph: m}} body={`
//      pos = vec3(aSeed.xyz * 2. - 1.) * 5.;       // required: set pos
//      size = 2.0;  color = vec3(1.0);  alpha = 1.0; // optional
//   `} />
// Attributes: aSeed, aSeed2 (vec4 in [0,1)), aIndex (float 0..count-1). Uniforms: uTime (s), uPx (px scale),
// plus any you pass (float / vec2 / vec3 / vec4). All GLSL_COMMON noise helpers are available (GLSL 1 names).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import type {} from '@react-three/fiber'; // registers <points> etc. as JSX intrinsic elements
import {useCurrentFrame, useVideoConfig} from 'remotion';

const mulberry = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// GLSL1-compatible noise (three.js ShaderMaterial compiles as GLSL ES 1.0 style).
const NOISE = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
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
vec3 curl(vec3 p){
  const float e = .1;
  vec3 dx = vec3(e, 0., 0.), dy = vec3(0., e, 0.), dz = vec3(0., 0., e);
  float x = snoise(p + dy) - snoise(p - dy) - snoise(p + dz) + snoise(p - dz);
  float y = snoise(p + dz) - snoise(p - dz) - snoise(p + dx) + snoise(p - dx);
  float z = snoise(p + dx) - snoise(p - dx) - snoise(p + dy) + snoise(p - dy);
  return normalize(vec3(x, y, z) + 1e-5);
}
`;

export type PointUniforms = Record<string, number | number[]>;

type Props = {
  count: number;
  seed?: number;
  body: string; // GLSL: must assign `pos`; may assign `size`, `color`, `alpha`
  uniforms?: PointUniforms;
  time?: number; // seconds; defaults to the enclosing Sequence's frame / fps
  // 'soft' = round gaussian dot (default); 'spark' = hot core + halo (good for hero light)
  sprite?: 'soft' | 'spark';
  blending?: 'add' | 'normal';
};

const glslType = (v: number | number[]) =>
  typeof v === 'number' ? 'float' : v.length === 2 ? 'vec2' : v.length === 3 ? 'vec3' : 'vec4';

export const PointCloud: React.FC<Props> = ({
  count,
  seed = 1,
  body,
  uniforms = {},
  time,
  sprite = 'soft',
  blending = 'add',
}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const t = time ?? frame / fps;

  const geometry = useMemo(() => {
    const r = mulberry(seed * 9973 + 17);
    const a = new Float32Array(count * 4);
    const b = new Float32Array(count * 4);
    const idx = new Float32Array(count);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 4; k++) {
        a[i * 4 + k] = r();
        b[i * 4 + k] = r();
      }
      idx[i] = i;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(a, 4));
    g.setAttribute('aSeed2', new THREE.BufferAttribute(b, 4));
    g.setAttribute('aIndex', new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [count, seed]);

  const uniformKeys = Object.keys(uniforms).sort().join(',');
  const material = useMemo(() => {
    const decl = Object.entries(uniforms)
      .map(([k, v]) => `uniform ${glslType(v)} ${k};`)
      .join('\n');
    const u: Record<string, {value: unknown}> = {uTime: {value: 0}, uPx: {value: 1}};
    for (const [k, v] of Object.entries(uniforms)) {
      u[k] = {value: typeof v === 'number' ? v : new (v.length === 2 ? THREE.Vector2 : v.length === 3 ? THREE.Vector3 : THREE.Vector4)(...(v as [number, number, number, number]))};
    }
    const vertexShader = `
      uniform float uTime; uniform float uPx;
      ${decl}
      attribute vec4 aSeed; attribute vec4 aSeed2; attribute float aIndex;
      varying vec3 vColor; varying float vAlpha;
      ${NOISE}
      void main(){
        vec3 pos = vec3(0.); float size = 2.0; vec3 color = vec3(1.); float alpha = 1.0;
        ${body}
        vec4 _mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * _mv;
        gl_PointSize = max(0.0, size * uPx * (10.0 / max(0.001, -_mv.z)));
        vColor = color; vAlpha = alpha;
      }`;
    const fragmentShader =
      sprite === 'spark'
        ? `varying vec3 vColor; varying float vAlpha;
           void main(){ vec2 c = gl_PointCoord - .5; float d = length(c);
             float core = exp(-d * d * 90.); float halo = exp(-d * d * 14.) * .45;
             float a = (core + halo) * vAlpha; if (a < .002) discard;
             gl_FragColor = vec4(vColor * a, a); }`
        : `varying vec3 vColor; varying float vAlpha;
           void main(){ vec2 c = gl_PointCoord - .5; float d = length(c);
             float a = exp(-d * d * 18.) * vAlpha; if (a < .002) discard;
             gl_FragColor = vec4(vColor * a, a); }`;
    return new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: blending === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
      premultipliedAlpha: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, uniformKeys, sprite, blending]);

  // Push uniforms every frame.
  material.uniforms.uTime.value = t;
  material.uniforms.uPx.value = height / 1080;
  for (const [k, v] of Object.entries(uniforms)) {
    const cur = material.uniforms[k];
    if (!cur) continue;
    if (typeof v === 'number') cur.value = v;
    else (cur.value as THREE.Vector4).set(...(v as [number, number, number, number]));
  }

  return <points geometry={geometry} material={material} frustumCulled={false} />;
};

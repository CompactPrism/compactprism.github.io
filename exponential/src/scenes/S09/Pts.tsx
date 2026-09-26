// Deterministic GPU points like lib/PointCloud, plus: depth testing (so towers occlude them), a `pre` block
// for GLSL helper functions, and `screen` sizing (body sets `screen = 1.` to give size in px).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {NOISE1} from '../S04/noise';

const mulberry = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
type U = Record<string, number | number[]>;
const glslType = (v: number | number[]) => (typeof v === 'number' ? 'float' : v.length === 2 ? 'vec2' : v.length === 3 ? 'vec3' : 'vec4');

export const Pts: React.FC<{count: number; seed?: number; body: string; pre?: string; uniforms?: U; depthTest?: boolean; order?: number}> = ({
  count,
  seed = 1,
  body,
  pre = '',
  uniforms = {},
  depthTest = true,
  order = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dpr = useThree((s) => s.viewport.dpr); // points sized in drawing-buffer px: keep them constant on screen
  const geometry = useMemo(() => {
    const r = mulberry(seed * 9973 + 17);
    const a = new Float32Array(count * 4);
    const b = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) {
      a[i] = r();
      b[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(a, 4));
    g.setAttribute('aSeed2', new THREE.BufferAttribute(b, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    return g;
  }, [count, seed]);
  const keys = Object.keys(uniforms).sort().join(',');
  const material = useMemo(() => {
    const decl = Object.entries(uniforms)
      .map(([k, v]) => `uniform ${glslType(v)} ${k};`)
      .join('\n');
    const u: Record<string, {value: unknown}> = {uTime: {value: 0}, uPx: {value: 1}};
    for (const [k, v] of Object.entries(uniforms)) {
      u[k] = {value: typeof v === 'number' ? v : new (v.length === 2 ? THREE.Vector2 : v.length === 3 ? THREE.Vector3 : THREE.Vector4)(...(v as [number, number, number, number]))};
    }
    return new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: `
        uniform float uTime; uniform float uPx;
        ${decl}
        attribute vec4 aSeed; attribute vec4 aSeed2;
        varying vec3 vColor; varying float vAlpha;
        ${NOISE1}
        ${pre}
        void main(){
          vec3 pos = vec3(0.); float size = 2.; vec3 color = vec3(1.); float alpha = 1.; float screen = 0.;
          ${body}
          vec4 mv = modelViewMatrix * vec4(pos, 1.);
          gl_Position = projectionMatrix * mv;
          float depth = max(.05, -mv.z);
          gl_PointSize = clamp(size * uPx * mix(10. / depth, 1., screen), 0., 256.);
          vColor = color; vAlpha = alpha * step(.1, -mv.z);
        }`,
      fragmentShader: `varying vec3 vColor; varying float vAlpha;
        void main(){ vec2 c = gl_PointCoord - .5; float d2 = dot(c, c);
          float a = (exp(-d2 * 90.) + exp(-d2 * 16.) * .4) * vAlpha; if (a < .003) discard;
          gl_FragColor = vec4(vColor * a, a); }`,
      transparent: true,
      depthWrite: false,
      depthTest,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, pre, keys, depthTest]);
  material.uniforms.uTime.value = frame / fps;
  material.uniforms.uPx.value = dpr;
  for (const [k, v] of Object.entries(uniforms)) {
    const cur = material.uniforms[k];
    if (!cur) continue;
    if (typeof v === 'number') cur.value = v;
    else (cur.value as THREE.Vector4).set(...(v as [number, number, number, number]));
  }
  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={order} />;
};

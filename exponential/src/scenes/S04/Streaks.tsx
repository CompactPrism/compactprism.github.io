// GPU motion streaks: each particle is a line segment whose two ends are the same particle evaluated at
// travel `tr` and `tr - uTrail`. Longer trail = faster flow. Deterministic (pure function of uniforms + seeds).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import type {} from '@react-three/fiber';
import {NOISE1} from './noise';

const mulberry = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type U = Record<string, number | number[]>;
const glslType = (v: number | number[]) => (typeof v === 'number' ? 'float' : v.length === 2 ? 'vec2' : v.length === 3 ? 'vec3' : 'vec4');

// body: GLSL statements using aSeed, aSeed2, tr (travel at this end), aEnd (0 head, 1 tail);
// must set `pos`, may set `color`, `alpha`.
export const Streaks: React.FC<{count: number; seed?: number; body: string; uniforms: U; depthTest?: boolean}> = ({
  count,
  seed = 5,
  body,
  uniforms,
  depthTest = false,
}) => {
  const geometry = useMemo(() => {
    const r = mulberry(seed * 7919 + 3);
    const a = new Float32Array(count * 8);
    const b = new Float32Array(count * 8);
    const e = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const sa = [r(), r(), r(), r()];
      const sb = [r(), r(), r(), r()];
      for (let end = 0; end < 2; end++) {
        for (let k = 0; k < 4; k++) {
          a[(i * 2 + end) * 4 + k] = sa[k];
          b[(i * 2 + end) * 4 + k] = sb[k];
        }
        e[i * 2 + end] = end;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(a, 4));
    g.setAttribute('aSeed2', new THREE.BufferAttribute(b, 4));
    g.setAttribute('aEnd', new THREE.BufferAttribute(e, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [count, seed]);

  const keys = Object.keys(uniforms).sort().join(',');
  const material = useMemo(() => {
    const decl = Object.entries(uniforms)
      .map(([k, v]) => `uniform ${glslType(v)} ${k};`)
      .join('\n');
    const u: Record<string, {value: unknown}> = {};
    for (const [k, v] of Object.entries(uniforms)) {
      u[k] = {value: typeof v === 'number' ? v : new (v.length === 2 ? THREE.Vector2 : v.length === 3 ? THREE.Vector3 : THREE.Vector4)(...(v as [number, number, number, number]))};
    }
    return new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: `
        ${decl}
        attribute vec4 aSeed; attribute vec4 aSeed2; attribute float aEnd;
        varying vec3 vColor; varying float vAlpha;
        ${NOISE1}
        void main(){
          vec3 pos = vec3(0.); vec3 color = vec3(1.); float alpha = 1.;
          float tr = uTravel - aEnd * uTrail;
          ${body}
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
          vColor = color; vAlpha = alpha * (1. - aEnd);
        }`,
      fragmentShader: `varying vec3 vColor; varying float vAlpha;
        void main(){ if (vAlpha < .002) discard; gl_FragColor = vec4(vColor * vAlpha, vAlpha); }`,
      transparent: true,
      depthWrite: false,
      depthTest,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, keys, depthTest]);

  for (const [k, v] of Object.entries(uniforms)) {
    const cur = material.uniforms[k];
    if (!cur) continue;
    if (typeof v === 'number') cur.value = v;
    else (cur.value as THREE.Vector4).set(...(v as [number, number, number, number]));
  }
  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />;
};

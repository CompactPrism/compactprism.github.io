// Luminous filament: a camera-facing ribbon expanded in screen space (constant px width at any distance),
// with a white-hot core, warm bloom falloff, a brighter swelling head, depth test against the city.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import type {} from '@react-three/fiber';
import type {V3} from '../S04/cam';

type Props = {
  fn: (u: number) => V3;
  uMax: number;
  n?: number;
  draw: number; // u of the head
  cull?: number; // u below which the line fades (behind camera)
  width: number; // half width, CSS px
  intensity?: number;
  core?: [number, number, number];
  glow?: [number, number, number];
};

export const GlowLine: React.FC<Props> = ({fn, uMax, n = 700, draw, cull = -1, width, intensity = 1, core = [1, 0.86, 0.6], glow = [0.93, 0.45, 0.25]}) => {
  const geometry = useMemo(() => {
    const pos = new Float32Array((n + 1) * 2 * 3);
    const nxt = new Float32Array((n + 1) * 2 * 3);
    const side = new Float32Array((n + 1) * 2);
    const uu = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      const u = (uMax * i) / n;
      const p = fn(u);
      const q = fn(u + uMax / n);
      for (let s = 0; s < 2; s++) {
        const k = i * 2 + s;
        pos.set(p, k * 3);
        nxt.set(q, k * 3);
        side[k] = s ? 1 : -1;
        uu[k] = u;
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aNext', new THREE.BufferAttribute(nxt, 3));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setAttribute('aU', new THREE.BufferAttribute(uu, 1));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    return g;
  }, [fn, uMax, n]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {uDraw: {value: 0}, uCull: {value: -1}, uWidth: {value: 20}, uI: {value: 1}, uCore: {value: new THREE.Vector3()}, uGlow: {value: new THREE.Vector3()}},
        vertexShader: `
          uniform float uDraw; uniform float uWidth;
          attribute vec3 aNext; attribute float aSide; attribute float aU;
          varying float vSide; varying float vU; varying float vDepth;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.);
            vec4 mvN = modelViewMatrix * vec4(aNext, 1.);
            vDepth = -mv.z;
            mv.z = min(mv.z, -.3); mvN.z = min(mvN.z, -.3);
            vec4 c = projectionMatrix * mv; vec4 cN = projectionMatrix * mvN;
            vec2 res = vec2(1920., 1080.);
            vec2 d = (cN.xy / cN.w - c.xy / c.w) * res;
            float L = length(d);
            d = L > 1e-5 ? d / L : vec2(1., 0.);
            vec2 nr = vec2(-d.y, d.x);
            float head = exp(-max(uDraw - aU, 0.) * 22.);
            float w = uWidth * (1. + 1.6 * head);
            c.xy += nr * aSide * w * 2. / res * c.w;
            gl_Position = c;
            vSide = aSide; vU = aU;
          }`,
        fragmentShader: `
          uniform float uDraw; uniform float uCull; uniform float uI; uniform vec3 uCore; uniform vec3 uGlow;
          varying float vSide; varying float vU; varying float vDepth;
          void main(){
            if (vU > uDraw) discard;
            float d = abs(vSide);
            float core = exp(-d * d * 320.);
            float glow = exp(-d * d * 10.) * .32 + exp(-d * 5.) * .1;
            float head = exp(-(uDraw - vU) * 16.);
            float tail = smoothstep(uCull, uCull + .04, vU);
            float fog = mix(.45, 1., exp(-vDepth * .0015));
            vec3 col = uGlow * glow * (1. + 2.2 * head) + mix(uCore, vec3(1.), .45) * core * (1. + 1.2 * head);
            col *= uI * tail * fog * smoothstep(1., .9, d);
            gl_FragColor = vec4(col, 1.);
          }`,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
      }),
    []
  );
  material.uniforms.uDraw.value = draw;
  material.uniforms.uCull.value = cull;
  material.uniforms.uWidth.value = width;
  material.uniforms.uI.value = intensity;
  (material.uniforms.uCore.value as THREE.Vector3).set(...core);
  (material.uniforms.uGlow.value as THREE.Vector3).set(...glow);
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
};

// Crisp mesh enemies for S07: DISEASE (spiked virions) and POVERTY (a slab of city lights cracked into
// drifting shards). Both materialise with a noise dissolve whose leading edge glows cold.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import type {} from '@react-three/fiber';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {GMesh, V3} from './gl';
import {rnd} from '../../lib/anim';

const VERT = /* glsl */ `
varying vec3 vO; varying vec3 vN; varying vec3 vW; varying vec3 vON;
void main(){
  vec3 p = position;
  vO = p; vON = normal;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(p, 1.);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const DISSOLVE = /* glsl */ `
  float thr = uDis * 2.7 - 1.35;
  if (dn > thr) discard;
  float edge = smoothstep(thr - .14, thr, dn) * (1. - smoothstep(.85, 1., uDis));
`;

const VIRUS_FRAG = /* glsl */ `
varying vec3 vO; varying vec3 vN; varying vec3 vW; varying vec3 vON;
void main(){
  float dn = snoise(normalize(vO) * 1.6 + uSeed);
  ${DISSOLVE}
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  float ndv = max(dot(N, V), 0.);
  float rim = pow(1. - ndv, 2.4);
  vec3 L = normalize(vec3(-.35, .85, .4));
  float dif = max(dot(N, L), 0.);
  float cells = smoothstep(.05, .45, abs(snoise(vO * 4.2 + uSeed)));
  float r = length(vO);
  float tip = smoothstep(1.3, 1.42, r);
  vec3 base = mix(vec3(.10, .14, .10), vec3(.26, .33, .23), cells);
  vec3 col = base * (.12 + dif * (.75 + uFl * 1.6));
  col += vec3(.50, .64, .46) * rim * (.9 + uFl * 1.2);
  col += vec3(.62, .74, .52) * tip * (.35 + uFl);
  col += vec3(.62, .84, .74) * edge * 1.4;
  gl_FragColor = vec4(col, 1.);
}`;

const SHARD_FRAG = /* glsl */ `
varying vec3 vO; varying vec3 vN; varying vec3 vW; varying vec3 vON;
void main(){
  vec2 sp = vO.xy + uOff;
  float dn = snoise(vec3(sp * 1.5, uSeed));
  ${DISSOLVE}
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  float rim = pow(1. - max(dot(N, V), 0.), 2.);
  vec3 col;
  if (vON.z > .5) {
    vec2 p = sp * 4.2;
    vec2 cid = floor(p); vec2 f = fract(p);
    float street = min(min(f.x, 1. - f.x), min(f.y, 1. - f.y));
    float road = smoothstep(.07, .0, street);
    vec2 q = f * 3.; vec2 lid = floor(q); vec2 lf = fract(q) - .5;
    float h = hash13(vec3(cid * 3. + lid, 1.));
    float on = step(h, .58) * step(.09, street);
    float dieT = uDie + hash13(vec3(cid, 5.)) * 1.8;
    float alive = 1. - smoothstep(dieT, dieT + .3, uRv);
    float fl = .65 + .35 * sin(uT * (5. + h * 13.) + h * 30.);
    float drop = step(.1, fract(uT * (1.1 + h * 1.7) + h * 7.));
    float dotL = smoothstep(.34, .06, length(lf));
    float lum = on * dotL * mix(.08, 1., alive) * fl * mix(.35, 1., drop);
    vec3 ground = vec3(.03, .04, .055) * (.7 + .5 * snoise(vec3(p * .6, 2.)));
    col = ground + vec3(.12, .16, .22) * road * (.3 + .7 * alive) + vec3(.78, .88, 1.) * lum * 1.5;
    col *= 1. + uFl * 1.2;
  } else {
    col = vec3(.03, .035, .045) + vec3(.40, .50, .66) * rim * (.45 + uFl);
  }
  col += vec3(.62, .78, 1.) * edge * 1.3;
  gl_FragColor = vec4(col, 1.);
}`;

type Common = {t: number; rv: number; fl: number; dis: number};

// ---------- DISEASE ----------
const makeSpikes = (n: number) => {
  const parts: THREE.BufferGeometry[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.39996323;
    const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const q = new THREE.Quaternion().setFromUnitVectors(up, d);
    const len = 0.3 + 0.08 * rnd(`sl${i}`);
    const stalk = new THREE.CylinderGeometry(0.028, 0.05, len, 6, 1, true);
    stalk.translate(0, 0.97 + len / 2, 0);
    stalk.applyQuaternion(q);
    const knob = new THREE.SphereGeometry(0.075, 8, 6);
    knob.scale(1, 0.8, 1);
    knob.translate(0, 0.97 + len + 0.04, 0);
    knob.applyQuaternion(q);
    parts.push(stalk, knob);
  }
  const nonIdx = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  nonIdx.forEach((g) => {
    g.deleteAttribute('uv');
  });
  return mergeGeometries(nonIdx)!;
};

const VIRIONS: {off: V3; r: number; spin: number; seed: number}[] = [
  {off: [0, 0, 0], r: 1, spin: 0.22, seed: 1.7},
  {off: [-1.2, -0.62, -0.9], r: 0.5, spin: -0.3, seed: 5.1},
  {off: [1.05, 0.74, -1.1], r: 0.4, spin: 0.35, seed: 8.3},
];

export const Virus: React.FC<Common & {position: V3; scale: number}> = ({t, rv, fl, dis, position, scale}) => {
  const body = useMemo(() => new THREE.SphereGeometry(1, 64, 40), []);
  const spikes = useMemo(() => makeSpikes(34), []);
  return (
    <group position={position} scale={[scale, scale, scale]} rotation={[0.3, 0, 0]}>
      {VIRIONS.map((v, i) => {
        const d = Math.min(1, Math.max(0, dis * 1.25 - i * 0.12));
        const u = {uT: t, uRv: rv, uFl: fl, uDis: d, uSeed: v.seed};
        const rot: V3 = [0.4 * i, t * v.spin + i, 0.2];
        return (
          <group key={i} position={v.off} rotation={rot} scale={[v.r, v.r, v.r]}>
            <GMesh geometry={body} vert={VERT} frag={VIRUS_FRAG} uniforms={u} renderOrder={1} />
            <GMesh geometry={spikes} vert={VERT} frag={VIRUS_FRAG} uniforms={u} renderOrder={1} />
          </group>
        );
      })}
    </group>
  );
};

// ---------- POVERTY ----------
type P2 = [number, number];
const clipHalf = (poly: P2[], m: P2, n: P2): P2[] => {
  const out: P2[] = [];
  const side = (p: P2) => (p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sa = side(a);
    const sb = side(b);
    if (sa <= 0) out.push(a);
    if (sa * sb < 0) {
      const k = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
  }
  return out;
};

const SLAB = 1.35;
const makeShards = () => {
  const seeds: P2[] = [];
  for (let i = 0; i < 9; i++) seeds.push([(rnd(`vx${i}`) - 0.5) * 2.2 * SLAB * 0.9, (rnd(`vy${i}`) - 0.5) * 2.2 * SLAB * 0.9]);
  return seeds.map((s, i) => {
    let poly: P2[] = [
      [-SLAB, -SLAB],
      [SLAB, -SLAB],
      [SLAB, SLAB],
      [-SLAB, SLAB],
    ];
    seeds.forEach((o, j) => {
      if (j === i) return;
      poly = clipHalf(poly, [(s[0] + o[0]) / 2, (s[1] + o[1]) / 2], [o[0] - s[0], o[1] - s[1]]);
    });
    const c: P2 = poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0] as P2);
    const shrink = 0.04;
    const pts = poly.map((p) => {
      const dx = p[0] - c[0];
      const dy = p[1] - c[1];
      const l = Math.hypot(dx, dy);
      return new THREE.Vector2(dx - (dx / l) * shrink, dy - (dy / l) * shrink);
    });
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {depth: 0.16, bevelEnabled: false});
    g.translate(0, 0, -0.16);
    return {geo: g, c, fall: rnd(`sf${i}`), tilt: rnd(`st${i}`) - 0.5, die: rnd(`sd${i}`) * 1.4};
  });
};

export const Shards: React.FC<Common & {position: V3; scale: number}> = ({t, rv, fl, dis, position, scale}) => {
  const shards = useMemo(() => makeShards(), []);
  const frac = Math.min(1, Math.max(0, (rv - 0.15) / 2.2));
  const fr = 1 - Math.pow(1 - frac, 2);
  return (
    <group position={position} scale={[scale, scale, scale]} rotation={[-0.78, 0.22 + t * 0.03, 0.08]}>
      {shards.map((s, i) => {
        const d = Math.min(1, Math.max(0, dis * 1.3 - s.fall * 0.3));
        const u = {uT: t, uRv: rv, uFl: fl, uDis: d, uSeed: 3 + i, uOff: [s.c[0], s.c[1]], uDie: 0.5 + s.die};
        const p: V3 = [s.c[0] * (1 + 0.1 * fr), s.c[1] * (1 + 0.1 * fr), -0.35 * fr * s.fall];
        return (
          <group key={i} position={p} rotation={[s.tilt * 0.3 * fr, -s.tilt * 0.35 * fr, s.tilt * 0.12 * fr]}>
            <GMesh geometry={s.geo} vert={VERT} frag={SHARD_FRAG} uniforms={u} renderOrder={1} />
          </group>
        );
      })}
    </group>
  );
};

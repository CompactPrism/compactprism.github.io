// V2 · IGNORANCE and V3 · POVERTY share one point set: nodes on a sphere, laid out flat as an azimuthal
// "field of minds" (curvature 0) that rolls up into a globe (curvature 1). A warm wave lights each node as
// it arrives; in V3 long-haul arcs carry the light to the most remote regions first.
import React, {useMemo} from 'react';
import {GLines, GPoints, V3} from '../S07/gl';
import {rnd} from '../../lib/anim';

export const R = 6;
export const NODES = 14000;

export type Wave = {
  tA: number; // wave starts (V2 touchdown)
  tB: number; // reaches rho1
  rho1: number;
  tC: number; // resumes (V3)
  tD: number; // reaches the antipode
  src: [number, number, number, number][]; // remote sources: dir xyz, start time
  speed: number;
};

// ---------- shared GLSL ----------
export const WORLD_GLSL = /* glsl */ `
vec3 sdir(float th, float ph){ return vec3(sin(th) * cos(ph), cos(th), sin(th) * sin(ph)); }
vec3 embed(float th, float ph, float lift){
  float c = max(uCurv, .0015);
  float Rp = ${R.toFixed(1)} / c;
  float a = th * c;
  float rr = (Rp + lift) * sin(a);
  vec3 p = vec3(rr * cos(ph), (Rp + lift) * cos(a) - Rp, rr * sin(ph));
  // rotate about the sphere centre (only used once rolled up)
  vec3 cc = vec3(0., -${R.toFixed(1)}, 0.);
  vec3 q = p - cc;
  q.yz = rot(uRX) * q.yz;
  q.xz = rot(uRY) * q.xz;
  return uO + cc + q;
}
float arrive(float th, float ph, float r){
  float rho = th * ${R.toFixed(1)};
  float ta = rho < uRho1 ? uTA + rho / uRho1 * (uTB - uTA) : uTC + (rho - uRho1) / (PI * ${R.toFixed(1)} - uRho1) * (uTD - uTC);
  vec3 n = sdir(th, ph);
  ta = min(ta, uS0.w + acos(clamp(dot(n, uS0.xyz), -1., 1.)) * ${R.toFixed(1)} / uSpd);
  ta = min(ta, uS1.w + acos(clamp(dot(n, uS1.xyz), -1., 1.)) * ${R.toFixed(1)} / uSpd);
  ta = min(ta, uS2.w + acos(clamp(dot(n, uS2.xyz), -1., 1.)) * ${R.toFixed(1)} / uSpd);
  ta = min(ta, uS3.w + acos(clamp(dot(n, uS3.xyz), -1., 1.)) * ${R.toFixed(1)} / uSpd);
  ta = min(ta, uS4.w + acos(clamp(dot(n, uS4.xyz), -1., 1.)) * ${R.toFixed(1)} / uSpd);
  return ta + r * .35;
}
float fogA(vec3 pos){ return exp(-max(0., length(pos - cameraPosition) - 3.) * uFogK); }
float facing(vec3 pos){
  vec3 cc = uO + vec3(0., -${R.toFixed(1)}, 0.);
  vec3 nn = normalize(pos - cc);
  return mix(1., .12 + .88 * smoothstep(-.25, .25, dot(nn, normalize(cameraPosition - pos))), smoothstep(.6, 1., uCurv));
}
`;

export const worldUniforms = (w: Wave, curv: number, O: V3, rx: number, ry: number, t: number, fogK: number, op: number) => {
  const s = [0, 1, 2, 3, 4].map((k) => w.src[k] ?? [0, 1, 0, 999]);
  return {
    uT: t,
    uCurv: curv,
    uO: O as number[],
    uRX: rx,
    uRY: ry,
    uTA: w.tA,
    uTB: w.tB,
    uRho1: w.rho1,
    uTC: w.tC,
    uTD: w.tD,
    uSpd: w.speed,
    uS0: s[0],
    uS1: s[1],
    uS2: s[2],
    uS3: s[3],
    uS4: s[4],
    uFogK: fogK,
    uOp: op,
  };
};

// JS mirrors (for DOM labels pinned to the world)
const rotYZ = (y: number, z: number, a: number) => [Math.cos(a) * y + Math.sin(a) * z, -Math.sin(a) * y + Math.cos(a) * z];
export const embedJS = (th: number, ph: number, lift: number, curv: number, O: V3, rx: number, ry: number): V3 => {
  const c = Math.max(curv, 0.0015);
  const Rp = R / c;
  const a = th * c;
  const rr = (Rp + lift) * Math.sin(a);
  let x = rr * Math.cos(ph);
  let y = (Rp + lift) * Math.cos(a) - Rp + R;
  let z = rr * Math.sin(ph);
  [y, z] = rotYZ(y, z, rx);
  const xz = rotYZ(x, z, ry);
  x = xz[0];
  z = xz[1];
  return [O[0] + x, O[1] - R + y, O[2] + z];
};
export const arriveJS = (w: Wave, th: number, ph: number, r = 0) => {
  const rho = th * R;
  let ta = rho < w.rho1 ? w.tA + (rho / w.rho1) * (w.tB - w.tA) : w.tC + ((rho - w.rho1) / (Math.PI * R - w.rho1)) * (w.tD - w.tC);
  const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
  for (const s of w.src) ta = Math.min(ta, s[3] + (Math.acos(Math.max(-1, Math.min(1, n[0] * s[0] + n[1] * s[1] + n[2] * s[2]))) * R) / w.speed);
  return ta + r * 0.35;
};
// plane coords (u = x, v = z) -> sphere coords
export const planeToSphere = (u: number, v: number) => ({th: Math.hypot(u, v) / R, ph: Math.atan2(v, u)});

// ---------- data ----------
const buildNodes = () => {
  const a = new Float32Array(NODES * 4);
  const th: number[] = [];
  const ph: number[] = [];
  for (let i = 0; i < NODES; i++) {
    const y = 1 - (2 * (i + 0.5)) / NODES;
    const ang = i * 2.39996323 + (rnd(`nj${i}`) - 0.5) * 0.02;
    const t = Math.acos(Math.max(-1, Math.min(1, y + (rnd(`ny${i}`) - 0.5) * 0.0006)));
    const p = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    th.push(t);
    ph.push(p);
    a[i * 4] = t;
    a[i * 4 + 1] = p;
    a[i * 4 + 2] = rnd(`nr${i}`);
    a[i * 4 + 3] = rnd(`nl${i}`);
  }
  return {a, th, ph};
};

const buildLinks = (th: number[], ph: number[], nodeA: Float32Array) => {
  // k-nearest links among "learner" nodes (spatial hash on the unit sphere)
  const learners: number[] = [];
  for (let i = 0; i < NODES; i++) if (nodeA[i * 4 + 3] < 0.42) learners.push(i);
  const P = learners.map((i) => [Math.sin(th[i]) * Math.cos(ph[i]), Math.cos(th[i]), Math.sin(th[i]) * Math.sin(ph[i])]);
  const cell = 0.06;
  const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const grid = new Map<string, number[]>();
  P.forEach((p, k) => {
    const kk = key(p[0], p[1], p[2]);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk)!.push(k);
  });
  const pairs = new Set<string>();
  const segs: number[] = [];
  P.forEach((p, k) => {
    const cx = Math.floor(p[0] / cell);
    const cy = Math.floor(p[1] / cell);
    const cz = Math.floor(p[2] / cell);
    const cand: [number, number][] = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const g = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (!g) continue;
          for (const j of g) {
            if (j === k) continue;
            const q = P[j];
            const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
            cand.push([d, j]);
          }
        }
    cand.sort((x, y) => x[0] - y[0]);
    for (const [d, j] of cand.slice(0, 2)) {
      if (d > 0.0036) continue;
      const id = k < j ? `${k}-${j}` : `${j}-${k}`;
      if (pairs.has(id)) continue;
      pairs.add(id);
      const a = learners[k];
      const b = learners[j];
      segs.push(a, b);
    }
  });
  const nv = segs.length;
  const own = new Float32Array(nv * 4);
  const oth = new Float32Array(nv * 4);
  for (let s = 0; s < nv; s += 2) {
    const a = segs[s];
    const b = segs[s + 1];
    for (const [v, x, y] of [
      [s, a, b],
      [s + 1, b, a],
    ]) {
      own.set([nodeA[x * 4], nodeA[x * 4 + 1], nodeA[x * 4 + 2], 0], v * 4);
      oth.set([nodeA[y * 4], nodeA[y * 4 + 1], nodeA[y * 4 + 2], 0], v * 4);
    }
  }
  return {count: nv, attrs: {aA: {data: own, size: 4}, aB: {data: oth, size: 4}}};
};

// ---------- shaders ----------
const NODE_BODY = /* glsl */ `
  ${'' /* WORLD_GLSL injected via uniforms block below */}
  float th = aNode.x, ph = aNode.y, r = aNode.z;
  pos = embed(th, ph, 0.);
  float ta = arrive(th, ph, r);
  float lit = smoothstep(ta, ta + .5, uT);
  float flash = exp(-max(0., uT - ta) * 3.5) * step(ta, uT);
  float learner = step(aNode.w, .42);
  vec3 cold = vec3(.30, .37, .48);
  vec3 warm = mix(vec3(.93, .54, .37), vec3(.96, .78, .50), r);
  color = mix(cold, warm, lit) + vec3(1., .9, .75) * flash;
  size = mix(2.0, 3.4, lit) * (learner > .5 ? 1.25 : .9) + flash * 3.;
  alpha = mix(.32, .85, lit) * fogA(pos) * facing(pos) * uOp;
`;
const LINK_BODY = /* glsl */ `
  pos = embed(aA.x, aA.y, 0.);
  float la = smoothstep(arrive(aA.x, aA.y, aA.z), arrive(aA.x, aA.y, aA.z) + .6, uT);
  float lb = smoothstep(arrive(aB.x, aB.y, aB.z), arrive(aB.x, aB.y, aB.z) + .6, uT);
  float lit = min(la, lb);
  color = mix(vec3(.35, .45, .6), vec3(.98, .7, .42), lit);
  alpha = mix(.035, .42, lit) * fogA(pos) * facing(pos) * uOp;
`;

// long-haul arcs (V3): aK = (arc index, s, launch time, -), aP/aQ = endpoint dirs
const ARC_POS = /* glsl */ `
  float s = aK.y;
  float om = acos(clamp(dot(aP, aQ), -1., 1.));
  vec3 d = (sin((1. - s) * om) * aP + sin(s * om) * aQ) / max(sin(om), 1e-3);
  float lift = ${R.toFixed(1)} * .28 * sin(PI * s);
  vec3 cc = uO + vec3(0., -${R.toFixed(1)}, 0.);
  vec3 q = d * (${R.toFixed(1)} + lift);
  q.yz = rot(uRX) * q.yz;
  q.xz = rot(uRY) * q.xz;
  pos = cc + q;
  float prog = clamp((uT - aK.z) / uArcDur, 0., 1.);
`;
const ARC_LINE = /* glsl */ `
  ${ARC_POS}
  float vis = step(s, prog);
  float head = exp(-pow((prog - s) * 9., 2.));
  color = mix(vec3(.98, .72, .45), vec3(1., .92, .75), head);
  alpha = vis * (.55 + head * .9) * uOp * facing(pos) * (1. - smoothstep(uArcFade, uArcFade + .8, uT) * .6);
`;

export const buildArcs = (sources: {from: V3; to: V3; t: number}[], segs = 56) => {
  const n = sources.length * segs * 2;
  const K = new Float32Array(n * 4);
  const Pa = new Float32Array(n * 3);
  const Qa = new Float32Array(n * 3);
  let v = 0;
  sources.forEach((s, k) => {
    for (let i = 0; i < segs; i++)
      for (const e of [i, i + 1]) {
        K.set([k, e / segs, s.t, 0], v * 4);
        Pa.set(s.from, v * 3);
        Qa.set(s.to, v * 3);
        v++;
      }
  });
  return {count: n, attrs: {aK: {data: K, size: 4}, aP: {data: Pa, size: 3}, aQ: {data: Qa, size: 3}}};
};
// JS: arc head position
export const arcPoint = (from: V3, to: V3, s: number, O: V3, rx: number, ry: number): V3 => {
  const dot = Math.max(-1, Math.min(1, from[0] * to[0] + from[1] * to[1] + from[2] * to[2]));
  const om = Math.acos(dot);
  const so = Math.max(Math.sin(om), 1e-3);
  const a = Math.sin((1 - s) * om) / so;
  const b = Math.sin(s * om) / so;
  const rr = R + R * 0.28 * Math.sin(Math.PI * s);
  let x = (from[0] * a + to[0] * b) * rr;
  let y = (from[1] * a + to[1] * b) * rr;
  let z = (from[2] * a + to[2] * b) * rr;
  [y, z] = rotYZ(y, z, rx);
  [x, z] = rotYZ(x, z, ry);
  return [O[0] + x, O[1] - R + y, O[2] + z];
};

type WorldProps = {u: Record<string, number | number[]>; arcs?: {count: number; attrs: Record<string, {data: Float32Array; size: number}>} | null; arcU?: Record<string, number | number[]>};

export const World: React.FC<WorldProps> = ({u, arcs, arcU}) => {
  const nodes = useMemo(() => buildNodes(), []);
  const nodeAttrs = useMemo(() => ({aNode: {data: nodes.a, size: 4}}), [nodes]);
  const links = useMemo(() => buildLinks(nodes.th, nodes.ph, nodes.a), [nodes]);
  const pre = WORLD_GLSL;
  return (
    <>
      <GLines count={links.count} attrs={links.attrs} body={`}\n${pre}\nvoid _unused(){`.length ? LINK_BODY : LINK_BODY} uniforms={u} glsl={pre} renderOrder={1} />
      <GPoints count={NODES} attrs={nodeAttrs} body={NODE_BODY} uniforms={u} glsl={pre} sprite="spark" renderOrder={2} />
      {arcs && arcU && <GLines count={arcs.count} attrs={arcs.attrs} body={ARC_LINE} uniforms={{...u, ...arcU}} glsl={pre} renderOrder={3} />}
    </>
  );
};

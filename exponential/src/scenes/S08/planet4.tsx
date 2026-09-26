// V4 · PLANET. A crystal lattice of a new material assembles in warm light; on the planet's surface, wind
// turbines and solar fields catch the hero's sweep; a warm orbit of light closes around the cleared world.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {GLines, GMesh, GPoints, V3} from '../S07/gl';
import {rnd} from '../../lib/anim';

// ---------- lattice (body-centred cubic, 4x4x4 corners + 3x3x3 centres) ----------
const N = 4;
const SP = 0.42;
export const buildLattice = () => {
  const atoms: {p: V3; kind: number}[] = [];
  const idx = new Map<string, number>();
  const o = ((N - 1) * SP) / 2;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      for (let k = 0; k < N; k++) {
        idx.set(`c${i},${j},${k}`, atoms.length);
        atoms.push({p: [i * SP - o, j * SP - o, k * SP - o], kind: 0});
      }
  for (let i = 0; i < N - 1; i++)
    for (let j = 0; j < N - 1; j++)
      for (let k = 0; k < N - 1; k++) {
        idx.set(`b${i},${j},${k}`, atoms.length);
        atoms.push({p: [(i + 0.5) * SP - o, (j + 0.5) * SP - o, (k + 0.5) * SP - o], kind: 1});
      }
  const bonds: [number, number][] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      for (let k = 0; k < N; k++) {
        const a = idx.get(`c${i},${j},${k}`)!;
        if (i < N - 1) bonds.push([a, idx.get(`c${i + 1},${j},${k}`)!]);
        if (j < N - 1) bonds.push([a, idx.get(`c${i},${j + 1},${k}`)!]);
        if (k < N - 1) bonds.push([a, idx.get(`c${i},${j},${k + 1}`)!]);
      }
  for (let i = 0; i < N - 1; i++)
    for (let j = 0; j < N - 1; j++)
      for (let k = 0; k < N - 1; k++) {
        const b = idx.get(`b${i},${j},${k}`)!;
        for (const [di, dj, dk] of [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
          [1, 1, 0],
          [1, 0, 1],
          [0, 1, 1],
          [1, 1, 1],
        ])
          bonds.push([b, idx.get(`c${i + di},${j + dj},${k + dk}`)!]);
      }
  // arrival order: a diagonal sweep through the crystal, with jitter
  const arr = atoms.map((a, i) => (a.p[0] + a.p[1] * 0.6 - a.p[2] * 0.4) / (o * 4) + 0.5 + (rnd(`la${i}`) - 0.5) * 0.12);
  const pts = new Float32Array(atoms.length * 4);
  const sc = new Float32Array(atoms.length * 4);
  atoms.forEach((a, i) => {
    pts.set([a.p[0], a.p[1], a.p[2], a.kind], i * 4);
    sc.set([(rnd(`lx${i}`) - 0.5) * 7, (rnd(`ly${i}`) - 0.5) * 5, (rnd(`lz${i}`) - 0.5) * 5, arr[i]], i * 4);
  });
  const la = new Float32Array(bonds.length * 2 * 4);
  const lb = new Float32Array(bonds.length * 2 * 4);
  bonds.forEach(([a, b], s) => {
    for (const [v, x, y] of [
      [s * 2, a, b],
      [s * 2 + 1, b, a],
    ]) {
      la.set([atoms[x].p[0], atoms[x].p[1], atoms[x].p[2], arr[x]], v * 4);
      lb.set([0, 0, 0, arr[y]], v * 4);
    }
  });
  return {
    nAtoms: atoms.length,
    atomAttrs: {aP: {data: pts, size: 4}, aSc: {data: sc, size: 4}},
    nBondV: bonds.length * 2,
    bondAttrs: {aA: {data: la, size: 4}, aB: {data: lb, size: 4}},
  };
};

const LAT_XF = /* glsl */ `
vec3 latXf(vec3 p){
  p.xz = rot(uSpin) * p.xz;
  p.yz = rot(.45) * p.yz;
  return uC + p * uS;
}
`;
const LAT_ATOMS = /* glsl */ `
  float k = clamp((uP - aSc.w * .75) / .25, 0., 1.);
  float ke = 1. - pow(1. - k, 3.);
  vec3 home = latXf(aP.xyz);
  vec3 from = uC + aSc.xyz * uS;
  pos = mix(from, home, ke);
  float snap = exp(-pow((k - .98) * 16., 2.)) * step(.9, k);
  bool big = aP.w < .5;
  color = big ? vec3(.96, .76, .48) : vec3(.98, .92, .82);
  color = mix(vec3(.5, .56, .66), color, ke);
  size = (big ? 6.5 : 4.2) * uS + snap * 6.;
  alpha = (.15 + .85 * ke) * uOp * step(.001, k) * (1. + snap);
`;
const LAT_BONDS = /* glsl */ `
  pos = latXf(aA.xyz);
  float on = min(clamp((uP - aA.w * .75) / .25, 0., 1.), clamp((uP - aB.w * .75) / .25, 0., 1.));
  color = vec3(.95, .66, .42);
  alpha = step(.999, on) * .55 * uOp;
`;

export const Lattice: React.FC<{u: Record<string, number | number[]>}> = ({u}) => {
  const L = useMemo(() => buildLattice(), []);
  return (
    <>
      <GLines count={L.nBondV} attrs={L.bondAttrs} body={LAT_BONDS} uniforms={u} glsl={LAT_XF} renderOrder={6} />
      <GPoints count={L.nAtoms} attrs={L.atomAttrs} body={LAT_ATOMS} uniforms={u} glsl={LAT_XF} sprite="spark" renderOrder={7} />
    </>
  );
};

// ---------- surface frame for the energy landscape ----------
export type Frame = {n0: THREE.Vector3; t0: THREE.Vector3; b0: THREE.Vector3};
export const surfaceFrame = (n: V3): Frame => {
  const n0 = new THREE.Vector3(...n).normalize();
  const t0 = new THREE.Vector3(0, 1, 0).sub(n0.clone().multiplyScalar(n0.y)).normalize();
  const b0 = new THREE.Vector3().crossVectors(t0, n0).normalize();
  return {n0, t0, b0};
};
export const surfDir = (f: Frame, beta: number, gamma: number) =>
  f.n0
    .clone()
    .multiplyScalar(Math.cos(beta))
    .add(f.t0.clone().multiplyScalar(Math.sin(beta) * Math.cos(gamma)))
    .add(f.b0.clone().multiplyScalar(Math.sin(beta) * Math.sin(gamma)))
    .normalize();

const SURF_VERT = /* glsl */ `
attribute vec4 aK;
varying vec3 vN; varying vec3 vW; varying vec4 vK;
void main(){
  vK = aK;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
// aK: x = sweep coordinate (-1..1 across the view), y = kind (0 tower, 1 blade, 2 panel), z,w = panel uv
const SURF_FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying vec4 vK;
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.) N = -N;
  float lit = smoothstep(uSweep - .25, uSweep, -vK.x) * 0. + smoothstep(vK.x - .05, vK.x + .2, uSweep);
  float band = exp(-pow((vK.x - uSweep) * 5., 2.));
  float rim = pow(1. - max(dot(N, V), 0.), 2.);
  vec3 L = normalize(uSun);
  float dif = max(dot(N, L), 0.);
  vec3 col;
  if (vK.y > 1.5) {
    vec2 g = fract(vK.zw * vec2(6., 3.));
    float cellLine = smoothstep(.08, .0, min(min(g.x, 1. - g.x), min(g.y, 1. - g.y)));
    vec3 glass = mix(vec3(.02, .035, .07), vec3(.05, .08, .14), dif);
    vec3 R = reflect(-V, N);
    float glint = pow(max(dot(R, L), 0.), 12.);
    col = glass + vec3(.25, .32, .45) * cellLine * .35;
    col += vec3(1., .78, .5) * (glint * 1.2 + cellLine * .5 + .12) * lit + vec3(1., .85, .6) * band * .9;
  } else {
    col = vec3(.018, .02, .028) + vec3(.35, .42, .55) * rim * .35 * (1. - lit);
    col += vec3(1., .7, .42) * (rim * .9 + dif * .25) * lit + vec3(1., .8, .55) * band * .6;
  }
  gl_FragColor = vec4(col * uOp, uOp);
}`;

const tagGeo = (g: THREE.BufferGeometry, sweep: number, kind: number, uv?: (x: number, y: number, z: number) => [number, number]) => {
  const n = g.attributes.position.count;
  const k = new Float32Array(n * 4);
  const p = g.attributes.position.array as Float32Array;
  for (let i = 0; i < n; i++) {
    const w = uv ? uv(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]) : [0, 0];
    k.set([sweep, kind, w[0], w[1]], i * 4);
  }
  g.setAttribute('aK', new THREE.BufferAttribute(k, 4));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
};

// Places a local-geometry (y = up) at a surface point, oriented along the normal.
const place = (g: THREE.BufferGeometry, C: THREE.Vector3, dir: THREE.Vector3, facing: THREE.Vector3, lift = 0) => {
  const up = dir.clone();
  const fwd = facing.clone().sub(up.clone().multiplyScalar(facing.dot(up))).normalize();
  const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const m = new THREE.Matrix4().makeBasis(right, up, fwd);
  m.setPosition(C.clone().add(dir.clone().multiplyScalar(6 + lift)));
  g.applyMatrix4(m);
  return g;
};

const TURB = [
  {b: 0.47, g: -0.3},
  {b: 0.5, g: -0.16},
  {b: 0.46, g: -0.02},
  {b: 0.52, g: 0.1},
  {b: 0.48, g: 0.24},
  {b: 0.53, g: 0.36},
  {b: 0.41, g: 0.3},
];

export const buildLandscape = (C: THREE.Vector3, f: Frame, camDir: THREE.Vector3) => {
  const towers: THREE.BufferGeometry[] = [];
  const hubs: {pos: THREE.Vector3; axis: THREE.Vector3; sweep: number}[] = [];
  TURB.forEach((tb, i) => {
    const dir = surfDir(f, tb.b, tb.g);
    const h = 0.3 + 0.04 * rnd(`th${i}`);
    const tower = new THREE.CylinderGeometry(0.006, 0.013, h, 6);
    tower.translate(0, h / 2 - 0.01, 0);
    const nac = new THREE.BoxGeometry(0.022, 0.018, 0.045);
    nac.translate(0, h, 0);
    const sweep = tb.g / 0.4;
    const g = mergeGeometries([tower.toNonIndexed(), nac.toNonIndexed()].map((x) => (x.deleteAttribute('uv'), x)))!;
    towers.push(tagGeo(place(g, C, dir, camDir), sweep, 0));
    const hubPos = C.clone().add(dir.clone().multiplyScalar(6 + h));
    hubs.push({pos: hubPos, axis: camDir.clone().sub(dir.clone().multiplyScalar(camDir.dot(dir))).normalize(), sweep});
  });
  // solar fields: rows of tilted panels
  const panels: THREE.BufferGeometry[] = [];
  const FIELDS = [
    {b: 0.2, g: -0.22},
    {b: 0.24, g: 0.02},
    {b: 0.19, g: 0.24},
    {b: 0.31, g: -0.1},
    {b: 0.33, g: 0.16},
  ];
  FIELDS.forEach((fd, fi) => {
    const dir = surfDir(f, fd.b, fd.g);
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 14; c++) {
        const pg = new THREE.PlaneGeometry(0.034, 0.02);
        pg.rotateX(-Math.PI / 2 + 0.55);
        pg.translate((c - 6.5) * 0.04, 0.006, (r - 2.5) * 0.034);
        const uvf = (x: number, _y: number, z: number): [number, number] => [(x + 0.017) / 0.034, (z + 0.01) / 0.02];
        tagGeo(pg, fd.g / 0.4 + (c - 6.5) * 0.012, 2, uvf);
        panels.push(pg);
      }
    const merged = mergeGeometries(panels.splice(0, panels.length).map((x) => x.toNonIndexed()))!;
    panels.push(place(merged, C, dir, camDir));
    void fi;
  });
  return {towers: mergeGeometries(towers)!, panels: mergeGeometries(panels)!, hubs};
};

const BLADES = (() => {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const b = new THREE.BoxGeometry(0.008, 0.15, 0.003);
    b.translate(0, 0.075, 0);
    b.rotateZ((k * Math.PI * 2) / 3);
    parts.push(b.toNonIndexed());
  }
  parts.forEach((p) => p.deleteAttribute('uv'));
  return mergeGeometries(parts)!;
})();

export const Landscape: React.FC<{C: V3; frame: Frame; camDir: V3; t: number; sweep: number; op: number; sun: V3}> = ({C, frame, camDir, t, sweep, op, sun}) => {
  const L = useMemo(() => buildLandscape(new THREE.Vector3(...C), frame, new THREE.Vector3(...camDir).normalize()), [C, frame, camDir]);
  const bladeGeos = useMemo(() => L.hubs.map((h) => tagGeo(BLADES.clone(), h.sweep, 1)), [L]);
  const u = {uSweep: sweep, uOp: op, uSun: sun as number[]};
  return (
    <>
      <GMesh geometry={L.towers} vert={SURF_VERT} frag={SURF_FRAG} uniforms={u} transparent renderOrder={4} />
      <GMesh geometry={L.panels} vert={SURF_VERT} frag={SURF_FRAG} uniforms={u} transparent renderOrder={4} side="double" />
      {L.hubs.map((h, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), h.axis);
        const spin = new THREE.Quaternion().setFromAxisAngle(h.axis, t * (1.4 + 0.3 * i) + i);
        const e = new THREE.Euler().setFromQuaternion(spin.multiply(q));
        return <GMesh key={i} geometry={bladeGeos[i]} vert={SURF_VERT} frag={SURF_FRAG} uniforms={u} transparent renderOrder={4} side="double" position={[h.pos.x, h.pos.y, h.pos.z]} rotation={[e.x, e.y, e.z]} />;
      })}
    </>
  );
};

// ---------- warm orbit ring ----------
const RING_N = 240;
export const ringAttrs = () => {
  const a = new Float32Array(RING_N * 2);
  for (let i = 0; i < RING_N; i++) {
    a[i * 2] = i / RING_N;
    a[i * 2 + 1] = (i + 1) / RING_N;
  }
  const s = new Float32Array(RING_N * 2);
  for (let i = 0; i < RING_N; i++) {
    s[i * 2] = i / RING_N;
    s[i * 2 + 1] = (i + 1) / RING_N;
  }
  return {aS: {data: s, size: 1}};
};
export const ringPoint = (C: V3, r: number, tilt: number, s: number, phase: number): V3 => {
  const a = s * Math.PI * 2 + phase;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  const y = -z * Math.sin(tilt);
  return [C[0] + x, C[1] + y, C[2] + z * Math.cos(tilt)];
};
const RING = /* glsl */ `
  float a = aS * TAU + uPh;
  vec3 p = vec3(cos(a) * uR, 0., sin(a) * uR);
  p = vec3(p.x, -p.z * sin(uTilt), p.z * cos(uTilt));
  pos = uC + p;
  float behind = uProg - aS;
  float vis = step(0., behind);
  vec3 cc = uC;
  float front = step(0., dot(normalize(pos - cc), normalize(cameraPosition - cc)) + .15 * 0.);
  float occl = 1. - step(length(cross(pos - cameraPosition, normalize(cc - cameraPosition))), uPR) * step(length(cc - cameraPosition), length(pos - cameraPosition));
  color = mix(vec3(.93, .54, .37), vec3(1., .86, .6), exp(-behind * 6.));
  alpha = vis * (.35 + .65 * exp(-behind * 4.)) * uOp * occl;
`;
export const Ring: React.FC<{u: Record<string, number | number[]>}> = ({u}) => {
  const a = useMemo(() => ringAttrs(), []);
  return <GLines count={RING_N * 2} attrs={a} body={RING} uniforms={u} renderOrder={8} />;
};

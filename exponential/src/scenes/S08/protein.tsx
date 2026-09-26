// V1 · DISEASE. A cold tangled strand folds, residue by residue behind the hero's light, into a protein
// cartoon (three helices + a three-stranded sheet with arrowheads) rendered as a lit 3D ribbon mesh.
// A DNA double helix turns in the background; small molecules dock into the finished fold.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {GLines, GMesh, GPoints, V3} from '../S07/gl';

type Res = {p: THREE.Vector3; ss: 0 | 1 | 2; hint: THREE.Vector3 | null; arrowK: number};

// ---------- backbone ----------
const helix = (a: V3, b: V3, out: Res[]) => {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const n = Math.round(dir.length() / 0.15);
  dir.normalize();
  const u1 = new THREE.Vector3(0, 0, 1).cross(dir);
  if (u1.lengthSq() < 1e-4) u1.set(1, 0, 0);
  u1.normalize();
  const u2 = dir.clone().cross(u1).normalize();
  for (let k = 0; k <= n; k++) {
    const ang = (k * 100 * Math.PI) / 180;
    const radial = u1.clone().multiplyScalar(Math.cos(ang)).add(u2.clone().multiplyScalar(Math.sin(ang)));
    const p = A.clone().add(dir.clone().multiplyScalar(k * 0.15)).add(radial.clone().multiplyScalar(0.23));
    out.push({p, ss: 1, hint: radial, arrowK: 0});
  }
};
const strand = (a: V3, b: V3, sheetN: V3, out: Res[]) => {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const n = Math.max(3, Math.round(A.distanceTo(B) / 0.33));
  const N = new THREE.Vector3(...sheetN).normalize();
  for (let k = 0; k <= n; k++) {
    const p = A.clone().lerp(B, k / n).add(N.clone().multiplyScalar(k % 2 ? 0.04 : -0.04));
    out.push({p, ss: 2, hint: N.clone(), arrowK: k / n});
  }
};
const loop = (out: Res[], to: THREE.Vector3, bulge: V3) => {
  const a = out[out.length - 1].p;
  const mid = a.clone().add(to).multiplyScalar(0.5).add(new THREE.Vector3(...bulge));
  const c = new THREE.CatmullRomCurve3([a, mid, to]);
  const n = Math.max(3, Math.round(c.getLength() / 0.3));
  for (let k = 1; k < n; k++) out.push({p: c.getPoint(k / n), ss: 0, hint: null, arrowK: 0});
};

const buildBackbone = () => {
  const r: Res[] = [];
  r.push({p: new THREE.Vector3(-1.7, -1.5, 0.9), ss: 0, hint: null, arrowK: 0});
  const seq: [string, V3, V3, V3?][] = [
    ['h', [-1.05, -1.1, 0.35], [-1.05, 1.15, 0.35]],
    ['h', [-0.3, 1.2, -0.45], [-0.3, -1.1, -0.45]],
    ['s', [0.42, -1.0, 0.55], [0.42, 0.95, 0.55], [0.15, 0, 1]],
    ['s', [0.88, 0.95, 0.5], [0.88, -1.0, 0.5], [0.15, 0, 1]],
    ['s', [1.34, -1.0, 0.42], [1.34, 0.95, 0.42], [0.15, 0, 1]],
    ['h', [0.95, 1.25, -0.8], [0.95, -1.05, -0.8]],
  ];
  const bulges: V3[] = [
    [-0.5, -0.3, 0.3],
    [-0.1, 0.55, 0.2],
    [0, -0.55, 0.5],
    [0, 0.3, 0.25],
    [0, -0.3, 0.25],
    [0.3, 0.5, -0.3],
  ];
  seq.forEach((e, i) => {
    const start = new THREE.Vector3(...e[1]);
    loop(r, start, bulges[i]);
    if (e[0] === 'h') helix(e[1], e[2], r);
    else strand(e[1], e[2], e[3]!, r);
  });
  loop(r, new THREE.Vector3(1.6, -1.6, -0.2), [0.4, -0.2, 0.3]);
  r.push({p: new THREE.Vector3(1.6, -1.6, -0.2), ss: 0, hint: null, arrowK: 0});
  return r;
};

export const SAMPLES = 460;
const RAD = 10;

type Sample = {pf: THREE.Vector3; hint: THREE.Vector3 | null; w: number; h: number; s: number};
const buildSamples = (): Sample[] => {
  const res = buildBackbone();
  const curve = new THREE.CatmullRomCurve3(
    res.map((r) => r.p),
    false,
    'catmullrom',
    0.5
  );
  const out: Sample[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / (SAMPLES - 1);
    const fi = u * (res.length - 1);
    const r = res[Math.round(fi)];
    let w = 0.045;
    let h = 0.045;
    let hint: THREE.Vector3 | null = null;
    const pf = curve.getPoint(u);
    if (r.ss === 1) {
      w = 0.2;
      h = 0.035;
      // radial hint: away from the local helix axis (approximate by neighbours' centroid)
      const lo = Math.max(0, Math.round(fi) - 2);
      const hi = Math.min(res.length - 1, Math.round(fi) + 2);
      const cen = new THREE.Vector3();
      for (let k = lo; k <= hi; k++) cen.add(res[k].p);
      cen.multiplyScalar(1 / (hi - lo + 1));
      hint = pf.clone().sub(cen).normalize();
    } else if (r.ss === 2) {
      const ak = r.arrowK;
      w = ak < 0.62 ? 0.17 : ak < 0.66 ? 0.28 : 0.28 * (1 - (ak - 0.66) / 0.34) + 0.03;
      h = 0.035;
      hint = r.hint;
    }
    out.push({pf, hint, w, h, s: u});
  }
  // light smoothing of the section size so helix/loop joins are soft (arrowheads stay sharp-ish)
  const ws = out.map((o) => o.w);
  const hs = out.map((o) => o.h);
  for (let i = 2; i < out.length - 2; i++) {
    out[i].w = (ws[i - 1] + ws[i] * 2 + ws[i + 1]) / 4;
    out[i].h = (hs[i - 2] + hs[i - 1] + hs[i] + hs[i + 1] + hs[i + 2]) / 5;
  }
  return out;
};

// the tangled (unfolded, cold) state of the same chain
const tangled = (s: number, t: number, out: THREE.Vector3) => {
  const a = s * 1.0;
  const w = t * 0.35;
  return out.set(
    1.5 * Math.sin(a * 7.1 + 1.3 + w) + 0.7 * Math.sin(a * 17.3 - w * 1.3) + 0.25 * Math.sin(a * 41 + w * 2),
    1.3 * Math.sin(a * 5.3 + 0.4 - w * 0.8) + 0.6 * Math.sin(a * 13.7 + 2 + w) + 0.25 * Math.sin(a * 37 + 1 - w * 2.2),
    0.9 * Math.sin(a * 6.2 + 2.2 + w * 0.6) + 0.5 * Math.sin(a * 19.1 + 1 - w) + 0.2 * Math.sin(a * 45 + w * 1.7)
  );
};

const RIB_VERT = /* glsl */ `
attribute float aS; attribute float aM;
varying vec3 vN; varying vec3 vW; varying float vS; varying float vM;
void main(){
  vS = aS; vM = aM;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const RIB_FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying float vS; varying float vM;
vec3 warmRamp(float s){
  vec3 a = vec3(.71, .33, .23), b = vec3(.85, .47, .34), c = vec3(.93, .54, .37), d = vec3(.96, .76, .48);
  return s < .33 ? mix(a, b, s / .33) : s < .66 ? mix(b, c, (s - .33) / .33) : mix(c, d, (s - .66) / .34);
}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  if (dot(N, V) < 0.) N = -N;
  vec3 L1 = normalize(vec3(-.55, .75, .7));
  vec3 L2 = normalize(vec3(.8, -.3, .4));
  float dif = max(dot(N, L1), 0.);
  float fil = max(dot(N, L2), 0.);
  float spec = pow(max(dot(N, normalize(L1 + V)), 0.), 36.);
  float rim = pow(1. - max(dot(N, V), 0.), 2.6);
  vec3 warm = warmRamp(vS);
  vec3 cold = vec3(.34, .40, .48);
  vec3 base = mix(cold, warm, vM);
  vec3 col = base * (.10 + .95 * dif) + base * fil * .22;
  col += mix(vec3(.55, .65, .8), vec3(1., .9, .74), vM) * spec * .55;
  col += mix(vec3(.35, .45, .62), vec3(1., .72, .45), vM) * rim * (.35 + .5 * vM);
  col += warm * vM * .12;
  float hot = exp(-pow((vS - uFront) * 22., 2.)) * uHot;
  col += vec3(1., .82, .55) * hot * 1.4;
  gl_FragColor = vec4(col * uOp, uOp);
}`;

export const Protein: React.FC<{t: number; front: number; hot: number; op: number}> = ({t, front, hot, op}) => {
  const samples = useMemo(() => buildSamples(), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const nv = SAMPLES * RAD;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
    g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(nv), 1));
    g.setAttribute('aM', new THREE.BufferAttribute(new Float32Array(nv), 1));
    const idx: number[] = [];
    for (let i = 0; i < SAMPLES - 1; i++)
      for (let k = 0; k < RAD; k++) {
        const a = i * RAD + k;
        const b = i * RAD + ((k + 1) % RAD);
        const c = (i + 1) * RAD + k;
        const d = (i + 1) * RAD + ((k + 1) % RAD);
        idx.push(a, c, b, b, c, d);
      }
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
    return g;
  }, []);

  // ---- per-frame rebuild (deterministic) ----
  const P: THREE.Vector3[] = [];
  const M: number[] = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i < SAMPLES; i++) {
    const s = samples[i];
    const m = Math.min(1, Math.max(0, (front - s.s) / 0.1));
    const me = 1 - Math.pow(1 - m, 3);
    tangled(s.s, t, tmp);
    P.push(tmp.clone().lerp(s.pf, me));
    M.push(me);
  }
  const pos = geo.attributes.position.array as Float32Array;
  const nor = geo.attributes.normal.array as Float32Array;
  const aS = geo.attributes.aS.array as Float32Array;
  const aM = geo.attributes.aM.array as Float32Array;
  let Nprev = new THREE.Vector3(0, 0, 1);
  const T = new THREE.Vector3();
  const B = new THREE.Vector3();
  const N = new THREE.Vector3();
  for (let i = 0; i < SAMPLES; i++) {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(SAMPLES - 1, i + 1)];
    T.copy(b).sub(a).normalize();
    // parallel transport of the previous normal
    N.copy(Nprev).sub(T.clone().multiplyScalar(Nprev.dot(T)));
    if (N.lengthSq() < 1e-6) N.set(T.y, -T.x, 0);
    N.normalize();
    const hint = samples[i].hint;
    if (hint && M[i] > 0) {
      const hN = hint.clone().sub(T.clone().multiplyScalar(hint.dot(T)));
      if (hN.lengthSq() > 1e-6) {
        hN.normalize();
        if (hN.dot(N) < 0 && samples[i].w > 0.1 && false) hN.negate();
        N.lerp(hN, M[i]).normalize();
      }
    }
    Nprev = N.clone();
    B.copy(T).cross(N).normalize();
    // section: ellipse, width along B (ribbon face normal = N)
    const w = 0.03 + (samples[i].w - 0.03) * M[i];
    const h = 0.03 + (samples[i].h - 0.03) * M[i];
    for (let k = 0; k < RAD; k++) {
      const th = (k / RAD) * Math.PI * 2;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const o = (i * RAD + k) * 3;
      pos[o] = P[i].x + B.x * c * w + N.x * sn * h;
      pos[o + 1] = P[i].y + B.y * c * w + N.y * sn * h;
      pos[o + 2] = P[i].z + B.z * c * w + N.z * sn * h;
      const nx = (B.x * c) / w + (N.x * sn) / h;
      const ny = (B.y * c) / w + (N.y * sn) / h;
      const nz = (B.z * c) / w + (N.z * sn) / h;
      const l = Math.hypot(nx, ny, nz) || 1;
      nor[o] = nx / l;
      nor[o + 1] = ny / l;
      nor[o + 2] = nz / l;
      aS[i * RAD + k] = samples[i].s;
      aM[i * RAD + k] = M[i];
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.normal.needsUpdate = true;
  geo.attributes.aS.needsUpdate = true;
  geo.attributes.aM.needsUpdate = true;

  return <GMesh geometry={geo} vert={RIB_VERT} frag={RIB_FRAG} uniforms={{uFront: front, uHot: hot, uOp: op}} transparent={op < 0.999} renderOrder={2} side="double" />;
};

// Position on the chain at parameter s (used to pin the hero spark to the fold front).
export const chainPoint = (s: number, t: number, front: number): V3 => {
  const samples = CACHE.get();
  const i = Math.min(SAMPLES - 1, Math.max(0, Math.round(s * (SAMPLES - 1))));
  const m = Math.min(1, Math.max(0, (front - samples[i].s) / 0.1));
  const me = 1 - Math.pow(1 - m, 3);
  const v = tangled(samples[i].s, t, new THREE.Vector3()).lerp(samples[i].pf, me);
  return [v.x, v.y, v.z];
};
const CACHE = (() => {
  let c: Sample[] | null = null;
  return {get: () => (c ??= buildSamples())};
})();

// ---------- DNA double helix (background, defocused) ----------
export const DNA_BODY = /* glsl */ `
  float u = aSeed.x;
  float which = aSeed.y < .4 ? 0. : (aSeed.y < .8 ? 1. : 2.);
  vec3 A = vec3(-10., -4.2, -7.5), B = vec3(9., 4.8, -10.);
  vec3 ax = normalize(B - A);
  vec3 e1 = normalize(cross(ax, vec3(0., 0., 1.)));
  vec3 e2 = cross(ax, e1);
  float turns = 7.;
  float rungU = (floor(u * 110.) + .5) / 110.;
  float uu = which > 1.5 ? rungU : u;
  float ang = uu * TAU * turns + uT * .5;
  vec3 c = A + (B - A) * uu;
  vec3 s0 = c + (cos(ang) * e1 + sin(ang) * e2) * .95;
  vec3 s1 = c + (cos(ang + 2.4) * e1 + sin(ang + 2.4) * e2) * .95;
  pos = which < .5 ? s0 : (which < 1.5 ? s1 : mix(s0, s1, aSeed.z));
  pos += (aSeed2.xyz - .5) * .06;
  float warm = smoothstep(uSweep - .12, uSweep, u) * 0. + (1. - smoothstep(uSweep - .02, uSweep + .1, u));
  vec3 cold = vec3(.42, .52, .66);
  vec3 wc = mix(vec3(.93, .54, .37), vec3(.96, .76, .48), aSeed2.w);
  color = mix(cold, wc, warm);
  float rung = step(1.5, which);
  size = mix(9., 7., rung) * (.8 + aSeed2.x * .5);
  alpha = (rung > .5 ? .05 : .09) * (1. + warm * .8) * uOp;
`;

// ---------- small molecules that dock into the fold ----------
type Mol = {atoms: V3[]; bonds: [number, number][]};
const ring = (n: number, r: number, extra: V3[] = []): Mol => {
  const atoms: V3[] = [];
  for (let i = 0; i < n; i++) atoms.push([Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r, 0]);
  const bonds: [number, number][] = atoms.map((_, i) => [i, (i + 1) % n]);
  extra.forEach((e, k) => {
    atoms.push(e);
    bonds.push([k === 0 ? 0 : n + k - 1, n + k]);
  });
  return {atoms, bonds};
};
export const MOLS: Mol[] = [
  ring(6, 0.14, [[0.27, 0, 0.04], [0.4, 0.09, 0.06]]),
  ring(5, 0.12, [[0.23, -0.05, 0.05]]),
  {atoms: [[0, 0, 0], [0.13, 0.08, 0], [0.26, 0, 0.05], [0.39, 0.08, 0.02], [0.13, 0.22, -0.04]], bonds: [[0, 1], [1, 2], [2, 3], [1, 4]]},
];

export const molAttrs = () => {
  const pts: number[] = [];
  const lines: number[] = [];
  MOLS.forEach((m, mi) => {
    m.atoms.forEach((a, ai) => pts.push(a[0], a[1], a[2], mi + ai * 0.01));
    m.bonds.forEach(([x, y]) => {
      const A = m.atoms[x];
      const B = m.atoms[y];
      lines.push(A[0], A[1], A[2], mi, B[0], B[1], B[2], mi);
    });
  });
  return {
    pts: {aOff: {data: new Float32Array(pts), size: 4}},
    nPts: pts.length / 4,
    lines: {aOff: {data: new Float32Array(lines), size: 4}},
    nLines: lines.length / 4,
  };
};

// uMk: molecule k centre (xyz) + dock progress (w); uRk: rotation angle
const MOL_POS = /* glsl */ `
  float mi = floor(aOff.w + .001);
  vec4 M = mi < .5 ? uM0 : (mi < 1.5 ? uM1 : uM2);
  float rr = mi < .5 ? uR.x : (mi < 1.5 ? uR.y : uR.z);
  vec3 o = aOff.xyz;
  o.xy = rot(rr) * o.xy; o.xz = rot(rr * .7 + mi) * o.xz;
  pos = M.xyz + o;
  float dock = M.w;
  float pulse = exp(-pow((dock - .98) * 30., 2.)) * step(.9, dock);
`;
export const MOL_PTS = /* glsl */ `
  ${MOL_POS}
  color = mix(vec3(.72, .82, .95), vec3(1., .82, .55), smoothstep(.6, 1., dock));
  size = 2.6 + pulse * 3.;
  alpha = uOp * (.8 + pulse);
`;
export const MOL_LINES = /* glsl */ `
  ${MOL_POS}
  color = mix(vec3(.6, .72, .9), vec3(1., .75, .45), smoothstep(.6, 1., dock));
  alpha = uOp * .75;
`;

export const Molecules: React.FC<{u: Record<string, number | number[]>}> = ({u}) => {
  const m = useMemo(() => molAttrs(), []);
  return (
    <>
      <GLines count={m.nLines} attrs={m.lines} body={MOL_LINES} uniforms={u} renderOrder={4} />
      <GPoints count={m.nPts} attrs={m.pts} body={MOL_PTS} uniforms={u} sprite="spark" renderOrder={5} />
    </>
  );
};

// sparks shed at the fold front
export const SPARKS = /* glsl */ `
  float life = fract(aSeed.x + uT * (.9 + aSeed.y * .6));
  vec3 dir = normalize(aSeed2.xyz - .5);
  pos = uP + dir * life * (.25 + aSeed.z * .6) + vec3(0., life * .15, 0.);
  color = mix(vec3(1., .9, .7), vec3(.93, .54, .37), life);
  size = 2.4 * (1. - life) + .6;
  alpha = (1. - life) * uI * .8;
`;

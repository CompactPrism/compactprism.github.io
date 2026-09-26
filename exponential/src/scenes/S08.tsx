// S08 · BATTLES. Four vignettes, each cold until the hero's warm light passes through it.
// V1 disease: a tangled strand folds into a protein behind the light · V2 ignorance: a field of minds lights
// up, greeting in many languages · V3 poverty: the field rolls up into a globe; light reaches the most
// remote nodes · V4 planet: a new material assembles, turbines and solar fields catch the light, the smog
// clears. Transitions are camera moves and match-shapes (strand -> dive -> field -> globe -> planet).
import React from 'react';
import * as THREE from 'three';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ShaderCanvas} from '../lib/ShaderCanvas';
import {ClaudeSpark} from '../lib/ClaudeSpark';
import {useScene} from '../lib/timing';
import {C, F, rgba} from '../theme';
import {E, clamp, drift, lerp, prog, ramp} from '../lib/anim';
import {BEATS, at} from './S07/beats';
import {Cam, CamSpec, GPoints, lerp3, makeCamera, project, pxPerUnit, spline, unprojectAt, V3} from './S07/gl';
import {Globe} from './S07/globe';
import {BG} from './S08/bg';
import {DNA_BODY, Molecules, Protein, SPARKS, chainPoint, elementS} from './S08/protein';
import {R, Wave, World, arcPoint, arriveJS, buildArcs, embedJS, planeToSphere, worldUniforms} from './S08/world';
import {Landscape, Lattice, Ring, ringPoint, surfDir, surfaceFrame} from './S08/planet4';
import {Card, CardBody, CardHead, CardSource, CardTitle, CaseTag, Dial, HitRate, Leader, fadeWin} from './S08/cards';

// On-screen facts, all from research/FACTS.md (see §16 and §18, "Safe on-screen facts" #27, #29, #21):
//  - Sep 2026: ~950 Claude agents, 21 hours -> a new CRISPR-like enzyme system (preprint, not yet peer-reviewed)
//  - Sep 2026: Claude-designed protein binders, ~50% hit rate vs a typical 10-15%
//  - Jan 2026: Teach For All, AI training for educators in 63 countries
//  - Claude's constitution (Jan 2026): "a brilliant friend who happens to have the knowledge of a doctor, lawyer, financial advisor..."

const O: V3 = [0, -14, 0]; // V2 field origin (north pole of the rolled-up globe)
const CEN: V3 = [0, -14 - R, 0]; // globe centre
const SITE = surfaceFrame([-0.22, 0.5, 0.84]); // where the energy landscape stands on the planet
const SUN: V3 = [-0.75, 0.5, 0.35];

const GREET: {w: string; f: string; u: number; v: number; lift: number}[] = [
  {w: 'Hello', f: F.serif, u: -0.6, v: -2.2, lift: 0.22},
  {w: 'Hola', f: F.serif, u: 1.5, v: -3.0, lift: 0.3},
  {w: 'Bonjour', f: F.serif, u: -2.6, v: -3.6, lift: 0.28},
  {w: '你好', f: "'WenQuanYi Zen Hei', sans-serif", u: 2.2, v: -4.2, lift: 0.36},
  {w: 'नमस्ते', f: "'FreeSerif', serif", u: -1.0, v: -5.2, lift: 0.38},
  {w: 'Habari', f: F.serif, u: 0.9, v: -6.3, lift: 0.36},
  {w: 'مرحبا', f: "'FreeSerif', serif", u: -3.9, v: -6.8, lift: 0.42},
  {w: 'Olá', f: F.serif, u: 3.3, v: -6.4, lift: 0.42},
  {w: 'こんにちは', f: "'IPAGothic', sans-serif", u: 2.2, v: -8.6, lift: 0.46},
  {w: '안녕하세요', f: "'WenQuanYi Zen Hei', sans-serif", u: -2.3, v: -9.0, lift: 0.46},
  {w: 'Привет', f: "'FreeSerif', serif", u: 0.1, v: -10.4, lift: 0.5},
  {w: 'Sawubona', f: F.serif, u: 3.6, v: -10.2, lift: 0.52},
];

// V3 long-haul arcs: from the edge of the lit region to remote nodes (sphere-local directions)
const sd = (th: number, ph: number): V3 => [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
const ARCS = [
  {from: sd(1.55, 1.2), to: sd(2.35, 1.55)},
  {from: sd(1.55, 0.6), to: sd(2.05, 0.35)},
  {from: sd(1.55, 1.9), to: sd(2.55, 2.3)},
  {from: sd(1.55, 2.6), to: sd(1.95, 3.1)},
  {from: sd(1.55, 0.1), to: sd(2.75, 0.9)},
];
const CHIPS = ['DOCTOR', 'LAWYER', 'FINANCIAL ADVISOR'];

const hermite = spline;

export const S08: React.FC = () => {
  const {t, dur, cue, end} = useScene('S08');
  const b = (L: 'L19' | 'L20' | 'L21' | 'L22', f: number) => at(cue, end, L, f);
  const c20 = cue('L20');
  const c21 = cue('L21');
  const c22 = cue('L22');
  // V1 beats
  const dec0 = b('L19', BEATS.L19.decode);
  const disc = b('L19', BEATS.L19.discover);
  const foldEnd = disc - 0.35;
  const front = ramp(t, [dec0 - 0.1, foldEnd], [-0.06, 1.13], E.inOut);
  // V2 beats
  const named2 = b('L20', BEATS.L20.named);
  const tutor = b('L20', BEATS.L20.tutor);
  const hour = b('L20', BEATS.L20.hour);
  // V3 beats
  const named3 = b('L21', BEATS.L21.named);
  const help = b('L21', BEATS.L21.help);
  const reach = b('L21', BEATS.L21.reach);
  // V4 beats
  const mats = b('L22', BEATS.L22.materials);
  const energy = b('L22', BEATS.L22.energy);
  const smarter = b('L22', BEATS.L22.smarter);
  const e22 = end('L22');

  const wave: Wave = {
    tA: named2 + 0.05,
    tB: hour + 0.1,
    rho1: 6.5,
    tC: named3 + 0.1,
    tD: reach + 1.3,
    speed: 3.4,
    src: ARCS.map((a, k) => [...a.to, help + 0.1 + k * 0.42 + 0.9] as [number, number, number, number]),
  };

  // ---------------- cameras ----------------
  const dr = drift(t, 0.05, 7);
  const aOrb = lerp(-0.34, 0.24, prog(t, 0, c20, E.inOut));
  const cam1: CamSpec = {pos: [8.3 * Math.sin(aOrb) + dr.x, 0.8 + dr.y, 8.3 * Math.cos(aOrb)], target: [-1.2, 0.08, 0], fov: 40};
  const k2 = prog(t, c20, c21, E.linear);
  const cam2: CamSpec = {pos: [O[0] + 0.35 * Math.sin(t * 0.25) + dr.x, O[1] + 1.05 - 0.15 * k2 + dr.y, O[2] + 3.0 - 1.4 * k2], target: [O[0] + 0.2, O[1] - 0.12, O[2] - 8], fov: 42};
  const dirV3 = (k: number) => new THREE.Vector3().lerpVectors(new THREE.Vector3(0.05, 0.62, 0.78), new THREE.Vector3(0.3, -0.1, 0.95), k).normalize();
  const k3 = prog(t, c21, c22 + 0.3, E.inOut);
  const d3 = dirV3(k3);
  const dist3 = 29 - 2 * k3;
  const cam3: CamSpec = {pos: [CEN[0] + d3.x * dist3 + dr.x, CEN[1] + d3.y * dist3 + dr.y, CEN[2] + d3.z * dist3], target: [CEN[0] - 5.4, CEN[1] + 0.2, CEN[2]], fov: 40};
  // V4 keyframes
  const n0 = SITE.n0;
  const t0v = SITE.t0;
  const V = (v: THREE.Vector3): V3 => [CEN[0] + v.x, CEN[1] + v.y, CEN[2] + v.z];
  const d3end = dirV3(1);
  const horizon = surfDir(SITE, 0.64, 0).multiplyScalar(R);
  const dF = new THREE.Vector3(0.28, 0.18, 0.94).normalize();
  const posKeys = [
    {t: c22, p: V(d3end.clone().multiplyScalar(27))},
    {t: mats + 0.3, p: V(new THREE.Vector3(0.24, 0.12, 0.96).normalize().multiplyScalar(21))},
    {t: energy - 0.35, p: V(n0.clone().multiplyScalar(R + 3.4).add(t0v.clone().multiplyScalar(-2.2)))},
    {t: energy + 0.3, p: V(n0.clone().multiplyScalar(R + 1.15).add(t0v.clone().multiplyScalar(-0.4)))},
    {t: smarter + 0.35, p: V(n0.clone().multiplyScalar(R + 1.3).add(t0v.clone().multiplyScalar(0.05)).add(SITE.b0.clone().multiplyScalar(0.25)))},
    {t: smarter + 1.9, p: V(dF.clone().multiplyScalar(25))},
    {t: dur, p: V(dF.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.08).multiplyScalar(26.5))},
  ];
  const tgtKeys = [
    {t: c22, p: [CEN[0] - 5.4, CEN[1] + 0.2, CEN[2]] as V3},
    {t: mats + 0.3, p: [CEN[0] - 3.2, CEN[1] + 0.6, CEN[2]] as V3},
    {t: energy - 0.35, p: V(n0.clone().multiplyScalar(R))},
    {t: energy + 0.3, p: V(horizon.clone().add(n0.clone().multiplyScalar(0.55)))},
    {t: smarter + 0.35, p: V(horizon.clone().add(n0.clone().multiplyScalar(0.7)).add(SITE.b0.clone().multiplyScalar(0.3)))},
    {t: smarter + 1.9, p: CEN},
    {t: dur, p: CEN},
  ];
  const cam4: CamSpec = {pos: hermite(posKeys, t), target: hermite(tgtKeys, t), fov: 40};

  // blends between vignette cameras
  const x12 = prog(t, c20 - 0.85, c20 + 0.35, E.inOut);
  const x12t = prog(t, c20 - 1.0, c20 + 0.15, E.inOut);
  const x23 = prog(t, c21 - 0.55, c21 + 1.05, E.inOut);
  let spec: CamSpec;
  if (t < c20 + 0.6) spec = {pos: lerp3(cam1.pos, cam2.pos, x12), target: lerp3(cam1.target, cam2.target, x12t), fov: lerp(40, 42, x12)};
  else if (t < c21 + 1.1) spec = {pos: lerp3(cam2.pos, cam3.pos, x23), target: lerp3(cam2.target, cam3.target, x23), fov: lerp(42, 40, x23)};
  else if (t < c22) spec = cam3;
  else spec = cam4;
  const cam = makeCamera(spec);
  const fwd = new THREE.Vector3();
  cam.getWorldDirection(fwd);

  // ---------------- V1: protein ----------------
  const v1on = t < c20 + 0.7;
  const P0 = unprojectAt(makeCamera(cam1), 960, 800, 5);
  const hover: V3 = [0.4 + 0.25 * Math.sin(t * 1.3), 1.75 + 0.1 * Math.sin(t * 2.1), 0.9];
  let spark1: V3;
  if (t < dec0 - 0.55) spark1 = lerp3(P0, [P0[0] * 0.8, P0[1] + 0.25, P0[2]], prog(t, 0, dec0 - 0.55, E.out));
  else if (t < dec0) spark1 = lerp3([P0[0] * 0.8, P0[1] + 0.25, P0[2]], chainPoint(0, t, front), prog(t, dec0 - 0.55, dec0, E.inOut));
  else if (t < foldEnd) spark1 = chainPoint(clamp(front), t, front);
  else spark1 = lerp3(chainPoint(1, t, front), hover, prog(t, foldEnd, foldEnd + 0.9, E.inOut));
  const pocket: V3[] = [
    [0.66, 0.2, 1.0],
    [-0.62, -0.35, 0.78],
    [1.32, -1.25, -0.15],
  ];
  const mStart: V3[] = [
    [3.6, 1.9, 1.4],
    [-3.4, -1.9, 1.6],
    [2.8, -2.3, -0.9],
  ];
  const dockT = pocket.map((_, k) => foldEnd + 0.15 + k * 0.38);
  const molU: Record<string, number | number[]> = {uOp: fadeWin(t, 0.4, c20 + 0.2, 0.6, 0.6), uR: [t * 0.9, t * 0.7 + 1, t * 1.1 + 2]};
  pocket.forEach((pk, k) => {
    const p = prog(t, dockT[k] - 1.1, dockT[k], E.inOut);
    const wob: V3 = [Math.sin(t * 1.3 + k) * 0.25 * (1 - p), Math.cos(t * 1.1 + k * 2) * 0.2 * (1 - p), 0];
    const c = lerp3(mStart[k], pk, p);
    molU[`uM${k}`] = [c[0] + wob[0], c[1] + wob[1], c[2] + wob[2], t - dockT[k]];
  });
  const warm1 = prog(t, dec0, foldEnd + 0.5, E.inOut);

  // ---------------- V2/V3: world ----------------
  const worldOn = t > c20 - 0.4 && t < c22 + 0.7;
  const curv = prog(t, c21 - 0.6, c21 + 0.95, E.inOut);
  const rx = ramp(t, [c21 + 0.2, c22 + 0.6], [0, 0.72], E.inOut);
  const ry = (t - c21) * 0.05 * prog(t, c21, c21 + 1, E.linear);
  const worldOp = Math.min(prog(t, c20 - 0.95, c20 + 0.1, E.out), 1 - prog(t, c22 - 0.3, c22 + 0.55, E.inOut));
  const wU = worldUniforms(wave, curv, O, rx, ry, t, lerp(0.085, 0, curv), worldOp);
  const arcs = React.useMemo(() => buildArcs(ARCS.map((a, k) => ({from: a.from, to: a.to, t: help + 0.1 + k * 0.42}))), [help]);
  const arcU = {uArcDur: 0.9, uArcFade: reach + 0.8};
  // V2 spark: arrives from the dive, touches down, skims forward riding the wave front
  const touch: V3 = [O[0], O[1] + 0.12, O[2] - 0.8];
  const skimEnd: V3 = [O[0] + 0.4, O[1] + 0.35, O[2] - 0.8 - 9.2];
  let spark2: V3 = touch;
  if (t < wave.tA) spark2 = lerp3(hover, touch, prog(t, c20 - 0.8, wave.tA, E.inOut));
  else if (t < wave.tB) spark2 = lerp3(touch, skimEnd, prog(t, wave.tA, wave.tB, E.inOut));
  else spark2 = lerp3(skimEnd, [skimEnd[0], skimEnd[1] + 1.4, skimEnd[2] - 1], prog(t, wave.tB, c21, E.inOut));
  // V3 spark: rides the first long-haul arc, then hovers at the far side
  const arcHead = (k: number) => clamp((t - (help + 0.1 + k * 0.42)) / 0.9);
  const spark3 = arcPoint(ARCS[0].from, ARCS[0].to, arcHead(0), O, rx, ry);

  // ---------------- V4: planet ----------------
  const globeOn = t > c22 - 0.45;
  const globeOp = prog(t, c22 - 0.4, c22 + 0.5, E.inOut);
  const clearAng = ramp(t, [energy - 0.35, smarter + 0.2, smarter + 1.6], [0, 1.0, Math.PI + 0.6], E.inOut);
  const clean = prog(t, smarter + 0.2, e22 + 0.4, E.inOut);
  const halo = prog(t, smarter + 0.5, e22 + 1, E.inOut);
  // lattice placed in front of the camera as it is at "materials"
  const camMat = makeCamera({pos: hermite(posKeys, mats + 0.9), target: hermite(tgtKeys, mats + 0.9), fov: 40});
  const latC = React.useMemo(() => unprojectAt(camMat, 620, 500, 6.2), [mats]); // eslint-disable-line react-hooks/exhaustive-deps
  const latP = prog(t, mats - 0.1, mats + 1.9, E.linear);
  const latOp = Math.min(prog(t, mats - 0.25, mats + 0.2, E.out), 1 - prog(t, energy - 0.2, energy + 0.35, E.inOut));
  const sweep = ramp(t, [energy - 0.3, smarter + 0.6], [-1.3, 1.35], E.inOut);
  const landOp = Math.min(prog(t, energy - 0.8, energy - 0.2, E.out), 1 - prog(t, smarter + 1.1, smarter + 1.8, E.inOut));
  const camDir4: V3 = [-t0v.x, -t0v.y, -t0v.z];
  const ringProg = prog(t, smarter + 0.9, dur - 0.3, E.inOut);
  const ringR = R * 1.32;
  const ringTilt = 0.42;
  let spark4: V3;
  const latCenter = latC;
  if (t < energy - 0.4) spark4 = lerp3(V(new THREE.Vector3(-4, 5, 4)), latCenter, prog(t, c22 + 0.4, mats + 0.2, E.inOut));
  else if (t < smarter + 0.8) {
    const g = lerp(-0.45, 0.45, clamp((sweep + 1) / 2));
    const sp = surfDir(SITE, 0.34, g).multiplyScalar(R + 0.22);
    spark4 = lerp3(latCenter, V(sp), prog(t, energy - 0.4, energy + 0.1, E.inOut));
  } else spark4 = lerp3(V(surfDir(SITE, 0.34, 0.45).multiplyScalar(R + 0.22)), ringPoint(CEN, ringR, ringTilt, ringProg, 2.2), prog(t, smarter + 0.8, smarter + 1.4, E.inOut));

  // ---------------- hero spark (DOM) ----------------
  const spark = t < c20 - 0.8 ? spark1 : t < c21 - 0.2 ? spark2 : t < c22 ? spark3 : spark4;
  const sp = project(cam, spark);
  const sparkOp = Math.min(prog(t, 0.15, 0.7, E.out), sp.visible ? 1 : 0) * (t > c21 - 0.6 && t < help ? 1 - prog(t, c21 - 0.6, c21 - 0.2) + prog(t, help - 0.4, help) : 1);
  const sparkSize = clamp(pxPerUnit(cam, Math.max(sp.depth, 0.5)) * 0.2, 30, 64);

  // ---------------- background ----------------
  const w1 = 1 - prog(t, c20 - 0.6, c20 + 0.4);
  const w2 = prog(t, c20 - 0.6, c20 + 0.4) * (1 - prog(t, c21 + 0.2, c21 + 1.2));
  const w34 = prog(t, c21 + 0.2, c21 + 1.2);
  const protScr = project(cam, [0, 0, 0]);
  const limbScr = project(cam, V(surfDir(SITE, 0.66, 0).multiplyScalar(R * 1.02)));
  const globeScr = project(cam, CEN);
  const hz = project(cam, [cam.position.x + fwd.x * 500, O[1], cam.position.z + fwd.z * 500]);
  const uv = (p: {x: number; y: number}): [number, number] => [(p.x - 960) / 1080, (540 - p.y) / 1080];
  const litFrac2 = prog(t, wave.tA, wave.tB + 0.5, E.inOut);
  const litFrac3 = prog(t, named3, reach + 1.3, E.inOut);
  const mix3 = (a: number[], bb: number[], k: number) => a.map((x, i) => lerp(x, bb[i], k));
  const sky1 = [0.02, 0.026, 0.04];
  const sky2t = [0.012, 0.016, 0.03];
  const sky2m = mix3([0.035, 0.045, 0.065], [0.075, 0.045, 0.04], litFrac2);
  const bgU = {
    uFade: 1,
    uTop: mix3(mix3(sky1, sky2t, w2), [0.008, 0.01, 0.018], w34),
    uMid: mix3(mix3([0.03, 0.036, 0.05], sky2m, w2), [0.01, 0.012, 0.02], w34),
    uBot: mix3(mix3([0.02, 0.024, 0.034], [0.01, 0.012, 0.018], w2), [0.008, 0.01, 0.016], w34),
    uHz: w2 > 0.5 && hz.visible ? uv(hz)[1] : lerp(0, -0.1, w34),
    uHaze: [...mix3(mix3([0.05, 0.07, 0.09], [0.14, 0.07, 0.045], warm1), [0.04, 0.05, 0.07], w2 + w34), 0.6 * w1 + 0.12 * w2 + 0.1 * w34 * (1 - clean)],
    uHazeS: 2.2,
    uGA: [...(w1 > 0.01 ? uv(protScr) : uv(globeScr)), w1 > 0.01 ? 0.42 : 0.5, w1 * (0.35 + 0.35 * warm1) + w34 * globeOp * (0.1 + 0.35 * halo) + w34 * (1 - globeOp) * 0.25 * litFrac3],
    uGAC: w1 > 0.01 ? mix3([0.35, 0.45, 0.55], [0.85, 0.45, 0.28], warm1) : mix3([0.3, 0.45, 0.7], [0.95, 0.62, 0.36], Math.max(halo, (1 - globeOp) * litFrac3)),
    uGB: [...(landOp > 0.01 && limbScr.visible ? uv(limbScr) : uv(hz.visible ? hz : {x: 960, y: 540})), landOp > 0.01 ? 0.3 : 0.26, w2 * (0.1 + 0.55 * litFrac2) + landOp * 0.5],
    uGBC: landOp > 0.01 ? mix3([0.5, 0.3, 0.55], [0.95, 0.62, 0.36], clamp((sweep + 1) / 2)) : [0.95, 0.55, 0.32],
    uStars: 0.15 * w1 + 0.35 * w2 + 0.9 * w34,
    uDrift: [spec.pos[0] * 0.01, spec.pos[1] * 0.004],
    uSweep: [0, 0.2, 0, 0],
  };

  // ---------------- overlays ----------------
  const flashIn = 1 - prog(t, 0, 0.75, E.out);
  const dip = prog(t, dur - 0.5, dur, E.inOut);
  const hx = elementS(1, 1);
  const sx = elementS(2, 2);
  const hP = project(cam, chainPoint(hx, t, front));
  const sP = project(cam, chainPoint(sx, t, front));
  const bP = project(cam, pocket[2]);
  const lab1 = fadeWin(t, foldEnd + 0.1, c20 - 0.4, 0.5, 0.4);
  const cardDrift = {x: (spec.pos[0] - cam1.pos[0]) * 6, y: 0};

  return (
    <AbsoluteFill style={{background: C.void}}>
      <ShaderCanvas frag={BG} uniforms={bgU} scale={0.5} />
      <ThreeCanvas width={1920} height={1080} style={{position: 'absolute', inset: 0}} gl={{antialias: true}}>
        <Cam spec={spec} />
        {v1on && (
          <>
            <GPoints count={7000} seed={81} body={DNA_BODY} uniforms={{uT: t, uSweep: ramp(t, [dec0, foldEnd + 0.6], [-0.1, 1.15], E.inOut), uOp: fadeWin(t, 0.2, c20 + 0.3, 0.8, 0.8)}} renderOrder={0} />
            <Protein t={t} front={front} hot={prog(t, dec0 - 0.2, dec0 + 0.3) * (1 - prog(t, foldEnd, foldEnd + 0.8))} op={1 - prog(t, c20 - 0.1, c20 + 0.5, E.inOut)} />
            <Molecules u={molU} />
            <GPoints count={260} seed={82} body={SPARKS} uniforms={{uT: t, uP: spark1 as number[], uI: prog(t, dec0 - 0.3, dec0) * (1 - prog(t, foldEnd, foldEnd + 0.6))}} sprite="spark" renderOrder={6} />
          </>
        )}
        {worldOn && <World u={wU} arcs={t > help - 0.2 ? arcs : null} arcU={arcU} />}
        {globeOn && (
          <Globe
            radius={R * 0.995}
            position={CEN}
            rotation={[0, 0, 0]}
            u={{uT: t, uSmog: 1, uClean: clean, uHalo: halo, uOpacity: globeOp, uSpin: 0, uSun: SUN, uLights: 0.9, uClr: [n0.x, n0.y, n0.z, clearAng]}}
          />
        )}
        {latOp > 0.001 && <Lattice u={{uC: latC as number[], uS: 1.15, uSpin: t * 0.35, uP: latP, uOp: latOp}} />}
        {landOp > 0.001 && <Landscape C={CEN} frame={SITE} camDir={camDir4} t={t} sweep={sweep} op={landOp} sun={SUN} />}
        {t > smarter + 0.8 && <Ring u={{uC: CEN as number[], uR: ringR, uTilt: ringTilt, uPh: 2.2, uProg: ringProg, uOp: 1 - dip, uPR: R * 1.02}} />}
      </ThreeCanvas>

      {/* ---------- V1 HUD ---------- */}
      <CaseTag t={t} t0={dec0 - 0.4} t1={c20 - 0.2} n={1} name="DISEASE" />
      <Leader x={hP.x} y={hP.y} dx={Math.max(60, 1560 - hP.x)} dy={-Math.max(40, hP.y - 262)} text="α-HELIX" op={lab1} />
      <Leader x={sP.x} y={sP.y} dx={Math.max(60, 1560 - sP.x)} dy={-30} text="β-SHEET" op={lab1} />
      <Leader x={bP.x} y={bP.y} dx={Math.max(60, 1560 - bP.x)} dy={50} text="BINDING SITE" op={fadeWin(t, dockT[2] + 0.1, c20 - 0.4, 0.4, 0.4)} />
      <Card t={t} t0={dec0 + 1.3} t1={c20 - 0.3} x={150} y={250} w={560} depth={0.5} drift={cardDrift}>
        <CardHead date="SEP 2026" />
        <CardTitle>Claude-designed protein binders</CardTitle>
        <HitRate p={t - dec0 - 1.6} />
        <CardSource>hit rate · anthropic.com</CardSource>
      </Card>
      <Card t={t} t0={disc - 0.1} t1={c20 - 0.2} x={150} y={566} w={560} depth={0.2} drift={cardDrift}>
        <CardHead date="SEP 2026" kind="DISCOVERY" />
        <CardTitle>A new CRISPR-like enzyme system</CardTitle>
        <CardBody>~950 Claude agents · 21 hours</CardBody>
        <CardSource>anthropic.com · preprint, not yet peer-reviewed</CardSource>
      </Card>

      {/* ---------- V2 HUD ---------- */}
      {t > c20 && t < c21 + 0.6 &&
        GREET.map((g, i) => {
          const s = planeToSphere(g.u, g.v);
          const wp = embedJS(s.th, s.ph, g.lift, curv, O, rx, ry);
          const p = project(cam, wp);
          if (!p.visible) return null;
          const ta = arriveJS(wave, s.th, s.ph, 0.2);
          const warmth = prog(t, ta, ta + 0.6, E.out);
          const op = prog(t, wave.tA - 0.4 + i * 0.08, wave.tA + 0.4 + i * 0.08, E.out) * (1 - prog(t, c21 - 0.5, c21 + 0.2, E.inOut));
          const size = clamp(pxPerUnit(cam, p.depth) * 0.3, 24, 58);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                transform: 'translate(-50%, -100%)',
                fontFamily: g.f,
                fontSize: size,
                fontWeight: 400,
                fontVariationSettings: '"opsz" 72, "SOFT" 50',
                color: warmth > 0.01 ? `rgb(${Math.round(lerp(150, 246, warmth))},${Math.round(lerp(170, 206, warmth))},${Math.round(lerp(200, 150, warmth))})` : rgba(C.ice, 0.6),
                opacity: op * (0.45 + 0.55 * warmth),
                textShadow: `0 0 ${12 + 16 * warmth}px ${rgba(C.gold, 0.45 * warmth)}, 0 2px 8px rgba(0,0,0,0.8)`,
                whiteSpace: 'nowrap',
              }}
            >
              {g.w}
            </div>
          );
        })}
      <CaseTag t={t} t0={c20 + 0.5} t1={c21 - 0.1} n={2} name="IGNORANCE" />
      <Card t={t} t0={tutor + 0.6} t1={c21 - 0.1} x={1150} y={204} w={630} depth={0.4} tilt={-6} drift={{x: Math.sin(t * 0.25) * 8, y: 0}}>
        <CardHead date="JAN 2026" kind="EDUCATION" />
        <CardTitle>Teach For All</CardTitle>
        <CardBody>AI training for educators in 63 countries</CardBody>
        <CardSource>anthropic.com</CardSource>
      </Card>
      <Dial t={t} t0={hour - 0.2} t1={c21 - 0.1} x={240} y={690} />

      {/* ---------- V3 HUD ---------- */}
      <CaseTag t={t} t0={named3} t1={c22 - 0.1} n={3} name="POVERTY" />
      {t > help && t < c22 &&
        CHIPS.map((c, k) => {
          const hp = arcHead(k);
          if (hp <= 0) return null;
          const p = project(cam, arcPoint(ARCS[k].from, ARCS[k].to, hp, O, rx, ry));
          const op = prog(hp, 0, 0.15) * (1 - prog(t, help + 0.1 + k * 0.42 + 1.4, help + 0.1 + k * 0.42 + 2.2));
          return (
            <div key={k} style={{position: 'absolute', left: p.x + 14, top: p.y - 16, opacity: op, fontFamily: F.mono, fontSize: 22, letterSpacing: '0.14em', color: C.gold, padding: '4px 10px', border: `1px solid ${rgba(C.gold, 0.5)}`, borderRadius: 6, background: rgba('#0C0E14', 0.6), whiteSpace: 'nowrap'}}>
              {c}
            </div>
          );
        })}
      <Card t={t} t0={help + 0.3} t1={c22 + 0.1} x={150} y={300} w={640} depth={0.3} drift={{x: 0, y: Math.sin(t * 0.3) * 6}}>
        <CardHead date="JAN 2026" kind="CLAUDE'S CONSTITUTION" />
        <div style={{fontFamily: F.serif, fontStyle: 'italic', fontWeight: 350, fontSize: 38, lineHeight: 1.25, color: C.ivory, fontVariationSettings: '"opsz" 72, "SOFT" 50'}}>
          “a brilliant friend who happens to have the knowledge of a doctor, lawyer, financial advisor…”
        </div>
        <CardSource>anthropic.com/constitution</CardSource>
      </Card>

      {/* ---------- V4 HUD ---------- */}
      <CaseTag t={t} t0={c22 + 0.2} t1={smarter + 0.4} n={4} name="A WARMING PLANET" />
      {latOp > 0.01 &&
        (() => {
          const p = project(cam, latC);
          return <Leader x={p.x + 120} y={p.y - 150} dx={170} dy={-40} text="NEW MATERIALS" op={latOp * prog(t, mats + 0.6, mats + 1.1)} />;
        })()}
      {landOp > 0.01 &&
        (() => {
          const p = project(cam, V(surfDir(SITE, 0.48, -0.02).multiplyScalar(R + 0.34)));
          return p.visible ? <Leader x={p.x} y={p.y} dx={-40} dy={-120} text="CLEAN ENERGY" op={landOp * prog(t, energy, energy + 0.4)} /> : null;
        })()}

      {/* ---------- the hero ---------- */}
      {sparkOp > 0.01 && (
        <div style={{position: 'absolute', left: sp.x - sparkSize / 2, top: sp.y - sparkSize / 2, opacity: sparkOp}}>
          <ClaudeSpark size={sparkSize} glow={1.1} rotate={t * 30} pulse={0.5 + 0.5 * Math.sin(t * 5)} />
        </div>
      )}

      {/* opens on the hero's white-gold flash from S08's predecessor; dips to black at the end */}
      {flashIn > 0.001 && <AbsoluteFill style={{background: `radial-gradient(circle at 50% 74%, #FFFFFF 0%, #FFF9EF 45%, ${rgba(C.gold, 0.9)} 100%)`, opacity: flashIn}} />}
      {dip > 0.001 && <AbsoluteFill style={{background: '#000', opacity: dip}} />}
    </AbsoluteFill>
  );
};

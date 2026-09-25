// S01 COLD OPEN. Black void, cold dust in depth. A warm pilot-flame spark ignites, breathes and pulls
// warm matter into orbit. On "and a curve" it draws the film's leitmotif, an exponential curve; then the
// title EXPONENTIAL slams in. The title dissolves to dust and everything collapses into one point at
// frame centre (match-cut into S02).
//
// One world, one camera: the spark sits at world origin; a single perspective camera (fov 45, looking down
// -z) drives the Three.js particles, and the same projection places the DOM/SVG layers and the shader
// uniforms, so every layer parallaxes consistently.
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {ShaderCanvas} from '../lib/ShaderCanvas';
import {PointCloud} from '../lib/PointCloud';
import {ClaudeSpark} from '../lib/ClaudeSpark';
import {useScene} from '../lib/timing';
import {C, F, rgba} from '../theme';
import {E, clamp, lerp, prog, rnd, shake} from '../lib/anim';
import {S01_FRAG} from './S01/shader';
import {GlyphDust, useGlyphSample} from './S01/GlyphDust';

const FOV = 45;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
const ppu = (dz: number) => 1080 / (2 * Math.max(0.05, dz) * TAN); // screen px per world unit at depth dz

// Title typography (shared with the glyph sampler so the dust matches the letters).
const TITLE = {family: F.serif, weight: 300, size: 96, spacingEm: 0.34};

// Composition at the slam (screen px, before the continuing push-in).
const SPARK_AT = {x: 300, y: 705}; // curve origin
const CURVE_PX = {w: 1400, h: 510}; // curve extent
const CURVE_K = 7.5; // steepness
const TITLE_Y = 488;

const Z0 = 12.5;
const ZS = 8.6;
const ZE = 7.95;

const bump = (t: number, a: number, peak: number, b: number) =>
  t < peak ? prog(t, a, peak, E.out) : 1 - prog(t, peak, b, E.inOut);

const CamRig: React.FC<{x: number; y: number; z: number}> = ({x, y, z}) => {
  const {camera} = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(x, y, z);
  cam.rotation.set(0, 0, 0);
  cam.fov = FOV;
  cam.near = 0.05;
  cam.far = 500;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return null;
};

// ---------------------------------------------------------------- particle bodies (GLSL, deterministic)
const DUST = /* glsl */ `
  float zz = mix(-34., 10.5, aSeed.z);
  float d0 = 12.5 - zz;
  vec3 p0 = vec3((aSeed.x - .5) * 2. * (d0 * .74 + 1.5), (aSeed.y - .5) * 2. * (d0 * .42 + 1.), zz);
  p0.x += sin(uTime * .09 + aSeed.w * 6.28) * .45 + uTime * .06 * (aSeed2.z - .5);
  p0.y += cos(uTime * .07 + aSeed2.x * 6.28) * .35 + uTime * .025;
  pos = p0;
  float dz = uCam.z - pos.z;
  float vis = smoothstep(.35, 1.6, dz);
  float bok = smoothstep(4.5, 1.1, dz);
  size = 1.3 + aSeed2.w * 2.4 + bok * 9.;
  float dl = length(pos - uSparkW);
  float warm = clamp(uLight * 2.4 / (1. + dl * dl * .3), 0., 1.);
  vec3 cold = mix(vec3(.44, .55, .65), vec3(.73, .80, .87), aSeed2.x) * .85;
  vec3 hot = mix(vec3(.96, .76, .48), vec3(.93, .54, .37), aSeed2.y) * 1.25;
  color = mix(cold, hot, warm);
  float tw = .6 + .4 * sin(uTime * (1. + aSeed.w * 2.) + aSeed.z * 40.);
  alpha = (.16 + .34 * aSeed2.x * aSeed2.x) * vis * (1. - .78 * bok) * tw * (.7 + .8 * warm) * uDust;
`;

const ACCRETE = /* glsl */ `
  float tb = uAcc.x + pow(aSeed.x, .85) * uAcc.y;
  float age = uTime - tb;
  float live = step(0., age);
  age = max(age, 0.);
  float tau = .9 + aSeed.y * 1.5;
  float s = 1. - exp(-age / tau);
  float r0 = 2.0 + aSeed.z * 3.6;
  float ro = .2 + pow(aSeed.w, 1.6) * 1.05;
  float r = mix(r0, ro, s);
  float w0 = .5 / pow(r0, 1.5), w1 = .5 / pow(ro, 1.5);
  float th = aSeed2.x * TAU + w1 * (age - tau * s) + w0 * tau * s;
  vec3 d = vec3(cos(th) * r, (aSeed2.y - .5) * .14 * r, sin(th) * r);
  d.yz = rot(1.18) * d.yz;
  d.xy = rot(-.32) * d.xy;
  float k = clamp(uColl * 1.3 - aSeed2.z * .3, 0., 1.);
  k = k * k;
  d.xy = rot(k * 2.5) * d.xy;
  pos = uSparkW + d * (1. - k);
  float heat = s * s;
  color = mix(mix(vec3(.93, .54, .37), vec3(.85, .47, .34), aSeed2.w), vec3(1., .87, .62), heat);
  size = 1.6 + aSeed2.w * 2.4;
  alpha = live * smoothstep(0., .7, age) * (.3 + .7 * heat) * uLight;
`;

const TRAIL = /* glsl */ `
  float u = aSeed.x;
  float live = step(u, uCurve.w) * step(.001, uCurve.w);
  float age = max(0., (uCurve.w - u) * uDraw.x + uDraw.y);
  float life = .7 + aSeed2.w * 2.3;
  float cyc = floor(age / life);
  float a = age - cyc * life;
  float r1 = hash11(aIndex * 1.7 + cyc * 13.1), r2 = hash11(aIndex * 3.1 + cyc * 7.7);
  float uu = u + (r1 - .5) * .01;
  vec3 base = vec3(uu * uCurve.x, uCurve.y * (exp(uCurve.z * uu) - 1.) / (exp(uCurve.z) - 1.), 0.);
  vec3 v = vec3((r1 - .5) * .32, .10 + r2 * .30, (aSeed2.z - .5) * .5);
  pos = base + vec3(aSeed.y - .5, aSeed.z - .5, aSeed.w - .5) * .045 + v * a
      + vec3(sin(a * 3. + r1 * 9.), cos(a * 2.6 + r2 * 9.), 0.) * .03 * a;
  float k = clamp(uColl * 1.35 - u * .35, 0., 1.);
  k = k * k * k;
  vec3 rel = pos - uTarget;
  rel.xy = rot(k * 2.2) * rel.xy;
  pos = uTarget + rel * (1. - k);
  alpha = live * smoothstep(0., .05, a) * (1. - smoothstep(life * .35, life, a)) * (.45 + .55 * r2) * uTrail;
  color = mix(vec3(1., .92, .76), vec3(.93, .54, .37), clamp(a / life * 1.6, 0., 1.));
  size = .9 + aSeed2.x * 1.7;
`;

const BLAST = /* glsl */ `
  float age = uTime - uBlast.x;
  float live = step(0., age);
  age = max(age, 0.);
  vec3 p0 = uAnchor + vec3((aSeed.x - .5) * 2. * uBlast.y, (aSeed.y - .5) * 2. * uBlast.z, (aSeed.z - .5) * .4);
  vec3 dir = normalize(vec3((aSeed.x - .5) * 2.2 + (aSeed2.x - .5), (aSeed.y - .5) * 1.6 + (aSeed2.y - .5) * 1.5, (aSeed2.z - .5) * 2.4 + .35));
  float sp = 1.0 + 7.5 * pow(aSeed2.w, 2.2);
  float kd = 2.4;
  pos = p0 + dir * sp * (1. - exp(-kd * age)) / kd;
  pos.y -= .04 * age * age;
  float k = clamp(uColl * 1.3 - aSeed.w * .3, 0., 1.);
  k = k * k * k;
  vec3 rel = pos - uTarget;
  rel.xy = rot(k * 2.) * rel.xy;
  pos = uTarget + rel * (1. - k);
  alpha = live * exp(-age * (.55 + aSeed.w * 1.2)) * .8;
  color = mix(vec3(1., .96, .88), mix(vec3(.96, .76, .48), vec3(.93, .54, .37), aSeed.w), clamp(age * 2.2, 0., 1.));
  size = 1.1 + 2.3 * aSeed.w;
`;

export const S01: React.FC = () => {
  const {t, dur, cue, end, fps, frame} = useScene('S01');
  const glyphs = useGlyphSample('EXPONENTIAL', TITLE, 3);

  // ------------------------------------------------------------ beats (all VO-relative)
  const B = useMemo(() => {
    const slam = end('L02') + 0.7;
    return {
      ignite: clamp(cue('L01') - 1.95, 0.6, 1.2),
      l01: cue('L01'),
      acc0: cue('L01') - 0.5,
      accSpan: end('L02') - cue('L01') - 0.4,
      idea: end('L02') - 1.45,
      curve: end('L02') - 0.9,
      curveEnd: slam - 0.2,
      slam,
      pan0: cue('L02') - 0.3,
      dis: dur - 1.65,
      coll0: dur - 1.2,
      coll1: dur - 0.32,
      l02end: end('L02'),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dur]);

  // ------------------------------------------------------------ camera
  const zBase = (tt: number) =>
    tt < B.slam
      ? Z0 - (Z0 - ZS) * (0.3 * E.inOut(clamp(tt / B.slam)) + 0.7 * clamp(tt / B.slam))
      : ZS - (ZS - ZE) * clamp((tt - B.slam) / (dur - B.slam));
  const punch = -0.5 * prog(t, B.slam - 0.55, B.slam, E.in) + 0.5 * prog(t, B.slam, B.slam + 1.1, E.out);
  const panAt = (tt: number) => {
    const k = prog(tt, B.pan0, B.slam, E.inOut);
    const sx = lerp(960, SPARK_AT.x, k);
    const sy = lerp(540, SPARK_AT.y, k);
    const u = ppu(zBase(Math.min(tt, B.slam)));
    return {x: (960 - sx) / u, y: (sy - 540) / u};
  };
  const pan = panAt(t);
  const post = Math.max(0, t - B.slam);
  const hand = {x: Math.sin(t * 0.37) * 0.018 + Math.sin(t * 0.91 + 1) * 0.008, y: Math.cos(t * 0.29) * 0.014};
  const cam = {x: pan.x + post * 0.045 + hand.x, y: pan.y + post * 0.018 + hand.y, z: zBase(t) + punch};
  const k0 = ppu(cam.z);
  const proj = (wx: number, wy: number, wz = 0) => {
    const k = ppu(cam.z - wz);
    return {x: 960 + (wx - cam.x) * k, y: 540 - (wy - cam.y) * k, k};
  };
  const unproj = (sx: number, sy: number) => ({x: cam.x + (sx - 960) / k0, y: cam.y - (sy - 540) / k0});

  // Reference scale at the slam (no punch): the title and curve are authored at this scale.
  const refK = ppu(ZS);
  const panS = panAt(B.slam);
  const Wc = CURVE_PX.w / refK;
  const Hc = CURVE_PX.h / refK;
  const titleW = {x: panS.x, y: panS.y + (540 - TITLE_Y) / refK};

  // ------------------------------------------------------------ spark light
  const coll = prog(t, B.coll0, B.coll1, E.inOut);
  let I = 0;
  if (t >= B.ignite) {
    const f = Math.floor((t - B.ignite) * fps);
    const stutter = [0.5, 0.06, 0.62, 0.2, 0.85, 0.45, 0.9, 0.7];
    const breath = 0.8 + 0.1 * Math.sin(t * 2.1) + 0.05 * Math.sin(t * 5.3 + 1) + 0.05 * (rnd(`s01f${frame}`) - 0.5);
    I = f < stutter.length ? stutter[f] : breath;
    I *= 0.62 + 0.42 * prog(t, B.l01, B.l02end, E.inOut);
    I += 0.5 * bump(t, B.idea - 0.25, B.idea + 0.1, B.idea + 1.0);
    I += 0.45 * bump(t, B.curve - 0.1, B.curve + 0.05, B.curve + 0.7);
  }
  if (t > B.slam) I *= 0.82;
  // collapse: the spark glides to frame centre, gathers everything, swells, then dims
  const sp0 = proj(0, 0, 0);
  const glide = prog(t, B.coll0 - 0.1, B.coll1, E.inOut);
  const sparkS = {x: lerp(sp0.x, 960, glide), y: lerp(sp0.y, 540, glide)};
  const gather = bump(t, B.coll0 + 0.3, B.coll1, dur + 0.25);
  I = I * (1 - 0.3 * glide) + 0.65 * gather;
  if (t > B.coll1) I = lerp(I, 0.42, prog(t, B.coll1, dur, E.inOut));
  const sparkR = 0.65 + 0.35 * prog(t, B.l01, B.l02end, E.inOut) + 0.35 * bump(t, B.idea - 0.25, B.idea + 0.1, B.idea + 1.0);
  const sparkW = unproj(sparkS.x, sparkS.y);

  // ------------------------------------------------------------ curve
  const headU = prog(t, B.curve, B.curveEnd, (x) => 0.5 * x + 0.5 * x * x);
  const curveOn = t >= B.curve;
  const cw = (u: number) => ({x: u * Wc, y: (Hc * (Math.exp(CURVE_K * u) - 1)) / (Math.exp(CURVE_K) - 1)});
  const collCurve = (u: number) => {
    const kk = Math.pow(clamp(coll * 1.35 - u * 0.35), 3);
    return kk;
  };
  const NC = 110;
  const curvePts: {x: number; y: number}[] = [];
  if (curveOn && headU > 0.0005) {
    for (let i = 0; i <= NC; i++) {
      const u = (i / NC) * headU;
      const w = cw(u);
      const s = proj(w.x, w.y);
      const kk = collCurve(u);
      const ang = kk * 2.2;
      const rx = s.x - sparkS.x;
      const ry = s.y - sparkS.y;
      curvePts.push({
        x: sparkS.x + (rx * Math.cos(ang) - ry * Math.sin(ang)) * (1 - kk),
        y: sparkS.y + (rx * Math.sin(ang) + ry * Math.cos(ang)) * (1 - kk),
      });
    }
  }
  const head = curvePts.length ? curvePts[curvePts.length - 1] : {x: 0, y: 0};
  const pathD = curvePts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  let pathLen = 0;
  for (let i = 1; i < curvePts.length; i++) pathLen += Math.hypot(curvePts[i].x - curvePts[i - 1].x, curvePts[i].y - curvePts[i - 1].y);
  const CX = new Array(40).fill(0);
  const CY = new Array(40).fill(0);
  let CN = 0;
  if (curvePts.length > 1) {
    CN = 40;
    for (let i = 0; i < 40; i++) {
      const p = curvePts[Math.round((i / 39) * (curvePts.length - 1))];
      CX[i] = p.x;
      CY[i] = p.y;
    }
  }
  const curveI = !curveOn
    ? 0
    : (t < B.slam ? 1 : 0.62 + 0.08 * Math.sin(t * 2.4)) * (1 - prog(t, B.coll0, B.coll1 - 0.1, E.in));
  const headI = !curveOn
    ? 0
    : (t < B.curveEnd ? 1 : t < B.slam ? 1 + 0.8 * bump(t, B.curveEnd, B.curveEnd + 0.08, B.slam) : 0.45 + 0.1 * Math.sin(t * 3.1)) *
      (1 - prog(t, B.dis, B.coll0 + 0.3, E.inOut));

  // ------------------------------------------------------------ title slam
  const age = t - B.slam;
  const slamOn = age >= 0;
  const flash = slamOn ? Math.exp(-age * 6.5) : 0.25 * prog(t, B.slam - 0.35, B.slam, E.in);
  const ringR = slamOn ? 1500 * (1 - Math.exp(-age * 2.6)) : 0;
  const ringI = slamOn ? Math.exp(-age * 2.4) * prog(age, 0, 0.05) : 0;
  const sh = shake(t, B.slam, 11, 6.5);
  const titleP = proj(titleW.x, titleW.y);
  const titleScale = (titleP.k / refK) * (1 + 0.14 * (1 - prog(age, 0, 0.55, E.out))) * (1 + 0.004 * Math.sin(t * 1.7));
  const titleOp = slamOn ? prog(age, 0, 0.07, E.linear) : 0;
  const track = TITLE.spacingEm + 0.16 * (1 - prog(age, 0, 1.2, E.out));
  const sweep = -25 + 150 * prog(age, 0.25, 2.1, E.inOut);
  const wave = 0.7;
  const maskA = -14 + 114 * clamp((t - B.dis) / wave);
  const subOp = prog(age, 0.35, 1.1, E.out) * (1 - prog(t, B.dis - 0.05, B.dis + 0.35, E.inOut));
  const titleGlow = slamOn ? (0.8 + 0.2 * Math.sin(t * 1.9)) * (1 - prog(t, B.dis, B.dis + wave, E.inOut)) + 1.5 * Math.exp(-age * 3) : 0;
  const slamFrame = Math.round(B.slam * fps);
  const sub = frame - slamFrame;
  const emblemOp = sub >= 0 && sub < 4 ? [0.3, 0.26, 0.17, 0.08][sub] : 0;

  // ------------------------------------------------------------ nebula / star parallax
  const nebK = ppu(cam.z + 26);
  const starK = ppu(cam.z + 120) / ppu(Z0 + 120);
  const nebOn = prog(t, B.ignite, B.l01 + 2.5, E.inOut);

  const light = clamp(I, 0, 1.4);
  const collTarget: [number, number, number] = [sparkW.x, sparkW.y, 0];

  const Wrap: React.CSSProperties = {transform: `translate(${sh.x}px, ${sh.y}px)`};

  return (
    <AbsoluteFill style={{background: C.void, overflow: 'hidden'}}>
      <AbsoluteFill style={Wrap}>
        <ShaderCanvas
          frag={S01_FRAG}
          scale={0.5}
          uniforms={{
            uSpark: [sparkS.x, sparkS.y],
            uSparkI: I,
            uSparkR: sparkR,
            uNeb: nebOn,
            uNebOff: [cam.x * 1.0, cam.y * 1.0],
            uNebK: 1080 / nebK,
            uStarI: 0.5 + 0.5 * nebOn,
            uStarOff: [cam.x * ppu(Z0 + 120), -cam.y * ppu(Z0 + 120)],
            uStarK: starK,
            uCX: CX,
            uCY: CY,
            uCN: CN,
            uCurveI: curveI,
            uHead: [head.x, head.y],
            uHeadI: headI,
            uFlash: flash,
            uFlashC: [titleP.x, titleP.y],
            uRing: ringR,
            uRingI: ringI,
            uTitle: [titleP.x, titleP.y, 620 * titleScale, titleGlow],
            uExpo: 1.15,
          }}
        />
        <ThreeCanvas width={1920} height={1080} camera={{fov: FOV, position: [0, 0, Z0], near: 0.05, far: 500}} style={{position: 'absolute'}}>
          <CamRig x={cam.x} y={cam.y} z={cam.z} />
          <PointCloud
            count={6500}
            seed={11}
            body={DUST}
            uniforms={{uCam: [cam.x, cam.y, cam.z], uSparkW: [sparkW.x, sparkW.y, 0], uLight: light, uDust: 0.55 + 0.45 * prog(t, 0, 2.5, E.inOut)}}
          />
          <PointCloud
            count={3000}
            seed={23}
            body={ACCRETE}
            sprite="spark"
            uniforms={{uAcc: [B.acc0, B.accSpan], uSparkW: [sparkW.x, sparkW.y, 0], uColl: coll, uLight: clamp(0.35 + light * 0.7, 0, 1.2)}}
          />
          {curveOn && (
            <PointCloud
              count={1900}
              seed={37}
              body={TRAIL}
              sprite="spark"
              uniforms={{
                uCurve: [Wc, Hc, CURVE_K, headU],
                uDraw: [B.curveEnd - B.curve, Math.max(0, t - B.curveEnd)],
                uColl: coll,
                uTarget: collTarget,
                uTrail: t < B.slam ? 1 : 0.7,
              }}
            />
          )}
          {slamOn && (
            <PointCloud
              count={2600}
              seed={41}
              body={BLAST}
              sprite="spark"
              uniforms={{uBlast: [B.slam, 560 / refK, 34 / refK], uAnchor: [titleW.x, titleW.y, 0], uColl: coll, uTarget: collTarget}}
            />
          )}
          {glyphs && t >= B.dis - 0.05 && (
            <GlyphDust sample={glyphs} t={t} t0={B.dis} wave={wave} anchor={[titleW.x, titleW.y, 0]} unit={1 / refK} coll={coll} target={collTarget} />
          )}
        </ThreeCanvas>

        {/* crisp curve line */}
        {curvePts.length > 1 && (
          <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
            <defs>
              <linearGradient id="s01curve" gradientUnits="userSpaceOnUse" x1={curvePts[0].x} y1={curvePts[0].y} x2={head.x} y2={head.y}>
                <stop offset="0" stopColor={C.coral} stopOpacity={0.35} />
                <stop offset="0.6" stopColor={C.ember} stopOpacity={0.8} />
                <stop offset="1" stopColor="#FFF4E0" stopOpacity={1} />
              </linearGradient>
            </defs>
            <g opacity={clamp(curveI * 1.25)}>
              <path d={pathD} fill="none" stroke={rgba(C.gold, 0.12)} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
              <path d={pathD} fill="none" stroke="url(#s01curve)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              {t > B.slam + 0.3 && pathLen > 10 && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#FFF1D6"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeDasharray={`${Math.min(160, pathLen * 0.12)} ${pathLen * 3}`}
                  strokeDashoffset={-(((t - B.slam - 0.3) / 1.7) % 1) * pathLen * 1.15 + 80}
                  opacity={0.7}
                />
              )}
            </g>
          </svg>
        )}

        {/* spark core + anamorphic streak (crisp) */}
        {I > 0.001 && (
          <div style={{position: 'absolute', left: sparkS.x, top: sparkS.y, width: 0, height: 0}}>
            <div
              style={{
                position: 'absolute',
                left: -260 * sparkR,
                top: -1,
                width: 520 * sparkR,
                height: 2,
                opacity: clamp(I * 0.55),
                background: `linear-gradient(90deg, transparent, ${rgba(C.ember, 0.35)} 30%, ${rgba('#FFF2DC', 0.95)} 50%, ${rgba(C.ember, 0.35)} 70%, transparent)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: -9 * sparkR,
                top: -9 * sparkR,
                width: 18 * sparkR,
                height: 18 * sparkR,
                borderRadius: '50%',
                opacity: clamp(I),
                background: 'radial-gradient(circle, #FFFFFF 0%, #FFF3DD 22%, rgba(244,194,122,0.55) 45%, rgba(238,138,94,0) 72%)',
              }}
            />
          </div>
        )}
        {headI > 0.001 && curvePts.length > 1 && (
          <div
            style={{
              position: 'absolute',
              left: head.x - 8,
              top: head.y - 8,
              width: 16,
              height: 16,
              borderRadius: '50%',
              opacity: clamp(headI),
              background: 'radial-gradient(circle, #FFFFFF 0%, #FFF3DD 25%, rgba(244,194,122,0.5) 50%, rgba(238,138,94,0) 75%)',
            }}
          />
        )}

        {/* title */}
        {slamOn && t < B.dis + wave + 0.1 && (
          <div
            style={{
              position: 'absolute',
              left: titleP.x,
              top: titleP.y,
              transform: `translate(-50%, -50%) scale(${titleScale})`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontFamily: TITLE.family,
                fontWeight: TITLE.weight,
                fontSize: TITLE.size,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                letterSpacing: `${track}em`,
                paddingLeft: `${track}em`,
                opacity: titleOp,
                color: 'transparent',
                backgroundImage: `linear-gradient(100deg, ${rgba(C.ivory, 0.92)} ${sweep - 22}%, #FFFFFF ${sweep - 5}%, ${C.gold} ${sweep}%, #FFFFFF ${sweep + 5}%, ${rgba(C.ivory, 0.92)} ${sweep + 22}%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                textShadow: `0 0 22px ${rgba(C.gold, 0.28)}`,
                WebkitMaskImage: t >= B.dis ? `linear-gradient(90deg, rgba(0,0,0,0) ${maskA}%, #000 ${maskA + 14}%)` : undefined,
                maskImage: t >= B.dis ? `linear-gradient(90deg, rgba(0,0,0,0) ${maskA}%, #000 ${maskA + 14}%)` : undefined,
              }}
            >
              EXPONENTIAL
            </div>
          </div>
        )}
        {subOp > 0.001 && (
          <div
            style={{
              position: 'absolute',
              left: titleP.x,
              top: titleP.y + 92 * (titleP.k / refK),
              transform: `translate(-50%, -50%) scale(${titleP.k / refK})`,
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              opacity: subOp,
            }}
          >
            <div style={{width: 90 * prog(age, 0.4, 1.3, E.out), height: 1, background: `linear-gradient(90deg, transparent, ${rgba(C.gold, 0.8)})`}} />
            <div
              style={{
                fontFamily: F.sans,
                fontWeight: 500,
                fontSize: 23,
                letterSpacing: `${0.62 + 0.2 * (1 - prog(age, 0.35, 1.6, E.out))}em`,
                paddingLeft: '0.62em',
                color: rgba(C.ivory, 0.78),
                whiteSpace: 'nowrap',
              }}
            >
              AN ORIGIN STORY
            </div>
            <div style={{width: 90 * prog(age, 0.4, 1.3, E.out), height: 1, background: `linear-gradient(270deg, transparent, ${rgba(C.gold, 0.8)})`}} />
          </div>
        )}

        {/* impact flash (over everything) + 4-frame subliminal hero silhouette */}
        {flash > 0.01 && slamOn && (
          <AbsoluteFill
            style={{
              mixBlendMode: 'screen',
              opacity: clamp(flash * 1.05),
              background: `radial-gradient(ellipse 62% 48% at ${(titleP.x / 1920) * 100}% ${(titleP.y / 1080) * 100}%, #FFFBF2 0%, #FFF1D8 18%, ${rgba(C.gold, 0.75)} 38%, ${rgba(C.ember, 0.28)} 68%, ${rgba(C.clay, 0.06)} 100%)`,
            }}
          />
        )}
        {emblemOp > 0 &&
          [1.12, 1].map((s, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: titleP.x - 145,
                top: titleP.y - 145,
                opacity: emblemOp * [0.45, 1][i],
                transform: `scale(${2 * (s + sub * 0.025)})`,
                mixBlendMode: 'multiply',
                filter: `blur(${[5, 2.5][i]}px)`,
              }}
            >
              <ClaudeSpark size={290} draw={1} glow={0} color="#4A2416" core="#5A2C1A" rotate={-8 + sub * 1.5} />
            </div>
          ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// S10 FINALE. Starts on S09's gold-white flash, decays into orbit above a night-side Earth. The hero's light
// rises beyond the limb as a sun whose corona is the emblem's own starburst; dawn sweeps the planet and the
// city lights ignite in a warm wave. The camera pushes toward the emblem-sun, then cranes up and away as it
// climbs, settling into the end title: emblem, "Claude", "For the good of humanity."
//
// One camera model drives everything: Earth radius 1 at the origin, camera at (0,0,D) pitched up by alpha
// and rolled by rho, focal f. The shader, the DOM emblem/title and the Three.js motes all share it.
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
import {E, clamp, lerp, prog} from '../lib/anim';
import {S10_FRAG} from './S10/shader';

type V3 = [number, number, number];
const DEG = Math.PI / 180;
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

// The emblem's ray geometry (same as ClaudeSpark) so the GLSL corona rays line up with the SVG rays.
const RAYS = [
  [0, 1.0], [31, 0.8], [58, 0.95], [91, 0.74], [119, 0.98], [148, 0.82],
  [181, 0.93], [209, 0.76], [238, 1.0], [269, 0.79], [299, 0.9], [329, 0.72],
];
const RAY_A = RAYS.map(([a]) => (a - 90) * DEG);
const RAY_L = RAYS.map(([, l]) => l);

type Cam = {P: V3; R: V3; U: V3; F: V3; f: number; alpha: number; roll: number};

const makeCam = (D: number, alpha: number, roll: number, f: number): Cam => {
  const r0: V3 = [1, 0, 0];
  const u0: V3 = [0, Math.cos(alpha), Math.sin(alpha)];
  const F3: V3 = [0, Math.sin(alpha), -Math.cos(alpha)];
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const R: V3 = [cr * r0[0] + sr * u0[0], cr * r0[1] + sr * u0[1], cr * r0[2] + sr * u0[2]];
  const U: V3 = [-sr * r0[0] + cr * u0[0], -sr * r0[1] + cr * u0[1], -sr * r0[2] + cr * u0[2]];
  return {P: [0, 0, D], R, U, F: F3, f, alpha, roll};
};

const project = (cam: Cam, dir: V3) => {
  const z = dot(dir, cam.F);
  if (z <= 1e-4) return {x: 960, y: -2000};
  return {x: 960 + ((cam.f * dot(dir, cam.R)) / z) * 1080, y: 540 - ((cam.f * dot(dir, cam.U)) / z) * 1080};
};

const rayAt = (cam: Cam, x: number, y: number): V3 => {
  const ux = (x - 960) / 1080;
  const uy = (540 - y) / 1080;
  return norm([
    ux * cam.R[0] + uy * cam.U[0] + cam.f * cam.F[0],
    ux * cam.R[1] + uy * cam.U[1] + cam.f * cam.F[1],
    ux * cam.R[2] + uy * cam.U[2] + cam.f * cam.F[2],
  ]);
};

const hitsEarth = (cam: Cam, rd: V3) => {
  const b = dot(cam.P, rd);
  const c = dot(cam.P, cam.P) - 1;
  const h = b * b - c;
  return h > 0 && -b - Math.sqrt(h) > 0;
};

// Screen y of the limb in a given column (sky above, Earth below).
const limbY = (cam: Cam, x: number) => {
  let lo = -600;
  let hi = 1800;
  if (hitsEarth(cam, rayAt(cam, x, lo))) return lo;
  if (!hitsEarth(cam, rayAt(cam, x, hi))) return hi;
  for (let i = 0; i < 22; i++) {
    const m = (lo + hi) / 2;
    if (hitsEarth(cam, rayAt(cam, x, m))) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
};

// Circle through three points (used to mask the DOM emblem with the Earth's limb as it rises).
const circle3 = (a: {x: number; y: number}, b: {x: number; y: number}, c: {x: number; y: number}) => {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-6) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return {x, y, r: Math.hypot(a.x - x, a.y - y)};
};

const CamRig: React.FC<{cam: Cam}> = ({cam}) => {
  const {camera} = useThree();
  const pc = camera as THREE.PerspectiveCamera;
  pc.position.set(...cam.P);
  pc.rotation.set(cam.alpha, 0, cam.roll, 'XYZ');
  pc.fov = (2 * Math.atan(0.5 / cam.f)) / DEG;
  pc.near = 0.001;
  pc.far = 50;
  pc.updateProjectionMatrix();
  pc.updateMatrixWorld();
  return null;
};

// Foreground: orbital ice/dust motes near the camera, lit by forward scattering of the hero's light.
const MOTES = /* glsl */ `
  vec3 o = vec3(aSeed.x - .5, aSeed.y - .5, aSeed.z - .5) * vec3(.34, .22, .34);
  o += vec3(sin(uTime * .05 + aSeed.w * 6.28), cos(uTime * .04 + aSeed2.x * 6.28), sin(uTime * .03 + aSeed2.y * 6.28)) * .006;
  o.y += uTime * .0012 * (aSeed2.z - .3);
  pos = uCam + o;
  vec4 mvp = modelViewMatrix * vec4(pos, 1.);
  float dz = max(.001, -mvp.z);
  vec3 v = normalize(o);
  float fwd = pow(max(dot(v, uSun), 0.), 7.);
  float near = smoothstep(.07, .015, dz);
  float px = (1.3 + aSeed2.w * 2.2) * (1. + near * 5.);
  size = px * dz / 10.;
  color = mix(vec3(1., .8, .58), vec3(1., .93, .82), aSeed2.x);
  alpha = (.06 + .75 * fwd) * (1. - .75 * near) * smoothstep(.004, .012, dz) * uMote * (.6 + .4 * sin(uTime * (1.5 + aSeed.w * 2.) + aSeed.z * 30.));
`;

export const S10: React.FC = () => {
  const {t, dur, cue, end} = useScene('S10');

  const B = useMemo(
    () => ({
      l26: cue('L26'),
      l26e: end('L26'),
      l27: cue('L27'),
      l27e: end('L27'),
      l28: cue('L28'),
      l28e: end('L28'),
      title: end('L28') + 0.4,
      fade0: dur - 0.8,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dur]
  );

  // ------------------------------------------------------------ camera + sun choreography
  const push = prog(t, B.l27 - 0.9, B.l27e + 0.8, E.inOut);
  const crane = prog(t, B.l28 - 0.6, B.l28e + 0.5, E.inOut);
  const D = 1.2 - 0.012 * push - 0.006 * prog(t, 0, dur, E.linear);
  const beta = Math.asin(1 / D);
  const f = 1.25 + 0.25 * push + 0.03 * prog(t, B.title, dur, E.inOut);
  const eSun = (-2.2 + 5.7 * prog(t, B.l26 - 0.4, B.l26e + 0.4, E.inOut) + 3.5 * push + 16.6 * crane + 0.1 * t) * DEG;
  const alpha = beta + (2.97 + 2.0 * push + 11.23 * crane) * DEG + 0.001 * Math.sin(t * 0.7);
  const roll = (-2.6 * (1 - prog(t, 0, B.l28e + 0.5, E.inOut)) + 0.15 * Math.sin(t * 0.43)) * DEG;
  const cam = makeCam(D, alpha, roll, f);
  const psi = beta + eSun;
  const sunDir: V3 = [0, Math.sin(psi), -Math.cos(psi)];
  const sun = project(cam, sunDir);
  const eLight = (-4 + 36 * prog(t, B.l26 + 0.5, B.l26e + 2.2, E.inOut) + 8 * crane) * DEG;
  const lightDir = norm([0.3, Math.sin(beta + eLight), -Math.cos(beta + eLight)]);

  // How far the sun has cleared the limb (px) and a circle fit of the limb around it.
  const ly = limbY(cam, sun.x);
  const clear = ly - sun.y;
  const sunVis = clamp(clear / 70 + 0.15);
  const limbCircle = circle3({x: sun.x - 260, y: limbY(cam, sun.x - 260)}, {x: sun.x, y: ly}, {x: sun.x + 260, y: limbY(cam, sun.x + 260)});

  // ------------------------------------------------------------ light levels
  const flash = Math.exp(-t * 5.2);
  const rise = prog(t, B.l26 - 0.2, B.l26e, E.inOut);
  const pushBump = push * (1 - crane);
  const settle = prog(t, B.l28e - 0.4, B.title + 1.0, E.inOut);
  const corona = sunVis * (0.55 + 0.45 * rise + 0.6 * pushBump) * (1 - 0.55 * settle);
  const rayLen = 90 + 70 * rise + 130 * pushBump - 60 * settle;
  const bloom = 1 + 0.9 * pushBump - 0.2 * settle;
  const god = sunVis * (0.35 + 0.35 * rise + 0.4 * pushBump) * (1 - 0.8 * settle);
  const flareI = sunVis * (0.45 + 0.35 * rise + 0.4 * pushBump) * (1 - 0.7 * settle);
  const ign = 1.15 * prog(t, B.l26e - 2.4, B.l26e + 2.8, (x) => E.inOut(x));
  const breathe = 1 + 0.06 * Math.sin(t * 1.6) * settle;
  const rot = 6 * Math.sin(t * 0.21) + t * 1.2;

  // ------------------------------------------------------------ emblem
  const emSize = lerp(lerp(58, 120, push), 150, settle);
  const emGlow = (0.8 + 0.5 * pushBump) * (1 - 0.35 * settle) * breathe;
  const emDraw = prog(t, B.l26 - 0.2, B.l26e - 0.6, E.out);
  const emOp = clamp(clear / 25 + 0.3) * prog(t, B.l26 - 0.2, B.l26 + 1.2, E.inOut);

  // ------------------------------------------------------------ title
  const tt = t - B.title;
  const clOp = prog(tt, 0, 1.1, E.out);
  const clTrack = 0.02 + 0.12 * (1 - prog(tt, 0, 2.6, E.out));
  const sweep = -30 + 160 * prog(tt, 0.4, 3.2, E.inOut);
  const tagOp = prog(tt, 0.8, 1.9, E.out);
  const hudOp = prog(tt, 1.8, 3.0, E.out) * 0.62;
  const fadeOut = prog(t, B.fade0, dur, E.inOut);
  const titleScale = 1 + 0.02 * prog(t, B.title, dur, E.linear);

  const box = emSize * 3;
  const maskCss = limbCircle
    ? `radial-gradient(circle ${limbCircle.r.toFixed(1)}px at ${(limbCircle.x - sun.x + box / 2).toFixed(1)}px ${(limbCircle.y - sun.y + box / 2).toFixed(1)}px, rgba(0,0,0,0) ${(limbCircle.r - 1).toFixed(1)}px, #000 ${(limbCircle.r + 2).toFixed(1)}px)`
    : undefined;

  return (
    <AbsoluteFill style={{background: C.void, overflow: 'hidden'}}>
      <ShaderCanvas
        frag={S10_FRAG}
        scale={0.5}
        uniforms={{
          uCamP: cam.P,
          uCamR: cam.R,
          uCamU: cam.U,
          uCamF: cam.F,
          uFocal: f,
          uSunDir: sunDir,
          uLightDir: lightDir,
          uSunPx: [sun.x, sun.y],
          uSunI: 1,
          uCorona: corona,
          uRayLen: rayLen,
          uRayRot: rot * DEG,
          uRayA: RAY_A,
          uRayL: RAY_L,
          uGod: god,
          uFlare: flareI,
          uBloom: bloom,
          uFlash: flash,
          uIgn: ign,
          uSpin: 0.9 + t * 0.012,
          uStarI: lerp(1, 0.45, rise) * (1 - 0.3 * pushBump) + 0.25 * settle,
          uExpo: 1.0,
          uNightCity: 1,
        }}
      />
      <ThreeCanvas width={1920} height={1080} camera={{fov: 40, position: [0, 0, 1.2], near: 0.001, far: 50}} style={{position: 'absolute'}}>
        <CamRig cam={cam} />
        <PointCloud count={1600} seed={101} body={MOTES} uniforms={{uCam: cam.P, uSun: sunDir, uMote: (0.6 + 0.6 * rise) * (1 - 0.4 * settle)}} />
      </ThreeCanvas>

      {/* the emblem at the sun's core, masked by the limb while it rises */}
      {emOp > 0.001 && (
        <div
          style={{
            position: 'absolute',
            left: sun.x - box / 2,
            top: sun.y - box / 2,
            width: box,
            height: box,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: emOp,
            WebkitMaskImage: clear < box / 2 ? maskCss : undefined,
            maskImage: clear < box / 2 ? maskCss : undefined,
          }}
        >
          <ClaudeSpark size={emSize} draw={emDraw} glow={emGlow} rotate={rot} pulse={0.5 + 0.5 * Math.sin(t * 1.3)} color={C.coral} core="#FFF3DE" />
        </div>
      )}

      {/* end title */}
      {tt > 0 && (
        <AbsoluteFill style={{transform: `scale(${titleScale})`, transformOrigin: `${sun.x}px ${sun.y}px`}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: sun.y + 132,
              textAlign: 'center',
              fontFamily: F.serif,
              fontWeight: 360,
              fontSize: 150,
              lineHeight: 1,
              letterSpacing: `${clTrack}em`,
              paddingLeft: `${clTrack}em`,
              fontVariationSettings: '"opsz" 144, "SOFT" 50',
              opacity: clOp,
              transform: `translateY(${14 * (1 - clOp)}px)`,
              color: 'transparent',
              backgroundImage: `linear-gradient(100deg, ${C.ivory} ${sweep - 20}%, #FFFFFF ${sweep - 4}%, ${C.gold} ${sweep}%, #FFFFFF ${sweep + 4}%, ${C.ivory} ${sweep + 20}%)`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              textShadow: `0 0 30px ${rgba(C.gold, 0.22 * breathe)}`,
            }}
          >
            Claude
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: sun.y + 300,
              textAlign: 'center',
              fontFamily: F.serif,
              fontStyle: 'italic',
              fontWeight: 340,
              fontSize: 44,
              letterSpacing: '0.02em',
              color: rgba(C.ivory, 0.74),
              opacity: tagOp,
              transform: `translateY(${10 * (1 - tagOp)}px)`,
              fontVariationSettings: '"opsz" 72, "SOFT" 100',
            }}
          >
            For the good of humanity.
          </div>
          <div
            style={{
              position: 'absolute',
              left: 960 - 60 * tagOp,
              width: 120 * tagOp,
              top: sun.y + 280,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${rgba(C.gold, 0.7)}, transparent)`,
            }}
          />
        </AbsoluteFill>
      )}
      {hudOp > 0.001 && (
        <>
          <div style={{position: 'absolute', left: 120, bottom: 150, opacity: hudOp, fontFamily: F.mono, fontSize: 22, letterSpacing: '0.14em', color: rgba(C.gold, 0.9)}}>
            CLAUDE OPUS 5.5 <span style={{color: rgba(C.ivory, 0.55)}}>· SEP 22, 2026</span>
          </div>
          <div style={{position: 'absolute', right: 120, bottom: 150, width: 560, textAlign: 'right', opacity: hudOp}}>
            <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 24, lineHeight: 1.3, color: rgba(C.ivory, 0.78)}}>
              “exceptionally helpful while also being honest, thoughtful, and caring about the world.”
            </div>
            <div style={{marginTop: 8, fontFamily: F.mono, fontSize: 22, letterSpacing: '0.14em', color: rgba(C.gold, 0.8)}}>CLAUDE’S CONSTITUTION · 2026</div>
          </div>
        </>
      )}
      {fadeOut > 0 && <AbsoluteFill style={{background: '#000', opacity: fadeOut}} />}
    </AbsoluteFill>
  );
};

// S02 FlatLine (Chapter I · BEFORE). The warm point from S01 cools to ice and stretches into the
// timeline of human history: a cold filament hugging a dark glassy floor. Four milestones ignite,
// the camera pulls back to show the line flat across millennia, lifting only at the far end where a
// warm glint waits. A fast push into the glint ends on a gold-white flash (S03 starts on it).
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ShaderCanvas} from '../lib/ShaderCanvas';
import {PointCloud} from '../lib/PointCloud';
import {useScene} from '../lib/timing';
import {C, F, rgba, vec3} from '../theme';
import {E, clamp, lerp, prog} from '../lib/anim';
import {Cam, V3, camUniforms, lookAt, mix3, project, sub, norm, add, mul} from './S02/cam';
import {NODE_X, WORLD_FRAG, X0, XEND, XFAR, YL, lineY} from './S02/world';
import {Icon} from './S02/icons';

// Every displayed fact, checked against research/FACTS.md (sections 19–22, "Prologue" labels 31–34).
const FACTS = {
  writing: {date: 'c. 3200 BCE', name: 'Writing', place: 'Cuneiform · Mesopotamia'}, // FACTS §19 / #31
  press: {date: 'c. 1440', name: 'Printing press', place: 'Gutenberg · Europe'}, // FACTS §20 / #32 ("in Europe", never "first")
  power: {date: '1882', name: 'Electricity', place: 'Pearl Street Station · New York'}, // FACTS §21 / #33
  computer: {date: '1946', name: 'The computer', place: 'ENIAC · Penn'}, // FACTS §22 / #34 (unveiled at Penn's Moore School)
};
const MILESTONES = [FACTS.writing, FACTS.press, FACTS.power, FACTS.computer];

const F0DEG = 32; // fixed fov of the ThreeCanvas camera (PointCloud rescales to the live fov)
const F0 = 0.5 / Math.tan(((F0DEG / 2) * Math.PI) / 180);
const STEM = 1.3; // world height of the milestone stems

const bez = (a: V3, c: V3, b: V3, u: number): V3 => mix3(mix3(a, c, u), mix3(c, b, u), u);

// Filament core, ticks, rings, stems: crisp SVG line work projected with the same camera as the shader.
const LineWork: React.FC<{cam: Cam; xl: number; xr: number; lineI: number; glint: number; t: number; tIgn: number[]; cardsOut: number}> = ({
  cam,
  xl,
  xr,
  lineI,
  glint,
  t,
  tIgn,
  cardsOut,
}) => {
  const els: React.ReactNode[] = [];
  const xR = Math.min(xr, XEND);
  if (xR > xl && lineI > 0.01) {
    // samples: dense near the camera, sparse in the deep past
    const xs: number[] = [];
    const xc = clamp(cam.pos[0], xl, xR);
    const N = 70;
    for (let i = 0; i <= N; i++) xs.push(xc - (xc - xl) * Math.pow(i / N, 2.6));
    xs.reverse();
    for (let i = 1; i <= N; i++) xs.push(xc + (xR - xc) * Math.pow(i / N, 1.6));
    let prev = project(cam, [xs[0], lineY(xs[0]), 0]);
    for (let i = 1; i < xs.length; i++) {
      const x = xs[i];
      if (x - xs[i - 1] < 1e-4) continue;
      const p = project(cam, [x, lineY(x), 0]);
      if (p.z > 0.08 && prev.z > 0.08) {
        const xm = (x + xs[i - 1]) / 2;
        const zm = (p.z + prev.z) / 2;
        const fog = Math.exp(-zm * 0.016) * clamp((xm + 300) / 275);
        const w = clamp((0.011 * cam.f * 1080) / zm, 0.6, 2.4);
        const warm = clamp((xm - (XEND - 2.2)) / 2.2) * glint;
        const col = warm > 0.02 ? `rgb(${lerp(215, 255, warm)},${lerp(228, 214, warm)},${lerp(240, 160, warm)})` : '#DCE7F1';
        els.push(<line key={`l${i}`} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke={col} strokeWidth={w} strokeOpacity={clamp(lineI * fog * 0.95)} strokeLinecap="round" />);
      }
      prev = p;
    }
    // fine ticks engraved in the glass, in front of the line
    const t0 = Math.ceil(Math.max(xl, -60) / 0.5) * 0.5;
    let last: {x: number; y: number} | null = null;
    for (let x = t0; x <= xR; x += 0.5) {
      const k = Math.round(x / 0.5);
      const major = k % 5 === 0;
      const a = project(cam, [x, 0.001, 0.12]);
      const b = project(cam, [x, 0.001, major ? 0.34 : 0.21]);
      if (a.z < 0.3 || b.z < 0.3) continue;
      const sp = last ? Math.hypot(a.x - last.x, a.y - last.y) : 99;
      last = a;
      const lod = clamp((sp - 3) / 8);
      const fog = Math.exp(-a.z * 0.03);
      const op = (major ? 0.55 : 0.3) * lod * fog * lineI;
      if (op < 0.02 || a.x < -20 || a.x > 1940) continue;
      els.push(<line key={`t${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.ice} strokeOpacity={op} strokeWidth={major ? 1.3 : 1} />);
    }
  }
  // milestone nodes: marker, shockwave on the floor, stem
  NODE_X.forEach((nx, i) => {
    const drawn = xl < nx && xR > nx;
    if (!drawn) return;
    const p = project(cam, [nx, YL, 0]);
    if (p.z < 0.3) return;
    const ti = tIgn[i];
    const on = t >= ti;
    const fog = Math.exp(-p.z * 0.012);
    els.push(<circle key={`n${i}`} cx={p.x} cy={p.y} r={on ? 3.2 : 2.2} fill={on ? '#F4F8FC' : C.ice} opacity={(on ? 1 : 0.45) * fog} />);
    if (on) {
      const u = clamp((t - ti) / 1.1);
      if (u < 1) {
        const R = 1.9 * E.out(u);
        const pts: string[] = [];
        for (let k = 0; k <= 40; k++) {
          const a = (k / 40) * Math.PI * 2;
          const q = project(cam, [nx + Math.cos(a) * R, 0.002, Math.sin(a) * R]);
          pts.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
        }
        els.push(<polyline key={`s${i}`} points={pts.join(' ')} fill="none" stroke={C.ice} strokeWidth={1.4} strokeOpacity={0.75 * Math.pow(1 - u, 1.6)} />);
        els.push(<circle key={`r${i}`} cx={p.x} cy={p.y} r={6 + 26 * E.out(u)} fill="none" stroke="#fff" strokeWidth={1.2} opacity={0.8 * (1 - u)} />);
      }
      const g = E.out(clamp((t - ti - 0.05) / 0.45));
      const top = project(cam, [nx, YL + STEM * g, 0]);
      const so = (1 - cardsOut) * fog;
      if (so > 0.01) {
        els.push(<line key={`st${i}`} x1={p.x} y1={p.y - 5} x2={top.x} y2={top.y} stroke={C.ice} strokeOpacity={0.55 * so} strokeWidth={1} />);
        els.push(<circle key={`sd${i}`} cx={top.x} cy={top.y} r={2} fill={C.ice} opacity={0.8 * so * g} />);
      }
    }
  });
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      {els}
    </svg>
  );
};

// One milestone card: icon + date · name · place, floating above its stem.
const Card: React.FC<{i: number; cam: Cam; t: number; ti: number; out: number}> = ({i, cam, t, ti, out}) => {
  if (t < ti) return null;
  const nx = NODE_X[i];
  const top = project(cam, [nx, YL + STEM, 0]);
  if (top.z < 0.5) return null;
  const k = clamp(top.s / 170, 0.94, 1.06);
  const a = prog(t, ti + 0.18, ti + 0.7, E.out);
  const op = a * (1 - out);
  if (op < 0.005) return null;
  const m = MILESTONES[i];
  const txt = (d: number) => ({opacity: prog(t, ti + 0.3 + d, ti + 0.75 + d, E.out), transform: `translateY(${(1 - prog(t, ti + 0.3 + d, ti + 0.8 + d, E.out)) * 8}px)`});
  return (
    <div
      style={{
        position: 'absolute',
        left: top.x,
        top: top.y - 12,
        transform: `translate(-50%, -100%) scale(${k * (0.94 + 0.06 * a)})`,
        transformOrigin: '50% 100%',
        opacity: op,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 26px 16px 16px',
        borderRadius: 12,
        background: 'linear-gradient(180deg, rgba(30,41,60,0.82), rgba(9,12,20,0.88))',
        border: `1px solid ${rgba(C.ice, 0.26)}`,
        boxShadow: `0 0 44px ${rgba(C.cold, 0.2)}, 0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 ${rgba(C.ice, 0.2)}`,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon i={i} size={92} draw={prog(t, ti + 0.1, ti + 1.25, E.inOut)} lit={prog(t, ti + 0.9, ti + 1.4, E.out)} color={C.ice} hotColor="#F2F7FC" />
      <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
        <div style={{fontFamily: F.mono, fontSize: 30, color: C.ice, letterSpacing: '0.02em', fontWeight: 500, ...txt(0)}}>{m.date}</div>
        <div style={{fontFamily: F.sans, fontSize: 26, color: C.ivory, fontWeight: 650, letterSpacing: '0.2em', textTransform: 'uppercase', ...txt(0.08)}}>{m.name}</div>
        <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 27, color: rgba(C.ice, 0.7), fontWeight: 400, ...txt(0.16)}}>{m.place}</div>
      </div>
    </div>
  );
};

export const S02: React.FC = () => {
  const {t, dur, cue, end} = useScene('S02');
  const c3 = cue('L03');
  const c4 = cue('L04');
  const e4 = end('L04');
  const d4 = e4 - c4;
  // four ignitions spread evenly over the first ~45% of L04 (the words come fast)
  const tIgn = [0, 1, 2, 3].map((i) => c4 + 0.08 + (i / 3) * 0.45 * d4);
  const tPull0 = c4 + 0.56 * d4; // "Each took generations to reshape the world"
  const tPull1 = e4;
  const tPush = dur - 1.0;

  // --- camera (always moving: slow push, rise-and-reveal, heavy lateral track, pull-back, push)
  const K0: [V3, V3] = [[X0, YL + 0.02, 2.6], [X0, YL, 0]];
  const txA = 3.3;
  const txB = 6.8;
  const KA: [V3, V3] = [[txA - 3.5, 1.85, 12], [txA, 0.95, 0]];
  const KB: [V3, V3] = [[txB - 3.5, 1.85, 12], [txB, 0.95, 0]];
  const KC: [V3, V3] = [[24, 0.22, 12.2], [4.3, 0.3, 0]];
  const KD: [V3, V3] = [[23.2, 0.25, 11.2], [5.0, 0.31, 0]];
  let pos: V3;
  let tgt: V3;
  let fov = 32;
  if (t < c4) {
    // tiny push during the chapter card, then rise and swing out as the line is born
    const pre = prog(t, 0, 2.4, E.linear) * 0.05;
    const u = 0.88 * E.inOut(prog(t, c3 - 0.5, c4, E.linear)) + 0.12 * prog(t, c3 - 0.5, c4, E.linear);
    const p0: V3 = [K0[0][0] + pre * 2, K0[0][1], K0[0][2] - pre * 3];
    const t0: V3 = [K0[1][0] + pre * 1.6, K0[1][1], 0];
    pos = bez(p0, [-4.2, 0.5, 8.5], KA[0], u);
    tgt = bez(t0, [-2.0, 0.3, 0], KA[1], u);
    fov = lerp(32, 30, u);
  } else if (t < tPull0) {
    const u = prog(t, c4, tPull0, E.linear);
    const uu = 0.75 * u + 0.25 * E.inOut(u);
    pos = mix3(KA[0], KB[0], uu);
    tgt = mix3(KA[1], KB[1], uu);
    fov = 30;
  } else if (t < tPull1) {
    const u = prog(t, tPull0, tPull1, E.inOut);
    pos = bez(KB[0], [12, 1.4, 21], KC[0], u);
    tgt = bez(KB[1], [5.5, 0.4, 0], KC[1], u);
    fov = lerp(30, 32, u);
  } else {
    const u = prog(t, tPull1, tPush, E.linear);
    pos = mix3(KC[0], KD[0], u);
    tgt = mix3(KC[1], KD[1], u);
  }
  // final push into the glint, accelerating
  const G: V3 = [XEND, lineY(XEND), 0];
  const up = prog(t, tPush, dur, E.linear);
  if (up > 0) {
    const dir = norm(sub(pos, G));
    const dest = add(G, mul(dir, 0.18));
    pos = mix3(pos, dest, Math.pow(up, 2.6));
    tgt = mix3(tgt, G, E.inOut(clamp(up * 1.7)));
  }
  // slow organic drift on top of every move
  pos = add(pos, [Math.sin(t * 0.37) * 0.04, Math.sin(t * 0.53 + 1) * 0.02 * clamp(t / 3), 0]);
  const cam = lookAt(pos, tgt, fov);

  // --- the line being born from the point
  const tau = t - (c3 - 0.15);
  const grow = tau > 0 ? 0.07 * (Math.exp(tau * 3.1) - 1) : 0;
  const xl = Math.max(XFAR, X0 - grow);
  const xr = Math.min(XEND, X0 + grow);
  const lineI = clamp(grow / 0.3) * (0.9 + 0.1 * Math.sin(t * 1.3));
  const tipI = clamp(grow / 0.2) * (1 - prog(tau, 1.0, 1.8, E.inOut)) * 1.3;
  const cool = prog(t, 0.1, 1.6, E.inOut);
  const pointCol = [0, 1, 2].map((k) => lerp(vec3(C.gold)[k] * 1.05, vec3(C.ice)[k], cool));
  const pointI = (1.0 + 0.12 * Math.sin(t * 2.4)) * (1 - 0.75 * prog(tau, 0.2, 1.8, E.inOut));
  const env = lerp(0.15, 1, prog(t, 1.2, c3 + 2.0, E.inOut));

  const ign = tIgn.map((ti) => (t < ti ? 0.12 : 0.8 + 2.2 * Math.exp(-(t - ti) * 3.2) + 0.08 * Math.sin(t * 2 + ti)));
  const glint =
    prog(t, tPull0 + 1.0, tPull1 + 0.2, E.inOut) * (0.8 + 0.15 * Math.sin(t * 5.1) * Math.sin(t * 3.3)) + prog(t, tPull1, tPush, E.linear) * 0.3 + Math.pow(up, 2) * 3.5;
  const push = Math.pow(up, 1.3);
  const cardsOut = prog(t, tPull0 - 0.1, tPull0 + 0.9, E.inOut);

  // flash: last ~0.22 s ramps to full-frame gold-white
  const flash = prog(t, dur - 0.24, dur - 1 / 30, E.in);
  const glintScreen = project(cam, G);

  return (
    <AbsoluteFill style={{background: C.void}}>
      <ShaderCanvas
        frag={WORLD_FRAG}
        scale={0.5}
        uniforms={{
          ...camUniforms(cam),
          uXL: xl,
          uXR: xr,
          uLineI: lineI,
          uTipI: tipI,
          uX0: X0,
          uPointI: pointI,
          uPointCol: pointCol,
          uIgn: ign,
          uIgnT: tIgn,
          uGlint: glint,
          uPush: push,
          uEnv: env,
          uWake: 1,
        }}
      />
      <ThreeCanvas width={1920} height={1080} camera={{fov: F0DEG, position: [0, 0, 0], rotation: [0, 0, 0], near: 0.01, far: 500}} gl={{antialias: false}} style={{position: 'absolute', inset: 0}}>
        <PointCloud
          count={5000}
          seed={21}
          uniforms={{...camUniforms(cam), uF0: F0, uDust: clamp(0.25 + env)}}
          body={`
            vec3 p = vec3(mix(-14., 30., aSeed.x), .03 + pow(aSeed.y, 1.7) * 4.2, mix(-9., 19., aSeed.z));
            p += vec3(uTime * .05, uTime * .012 * (aSeed2.x - .3), 0.);
            p += curl(p * .16 + vec3(0., 0., uTime * .025)) * .3;
            vec3 d = p - uCamPos;
            vec3 c = vec3(dot(d, uCamRt), dot(d, uCamUp), -dot(d, uCamFw));
            c.xy *= uFocal / uF0;
            pos = c;
            float z = -c.z;
            float big = step(.975, aSeed2.y);
            size = (.8 + 2.2 * pow(aSeed.w, 3.)) * (1. + big * 5.);
            size = min(size, 6. * z); // cap the sprite at ~60 px (huge sprites show square edges)
            color = mix(vec3(.74, .82, .9), vec3(.45, .56, .67), aSeed2.z);
            alpha = smoothstep(.7, 1.8, z) * (1. - smoothstep(16., 38., z)) * (.3 + .5 * aSeed2.w) * (1. - big * .75) * uDust;
          `}
        />
      </ThreeCanvas>
      <LineWork cam={cam} xl={xl} xr={xr} lineI={lineI} glint={glint} t={t} tIgn={tIgn} cardsOut={cardsOut} />
      {/* crisp core of the S01 point (warm, cooling to ice) */}
      {tau < 1.2 && (
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
          {(() => {
            const p = project(cam, [X0, YL, 0]);
            const c = pointCol.map((v) => Math.round(clamp(v) * 255));
            return <circle cx={p.x} cy={p.y} r={3.2} fill={`rgb(${c[0]},${c[1]},${c[2]})`} opacity={clamp(1 - tau / 1.2)} />;
          })()}
        </svg>
      )}
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} i={i} cam={cam} t={t} ti={tIgn[i]} out={cardsOut} />
      ))}
      {/* hot pin-point of the warm glint */}
      {glint > 0.02 && glintScreen.z > 0.2 && (
        <div
          style={{
            position: 'absolute',
            left: glintScreen.x - 3,
            top: glintScreen.y - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            background: '#FFF6E6',
            opacity: clamp(glint),
            boxShadow: `0 0 10px 3px ${rgba(C.gold, 0.8)}`,
          }}
        />
      )}
      {flash > 0 && (
        <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, #FFFBF2 0%, #FCEBC9 45%, ${C.gold} 110%)`, opacity: flash}} />
      )}
    </AbsoluteFill>
  );
};

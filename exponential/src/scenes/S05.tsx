// S05 HeroBorn: II · THE HERO.
// L10 a small team gathers like a campfire in a vast cold world (2021 · ANTHROPIC)
// L11 raw cold-electric power is caged by warm light and calmed (POWERFUL / SAFE)
// L12 a constitution engraves itself; HELPFUL · HONEST · HARMLESS charge the forming emblem
// L13 tens of thousands of particles converge; the ClaudeSpark IGNITES on "Claude"; hold; pull back into the S06 HUD.
import React, {useMemo} from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ShaderCanvas} from '../lib/ShaderCanvas';
import {PointCloud} from '../lib/PointCloud';
import {ClaudeSpark} from '../lib/ClaudeSpark';
import {useScene} from '../lib/timing';
import {C, F, rgba} from '../theme';
import {E, clamp, lerp, prog, rnd, shake} from '../lib/anim';
import {BG_FRAG} from './S05/shaders';
import {DUST, GROUND, HERO_PTS} from './S05/points';
import {CamRig, CamPose, makeCam, applyPose, project, pxPerUnit} from './S05/camera';
import {CAGE} from './S05/geo';
import {VO_FRAC} from './S05/vo';
import {Constitution} from './S05/Constitution';
import {FLY_S05, HERO, HERO_ROT_END, flyAt} from './S06/layout';

// Every displayed fact. Checked against research/FACTS.md (section numbers in comments).
const FACTS = {
  founded: '2021', // §4: first announcement May 28, 2021
  company: 'ANTHROPIC', // §4
  launch: 'MARCH 2023', // §6: Claude launched Mar 14, 2023
  name: 'Claude',
  // §14: verbatim line from Claude's constitution (rendered in S05/Constitution.tsx)
};

type V3 = [number, number, number];
const L3 = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

const S_WORLD = 2.05; // emblem diameter in world units (at z=0)
const SPH_R = 0.86; // energy sphere radius
const CAGE_R = 1.3;
const FIRE: V3 = [0, -1.28, 0];
const GROUND_Y = -1.45;

// The team: 7 small warm lights.
const TEAM = Array.from({length: 7}, (_, i) => {
  const a = (i / 7) * Math.PI * 2 + rnd(`ta${i}`) * 0.6;
  const r0 = 1.9 + rnd(`tr${i}`) * 1.8;
  const a1 = (i / 7) * Math.PI * 2 + 0.4;
  const r1 = 0.1 + rnd(`tc${i}`) * 0.2;
  return {
    start: [Math.cos(a) * r0, FIRE[1] + 0.05 + rnd(`ty${i}`) * 0.1, Math.sin(a) * r0 * 0.7] as V3,
    home: [Math.cos(a1) * r1, FIRE[1] + 0.06 + rnd(`th${i}`) * 0.14, Math.sin(a1) * r1 * 0.8] as V3,
    delay: rnd(`td${i}`) * 0.7,
    size: 0.8 + rnd(`ts${i}`) * 0.45,
  };
});

const rotY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];

export const S05: React.FC = () => {
  const {t, dur, cue, end} = useScene('S05');
  const at = (L: string, f: number) => cue(L) + f * (end(L) - cue(L));
  const B = {
    y2021: at('L10', VO_FRAC.L10.y2021),
    anthropic: at('L10', VO_FRAC.L10.anthropic),
    c11: cue('L11'),
    powerful: at('L11', VO_FRAC.L11.powerful),
    history: at('L11', VO_FRAC.L11.history),
    built: at('L11', VO_FRAC.L11.built),
    safely: at('L11', VO_FRAC.L11.safely),
    c12: cue('L12'),
    principles: at('L12', VO_FRAC.L12.principles),
    words: [at('L12', VO_FRAC.L12.helpful), at('L12', VO_FRAC.L12.honest), at('L12', VO_FRAC.L12.harmless)],
    c13: cue('L13'),
    march: at('L13', VO_FRAC.L13.march),
    ign: at('L13', VO_FRAC.L13.claude),
    fly: dur - FLY_S05,
  };

  // ---------------- camera ----------------
  const a = prog(t, 0, B.c11 + 0.4, E.inOut);
  let pos: V3 = L3([1.1, 0.75, 13.8], [0.3, 0.05, 9.4], a);
  let tgt: V3 = [FIRE[0], FIRE[1], FIRE[2]];
  const b = prog(t, B.c11 - 0.5, B.c11 + 1.8, E.inOut);
  pos = L3(pos, [-0.4, 0.18, 7.7], b);
  tgt = L3(tgt, [0, 0, 0], b);
  const orb = prog(t, B.c11, B.c12 + 1, E.inOut);
  pos = [pos[0] + Math.sin(orb * 2.2) * 0.45 * b, pos[1], pos[2]];
  const c = prog(t, B.c12 - 0.5, B.c12 + 1.4, E.inOut);
  pos = L3(pos, [0.25, 0.08, 7.3], c);
  const d = prog(t, B.c13 - 1.0, B.c13 + 0.5, E.inOut);
  pos = L3(pos, [0, 0, 9.2], d);
  const zEnd = (S_WORLD * 1080) / (2 * Math.tan((22.5 * Math.PI) / 180) * HERO.size); // emblem = HERO.size px at the fly
  pos = [pos[0], pos[1], pos[2] - (9.2 - zEnd) * prog(t, B.c13 + 0.5, B.fly, (x) => x) * d];
  // constant gentle hand-held drift
  pos = [pos[0] + Math.sin(t * 0.31) * 0.06, pos[1] + Math.cos(t * 0.27) * 0.04, pos[2]];
  const pose: CamPose = {pos, target: tgt, roll: Math.sin(t * 0.2) * 0.006};
  const cam = useMemo(() => makeCam(pose), []); // eslint-disable-line react-hooks/exhaustive-deps
  applyPose(cam, pose);
  const P = (v: V3) => project(cam, v[0], v[1], v[2]);
  const origin = P([0, 0, 0]);
  const ppu0 = pxPerUnit(cam, origin.depth);

  // ---------------- L10: the team ----------------
  const gather = prog(t, 1.3, B.anthropic + 0.3, E.inOut);
  const rise = prog(t, B.c11 + 1.6, B.history, E.inOut);
  const cageP = prog(t, B.history - 0.15, B.safely + 0.15, E.inOut);
  const spin = 0.35 + t * 0.16;
  const collapse = prog(t, B.c12 - 0.15, B.c12 + 0.75, E.in);
  const cageScale = CAGE_R * (1 - collapse);
  const vtx = (i: number): V3 => {
    const v = rotY(CAGE.verts[i], spin);
    return [v[0] * cageScale, v[1] * cageScale, v[2] * cageScale];
  };
  const teamPos = TEAM.map((m, i) => {
    const g = prog(gather, m.delay * 0.3, 1, (x) => x);
    let p = L3(m.start, m.home, E.inOut(g));
    p = [p[0], p[1] + Math.sin(t * 1.3 + i) * 0.02, p[2]];
    if (rise > 0) {
      const path = CAGE.paths[i];
      const seed = vtx(path[0]);
      const r = E.inOut(rise);
      const up = L3(p, seed, r);
      p = [up[0], up[1] + Math.sin(r * Math.PI) * 0.25, up[2]];
      if (cageP > 0) {
        const f = cageP * (path.length - 1);
        const k = Math.min(path.length - 2, Math.floor(f));
        p = k >= 0 && path.length > 1 ? L3(vtx(path[k]), vtx(path[k + 1]), f - k) : seed;
      }
    }
    return p;
  });
  const teamOn = prog(t, 1.4, 2.6) * (1 - prog(t, B.safely + 0.2, B.c12 + 0.3));
  const fireP = P(FIRE);
  const fire = prog(t, 1.6, B.anthropic + 0.4) * (0.35 + 0.65 * gather) * (1 - 0.8 * prog(t, B.c11 + 1.4, B.history));

  // ---------------- L11: power & safety ----------------
  const sphOn = prog(t, B.c11 + 0.1, B.powerful - 0.1, E.inOut) * (1 - collapse);
  const chaos = (0.35 + 0.65 * prog(t, B.c11 + 0.2, B.powerful)) * (1 - prog(t, B.safely - 0.05, B.safely + 1.0, E.inOut));
  const order = prog(t, B.safely - 0.25, B.safely + 1.2, E.inOut);
  const sphR = SPH_R * ppu0 * (1 - collapse * 0.97);
  const closeHit = Math.exp(-Math.max(0, t - (B.safely + 0.1)) * 3) * (t > B.safely + 0.1 ? 1 : 0);

  // ---------------- L12: constitution ----------------
  const docOn = prog(t, B.c12 + 0.1, B.c12 + 0.5) * (1 - prog(t, B.c13 - 0.2, B.c13 + 0.5));
  const recede = prog(t, B.principles - 0.1, B.principles + 0.8, E.inOut);
  const stamp = B.words.map((w) => prog(t, w - 0.05, w + 0.3, E.out));
  const arrive = B.words.map((w) => w + 0.55);
  const charged = arrive.reduce((s, w) => s + prog(t, w - 0.02, w + 0.25, E.out), 0) / 3; // 0..1
  const wordsOn = 1 - prog(t, B.c13 - 0.1, B.c13 + 0.6, E.inOut);

  // ---------------- L13: reveal ----------------
  const conv = prog(t, B.c13 - 0.35, B.ign - 0.08, (x) => x);
  const ignK = t >= B.ign ? 1 : 0;
  const since = t - B.ign;
  const flash = ignK * (prog(t, B.ign, B.ign + 0.05) * Math.exp(-Math.max(0, since - 0.05) * 5.5));
  const post = prog(t, B.ign, B.ign + 1.6, E.out);
  const burst = ignK * 5.5 * E.out(clamp(since / 1.8));
  const shockR = ignK * 1500 * E.out(clamp(since / 1.5));
  const shockI = ignK * Math.exp(-since * 2.2) * 1.2;
  const flyTau = t - B.fly;
  const flying = flyTau >= 0;
  const flyK = prog(t, B.fly, dur, E.inOut);
  const rays = ignK * (1.2 * Math.exp(-since * 2.5) + 0.45) * (1 - prog(t, B.fly - 0.1, B.fly + 0.6));
  const sh = shake(t, B.ign, 13, 5.5);

  // emblem state
  const emb = (() => {
    const ppu = ppu0;
    const size = S_WORLD * ppu;
    const breathe = 1 + 0.018 * Math.sin((t - B.ign) * 2.4) * post;
    let st = {x: origin.x, y: origin.y, size: size * breathe, rot: 3 * Math.sin(t * 0.35) * post, draw: 0, glow: 0.3, op: 0, pulse: 0};
    if (t >= B.principles) {
      st.draw = 0.12 + 0.88 * charged;
      st.op = prog(t, B.principles, B.principles + 0.5) * (0.5 + 0.35 * charged);
      st.glow = 0.25 + 0.5 * charged;
    }
    if (t >= B.c13 - 0.3) {
      st.op = lerp(st.op, 0.55, prog(t, B.c13 - 0.3, B.c13 + 0.3));
      st.glow = lerp(st.glow, 0.3, prog(t, B.c13 - 0.3, B.c13 + 0.3)) + conv * 0.6;
    }
    if (ignK) {
      st.op = 1;
      st.draw = 1;
      st.glow = 0.95 + 1.1 * Math.exp(-since * 2.2);
      st.pulse = 0.5 + 0.5 * Math.sin(since * 2.4);
    }
    if (flying) {
      const f = flyAt(flyTau);
      st = {...st, x: f.x, y: f.y, size: f.size, rot: lerp(st.rot, HERO_ROT_END, f.u) + f.spin, glow: lerp(st.glow, 0.7, f.u)};
    }
    return st;
  })();

  // ---------------- background uniforms ----------------
  const warm = 0.08 + 0.25 * order + 0.3 * prog(t, B.c12, B.principles) + 0.37 * prog(t, B.ign - 0.4, B.ign + 0.5);
  const coreI = (t >= B.principles ? 0.25 + 0.55 * charged : 0) * (1 - prog(t, B.c13 - 0.3, B.c13 + 0.3) * 0.4) + conv * 0.5 + ignK * (1.6 * Math.exp(-since * 2.4) + 0.45);
  const coreOn = coreI * (1 - 0.8 * flyK) * prog(t, B.c12 - 0.2, B.principles + 0.3);
  const camPar = {x: (pos[0] - 0.3) * 60, y: -(pos[1]) * 60};
  const fadeIn = prog(t, 0, 0.5);

  // collapse point: the calmed sphere shrinks into a spark that seeds the document
  const seedGlow = Math.sin(Math.PI * clamp(collapse)) * (1 - prog(t, B.c12 + 0.6, B.c12 + 1.2));

  const layerShift = `translate(${sh.x}px, ${sh.y}px) scale(${1 + 0.02 * ignK * Math.exp(-since * 3)})`;

  return (
    <AbsoluteFill style={{background: C.void, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: layerShift}}>
        <ShaderCanvas
          frag={BG_FRAG}
          scale={0.5}
          uniforms={{
            uCam: [camPar.x, camPar.y],
            uWarm: warm,
            uFire: [fireP.x, fireP.y, fire],
            uSph: [origin.x, origin.y, Math.max(1, sphR), sphOn + seedGlow * 0.5],
            uChaos: chaos,
            uOrder: order,
            uSpin: spin,
            uCore: [emb.x, emb.y, 70 + 40 * charged + 60 * ignK, coreOn + seedGlow * 1.2],
            uRays: rays,
            uShock: [shockR, shockI],
            uNeb: 0.8 + 0.2 * warm,
            uFade: fadeIn * (1 - 0.5 * flyK),
          }}
        />
        <AbsoluteFill>
          <ThreeCanvas width={1920} height={1080} camera={{fov: 45, position: [0, 0, 10]}}>
            <CamRig pose={pose} />
            <PointCloud
              count={150 * 100}
              seed={11}
              body={GROUND}
              uniforms={{uGy: GROUND_Y, uFireXZ: [FIRE[0], FIRE[2], fire * 1.2], uGround: (1 - prog(t, B.c11 + 0.8, B.c12)) * prog(t, 0.2, 2.0)}}
            />
            <PointCloud count={2600} seed={5} body={DUST} uniforms={{uWarmD: warm, uDust: 0.9 - 0.3 * flyK}} />
            {t > B.c13 - 0.5 && (
              <PointCloud
                count={32000}
                seed={23}
                sprite="spark"
                body={HERO_PTS}
                uniforms={{uConv: conv, uSz: S_WORLD, uRotE: 0, uPost: post, uBurst: burst, uOn: prog(t, B.c13 - 0.5, B.c13) * (1 - flyK)}}
              />
            )}
          </ThreeCanvas>
        </AbsoluteFill>

        {/* L10 team lights */}
        {teamOn > 0.001 &&
          teamPos.map((p, i) => {
            const s = P(p);
            const k = pxPerUnit(cam, s.depth) / 150;
            const fl = 0.8 + 0.2 * Math.sin(t * 9 + i * 2.3) * Math.sin(t * 5.3 + i);
            const on = teamOn * prog(t, 1.4 + TEAM[i].delay * 0.6, 2.4 + TEAM[i].delay * 0.6);
            const sz = 64 * k * TEAM[i].size;
            return (
              <div key={i} style={{position: 'absolute', left: s.x - sz / 2, top: s.y - sz / 2, width: sz, height: sz, opacity: on * fl}}>
                <div style={{position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle, ${rgba(C.gold, 0.9)} 0%, ${rgba(C.ember, 0.45)} 18%, ${rgba(C.coral, 0.12)} 45%, rgba(0,0,0,0) 70%)`}} />
                <div style={{position: 'absolute', left: sz / 2 - 5 * k, top: sz / 2 - 5 * k, width: 10 * k, height: 10 * k, borderRadius: '50%', background: '#FFF6E6', boxShadow: `0 0 ${8 * k}px ${C.gold}`}} />
              </div>
            );
          })}

        {/* L11 cage of warm light */}
        {cageP > 0 && collapse < 1 && <Cage t={t} P={P} vtx={vtx} progress={cageP} fade={1 - collapse} hit={closeHit} order={order} />}

        {/* L12 constitution */}
        <Constitution t={t} t0={B.c12} op={docOn} recede={recede} cx={960} cy={500} tilt={Math.sin(t * 0.3) * 5 - 3} />
        {t > B.principles - 0.2 && wordsOn > 0.001 && <Principles t={t} words={B.words} stamp={stamp} on={wordsOn} target={{x: emb.x, y: emb.y}} />}

        {/* the emblem */}
        {emb.op > 0.001 && (
          <>
            {flying &&
              [0.09, 0.06, 0.03].map((dt, i) => {
                const g = flyAt(Math.max(0, flyTau - dt));
                return (
                  <div key={i} style={{position: 'absolute', left: g.x - g.size / 2, top: g.y - g.size / 2, opacity: 0.16 + i * 0.08}}>
                    <ClaudeSpark size={g.size} glow={0} rotate={HERO_ROT_END * g.u + g.spin} />
                  </div>
                );
              })}
            <div style={{position: 'absolute', left: emb.x - emb.size / 2, top: emb.y - emb.size / 2, opacity: emb.op}}>
              <ClaudeSpark size={emb.size} draw={emb.draw} glow={emb.glow} rotate={emb.rot} pulse={emb.pulse} core={ignK ? '#FFE9C7' : C.gold} />
            </div>
          </>
        )}

        {/* ignition: crisp shockwave ring + anamorphic flare */}
        {ignK > 0 && since < 1.6 && (
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
            <circle cx={emb.x} cy={emb.y} r={shockR * 0.97} fill="none" stroke={rgba(C.ivory, 0.9 * Math.exp(-since * 2.6))} strokeWidth={2.2} />
            <circle cx={emb.x} cy={emb.y} r={shockR * 0.62} fill="none" stroke={rgba(C.gold, 0.5 * Math.exp(-since * 3))} strokeWidth={1.2} />
          </svg>
        )}
        {ignK > 0 && <Flare x={emb.x} y={emb.y} k={(1.0 * Math.exp(-since * 2.0) + 0.22) * (1 - flyK)} />}
      </AbsoluteFill>

      {/* labels live outside the shake so type stays readable */}
      <Labels t={t} B={B} fireY={fireP.y} sph={{x: origin.x, y: origin.y, r: (CAGE_R * ppu0) * (1 - collapse)}} flyK={flyK} />

      {/* flash */}
      {flash > 0.001 && (
        <AbsoluteFill style={{background: `radial-gradient(circle at ${emb.x}px ${emb.y}px, #FFF8EC 0%, ${rgba(C.gold, 0.85)} 30%, ${rgba(C.ember, 0.6)} 100%)`, opacity: flash * 0.9, mixBlendMode: 'screen'}} />
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------

const Cage: React.FC<{
  t: number;
  P: (v: V3) => {x: number; y: number; depth: number};
  vtx: (i: number) => V3;
  progress: number;
  fade: number;
  hit: number;
  order: number;
}> = ({P, vtx, progress, fade, hit, order}) => {
  const pts = CAGE.verts.map((_, i) => {
    const w = vtx(i);
    const s = P(w);
    return {...s, z: w[2]};
  });
  const zr = Math.max(0.001, CAGE_R);
  const lines = CAGE.edges.map((e, k) => {
    const local = clamp((progress - e.key * 0.72) / 0.28);
    if (local <= 0) return null;
    const a = pts[e.from];
    const b = pts[e.to];
    const x2 = lerp(a.x, b.x, E.out(local));
    const y2 = lerp(a.y, b.y, E.out(local));
    const front = clamp((a.z + b.z) / (2 * zr) * 0.5 + 0.5);
    const o = (0.22 + 0.78 * front) * fade * (1 + hit * 0.8);
    return (
      <g key={k}>
        <line x1={a.x} y1={a.y} x2={x2} y2={y2} stroke={rgba(C.ember, 0.22 * o)} strokeWidth={6} strokeLinecap="round" />
        <line x1={a.x} y1={a.y} x2={x2} y2={y2} stroke={rgba(order > 0.5 ? C.gold : C.gold, 0.85 * o)} strokeWidth={1.5} strokeLinecap="round" />
      </g>
    );
  });
  const nodes = pts.map((s, i) => {
    const on = CAGE.edges.some((e) => (e.from === i || e.to === i) && progress - e.key * 0.72 > 0.12);
    if (!on) return null;
    const front = clamp(s.z / zr * 0.5 + 0.5);
    const o = (0.3 + 0.7 * front) * fade;
    return (
      <g key={i}>
        <circle cx={s.x} cy={s.y} r={7 + hit * 6} fill={rgba(C.ember, 0.18 * o)} />
        <circle cx={s.x} cy={s.y} r={2.3} fill={rgba('#FFF4E0', 0.95 * o)} />
      </g>
    );
  });
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      {lines}
      {nodes}
    </svg>
  );
};

const WORDS = ['HELPFUL', 'HONEST', 'HARMLESS'];
const WY = 790;
const W_SIZE = 56;
const W_TRACK = 0.16; // em, final tracking
const SEP_GAP = 46; // px on each side of a separator dot

// Measure the words once (fonts are loaded before render) so separators sit at exactly equal gaps.
let wordLayout: {x: number[]; w: number[]} | null = null;
const layoutWords = () => {
  if (wordLayout) return wordLayout;
  let widths = WORDS.map((w) => w.length * W_SIZE * 0.78);
  try {
    const cv = document.createElement('canvas').getContext('2d');
    if (cv) {
      cv.font = `380 ${W_SIZE}px 'Fraunces Variable'`;
      widths = WORDS.map((w) => cv.measureText(w).width + w.length * W_SIZE * W_TRACK);
    }
  } catch {
    // keep estimate
  }
  const total = widths.reduce((a, b) => a + b, 0) + 4 * SEP_GAP;
  let x = 960 - total / 2;
  const xs: number[] = [];
  widths.forEach((w) => {
    xs.push(x + w / 2);
    x += w + 2 * SEP_GAP;
  });
  wordLayout = {x: xs, w: widths};
  return wordLayout;
};

const Principles: React.FC<{t: number; words: number[]; stamp: number[]; on: number; target: {x: number; y: number}}> = ({t, words, stamp, on, target}) => {
  const {x: WX, w: WW} = layoutWords();
  return (
    <AbsoluteFill style={{opacity: on}}>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {words.map((w, i) => {
          const x0 = WX[i];
          const y0 = WY - 44;
          const cx = (x0 + target.x) / 2 + (x0 - target.x) * 0.1;
          const cy = y0 - 150;
          const ty = target.y + 60;
          const d = `M${x0},${y0} Q${cx},${cy} ${target.x},${ty}`;
          const fly = prog(t, w + 0.08, w + 0.55, E.in);
          const trail = clamp(fly);
          const fadeTrail = 1 - prog(t, w + 0.55, w + 1.4);
          if (t < w + 0.05) return null;
          const q = (k: number) => ({
            x: (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * cx + k * k * target.x,
            y: (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cy + k * k * ty,
          });
          const head = q(trail);
          return (
            <g key={i}>
              <path d={d} fill="none" stroke={rgba(C.gold, 0.55 * fadeTrail)} strokeWidth={1.4} pathLength={1} strokeDasharray={`${trail} 1`} />
              <path d={d} fill="none" stroke={rgba(C.ember, 0.18 * fadeTrail)} strokeWidth={7} pathLength={1} strokeDasharray={`${trail} 1`} />
              {fly < 1 && (
                <>
                  <circle cx={head.x} cy={head.y} r={16} fill={rgba(C.gold, 0.25)} />
                  <circle cx={head.x} cy={head.y} r={4.5} fill="#FFF6E6" />
                </>
              )}
            </g>
          );
        })}
      </svg>
      {WORDS.map((word, i) => {
        const s = stamp[i];
        if (s <= 0) return null;
        const hot = Math.exp(-Math.max(0, t - words[i]) * 2.2);
        const tr = W_TRACK + 0.14 * (1 - s);
        return (
          <div key={word} style={{position: 'absolute', left: WX[i] - 300, width: 600, top: WY - 38, height: 76, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div
              style={{
                fontFamily: F.serif,
                fontSize: W_SIZE,
                fontWeight: 380,
                letterSpacing: `${tr}em`,
                marginRight: `-${tr}em`,
                lineHeight: '76px',
                whiteSpace: 'nowrap',
                color: hot > 0.4 ? '#FFF3E2' : C.ivory,
                fontVariationSettings: '"opsz" 144, "SOFT" 50',
                opacity: clamp(s * 1.6),
                transform: `scale(${1.28 - 0.28 * s})`,
                textShadow: `0 0 ${10 + 30 * hot}px ${rgba(C.ember, 0.4 + 0.5 * hot)}, 0 0 4px rgba(0,0,0,0.9)`,
              }}
            >
              {word}
            </div>
            <div style={{width: WW[i] * s + 120 * hot, height: 1.5, marginTop: 2, background: `linear-gradient(90deg, rgba(0,0,0,0), ${rgba(C.gold, 0.4 + 0.6 * hot)}, rgba(0,0,0,0))`}} />
          </div>
        );
      })}
      {[0, 1].map((i) => {
        const sx = WX[i] + WW[i] / 2 + SEP_GAP;
        return <div key={i} style={{position: 'absolute', left: sx - 4, top: WY - 6, width: 8, height: 8, borderRadius: 4, background: rgba(C.gold, 0.7 * clamp(stamp[i + 1] * 2))}} />;
      })}
    </AbsoluteFill>
  );
};

const Flare: React.FC<{x: number; y: number; k: number}> = ({x, y, k}) => (
  <AbsoluteFill style={{mixBlendMode: 'screen', pointerEvents: 'none', opacity: clamp(k)}}>
    <div style={{position: 'absolute', left: 0, width: 1920, top: y - 40, height: 80, background: `radial-gradient(ellipse 50% 50% at ${x}px 50%, ${rgba(C.ember, 0.45)} 0%, ${rgba(C.coral, 0.12)} 45%, rgba(0,0,0,0) 100%)`}} />
    <div style={{position: 'absolute', left: 0, width: 1920, top: y - 1.5, height: 3, background: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${rgba(C.coral, 0.5)} ${(x / 1920) * 100 - 30}%, #FFF2DC ${(x / 1920) * 100}%, ${rgba(C.coral, 0.5)} ${(x / 1920) * 100 + 30}%, rgba(0,0,0,0) 100%)`}} />
    <div style={{position: 'absolute', left: x - 1, width: 2, top: y - 220, height: 440, background: `linear-gradient(180deg, rgba(0,0,0,0), ${rgba(C.gold, 0.5)} 50%, rgba(0,0,0,0))`}} />
  </AbsoluteFill>
);

const Labels: React.FC<{
  t: number;
  B: {y2021: number; anthropic: number; c11: number; powerful: number; safely: number; c12: number; march: number; ign: number; c13: number};
  fireY: number;
  sph: {x: number; y: number; r: number};
  flyK: number;
}> = ({t, B, fireY, sph, flyK}) => {
  // L10
  const y1 = prog(t, B.y2021, B.y2021 + 0.8, E.out) * (1 - prog(t, B.c11 + 0.2, B.c11 + 0.9));
  const y2 = prog(t, B.anthropic - 0.45, B.anthropic + 0.5, E.out) * (1 - prog(t, B.c11 + 0.2, B.c11 + 0.9));
  // L11
  const pw = prog(t, B.powerful - 0.1, B.powerful + 0.6, E.out) * (1 - prog(t, B.c12 - 0.3, B.c12 + 0.2));
  const sf = prog(t, B.safely - 0.05, B.safely + 0.6, E.out) * (1 - prog(t, B.c12 - 0.3, B.c12 + 0.2));
  // L13
  const since = t - B.ign;
  const nm = prog(t, B.ign + 0.08, B.ign + 1.1, E.out) * (1 - prog(t, B.ign + 99, B.ign + 100)) * (1 - flyK * 2.2);
  const dt = prog(t, B.march, B.march + 0.8, E.out) * (1 - clamp(flyK * 2.2));
  const halo = '0 0 14px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.9)';
  const topL = Math.min(fireY + 70, 640);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {(y1 > 0 || y2 > 0) && (
        <div style={{position: 'absolute', left: 0, right: 0, top: topL, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{width: 1, height: 44 * y1, background: `linear-gradient(180deg, ${rgba(C.gold, 0)}, ${rgba(C.gold, 0.7)})`, marginBottom: 10}} />
          <div style={{fontFamily: F.mono, fontWeight: 300, fontSize: 44, letterSpacing: '0.24em', paddingLeft: '0.24em', color: rgba(C.ivory, 0.92), opacity: y1, transform: `translateY(${(1 - y1) * 10}px)`, textShadow: halo}}>
            {FACTS.founded}
          </div>
          <div style={{marginTop: 8, fontFamily: F.sans, fontWeight: 600, fontSize: 24, letterSpacing: `${0.7 - 0.2 * y2}em`, paddingLeft: '0.5em', color: rgba(C.gold, 0.88), opacity: y2, textShadow: halo}}>
            {FACTS.company}
          </div>
        </div>
      )}
      {pw > 0 && (
        <Callout x={sph.x - sph.r - 18} y={sph.y} dir={-1} text="POWERFUL" color={C.ice} p={pw} />
      )}
      {sf > 0 && <Callout x={sph.x + sph.r + 18} y={sph.y} dir={1} text="SAFE" color={C.gold} p={sf} />}
      {since > 0 && nm > 0 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', justifyContent: 'center'}}>
          <div
            style={{
              fontFamily: F.serif,
              fontSize: 150,
              lineHeight: '170px',
              fontWeight: 340,
              fontVariationSettings: '"opsz" 144, "SOFT" 50',
              letterSpacing: `${0.02 + 0.3 * (1 - nm)}em`,
              paddingLeft: `${0.02 + 0.3 * (1 - nm)}em`,
              color: C.ivory,
              opacity: nm,
              transform: `translateY(${(1 - nm) * 14 - flyK * 30}px)`,
              textShadow: `0 0 30px ${rgba(C.coral, 0.55)}, 0 0 80px ${rgba(C.ember, 0.3)}, 0 2px 6px rgba(0,0,0,0.8)`,
            }}
          >
            {FACTS.name}
          </div>
        </div>
      )}
      {dt > 0 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: since > 0 ? 826 : 812, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, opacity: dt}}>
          <div style={{width: 70 * dt, height: 1, background: rgba(C.gold, 0.6)}} />
          <div style={{fontFamily: F.mono, fontSize: 26, fontWeight: 500, letterSpacing: '0.42em', paddingLeft: '0.42em', color: rgba(C.gold, 0.95), textShadow: halo}}>{FACTS.launch}</div>
          <div style={{width: 70 * dt, height: 1, background: rgba(C.gold, 0.6)}} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const Callout: React.FC<{x: number; y: number; dir: 1 | -1; text: string; color: string; p: number}> = ({x, y, dir, text, color, p}) => {
  const len = 90 * p;
  return (
    <div style={{position: 'absolute', left: dir > 0 ? x : x - 420, top: y - 20, width: 420, height: 40, display: 'flex', flexDirection: dir > 0 ? 'row' : 'row-reverse', alignItems: 'center', gap: 16, opacity: p}}>
      <div style={{width: len, height: 1, background: rgba(color, 0.7), flex: 'none'}} />
      <div style={{width: 5, height: 5, borderRadius: 3, background: color, flex: 'none'}} />
      <div style={{fontFamily: F.sans, fontWeight: 600, fontSize: 24, letterSpacing: `${0.55 - 0.15 * p}em`, color, textShadow: '0 0 12px rgba(0,0,0,0.95)', whiteSpace: 'nowrap'}}>{text}</div>
    </div>
  );
};

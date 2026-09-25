// S03 Attention. From the gold-white flash, a sheet of paper made of light floats in the dark:
// 2017, eight researchers. Its title writes itself; the words become tokens; every token fires
// attention to every other token at once, and the web turns warm: the first warm light in the cold
// world. The web folds into a Transformer block of light that replicates into a rising stack, then
// streaks upward into particles and dips to black.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ShaderCanvas} from '../lib/ShaderCanvas';
import {PointCloud} from '../lib/PointCloud';
import {useScene} from '../lib/timing';
import {C, F, rgba} from '../theme';
import {E, clamp, lerp, prog} from '../lib/anim';
import {Cam, V3, add, camUniforms, lookAt, mix3, project} from './S02/cam';
import {S03_FRAG} from './S03/frag';
import {ARCS, ARC_N, AUTHOR_X, AUTHOR_Y, BLOCK_LINES, BLOCK_SAMPLED, BOX, PAPER_BARS, PAPER_HH, PAPER_HW, TOKENS, WEIGHTS, arcPoint, tokenPos} from './S03/geo';
import {Dot, LightCanvas, Quad, RGB, Stroke} from './S03/LightCanvas';

// Every displayed fact. Source: research/FACTS.md §1 ("Attention Is All You Need": arXiv 1706.03762,
// v1 12 June 2017, 8 authors, Google Brain + Google Research, NeurIPS 2017) and the director's note
// for the paper's own results (N = 6 layers; 28.4 BLEU on WMT 2014 English-German; 3.5 days on 8 P100 GPUs).
const FACTS = {
  month: 'JUNE',
  year: '2017',
  authors: 8,
  orgs: 'Google Brain · Google Research',
  arxiv: 'arXiv:1706.03762',
  venue: 'NeurIPS 2017',
  layers: 6,
  bleu: '28.4',
  bleuTask: 'WMT 2014 English→German',
  train: '3.5 days',
  gpus: '8 P100 GPUs',
};

const F0DEG = 32;
const F0 = 0.5 / Math.tan(((F0DEG / 2) * Math.PI) / 180);
const COLD: RGB = [185, 204, 221];
const ELEC: RGB = [127, 209, 255];
const GOLD: RGB = [244, 194, 122];
const EMBER: RGB = [238, 138, 94];
const IVORY: RGB = [243, 238, 228];
const mixc = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hex = (c: RGB) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;

const rotY = (v: V3, a: number): V3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const rotX = (v: V3, a: number): V3 => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
const bez = (a: V3, c: V3, b: V3, u: number): V3 => mix3(mix3(a, c, u), mix3(c, b, u), u);
const soft = (u: number) => 0.82 * E.inOut(u) + 0.18 * u; // eased but never fully stopping

let measureCtx: CanvasRenderingContext2D | null = null;
const measure = (font: string, s: string) => {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx!.font = font;
  return measureCtx!.measureText(s).width;
};

const glass = (warm: number): React.CSSProperties => ({
  position: 'absolute',
  borderRadius: 12,
  background: `linear-gradient(180deg, ${warm > 0.5 ? 'rgba(46,32,26,0.78)' : 'rgba(28,38,56,0.78)'}, rgba(8,10,16,0.86))`,
  border: `1px solid ${warm > 0.5 ? rgba(C.gold, 0.3) : rgba(C.ice, 0.24)}`,
  boxShadow: `0 0 44px ${warm > 0.5 ? rgba(C.ember, 0.18) : rgba(C.cold, 0.16)}, 0 12px 34px rgba(0,0,0,0.5), inset 0 1px 0 ${rgba(warm > 0.5 ? C.gold : C.ice, 0.18)}`,
  whiteSpace: 'nowrap',
});
const capsLabel: React.CSSProperties = {fontFamily: F.sans, fontSize: 22, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase'};

export const S03: React.FC = () => {
  const {t, dur, cue, end} = useScene('S03');
  const c5 = cue('L05');
  const c6 = cue('L06');
  const e6 = end('L06');
  const c7 = cue('L07');
  const e7 = end('L07');
  const d7 = e7 - c7;
  const tFire = c7 + 0.17 * d7 + 0.15; // "weigh every word against every other word"
  const tOnce = c7 + 0.58 * d7; // "all at once"
  const tFold = c7 + 0.69 * d7 - 0.1; // "They called it the Transformer"
  const tSnap = tFold + 1.0;
  const tRise = dur - 0.85;

  // ---------------- camera
  let pos: V3;
  let tgt: V3;
  if (t < c6) {
    const u = soft(prog(t, 0, c6, E.linear));
    pos = bez([1.5, 0.75, 8.8], [1.0, 0.5, 8.2], [0.65, 0.3, 7.3], u);
    tgt = mix3([0.85, 0.05, 0], [0.72, 0.05, 0], u);
  } else if (t < c7) {
    const u = soft(prog(t, c6, c7, E.linear));
    pos = mix3([0.65, 0.3, 7.3], [0.35, 0.4, 7.9], u);
    tgt = mix3([0.72, 0.05, 0], [0.2, 0.1, 0], u);
  } else if (t < tFold) {
    const u = soft(prog(t, c7, tFold, E.linear));
    pos = bez([0.35, 0.4, 7.9], [2.6, 1.7, 7.2], [-1.5, 0.85, 6.9], u);
    tgt = mix3([0.2, 0.1, 0], [0, 0.12, 0], u);
  } else if (t < tSnap + 0.3) {
    const u = soft(prog(t, tFold, tSnap + 0.3, E.linear));
    pos = mix3([-1.5, 0.85, 6.9], [0.4, 0.55, 8.9], u);
    tgt = mix3([0, 0.12, 0], [0, 0.1, 0], u);
  } else if (t < tRise) {
    const u = soft(prog(t, tSnap + 0.3, tRise, E.linear));
    pos = mix3([0.4, 0.55, 8.9], [3.0, 3.7, 10.6], u);
    tgt = mix3([0, 0.1, 0], [0, 1.3, 0], u);
  } else {
    const u = prog(t, tRise, dur, E.in);
    pos = mix3([3.0, 3.7, 10.6], [2.9, 4.6, 10.2], u);
    tgt = mix3([0, 1.3, 0], [0, 5.5, 0], u);
  }
  pos = add(pos, [Math.sin(t * 0.41) * 0.05, Math.sin(t * 0.57 + 1) * 0.03, 0]);
  const cam: Cam = lookAt(pos, tgt, F0DEG);
  const P = (p: V3): [number, number] => {
    const q = project(cam, p);
    return [q.x, q.y];
  };

  // ---------------- the paper of light
  const pYaw = lerp(-0.62, -0.16, soft(prog(t, 0, c6 + 1, E.linear)));
  const pPitch = lerp(0.3, 0.05, soft(prog(t, 0, c6 + 1, E.linear)));
  const recede = prog(t, c6 - 0.3, c7 + 0.6, E.inOut);
  const pC: V3 = [lerp(0, -0.4, recede), 0.1, lerp(0, -3.4, recede)];
  const pU = rotX(rotY([PAPER_HW, 0, 0], pYaw), pPitch);
  const pV = rotX(rotY([0, PAPER_HH, 0], pYaw), pPitch);
  const paperW = (x: number, y: number): V3 => add(pC, add([pU[0] * x, pU[1] * x, pU[2] * x], [pV[0] * y, pV[1] * y, pV[2] * y]));
  const paperOn = prog(t, 0.25, 1.7, E.out);
  const paperI = paperOn * lerp(1, 0.3, recede) * (1 - prog(t, c7 + 0.4, c7 + 1.4, E.inOut));

  const strokes: Stroke[] = [];
  const dots: Dot[] = [];
  const quads: Quad[] = [];

  if (paperI > 0.005) {
    // sheet outline (drawn on), faint fill
    const corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ];
    const edge: [number, number][] = [];
    const drawE = prog(t, 0.2, 1.6, E.inOut) * 4;
    for (let k = 0; k < 4; k++) {
      const f = clamp(drawE - k);
      if (f <= 0) break;
      const a = corners[k];
      const b = corners[k + 1];
      if (k === 0) edge.push(P(paperW(a[0], a[1])));
      edge.push(P(paperW(lerp(a[0], b[0], f), lerp(a[1], b[1], f))));
    }
    if (edge.length > 1) strokes.push({pts: edge, c: IVORY, w: 1.4, a: 0.75 * paperI});
    quads.push({pts: corners.slice(0, 4).map(([x, y]) => P(paperW(x, y))), c: [150, 175, 200], a: 0.05 * paperI});
    // light bars (text), revealed top to bottom
    PAPER_BARS.forEach(([x0, x1, y, th], k) => {
      const rv = prog(t, 0.9 + (0.95 - y) * 1.9, 1.5 + (0.95 - y) * 1.9, E.out);
      if (rv <= 0) return;
      const xe = lerp(x0, x1, rv);
      const titleBar = k === 0;
      const pulse = titleBar ? 1 + 0.9 * Math.exp(-Math.pow((t - (c5 + 4.9)) * 2.2, 2)) : 1;
      quads.push({
        pts: [P(paperW(x0, y - th)), P(paperW(xe, y - th)), P(paperW(xe, y + th)), P(paperW(x0, y + th))],
        c: titleBar ? IVORY : COLD,
        a: (titleBar ? 0.55 : 0.34) * paperI * pulse,
      });
    });
    // eight authors: eight points of light on the author row
    AUTHOR_X.forEach((ax, k) => {
      const on = prog(t, c5 + 1.5 + k * 0.08, c5 + 1.9 + k * 0.08, E.out);
      if (on <= 0) return;
      const [x, y] = P(paperW(ax, AUTHOR_Y));
      dots.push({x, y, r: 2.2 + 0.4 * Math.sin(t * 3 + k), c: IVORY, a: on * paperI});
    });
  }

  // ---------------- title words -> tokens
  const TITLE_PX = 104;
  const titleFont = `340 ${TITLE_PX}px 'Fraunces Variable'`;
  const sp = measure(titleFont, ' ');
  const ww = TOKENS.map((w) => measure(titleFont, w));
  const total = ww.reduce((a, b) => a + b, 0) + sp * (TOKENS.length - 1);
  let acc = 960 - total / 2;
  const titleX = ww.map((w) => {
    const cx = acc + w / 2;
    acc += w + sp;
    return cx;
  });
  const TITLE_Y = 520;
  const chars = [0, 10, 13, 17, 21];
  const tWord = chars.map((c) => c6 + (c / 26) * (e6 - c6) - 0.05);
  const warm = prog(t, tFire + 0.25, tOnce + 0.4, E.inOut);
  const foldU = prog(t, tFold, tSnap, E.inOut);
  const tokenWorld = (i: number): V3 => {
    const a = tokenPos(i);
    const b: V3 = [(i - 2) * 0.92, -1.62, 0.25];
    return mix3(a, b, foldU);
  };

  // ---------------- attention web
  const fireD = prog(t, tFire, tFire + 0.75, E.out); // all arcs at the same moment
  const B0y = 0.1;
  const tilt = 1.2 * prog(t, tSnap + 0.3, tSnap + 1.05, E.inOut);
  const GAP = 0.45;
  const riseU = Math.max(0, t - tRise);
  const blockW = (x: number, y: number, layer: number): V3 => [x, B0y + y * Math.cos(tilt) + layer * GAP + riseU * riseU * (5 + layer * 1.2), -y * Math.sin(tilt)];

  if (t >= tFire && t < tSnap + 0.45) {
    const snapFade = 1 - prog(t, tSnap - 0.05, tSnap + 0.35, E.inOut);
    ARCS.forEach((a, k) => {
      const kw = Math.pow(a.w, 0.6);
      const m = E.inOut(clamp((t - tFold - 0.3 * a.seed) / 0.68));
      const L = k % BLOCK_LINES.length;
      const n = Math.max(2, Math.round(ARC_N * clamp(fireD * 1.15 - a.seed * 0.15)));
      const pts: [number, number][] = [];
      for (let s = 0; s < n; s++) {
        const u = s / (ARC_N - 1);
        const pa = arcPoint(a, u, 1 + 0.08 * Math.sin(t * 1.3 + a.seed * 6) * (1 - m));
        const bl = BLOCK_SAMPLED[L][s];
        const pb = blockW(bl[0], bl[1], 0);
        pts.push(P(mix3(pa, pb, m)));
      }
      const wk = clamp((warm - (1 - kw) * 0.35) / 0.65);
      const col = mixc(mixc(ELEC, [200, 230, 250], 0.2), mixc(EMBER, GOLD, kw), wk);
      const alpha = (0.22 + 0.78 * kw) * (0.75 + 0.25 * Math.sin(t * 2.1 + a.seed * 20)) * snapFade;
      strokes.push({pts, c: m > 0.5 ? mixc(col, GOLD, m) : col, w: 0.9 + 1.9 * kw, a: alpha, glow: 0.9 + 0.6 * wk});
      // pulses travelling from query to key
      if (fireD > 0.95 && m < 0.3) {
        for (let q = 0; q < 2; q++) {
          const u = (((t - tFire) * (0.42 + 0.3 * a.seed) + a.seed + q * 0.5) % 1 + 1) % 1;
          const [x, y] = P(arcPoint(a, u));
          dots.push({x, y, r: 1.3 + 2.2 * kw, c: mixc(ELEC, GOLD, wk), a: (0.35 + 0.65 * kw) * (1 - m * 3) * Math.sin(Math.PI * u)});
        }
      }
    });
  }

  // ---------------- the Transformer block + stack
  const blockOn = prog(t, tSnap - 0.1, tSnap + 0.25, E.out);
  const layers = 6;
  if (blockOn > 0) {
    for (let layer = 0; layer < layers; layer++) {
      const tl = tSnap + 0.62 + (layer - 1) * 0.16;
      const lu = layer === 0 ? 1 : prog(t, tl, tl + 0.45, E.out);
      if (lu <= 0) continue;
      const ly = layer === 0 ? 0 : layer - 1 + lu;
      const fadeRise = 1 - prog(t, tRise + 0.1 + layer * 0.05, dur - 0.15, E.in);
      const la = blockOn * lu * fadeRise * (layer === 0 ? 1 : 0.85);
      const trail = riseU > 0 ? [0, 1, 2] : [0];
      for (const tr of trail) {
        const off = tr * 0.09 * riseU * (10 + layer);
        BLOCK_LINES.forEach((ln) => {
          const pts = ln.pts.map(([x, y]) => {
            const w = blockW(x, y, ly);
            return P([w[0], w[1] - off, w[2]]);
          });
          const c = ln.kind === 'res' ? EMBER : ln.kind === 'frame' ? mixc(GOLD, IVORY, 0.3) : GOLD;
          strokes.push({pts, c, w: ln.kind === 'frame' ? 1.2 : 1.6, a: la * (ln.kind === 'frame' ? 0.55 : 0.9) * (tr === 0 ? 1 : 0.4 / tr), glow: tr === 0 ? 1.2 : 0.6});
        });
        if (tr === 0) {
          (['mha', 'an1', 'ff', 'an2'] as const).forEach((b) => {
            const [x0, y0, x1, y1] = BOX[b];
            quads.push({pts: [P(blockW(x0, y0, ly)), P(blockW(x1, y0, ly)), P(blockW(x1, y1, ly)), P(blockW(x0, y1, ly))], c: EMBER, a: 0.07 * la});
          });
        }
      }
    }
  }

  // ---------------- labels anchored to the world
  const flash = 1 - prog(t, 0, 0.62, E.out);
  const hudA = (t0: number) => prog(t, t0, t0 + 0.55, E.out) * (1 - prog(t, c6 - 0.4, c6 + 0.3, E.inOut));
  const card1 = P([2.0, 1.02, 0.55]);
  const card2 = P([2.12, 0.24, 0.3]);
  const card3 = P([2.02, -0.55, 0.05]);
  if (paperI > 0.01) {
    const leader = (from: [number, number], to: [number, number], a: number) => {
      if (a <= 0.01) return;
      const mid: [number, number] = [from[0] - 40, from[1]];
      strokes.push({pts: [from, mid, to], c: COLD, w: 1, a: 0.5 * a, glow: 0.5});
      dots.push({x: to[0], y: to[1], r: 1.6, c: COLD, a: 0.9 * a});
    };
    leader([card1[0] - 14, card1[1]], P(paperW(0.66, 0.8)), hudA(c5 + 0.5));
    leader([card2[0] - 14, card2[1]], P(paperW(0.72, AUTHOR_Y)), hudA(c5 + 1.4));
    leader([card3[0] - 14, card3[1]], P(paperW(1, -0.35)), hudA(c5 + 3.1));
  }

  const hit = tWord.reduce((s, tw) => s + Math.exp(-Math.max(0, t - tw) * 5) * (t >= tw ? 1 : 0), 0) + Math.exp(-Math.max(0, t - tSnap) * 4) * (t >= tSnap ? 2.2 : 0) + Math.exp(-Math.max(0, t - tFire) * 3) * (t >= tFire ? 1 : 0);
  const stackI = blockOn * (0.5 + 0.5 * prog(t, tSnap + 0.5, tSnap + 1.6, E.inOut)) * (1 - prog(t, tRise + 0.3, dur, E.in));
  const riseI = prog(t, tRise - 0.1, tRise + 0.4, E.out);
  const stackBase = project(cam, [0, B0y, 0]);
  const blackout = prog(t, dur - 0.5, dur - 0.03, E.in);
  const webI = prog(t, tFire - 0.2, tFire + 0.8, E.out) * (1 - prog(t, tFold, tSnap + 0.4, E.inOut));

  // block box labels (upright block only)
  const boxLabelA = prog(t, tSnap + 0.05, tSnap + 0.4, E.out) * (1 - prog(t, tSnap + 0.3, tSnap + 0.65, E.inOut));
  const tfA = prog(t, tSnap + 0.1, tSnap + 0.7, E.out) * (1 - blackout);
  const stackCards = (t0: number) => prog(t, t0, t0 + 0.5, E.out) * (1 - prog(t, tRise, tRise + 0.5, E.inOut));
  const topLayer = project(cam, blockW(-1.28, 0, layers - 1));
  const botLayer = project(cam, blockW(-1.28, 0, 0));
  const pillCol = mixc(ELEC, GOLD, warm);

  return (
    <AbsoluteFill style={{background: C.void}}>
      <ShaderCanvas
        frag={S03_FRAG}
        scale={0.5}
        uniforms={{
          ...camUniforms(cam),
          uPapC: pC,
          uPapU: pU,
          uPapV: pV,
          uPapI: paperI,
          uWebI: webI,
          uWarm: warm,
          uRowW: 2.3,
          uStackA: [0, B0y - 0.3, 0],
          uStackB: [0, B0y + GAP * 5 + 0.4 + riseU * riseU * 8, 0],
          uStackI: stackI,
          uRise: riseI * (1 - blackout),
          uHit: hit,
          uEnv: prog(t, 0.2, 1.5, E.out),
          uStackUV: [(stackBase.x - 960) / 1080, (540 - stackBase.y) / 1080],
        }}
      />
      <ThreeCanvas width={1920} height={1080} camera={{fov: F0DEG, position: [0, 0, 0], rotation: [0, 0, 0], near: 0.01, far: 500}} gl={{antialias: false}} style={{position: 'absolute', inset: 0}}>
        <PointCloud
          count={4500}
          seed={33}
          uniforms={{...camUniforms(cam), uF0: F0, uWarm: warm, uRiseT: riseU, uStream: prog(t, tRise - 0.2, tRise + 0.2, E.out)}}
          body={`
            vec3 p = vec3(mix(-8., 8., aSeed.x), mix(-4.5, 7., aSeed.y), mix(-9., 6., aSeed.z));
            p += curl(p * .18 + vec3(0., uTime * .03, 0.)) * .35;
            p.y += uTime * .04;
            // the rising stream: a subset is born inside the stack and shoots upward
            float isS = step(.45, aSeed2.x) * uStream;
            vec3 q = vec3((aSeed.x - .5) * 2.6, .1 + aSeed.y * 2.6, (aSeed.z - .5) * 2.2);
            q.y += uRiseT * uRiseT * (6. + 10. * aSeed2.y) + uRiseT * 2.;
            p = mix(p, q, isS);
            vec3 d = p - uCamPos;
            vec3 c = vec3(dot(d, uCamRt), dot(d, uCamUp), -dot(d, uCamFw));
            c.xy *= uFocal / uF0;
            pos = c;
            float z = -c.z;
            size = (.7 + 1.9 * pow(aSeed.w, 3.)) * (1. + isS * .6);
            size = min(size, 6. * z);
            vec3 cold = mix(vec3(.72, .8, .87), vec3(.5, .8, 1.), aSeed2.z * .5);
            vec3 warm = mix(vec3(.93, .54, .37), vec3(.96, .76, .48), aSeed2.z);
            color = mix(cold, warm, clamp(uWarm * 1.2 - aSeed2.w * .3 + isS, 0., 1.));
            alpha = smoothstep(.7, 1.8, z) * (1. - smoothstep(14., 30., z)) * (.25 + .45 * aSeed2.w) * (1. + isS * 1.5);
          `}
        />
      </ThreeCanvas>
      <LightCanvas strokes={strokes} dots={dots} quads={quads} />

      {/* ---- paper HUD: date, authors, reference */}
      {hudA(c5 + 0.5) > 0 && (
        <div style={{...glass(0), left: card1[0], top: card1[1], transform: 'translateY(-50%)', padding: '14px 24px 16px', opacity: hudA(c5 + 0.5)}}>
          <div style={{...capsLabel, color: rgba(C.ice, 0.7)}}>{FACTS.month}</div>
          <div style={{fontFamily: F.mono, fontSize: 64, lineHeight: 1.05, color: C.ivory, fontWeight: 500, letterSpacing: '0.02em'}}>{FACTS.year}</div>
        </div>
      )}
      {hudA(c5 + 1.4) > 0 && (
        <div style={{...glass(0), left: card2[0], top: card2[1], transform: 'translateY(-50%)', padding: '16px 24px 16px', opacity: hudA(c5 + 1.4)}}>
          <div style={{...capsLabel, fontSize: 24, color: C.ivory}}>{FACTS.authors} researchers</div>
          <div style={{display: 'flex', gap: 14, margin: '14px 2px 12px'}}>
            {Array.from({length: FACTS.authors}, (_, k) => {
              const on = prog(t, c5 + 1.5 + k * 0.08, c5 + 1.9 + k * 0.08, E.out);
              return <div key={k} style={{width: 9, height: 9, borderRadius: 5, background: '#F7F3EA', opacity: on, boxShadow: `0 0 10px 2px ${rgba(C.ice, 0.55)}`}} />;
            })}
          </div>
          <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 25, color: rgba(C.ice, 0.72), opacity: prog(t, c5 + 2.2, c5 + 2.8, E.out)}}>{FACTS.orgs}</div>
        </div>
      )}
      {hudA(c5 + 3.1) > 0 && (
        <div style={{...glass(0), left: card3[0], top: card3[1], transform: 'translateY(-50%)', padding: '14px 24px', opacity: hudA(c5 + 3.1)}}>
          <div style={{fontFamily: F.mono, fontSize: 28, color: C.ivory}}>{FACTS.arxiv}</div>
          <div style={{fontFamily: F.mono, fontSize: 23, color: rgba(C.ice, 0.7), marginTop: 4}}>{FACTS.venue}</div>
        </div>
      )}

      {/* ---- title, then tokens */}
      {TOKENS.map((w, i) => {
        const tw = tWord[i];
        if (t < tw - 0.02) return null;
        const a = prog(t, tw, tw + 0.4, E.out);
        const m = E.inOut(prog(t, c7 + i * 0.06, c7 + 0.8 + i * 0.06, E.linear));
        const tok = project(cam, tokenWorld(i));
        const x = lerp(titleX[i], tok.x, m);
        const y = lerp(TITLE_Y, tok.y, m);
        const serifA = a * (1 - clamp((m - 0.25) / 0.4));
        const pillA = clamp((m - 0.35) / 0.45) * (1 - prog(t, tSnap + 0.6, tSnap + 1.4, E.inOut));
        const glowHit = t >= tw ? Math.exp(-(t - tw) * 3.2) : 0;
        const fs = lerp(TITLE_PX, 34, m);
        return (
          <React.Fragment key={i}>
            {glowHit > 0.01 && m < 0.1 && (
              <div style={{position: 'absolute', left: x - 170, top: y - 120, width: 340, height: 240, background: `radial-gradient(ellipse at center, ${rgba(C.ivory, 0.22 * glowHit)} 0%, rgba(0,0,0,0) 65%)`}} />
            )}
            {serifA > 0.005 && (
              <div
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  transform: `translate(-50%, -50%) translateY(${(1 - a) * 22}px)`,
                  fontFamily: F.serif,
                  fontWeight: 340,
                  fontSize: fs,
                  fontVariationSettings: '"opsz" 144, "SOFT" 50',
                  letterSpacing: `${(1 - a) * 0.06}em`,
                  color: C.ivory,
                  opacity: serifA,
                  whiteSpace: 'nowrap',
                  textShadow: `0 0 ${24 + 30 * glowHit}px ${rgba(C.ice, 0.35 + 0.4 * glowHit)}, 0 2px 18px rgba(0,0,0,0.6)`,
                }}
              >
                {w}
              </div>
            )}
            {pillA > 0.005 && (
              <div
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  transform: `translate(-50%, -50%) scale(${lerp(0.7, 1, pillA)})`,
                  height: 58,
                  padding: '0 24px',
                  borderRadius: 29,
                  display: 'flex',
                  alignItems: 'center',
                  fontFamily: F.mono,
                  fontSize: 30,
                  color: C.ivory,
                  background: `linear-gradient(180deg, rgba(${pillCol.map(Math.round).join(',')},0.2), rgba(8,10,16,0.82))`,
                  border: `1.5px solid ${hex(pillCol)}`,
                  boxShadow: `0 0 26px ${hex(pillCol)}66, inset 0 0 14px ${hex(pillCol)}33`,
                  opacity: pillA,
                  whiteSpace: 'nowrap',
                }}
              >
                {w}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* ---- self-attention formula + weights (web phase) */}
      {(() => {
        const a = prog(t, tFire - 0.1, tFire + 0.5, E.out) * (1 - prog(t, tFold - 0.1, tFold + 0.4, E.inOut));
        if (a <= 0.005) return null;
        const px = -pos[0] * 10;
        const it: React.CSSProperties = {fontStyle: 'italic'};
        return (
          <>
            <div style={{...glass(warm), left: 150 + px, top: 206, padding: '16px 28px 18px', opacity: a}}>
              <div style={{...capsLabel, color: rgba(warm > 0.5 ? C.gold : C.ice, 0.75), marginBottom: 10}}>Scaled dot-product attention</div>
              <div style={{display: 'flex', alignItems: 'center', gap: 12, fontFamily: F.serif, fontSize: 38, color: C.ivory, fontWeight: 380, fontVariationSettings: '"opsz" 72'}}>
                <span>
                  <span style={it}>Attention</span>(<span style={it}>Q</span>, <span style={it}>K</span>, <span style={it}>V</span>)
                </span>
                <span style={{opacity: 0.85}}>=</span>
                <span>softmax</span>
                <span style={{display: 'inline-flex', alignItems: 'center'}}>
                  <span style={{fontSize: 64, fontWeight: 200, lineHeight: 1, marginTop: -6}}>(</span>
                  <span style={{display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: 32, lineHeight: 1.15}}>
                    <span style={{padding: '0 8px 3px'}}>
                      <span style={it}>QK</span>
                      <sup style={{fontSize: 20, fontStyle: 'normal'}}>T</sup>
                    </span>
                    <span style={{borderTop: `1.5px solid ${C.ivory}`, padding: '3px 8px 0', display: 'inline-flex', alignItems: 'flex-start'}}>
                      <span style={{fontSize: 30}}>√</span>
                      <span style={{borderTop: `1.5px solid ${C.ivory}`, marginTop: 4, paddingTop: 0}}>
                        <span style={it}>d</span>
                        <sub style={{fontSize: 20, fontStyle: 'italic'}}>k</sub>
                      </span>
                    </span>
                  </span>
                  <span style={{fontSize: 64, fontWeight: 200, lineHeight: 1, marginTop: -6}}>)</span>
                </span>
                <span style={it}>V</span>
              </div>
            </div>
            <div style={{...glass(warm), right: 140 - px, bottom: 200, padding: '14px 22px 18px', opacity: a}}>
              <div style={{...capsLabel, color: rgba(warm > 0.5 ? C.gold : C.ice, 0.75), marginBottom: 12}}>Attention weights</div>
              {TOKENS.map((row, i) => (
                <div key={i} style={{display: 'flex', alignItems: 'center', height: 34}}>
                  <div style={{width: 138, fontFamily: F.mono, fontSize: 22, color: rgba(C.ivory, 0.8)}}>{row}</div>
                  {TOKENS.map((_, j) => {
                    const wv = i === j ? 0.9 : WEIGHTS[i][j];
                    const on = prog(t, tFire + 0.05 * (i + j), tFire + 0.35 + 0.05 * (i + j), E.out);
                    const cc = i === j ? mixc([120, 130, 150], [150, 130, 110], warm) : mixc(ELEC, mixc(EMBER, GOLD, Math.pow(wv, 0.5)), clamp((warm - (1 - Math.pow(wv, 0.6)) * 0.35) / 0.65));
                    return (
                      <div key={j} style={{width: 30, height: 30, margin: 2, borderRadius: 4, background: `rgba(${cc.map(Math.round).join(',')},${(i === j ? 0.12 : 0.1 + 0.85 * Math.pow(wv, 0.7)) * on})`, border: `1px solid rgba(${cc.map(Math.round).join(',')},0.25)`}} />
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* ---- block labels */}
      {boxLabelA > 0.005 &&
        ([
          ['Multi-head attention', (BOX.mha[1] + BOX.mha[3]) / 2],
          ['Add & norm', (BOX.an1[1] + BOX.an1[3]) / 2],
          ['Feed forward', (BOX.ff[1] + BOX.ff[3]) / 2],
          ['Add & norm', (BOX.an2[1] + BOX.an2[3]) / 2],
        ] as const).map(([lab, y], k) => {
          const p = project(cam, blockW(0, y, 0));
          return (
            <div key={k} style={{position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%, -50%)', ...capsLabel, fontSize: 22, color: C.ivory, opacity: boxLabelA, textShadow: `0 0 14px ${rgba(C.ember, 0.6)}`, whiteSpace: 'nowrap'}}>
              {lab}
            </div>
          );
        })}

      {/* ---- stack: N = 6, results cards, the name */}
      {stackCards(tSnap + 1.2) > 0.005 && (
        <>
          <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: stackCards(tSnap + 1.2)}}>
            <path d={`M${topLayer.x - 30},${topLayer.y} h-14 V${botLayer.y} h14`} fill="none" stroke={C.gold} strokeOpacity={0.7} strokeWidth={1.4} />
          </svg>
          <div style={{position: 'absolute', left: topLayer.x - 60, top: (topLayer.y + botLayer.y) / 2, transform: 'translate(-100%, -50%)', textAlign: 'right', opacity: stackCards(tSnap + 1.2)}}>
            <div style={{fontFamily: F.mono, fontSize: 44, color: C.ivory, lineHeight: 1.1}}>
              <span style={{fontFamily: F.serif, fontStyle: 'italic'}}>N</span> = {FACTS.layers}
            </div>
            <div style={{...capsLabel, color: rgba(C.gold, 0.8), marginTop: 4}}>identical layers</div>
          </div>
        </>
      )}
      {stackCards(tSnap + 0.45) > 0.005 && (
        <div style={{...glass(1), left: 1330 - pos[0] * 12, top: 300, padding: '16px 26px 18px', opacity: stackCards(tSnap + 0.45)}}>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 14}}>
            <div style={{fontFamily: F.mono, fontSize: 60, color: C.ivory, lineHeight: 1}}>{FACTS.bleu}</div>
            <div style={{...capsLabel, color: C.gold}}>BLEU</div>
          </div>
          <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 25, color: rgba(C.ivory, 0.72), marginTop: 8}}>{FACTS.bleuTask}</div>
        </div>
      )}
      {stackCards(tSnap + 0.75) > 0.005 && (
        <div style={{...glass(1), left: 1330 - pos[0] * 12, top: 470, padding: '16px 26px 18px', opacity: stackCards(tSnap + 0.75)}}>
          <div style={{...capsLabel, color: rgba(C.gold, 0.8), marginBottom: 6}}>Trained in</div>
          <div style={{fontFamily: F.mono, fontSize: 40, color: C.ivory, lineHeight: 1.1}}>{FACTS.train}</div>
          <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 25, color: rgba(C.ivory, 0.72), marginTop: 6}}>on {FACTS.gpus}</div>
        </div>
      )}
      {tfA > 0.005 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 836,
            textAlign: 'center',
            fontFamily: F.sans,
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: `${lerp(0.9, 0.62, tfA)}em`,
            paddingLeft: '0.62em',
            color: C.ivory,
            opacity: tfA * (1 - prog(t, tRise + 0.2, dur - 0.2, E.inOut)),
            textShadow: `0 0 24px ${rgba(C.ember, 0.55)}`,
          }}
        >
          TRANSFORMER
        </div>
      )}

      {flash > 0.002 && <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, #FFFBF2 0%, #FCEBC9 45%, ${C.gold} 110%)`, opacity: flash}} />}
      {blackout > 0 && <AbsoluteFill style={{background: '#000', opacity: blackout}} />}
    </AbsoluteFill>
  );
};

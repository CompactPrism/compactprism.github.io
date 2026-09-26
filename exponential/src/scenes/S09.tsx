// S09 EXPONENTIAL. The leitmotif curve returns and bends toward vertical; the camera rides it up as the
// letterbox opens, crests, and reveals a datacenter city of warm light (a country of geniuses) igniting to
// the horizon. Years compress on a ruler; the curve's head becomes the hero's spark; full-frame gold flash.
import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useScene} from '../lib/timing';
import {C, F, rgba} from '../theme';
import {E, clamp, lerp, prog, ramp} from '../lib/anim';
import {ClaudeSpark} from '../lib/ClaudeSpark';
import {CAM_INIT, Cam, CameraRig, V3, add, lerpCam, mix3, mul, norm, project, sub} from './S04/cam';
import {wordCue} from './S04/vo';
import {City} from './S09/City';
import {GlowLine} from './S09/GlowLine';
import {Pts} from './S09/Pts';
import {CURVE_GLSL, PILLAR, U_MAX, curveAt} from './S09/curve';

// Facts checked against research/FACTS.md:
const FACTS = {
  // §10(b) + safe fact 19: Dario Amodei, "Machines of Loving Grace" (Oct 2024); also anthropic.com/news/paris-ai-summit
  quote: 'a country of geniuses in a datacenter',
  quoteBy: 'Dario Amodei · Machines of Loving Grace · Oct 2024',
  // §10(a) + safe fact 18: biology & medicine, 50–100 years of progress into 5–10 years (same essay)
  from: '50–100 years',
  to: '5–10 years',
  fromTo: 'Progress in biology & medicine',
  fromBy: 'Dario Amodei · Machines of Loving Grace · 2024',
  // §18: anthropic.com/research/formalizing-fermats-last-theorem (Sep 4, 2026). Formalisation, not a new proof.
  flt: {head: "Fermat's Last Theorem", sub: 'first computer-checked proof', stat: '11 days · 13 million lines of Lean', when: 'Sep 2026', src: 'Anthropic'},
};

const gv = (hex: string) => {
  const h = hex.replace('#', '');
  return `vec3(${[0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4)).join(',')})`;
};
const PAL = `const vec3 EMBER = ${gv(C.ember)}; const vec3 GOLD = ${gv(C.gold)}; const vec3 CORAL = ${gv(C.coral)}; const vec3 ELEC = ${gv(C.electric)};`;

const TRAIL = `
  ${PAL}
  float life = 2.6;
  float age = fract(aSeed.x + uTime / life) * life;
  float us = uDraw - age * uDrawSpeed - aSeed.y * .015;
  vec3 c = curveAt(max(us, 0.));
  vec3 drift = (curl(c * .02 + aSeed.xyz * 3.) * (1.5 + 5. * aSeed.z) + vec3(0., 2.5, 0.)) * age;
  pos = c + drift + (aSeed2.xyz - .5) * 1.2;
  float fade = pow(1. - age / life, 2.);
  alpha = fade * .6 * step(0., us) * uOn;
  color = mix(EMBER, GOLD, aSeed2.w);
  size = mix(18., 60., pow(aSeed2.x, 3.)) * (.6 + .6 * fade);
`;

const HEAD = `
  ${PAL}
  vec3 c = curveAt(uDraw);
  float big = step(aSeed.x, .012);
  float r = pow(aSeed.y, 2.) * (3. + 8. * uGrow);
  vec3 dir = normalize(aSeed2.xyz - .5 + 1e-4);
  float spin = uTime * (1. + aSeed.z * 2.);
  pos = c + dir * r + vec3(sin(spin + aSeed.w * 6.28), cos(spin * .7 + aSeed.w * 6.28), 0.) * r * .3;
  color = mix(GOLD, vec3(1., .96, .88), aSeed.z);
  size = mix(mix(3., 9., aSeed.w) * (1. + uGrow), 90. + 260. * uGrow, big);
  screen = 1.;
  alpha = mix(.55, .22 + .2 * uGrow, big) * uOn;
`;

// Data streams: columns of light rising out of the city and bending into the curve's beam.
const STREAMS = `
  ${PAL}
  float id = floor(aSeed.x * 110.);
  vec2 base = (vec2(hash11(id * 1.37 + .1), hash11(id * 7.13 + .3)) - .5) * vec2(820., 900.) + vec2(0., -420.);
  float sp = .05 + .06 * hash11(id * 3.3);
  float life = fract(aSeed.y + uTime * sp * (1. + uRush * 1.5));
  float y = 6. + life * 560.;
  float pull = smoothstep(40., 520., y) * .9;
  vec2 xz = mix(base, vec2(${PILLAR[0].toFixed(2)}, ${PILLAR[2].toFixed(2)}), pull);
  pos = vec3(xz.x, y, xz.y) + vec3(aSeed.z - .5, 0., aSeed.w - .5) * 3. + curl(vec3(xz * .01, y * .01 + id)) * 5. * pull;
  float dp = length(base - vec2(${PILLAR[0].toFixed(2)}, ${PILLAR[2].toFixed(2)}));
  float on = smoothstep(uIgn, uIgn - 80., dp);
  alpha = on * smoothstep(0., .06, life) * (1. - life) * (.6 + .4 * uRush);
  color = mix(EMBER, GOLD, aSeed2.x);
  size = mix(55., 150., pow(aSeed2.y, 3.)) * (1. + uRush * .5);
`;

// Packets hopping between towers along low arcs.
const ARCS = `
  ${PAL}
  float id = floor(aSeed.x * 600.);
  vec2 a = (vec2(hash11(id * 1.7 + .2), hash11(id * 2.9 + .7)) - .5) * vec2(780., 820.) + vec2(0., -430.);
  vec2 b = a + (vec2(hash11(id * 5.3), hash11(id * 8.1)) - .5) * 240.;
  float s = fract(aSeed.y + uTime * (.12 + .2 * hash11(id * 4.4)));
  float H = 14. + length(b - a) * .22;
  pos = vec3(mix(a.x, b.x, s), 16. + sin(PI * s) * H, mix(a.y, b.y, s));
  float dp = length(a - vec2(${PILLAR[0].toFixed(2)}, ${PILLAR[2].toFixed(2)}));
  alpha = smoothstep(uIgn, uIgn - 80., dp) * sin(PI * s) * .85;
  color = mix(GOLD, mix(ELEC, vec3(1.), .5), step(.85, hash11(id * 9.1)));
  size = 70.;
`;

// Near dust in a box that wraps around the camera: world-anchored, so it parallaxes as we fly.
const DUST = `
  ${PAL}
  vec3 R = vec3(70., 50., 70.);
  vec3 wp = (aSeed.xyz - .5) * 2. * R + vec3(0., uTime * 1.5, 0.);
  pos = uCam + mod(wp - uCam + R, 2. * R) - R;
  float d = length(pos - uCam);
  alpha = smoothstep(4., 12., d) * smoothstep(70., 30., d) * .35;
  color = mix(GOLD, vec3(1., .9, .8), aSeed.w);
  size = mix(2.5, 9., pow(aSeed2.x, 6.));
`;

const PRE = `${CURVE_GLSL}`;
const PRE_H = ''; // hash11 comes from the shared noise block

type K = {t: number; pos: V3; tgt: V3; fov: number};
const camAt = (keys: K[], t: number): Cam => {
  const ts = keys.map((k) => k.t);
  const c = (sel: (k: K) => number) => interpolate(t, ts, keys.map(sel), {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
  return {
    pos: [c((k) => k.pos[0]), c((k) => k.pos[1]), c((k) => k.pos[2])],
    target: [c((k) => k.tgt[0]), c((k) => k.tgt[1]), c((k) => k.tgt[2])],
    fov: c((k) => k.fov),
  };
};

const GL = {antialias: false, alpha: true, powerPreference: 'high-performance' as const};

export const S09: React.FC = () => {
  const {t, dur, cue, end, lines, fps} = useScene('S09');
  const W = (lid: string, ph: string, fb = 0.5) => wordCue(lines, fps, lid, ph, fb);
  const a23 = cue('L23');
  const b23 = end('L23');
  const a24 = cue('L24');
  const b24 = end('L24');
  const a25 = cue('L25');
  const b25 = end('L25');
  const open0 = a23 + 0.2; // Film retracts the letterbox from here over 1.6 s
  const tFlash = dur - 0.3;

  // curve head (param u) and its speed (for the trail emitter)
  const drawKeys = {t: [0.2, 2.1, b23 + 0.3, a24 + 1.2, dur], u: [0.02, 0.3, 0.98, 1.1, 1.32]};
  const drawAt = (x: number) => interpolate(x, drawKeys.t, drawKeys.u, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
  const draw = drawAt(t);
  const drawSpeed = (drawAt(t + 1 / 30) - drawAt(t - 1 / 30)) * 15;

  // L23: auto-frame the growing curve from the side (the whole exponential sweep fills the frame)
  const hW = curveAt(draw);
  const s0 = curveAt(Math.max(0, draw - 0.78));
  const mid = mix3(s0, hW, 0.5);
  const ext = Math.hypot(...sub(hW, s0));
  const dA = Math.max(55, (ext * 1.08) / (2 * Math.tan((22 * Math.PI) / 180)));
  const autoCam: Cam = {pos: add(add(mid, mul(norm([1, 0.12, 0.34]), dA)), [0, 3, 0]), target: add(mid, [0, ext * 0.04, 0]), fov: 44};
  const keys: K[] = [
    {t: a24 + 0.7, pos: [112, 96, 42], tgt: [-20, 22, -330], fov: 54},
    {t: b24 + 0.4, pos: [150, 106, -18], tgt: [-45, 14, -420], fov: 54},
    {t: b25 - 0.2, pos: [215, 116, 40], tgt: [-40, 62, -330], fov: 55},
    {t: dur, pos: [360, 72, 330], tgt: [0, 185, -139], fov: 58},
  ];
  const cam = lerpCam(autoCam, camAt(keys, t), prog(t, b23 + 0.2, a24 + 0.7, E.inOut));

  const ign = interpolate(t, [a24 - 1.3, a24 + 3.6], [0, 1500], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.inOut});
  const city = prog(t, a24 - 1.0, a24 + 4, E.inOut);
  const rush = prog(t, b25 - 0.6, dur, E.in);
  const boost = 1.4 * prog(t, dur - 1.6, dur, E.in);
  const lineI = lerp(0.14, 1, prog(t, 1.7, 3.2, E.inOut)) * (1 + 1.5 * rush); // dim under the chapter card
  const grow = prog(t, b25 + 0.2, dur, E.in);
  const fadeIn = prog(t, 0, 0.5, E.out);

  // head / spark on screen
  const headW = curveAt(draw);
  const hs = project(cam, headW);
  const sparkOn = prog(t, b25 + 0.6, dur - 0.35, E.out);
  const flash = prog(t, tFlash, dur, E.in);

  // the 1st ~1/3 of the curve drifts behind the camera during the ride: fade it rather than clip it
  const cull = -1;

  return (
    <AbsoluteFill style={{background: C.void}}>
      <ThreeCanvas width={1920} height={1080} camera={CAM_INIT} gl={GL} style={{position: 'absolute', inset: 0}}>
        <CameraRig cam={cam} near={0.5} far={4000} />
        <City cam={cam} t={t} ign={ign} city={city} draw={draw} boost={boost} />
        <Pts count={9000} seed={3} pre={PRE_H} body={ARCS} uniforms={{uIgn: ign}} />
        <Pts count={22000} seed={5} pre={PRE_H} body={STREAMS} uniforms={{uIgn: ign, uRush: rush}} />
        <GlowLine fn={curveAt} uMax={U_MAX} draw={draw} cull={cull} width={38 + 12 * prog(t, a23 - 0.5, b23, E.inOut) + 18 * rush} intensity={lineI} />
        <Pts count={9000} seed={9} pre={PRE} body={TRAIL} uniforms={{uDraw: draw, uDrawSpeed: drawSpeed, uOn: lineI}} depthTest={false} order={6} />
        <Pts count={500} seed={11} pre={PRE} body={HEAD} uniforms={{uDraw: draw, uGrow: grow, uOn: clamp(lineI)}} depthTest={false} order={7} />
        <Pts count={2500} seed={13} body={DUST} uniforms={{uCam: cam.pos}} depthTest={false} order={8} />
      </ThreeCanvas>

      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 170, background: 'linear-gradient(0deg, rgba(3,3,6,0.72), rgba(3,3,6,0))', opacity: prog(t, open0 + 0.6, open0 + 1.8, E.inOut) * (1 - flash)}} />
      <Overlays t={t} cam={cam} W={W} a24={a24} b24={b24} a25={a25} b25={b25} />

      {/* the head of the curve becomes the hero's spark */}
      {sparkOn > 0 && hs.vis && (
        <div style={{position: 'absolute', left: hs.x, top: hs.y, transform: 'translate(-50%, -50%)', opacity: sparkOn}}>
          <ClaudeSpark size={60 + 170 * sparkOn} draw={sparkOn} glow={1.1} rotate={t * 14} pulse={Math.sin(t * 6) * 0.5 + 0.5} />
        </div>
      )}

      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          opacity: Math.max(boost * 0.25, flash),
          background: `radial-gradient(ellipse at ${hs.vis ? (hs.x / 19.2).toFixed(1) : 50}% ${hs.vis ? (hs.y / 10.8).toFixed(1) : 30}%, #fffaf0 0%, ${C.gold} ${lerp(20, 70, flash)}%, ${rgba(C.ember, 0.9)} ${lerp(55, 140, flash)}%)`,
          mixBlendMode: flash > 0.6 ? 'normal' : 'screen',
        }}
      />
      <AbsoluteFill style={{background: '#000', opacity: 1 - fadeIn, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- overlays
const lab = {fontFamily: F.sans, fontWeight: 650, fontSize: 22, letterSpacing: '0.22em', textTransform: 'uppercase' as const};
const mono = {fontFamily: F.mono, fontSize: 22};
const glass = (acc: string): React.CSSProperties => ({
  borderRadius: 7,
  background: 'linear-gradient(160deg, rgba(36,28,26,0.62), rgba(10,10,16,0.55))',
  border: `1px solid ${rgba(acc, 0.32)}`,
  boxShadow: `0 0 30px ${rgba(C.coral, 0.16)}, 0 10px 40px rgba(0,0,0,0.55)`,
});

type OP = {t: number; cam: Cam; W: (l: string, p: string, fb?: number) => number; a24: number; b24: number; a25: number; b25: number};

// Small illustrative tags pinned to towers: minds at work (no numbers, not claims).
const TAGS: {p: V3; txt: string}[] = [
  {p: [-70, 42, -205], txt: 'protein design'},
  {p: [95, 38, -250], txt: 'new materials'},
  {p: [-160, 30, -330], txt: 'tutoring'},
  {p: [40, 34, -420], txt: 'clean energy'},
  {p: [-20, 30, -560], txt: 'drug discovery'},
];

const Overlays: React.FC<OP> = ({t, cam, W, a24, b24, a25, b25}) => {
  // quote card, anchored in the sky left of the pillar (parallax with the camera)
  const qIn = prog(t, W('L24', 'country') - 0.3, W('L24', 'country') + 0.6, E.out);
  const qOut = prog(t, b24 + 0.1, b24 + 0.8, E.inOut);
  const qOp = qIn * (1 - qOut);
  const tagIn = (i: number) => prog(t, a24 + 1.6 + i * 0.35, a24 + 2.2 + i * 0.35, E.out) * (1 - prog(t, a25 - 0.6, a25, E.inOut));
  const artIn = prog(t, W('L24', 'working') - 0.2, W('L24', 'working') + 0.5, E.out) * (1 - prog(t, b24 + 0.3, b24 + 1, E.inOut));

  // L25 ruler
  const rIn = prog(t, a25 - 0.5, a25 + 0.4, E.out);
  const rOut = prog(t, b25 + 0.2, b25 + 0.9, E.inOut);
  const comp = prog(t, W('L25', 'compressed') - 0.1, W('L25', 'into') + 0.2, E.inOut);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {qOp > 0 && (
        <div style={{position: 'absolute', left: 150, top: 205 - (1 - qIn) * 16, opacity: qOp, padding: '22px 30px 20px', maxWidth: 760, ...glass(C.gold)}}>
          <div style={{...lab, color: rgba(C.gold, 0.9), marginBottom: 10}}>Imagine</div>
          <div style={{fontFamily: F.serif, fontStyle: 'italic', fontWeight: 340, fontSize: 56, lineHeight: 1.12, color: C.ivory, fontVariationSettings: '"opsz" 144, "SOFT" 50', textShadow: `0 0 26px ${rgba(C.ember, 0.35)}`}}>
            “{FACTS.quote}”
          </div>
          <div style={{...mono, color: rgba(C.ice, 0.8), marginTop: 14}}>{FACTS.quoteBy}</div>
        </div>
      )}

      {TAGS.map((g, i) => {
        const op = tagIn(i);
        if (op <= 0) return null;
        const p = project(cam, g.p);
        if (!p.vis || p.x < 60 || p.x > 1860 || p.y < 60 || p.y > 900) return null;
        const hide = (artIn > 0 && p.x > 1100 && p.y < 520 ? 1 - artIn : 1) * (qOp > 0 && p.x < 980 && p.y < 560 ? 1 - qOp : 1);
        if (op * hide <= 0.01) return null;
        return (
          <div key={g.txt} style={{position: 'absolute', left: p.x, top: p.y, opacity: op * hide}}>
            <div style={{position: 'absolute', left: -5, top: -5, width: 10, height: 10, borderRadius: 5, background: '#fff', boxShadow: `0 0 12px ${C.gold}, 0 0 24px ${C.ember}`}} />
            <div style={{position: 'absolute', left: 0, bottom: 0, width: 1, height: 46, background: `linear-gradient(0deg, ${rgba(C.gold, 0.8)}, ${rgba(C.gold, 0)})`}} />
            <div style={{position: 'absolute', left: 8, top: -78, whiteSpace: 'nowrap', padding: '5px 12px 6px', ...glass(C.gold), ...mono, fontSize: 24, color: C.ivory}}>
              <span style={{color: C.gold}}>●</span> agent · {g.txt}
            </div>
          </div>
        );
      })}

      {artIn > 0 && (
        <div style={{position: 'absolute', right: 110, top: 190 - (1 - artIn) * 14, opacity: artIn, padding: '16px 26px 16px', width: 640, whiteSpace: 'nowrap', ...glass(C.gold)}}>
          <div style={{...lab, color: rgba(C.ice, 0.88)}}>Case file · {FACTS.flt.when}</div>
          <div style={{fontFamily: F.sans, fontWeight: 760, fontSize: 38, color: C.gold, marginTop: 6, textShadow: `0 0 18px ${rgba(C.ember, 0.5)}`}}>{FACTS.flt.head}</div>
          <div style={{fontFamily: F.sans, fontSize: 26, color: C.ivory, marginTop: 4}}>{FACTS.flt.sub}</div>
          <div style={{...mono, fontSize: 24, color: C.gold, marginTop: 8}}>{FACTS.flt.stat}</div>
          <div style={{...mono, color: rgba(C.ice, 0.72), marginTop: 4}}>{FACTS.flt.src}</div>
        </div>
      )}

      {rIn * (1 - rOut) > 0 && <Ruler t={t} rIn={rIn} comp={comp} op={rIn * (1 - rOut)} />}

    </AbsoluteFill>
  );
};

// Hero graphic: a century-long ruler of years physically collapses into a short, white-hot span.
const Ruler: React.FC<{t: number; rIn: number; comp: number; op: number}> = ({t, rIn, comp, op}) => {
  const cx = 960;
  const y = 610;
  const N = 100;
  const span = lerp(1360, 150, comp);
  const x0 = cx - span / 2;
  const drawn = prog(rIn, 0, 1, E.out);
  const heat = comp;
  const ticks = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    if (f > drawn) break;
    const x = x0 + f * span;
    const major = i % 10 === 0;
    const h = major ? 58 : i % 5 === 0 ? 34 : 18;
    const col = `rgba(255,${Math.round(lerp(226, 238, heat))},${Math.round(lerp(205, 200, heat))},${lerp(major ? 0.85 : 0.5, 1, heat)})`;
    ticks.push(<line key={i} x1={x} y1={y - h} x2={x} y2={y} stroke={heat > 0.5 ? C.gold : col} strokeWidth={major ? 2.4 : 1.4} />);
  }
  const brk = (x: number, dir: number) => (
    <path d={`M${x + dir * 16},${y - 76} L${x},${y - 76} L${x},${y + 14} L${x + dir * 16},${y + 14}`} fill="none" stroke={rgba(C.gold, 0.5 + 0.5 * heat)} strokeWidth={2.5} />
  );
  const fromOp = 1 - clamp(comp * 2.2);
  const toOp = clamp(comp * 2.2 - 1.1);
  const pulse = heat;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <div style={{position: 'absolute', left: 160, top: y - 330, width: 1600, height: 470, background: 'radial-gradient(ellipse at 50% 55%, rgba(4,5,9,0.78), rgba(4,5,9,0.35) 55%, rgba(4,5,9,0) 75%)'}} />
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {heat > 0.02 && <ellipse cx={cx} cy={y - 24} rx={span * 0.62 + 30} ry={70} fill={rgba(C.ember, 0.22 * pulse)} />}
        <line x1={x0} y1={y} x2={x0 + span * drawn} y2={y} stroke={rgba(C.ember, 0.3 + 0.4 * heat)} strokeWidth={10 + 10 * heat} strokeLinecap="round" />
        <line x1={x0} y1={y} x2={x0 + span * drawn} y2={y} stroke={heat > 0.3 ? '#fff4e0' : rgba(C.ivory, 0.8)} strokeWidth={2} />
        {ticks}
        {drawn > 0.98 && brk(x0 - 22, 1)}
        {drawn > 0.98 && brk(x0 + span + 22, -1)}
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: y - 262, textAlign: 'center', ...lab, fontSize: 26, color: C.ivory, textShadow: '0 2px 14px rgba(0,0,0,0.9)', opacity: clamp(rIn * 2)}}>
        {FACTS.fromTo}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: y - 208, height: 110, textAlign: 'center', whiteSpace: 'nowrap'}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 18, fontFamily: F.mono, fontSize: 76, color: C.ivory, opacity: fromOp * clamp(rIn * 2 - 0.4), textShadow: '0 2px 20px rgba(0,0,0,0.85)', transform: `scale(${1 - 0.25 * clamp(comp * 2)})`}}>
          {FACTS.from}
        </div>
        <div style={{position: 'absolute', left: 0, right: 0, top: -2, fontFamily: F.mono, fontWeight: 600, fontSize: 108, color: C.gold, opacity: toOp, textShadow: `0 0 34px ${rgba(C.ember, 0.8)}, 0 2px 20px rgba(0,0,0,0.7)`, transform: `scale(${lerp(1.25, 1, toOp)})`}}>
          {FACTS.to}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: y + 36, textAlign: 'center', ...mono, fontSize: 24, color: rgba(C.ice, 0.85), opacity: clamp(rIn * 1.5 - 0.5), textShadow: '0 2px 10px rgba(0,0,0,0.9)'}}>
        {FACTS.fromBy}
      </div>
    </div>
  );
};

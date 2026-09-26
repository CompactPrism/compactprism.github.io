// S06 Powers: the power-scanner HUD.
// 0–0.45 s  the emblem finishes its flight from S05 into the gauge; the HUD boots around it
// L14       a circular release timeline sweeps 2023 → 2026 while the SWE-bench Verified arc climbs 49.0 → 87.6 %
// L15       five powers unlock, each on its phrase, as glass panels floating in 3D around the hero
//           (READ, SEE, CODE, COMPUTER USE, AGENTS), wired to the gauge with data packets
// L16       the HUD reframes: METR time-horizon chart, doubling every ~7 months, and accelerating
// end       a cold wind and dark haze roll in from the edges; the HUD flickers; dip to black
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ShaderCanvas} from '../lib/ShaderCanvas';
import {ClaudeSpark} from '../lib/ClaudeSpark';
import {useScene} from '../lib/timing';
import {C, rgba} from '../theme';
import {E, clamp, lerp, prog, rnd} from '../lib/anim';
import {BG6, WIND} from './S06/shaders';
import {EMBLEM_HUD_SIZE, FLY_S05, FLY_S06, GAUGE, HERO_ROT_END, flyAt} from './S06/layout';
import {Gauge, Readout, RELEASES, T0, T1} from './S06/Gauge';
import {AgentsBody, CodeBody, ComputerBody, Glass, ReadBody, SeeBody} from './S06/Panels';
import {Chart} from './S06/Chart';
import {VO_FRAC} from './S05/vo';

// Every displayed fact, checked against research/FACTS.md (sections in brackets):
// release dates [§6]; SWE-bench Verified 49.0 / 62.3 / 72.5 / 80.9 / 87.6 % [§9]; context 100K (May 2023),
// 200K (Nov 2023), 1M default (2026) [§7]; Gatsby 72K tokens / 22 s (anthropic.com/news/100k-context-windows,
// director-verified); computer use public beta Oct 2024 [§6]; Claude Code preview Feb 2025 [§6];
// METR: doubling ~7 months (Mar 2025), 3.7 Sonnet ~59 min, Opus 4.5 ~4 h 49 min, Opus 4.6 ~14.5 h (noisy) [§8].

type PanelDef = {
  id: 'read' | 'see' | 'code' | 'computer' | 'agents';
  title: string;
  chip: string;
  X: number;
  Y: number;
  Z: number;
  w: number;
  h: number;
  ry: number;
  rx: number;
  side: 1 | -1 | 0; // which edge faces the gauge: 1 = right edge, -1 = left edge, 0 = top edge
  ping: number; // release date to flare on the timeline ring
};

const PANELS: PanelDef[] = [
  {id: 'read', title: 'READ', chip: 'MAY 2023', X: -520, Y: -170, Z: -30, w: 480, h: 262, ry: 15, rx: -5, side: 1, ping: RELEASES[1].d},
  {id: 'see', title: 'SEE', chip: 'MAR 2024', X: 520, Y: -170, Z: -110, w: 480, h: 262, ry: -15, rx: -5, side: -1, ping: RELEASES[4].d},
  {id: 'code', title: 'CODE', chip: 'FEB 2025', X: -515, Y: 170, Z: 40, w: 520, h: 272, ry: 13, rx: 5, side: 1, ping: RELEASES[7].d},
  {id: 'computer', title: 'COMPUTER USE', chip: 'OCT 2024', X: 515, Y: 170, Z: -50, w: 520, h: 272, ry: -13, rx: 5, side: -1, ping: RELEASES[6].d},
  {id: 'agents', title: 'AGENTS', chip: 'HOURS', X: 0, Y: 296, Z: 20, w: 600, h: 205, ry: 0, rx: 9, side: 0, ping: RELEASES[12].d},
];
const BODIES = {read: ReadBody, see: SeeBody, code: CodeBody, computer: ComputerBody, agents: AgentsBody};
const LP = 1100; // per-panel CSS perspective

const BOKEH = Array.from({length: 12}, (_, i) => ({
  x: rnd(`bx${i}`) * 1920,
  y: 190 + rnd(`by${i}`) * 700,
  r: 30 + rnd(`br${i}`) * 90,
  k: 1.3 + rnd(`bk${i}`) * 1.2,
  a: 0.05 + rnd(`ba${i}`) * 0.09,
}));

const bez = (p0: {x: number; y: number}, p1: {x: number; y: number}, p2: {x: number; y: number}, p3: {x: number; y: number}, k: number) => {
  const m = 1 - k;
  return {
    x: m * m * m * p0.x + 3 * m * m * k * p1.x + 3 * m * k * k * p2.x + k * k * k * p3.x,
    y: m * m * m * p0.y + 3 * m * m * k * p1.y + 3 * m * k * k * p2.y + k * k * k * p3.y,
  };
};

export const S06: React.FC = () => {
  const {t, dur, cue, end, frame} = useScene('S06');
  const at = (L: string, f: number) => cue(L) + f * (end(L) - cue(L));
  const B = {
    sweep0: cue('L14') + 0.05,
    sweep1: end('L14') + 0.75,
    stings: [VO_FRAC.L15.read, VO_FRAC.L15.see, VO_FRAC.L15.code, VO_FRAC.L15.computer, VO_FRAC.L15.agents].map((f) => at('L15', f)),
    re: cue('L16') - 0.45,
    line0: cue('L16') + 0.45,
    line1: at('L16', 0.66),
    big: at('L16', VO_FRAC.L16.doubled) - 0.35,
    lately: at('L16', VO_FRAC.L16.lately),
    wind: dur - 1.2,
  };

  // camera: slow drift + push; everything in the HUD world is projected with it
  const camX = 26 * Math.sin(t * 0.23) + 10 * Math.sin(t * 0.61);
  const camY = 10 * Math.sin(t * 0.19);
  const camZ = 1400 - 90 * prog(t, 0, dur, (x) => x);
  const yaw = 1.6 * Math.sin(t * 0.23);

  // L16 reframe: the gauge slides left and shrinks; panels scatter; the chart comes forward
  const re = prog(t, B.re, B.re + 1.0, E.inOut);
  const gC = {x: lerp(GAUGE.x, 318, re), y: lerp(GAUGE.y, 505, re)};
  const gS = lerp(1, 0.62, re);
  const proj = (X: number, Y: number, Z: number) => {
    const s = camZ / (camZ - Z);
    return {x: gC.x + (X - camX) * s, y: gC.y + (Y - camY) * s, s};
  };
  const g0 = proj(0, 0, 0);

  // boot + timeline sweep
  const boot = prog(t, 0.05, 1.4, (x) => x);
  const cursor = T0 + (T1 - T0 + 0.05) * prog(t, B.sweep0, B.sweep1, E.inOut);
  const swe = (() => {
    const pts = [
      {d: 2024 + 9.7 / 12, v: 49.0},
      {d: 2025 + 1.8 / 12, v: 62.3},
      {d: 2025 + 4.7 / 12, v: 72.5},
      {d: 2025 + 10.75 / 12, v: 80.9},
      {d: 2026 + 3.5 / 12, v: 87.6},
    ];
    let v = 0;
    for (const p of pts) if (cursor >= p.d) v = lerp(v, p.v, clamp((cursor - p.d) * 14));
    return v;
  })();

  // powers
  const since = B.stings.map((s) => t - s);
  const unlocked = since.map((s) => (s > 0 ? s : 0));
  const latest = since.reduce((m, s, i) => (s > 0 ? i : m), -1);
  const zFocus = latest >= 0 ? PANELS.reduce((z, p, i) => (i <= latest ? lerp(z, p.Z, prog(since[i], 0, 0.5, E.inOut)) : z), PANELS[0].Z) : 0;
  const pings = PANELS.map((p, i) => ({d: p.ping, k: since[i] > 0 ? Math.exp(-since[i] * 2.2) : 0}));
  const stingHot = since.reduce((m, s) => Math.max(m, s > 0 ? Math.exp(-s * 4) : 0), 0);

  // emblem: finishes the flight from S05, then lives in the gauge
  const emb = (() => {
    if (t < FLY_S06) {
      const f = flyAt(FLY_S05 + t);
      return {x: f.x, y: f.y, size: f.size, rot: HERO_ROT_END * f.u + f.spin};
    }
    return {x: g0.x, y: g0.y, size: EMBLEM_HUD_SIZE * gS * g0.s, rot: HERO_ROT_END + 90 + (t - FLY_S06) * 5};
  })();
  const landing = t < FLY_S06 + 0.5 ? Math.exp(-Math.max(0, t - FLY_S06) * 5) * (t > FLY_S06 ? 1 : 0) : 0;

  // end: cold wind, flicker, dip
  const wind = prog(t, B.wind, dur, E.in);
  const flick = wind > 0 ? (rnd(`fl${frame}`) > 0.62 ? 0.45 : 1) * (1 - 0.45 * wind) : 1;
  const glitch = wind > 0 && rnd(`gl${frame}`) > 0.7 ? (rnd(`gx${frame}`) - 0.5) * 18 * wind : 0;
  const black = prog(t, dur - 0.4, dur, E.in);
  const hudOp = flick * (1 - wind * 0.35);

  // panel screen poses
  const panels = PANELS.map((p, i) => {
    const s0 = since[i];
    const inK = prog(s0, -0.12, 0.45, E.out);
    const out = re;
    const X = p.X * (1 + 0.28 * (1 - inK) + 0.75 * out);
    const Y = p.Y * (1 + 0.12 * (1 - inK) + 0.3 * out);
    const Z = p.Z - 560 * (1 - inK) - 420 * out;
    const pr = proj(X, Y, Z);
    const op = clamp(inK * 1.8) * (1 - out);
    const blur = Math.min(1.8, Math.max(0, Math.abs(p.Z - zFocus) - 50) * 0.011) + 2.5 * (1 - inK) + 2 * out;
    const ry = p.ry + yaw;
    // anchor on the edge facing the gauge (for connectors)
    let ax = 0;
    let ay = 0;
    if (p.side !== 0) {
      const xl = (p.side * p.w) / 2;
      const z = -xl * Math.sin((ry * Math.PI) / 180);
      ax = ((xl * Math.cos((ry * Math.PI) / 180) * LP) / (LP - z)) * pr.s;
    } else {
      const yl = -p.h / 2;
      const z = yl * Math.sin((p.rx * Math.PI) / 180);
      ay = ((yl * Math.cos((p.rx * Math.PI) / 180) * LP) / (LP - z)) * pr.s;
    }
    return {p, pr, op, blur, ry, anchor: {x: pr.x + ax, y: pr.y + ay}, hot: s0 > 0 ? Math.exp(-s0 * 3.5) : 0, s0, inK};
  });

  // chart
  const chartIn = prog(t, B.re + 0.3, B.re + 1.2, E.out);
  const chartPr = proj(600 - 318 + (1135 - 960) - 0, 540 - 505, -500 * (1 - chartIn));
  const CW = 1230;
  const CH = 640;
  const chartC = {x: 1135 - (camX * 0.4) + (1 - chartIn) * 60, y: 540 - camY * 0.4};

  const spill: number[] = [];
  panels.forEach((q) => spill.push(q.pr.x, q.pr.y, q.op * (0.7 + 1.2 * q.hot)));

  return (
    <AbsoluteFill style={{background: C.void, overflow: 'hidden'}}>
      <ShaderCanvas
        frag={BG6}
        scale={0.5}
        uniforms={{
          uCam: [camX, camY],
          uGauge: [g0.x, g0.y, (0.55 + 0.5 * stingHot + 0.6 * landing) * (1 - 0.4 * re) * boot ** 0.5],
          uSpill: spill,
          uChart: [chartC.x, chartC.y, chartIn],
          uCold: wind,
          uFade: lerp(0.35, 1, prog(t, 0, 0.7)) * (1 - 0.5 * wind),
        }}
      />

      {/* deep bokeh (behind the HUD) */}
      {BOKEH.slice(0, 5).map((b, i) => (
        <div key={i} style={{position: 'absolute', left: b.x - b.r - camX * 0.3, top: b.y - b.r - camY * 0.3, width: b.r * 2, height: b.r * 2, borderRadius: '50%', background: `radial-gradient(circle, ${rgba(C.coral, b.a)} 0%, rgba(0,0,0,0) 70%)`}} />
      ))}

      <AbsoluteFill style={{opacity: hudOp, transform: `translateX(${glitch}px)`}}>
        {/* connectors + data packets */}
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
          {panels.map((q, i) => {
            if (q.s0 <= 0 || q.op <= 0.01) return null;
            const dx = q.anchor.x - g0.x;
            const dy = q.anchor.y - g0.y;
            const ang = Math.atan2(dy, dx);
            const rr = (GAUGE.r + 8) * gS * g0.s;
            const p0 = {x: g0.x + Math.cos(ang) * rr, y: g0.y + Math.sin(ang) * rr};
            const p3 = q.anchor;
            const horiz = q.p.side !== 0;
            const p1 = horiz ? {x: p0.x + Math.sign(dx) * 90, y: p0.y} : {x: p0.x, y: p0.y + 30};
            const p2 = horiz ? {x: p3.x - Math.sign(dx) * 110, y: p3.y} : {x: p3.x, y: p3.y - 20};
            const d = `M${p0.x},${p0.y} C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
            const draw = prog(q.s0, 0, 0.35, E.out);
            const packets = [0, 0.33, 0.66].map((o, k) => {
              const u = (t * 0.55 + o + i * 0.17) % 1;
              const back = k === 2;
              const pt = bez(p0, p1, p2, p3, back ? 1 - u : u);
              return <rect key={k} x={pt.x - 3.5} y={pt.y - 3.5} width={7} height={7} transform={`rotate(45 ${pt.x} ${pt.y})`} fill={back ? rgba(C.ivory, 0.8) : C.gold} opacity={draw >= 1 ? Math.sin(u * Math.PI) : 0} />;
            });
            return (
              <g key={i} opacity={q.op}>
                <path d={d} fill="none" stroke={rgba(C.ember, 0.22)} strokeWidth={7} pathLength={1} strokeDasharray={`${draw} 1`} />
                <path d={d} fill="none" stroke={rgba(C.gold, 0.75)} strokeWidth={1.4} pathLength={1} strokeDasharray={`${draw} 1`} />
                <circle cx={p3.x} cy={p3.y} r={4} fill={C.gold} opacity={draw} />
                {packets}
              </g>
            );
          })}
          {/* sting rings */}
          {panels.map((q, i) => {
            if (q.s0 <= 0 || q.s0 > 0.8) return null;
            const k = E.out(q.s0 / 0.8);
            return <ellipse key={i} cx={q.pr.x} cy={q.pr.y} rx={q.p.w * 0.5 + 160 * k} ry={q.p.h * 0.5 + 90 * k} fill="none" stroke={rgba('#FFF1DA', 0.8 * (1 - k))} strokeWidth={2} />;
          })}
          {/* chart link */}
          {chartIn > 0 && (
            <path
              d={`M${g0.x + (GAUGE.r + 8) * gS * g0.s},${g0.y} C${g0.x + 200},${g0.y} ${chartC.x - CW / 2 - 90},${chartC.y} ${chartC.x - CW / 2 + 4},${chartC.y}`}
              fill="none"
              stroke={rgba(C.gold, 0.6 * chartIn)}
              strokeWidth={1.4}
              pathLength={1}
              strokeDasharray={`${chartIn} 1`}
            />
          )}
        </svg>

        {/* the gauge (moves as one piece) */}
        <AbsoluteFill style={{transform: `translate(${g0.x - GAUGE.x}px, ${g0.y - GAUGE.y}px) scale(${gS * g0.s})`, transformOrigin: `${GAUGE.x}px ${GAUGE.y}px`}}>
          <Gauge t={t} cx={GAUGE.x} cy={GAUGE.y} r={GAUGE.r} boot={boot} cursor={cursor} swe={swe} unlocked={unlocked} ping={pings} op={1} />
        </AbsoluteFill>
        <Readout cursor={cursor} op={prog(t, B.sweep0 - 0.3, B.sweep0 + 0.3) * (1 - re)} x={g0.x} y={194 - camY * 0.2} />

        {/* the hero */}
        {landing > 0.01 && <div style={{position: 'absolute', left: emb.x - 90, top: emb.y - 90, width: 180, height: 180, borderRadius: '50%', border: `2px solid ${rgba('#FFF1DA', 0.8 * landing)}`, transform: `scale(${1.6 - landing * 0.6})`}} />}
        <div style={{position: 'absolute', left: emb.x - emb.size / 2, top: emb.y - emb.size / 2}}>
          <ClaudeSpark size={emb.size} glow={0.75 + 0.6 * stingHot + 0.6 * landing} rotate={emb.rot} pulse={0.5 + 0.5 * Math.sin(t * 2.2)} />
        </div>

        {/* floating glass panels */}
        {panels
          .slice()
          .sort((a, b) => a.p.Z - b.p.Z)
          .map((q) => {
            if (q.op <= 0.005) return null;
            const Body = BODIES[q.p.id];
            return (
              <div
                key={q.p.id}
                style={{
                  position: 'absolute',
                  left: q.pr.x - q.p.w / 2,
                  top: q.pr.y - q.p.h / 2,
                  width: q.p.w,
                  height: q.p.h,
                  opacity: q.op,
                  transform: `scale(${q.pr.s}) perspective(${LP}px) rotateY(${q.ry}deg) rotateX(${q.p.rx}deg)`,
                  filter: q.blur > 0.35 ? `blur(${q.blur.toFixed(2)}px)` : undefined,
                }}
              >
                <Glass w={q.p.w} h={q.p.h} kind={q.p.id} title={q.p.title} chip={q.p.chip} spillSide={q.p.side === 1 ? 'right' : q.p.side === -1 ? 'left' : 'top'} hot={q.hot}>
                  <Body u={Math.max(0, q.s0)} t={t} />
                </Glass>
              </div>
            );
          })}

        {/* L16 chart */}
        {chartIn > 0.005 && (
          <div
            style={{
              position: 'absolute',
              left: chartC.x - CW / 2,
              top: chartC.y - CH / 2,
              width: CW,
              height: CH,
              opacity: chartIn,
              transform: `scale(${chartPr.s * (0.94 + 0.06 * chartIn)}) perspective(1600px) rotateY(${-4 + yaw * 0.5}deg)`,
              filter: chartIn < 0.6 ? `blur(${((0.6 - chartIn) * 5).toFixed(2)}px)` : undefined,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 14,
                background: `linear-gradient(160deg, ${rgba(C.ivory, 0.06)} 0%, ${rgba(C.ink, 0.74)} 35%, ${rgba(C.ink, 0.7)} 75%, ${rgba(C.clay, 0.12)} 100%)`,
                border: `1px solid ${rgba(C.gold, 0.28)}`,
                boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${rgba(C.coral, 0.12)}`,
              }}
            />
            <div style={{position: 'absolute', inset: 0, borderRadius: 14, background: `linear-gradient(to right, ${rgba(C.ember, 0.14)}, rgba(0,0,0,0) 30%)`}} />
            <Chart t={t} w={CW} h={CH} tLine={[B.line0, B.line1]} tBig={B.big} tLately={B.lately} op={chartIn} />
          </div>
        )}

        {/* holographic scanlines + a slow scan band */}
        <AbsoluteFill style={{background: 'repeating-linear-gradient(180deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 4px)', opacity: 0.55}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 140 + ((t * 0.28) % 1) * 820, height: 110, background: `linear-gradient(180deg, rgba(0,0,0,0), ${rgba(C.gold, 0.035)}, rgba(0,0,0,0))`}} />
      </AbsoluteFill>

      {/* foreground bokeh: closest layer, strongest parallax */}
      {BOKEH.slice(5).map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: b.x - b.r * 1.6 - camX * b.k - t * 6 * b.k,
            top: b.y - b.r * 1.6 - camY * b.k,
            width: b.r * 3.2,
            height: b.r * 3.2,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${rgba(C.gold, b.a * 0.9)} 0%, ${rgba(C.coral, b.a * 0.4)} 40%, rgba(0,0,0,0) 70%)`,
          }}
        />
      ))}

      {wind > 0.001 && <ShaderCanvas frag={WIND} scale={0.5} uniforms={{uWind: wind}} />}
      {black > 0 && <AbsoluteFill style={{background: '#000', opacity: black}} />}
    </AbsoluteFill>
  );
};

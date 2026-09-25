// The instrument: log-scale training-compute chart drawn in light, projected through the live 3D camera.
import React from 'react';
import {C, F, rgba} from '../../theme';
import {E, clamp, lerp, prog} from '../../lib/anim';
import {Cam, V3, project} from './cam';
import {CH, FACTS, TREND, chartW, chartX, pxW, trendV} from './chart';

export type ChartState = {
  on: number; // global opacity
  axes: number; // 0..1 axis draw
  labels: number; // 0..1 tick labels
  draw: number; // 0..1 trend line head
  callout: number; // 0..1 rate callout
  decade: number; // 0..1 2010–2024 highlight
  morph: number; // 0 log .. 1 linear
  t: number;
};

const Pow: React.FC<{mant?: string; exp: number}> = ({mant, exp}) => (
  <span style={{whiteSpace: 'nowrap'}}>
    {mant ? `${mant}×` : ''}10
    <span style={{fontSize: '0.64em', position: 'relative', top: '-0.62em', marginLeft: 1}}>{exp}</span>
  </span>
);

const P = (cam: Cam, w: V3) => project(cam, w);

const Glass: React.FC<{x: number; y: number; s: number; op: number; children: React.ReactNode; anchor?: 'l' | 'r'; w?: number}> = ({x, y, s, op, children, anchor = 'l', w}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      transform: `translate(${anchor === 'r' ? '-100%' : '0'}, 0) scale(${s})`,
      transformOrigin: anchor === 'r' ? '100% 0' : '0 0',
      opacity: op,
      padding: '10px 16px 11px',
      borderRadius: 6,
      background: 'linear-gradient(160deg, rgba(34,30,32,0.62), rgba(10,11,18,0.55))',
      border: `1px solid ${rgba(C.gold, 0.28)}`,
      boxShadow: `0 0 26px ${rgba(C.coral, 0.14)}, 0 8px 30px rgba(0,0,0,0.5)`,
    }}
  >
    {children}
  </div>
);

const lab = {fontFamily: F.sans, fontWeight: 650, fontSize: 22, letterSpacing: '0.2em', textTransform: 'uppercase' as const};
const mono = {fontFamily: F.mono, fontSize: 22};

export const Chart: React.FC<{cam: Cam; s: ChartState}> = ({cam, s}) => {
  if (s.on <= 0.001) return null;
  const {axes, labels, draw, morph} = s;
  const pr = (w: V3) => P(cam, w);
  const bl = pr(chartW(CH.yr0, CH.v0, 0));
  const tl = pr(pxW(CH.px0, CH.py1 - 18));
  const br = pr(pxW(CH.px1 + 10, CH.py0));
  const yTop = lerp(bl.y, tl.y, prog(axes, 0, 0.8, E.out));
  const xEnd = lerp(bl.x, br.x, prog(axes, 0.15, 1, E.out));
  const yAxisOnX = (py: number) => {
    const a = pr(pxW(CH.px0, py));
    return a;
  };

  // trend line samples
  const headYr = lerp(TREND.start, TREND.end, draw);
  const N = 90;
  const pts: {x: number; y: number}[] = [];
  for (let i = 0; i <= N; i++) {
    const yr = lerp(TREND.start, headYr, i / N);
    pts.push(pr(chartW(yr, trendV(yr), morph)));
  }
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const head = pts[pts.length - 1];
  const lineOn = draw > 0.001 ? 1 : 0;

  // y ticks: decades + minor log ticks
  const decades = Array.from({length: CH.v1 - CH.v0 + 1}, (_, i) => CH.v0 + i);
  const years = Array.from({length: CH.yr1 - CH.yr0 + 1}, (_, i) => CH.yr0 + i);
  const logOp = 1 - clamp(morph * 1.6);
  const linOp = clamp(morph * 1.6 - 0.6);
  const cardsOp = 1 - clamp(morph * 2);

  return (
    <div style={{position: 'absolute', inset: 0, opacity: s.on}}>
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <defs>
          <radialGradient id="c4head">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.18" stopColor={C.gold} stopOpacity="0.95" />
            <stop offset="0.5" stopColor={C.ember} stopOpacity="0.35" />
            <stop offset="1" stopColor={C.coral} stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* faint decade grid */}
        {decades.map((v) => {
          const a = pr(chartW(CH.yr0, v, morph));
          const b = pr(chartW(CH.yr1, v, morph));
          const on = clamp(labels * 1.6 - (v - CH.v0) / 22) * (v % 2 === 0 ? 0.1 : 0.05) * lerp(1, 0.3, morph);
          if (a.y < 150 || a.y > 900) return null;
          return <line key={v} x1={a.x} y1={a.y} x2={lerp(a.x, b.x, prog(labels, 0, 1, E.out))} y2={lerp(a.y, b.y, prog(labels, 0, 1, E.out))} stroke={rgba(C.ice, on)} strokeWidth={1} />;
        })}
        {/* axes */}
        <line x1={bl.x} y1={bl.y} x2={bl.x + (tl.x - bl.x) * prog(axes, 0, 0.8, E.out)} y2={yTop} stroke={rgba(C.ice, 0.55)} strokeWidth={1.5} />
        <line x1={bl.x} y1={bl.y} x2={xEnd} y2={bl.y + (br.y - bl.y) * prog(axes, 0.15, 1, E.out)} stroke={rgba(C.ice, 0.55)} strokeWidth={1.5} />
        {/* 2010–2024 highlight on the x axis */}
        {s.decade > 0 && (() => {
          const a = pr(chartW(2010, CH.v0, 0));
          const b = pr(chartW(lerp(2010, 2024, prog(s.decade, 0, 1, E.inOut)), CH.v0, 0));
          const e = pr(chartW(2024, CH.v0, 0));
          return (
            <g opacity={clamp(s.decade * 3) * cardsOp}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={rgba(C.ember, 0.35)} strokeWidth={9} strokeLinecap="round" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.gold} strokeWidth={2.5} />
              <line x1={a.x} y1={a.y - 12} x2={a.x} y2={a.y + 12} stroke={C.gold} strokeWidth={2} />
              <line x1={e.x} y1={e.y - 12} x2={e.x} y2={e.y + 12} stroke={C.gold} strokeWidth={2} opacity={prog(s.decade, 0.8, 1)} />
            </g>
          );
        })()}
        {/* y ticks */}
        {decades.map((v) => {
          const on = clamp(axes * 1.5 - (v - CH.v0) / 16);
          const out: React.ReactNode[] = [];
          const a = pr(chartW(CH.yr0, v, morph));
          if (a.y > 150 && a.y < 905) out.push(<line key={`d${v}`} x1={a.x - 12} y1={a.y} x2={a.x} y2={a.y} stroke={rgba(C.ice, 0.6 * on)} strokeWidth={1.4} />);
          if (v < CH.v1) {
            for (let m = 2; m <= 9; m++) {
              const b = pr(chartW(CH.yr0, v + Math.log10(m), morph));
              if (b.y < 150 || b.y > 905) continue;
              out.push(<line key={`m${v}-${m}`} x1={b.x - 5} y1={b.y} x2={b.x} y2={b.y} stroke={rgba(C.ice, 0.3 * on * logOp)} strokeWidth={1} />);
            }
          }
          return <g key={v}>{out}</g>;
        })}
        {/* x ticks */}
        {years.map((yr) => {
          const a = pr(chartW(yr, CH.v0, 0));
          const on = clamp(axes * 1.6 - (yr - CH.yr0) / 20);
          const major = yr % 2 === 0;
          return <line key={yr} x1={a.x} y1={a.y} x2={a.x} y2={a.y + (major ? 12 : 6)} stroke={rgba(C.ice, (major ? 0.6 : 0.35) * on)} strokeWidth={1.3} />;
        })}
        {/* HUD corner brackets */}
        {[
          [tl, 1, 1],
          [pr(pxW(CH.px1 + 10, CH.py1 - 18)), -1, 1],
        ].map(([p, sx, sy], i) => {
          const q = p as {x: number; y: number};
          const L = 22 * axes;
          return <path key={i} d={`M${q.x + (sx as number) * L},${q.y} L${q.x},${q.y} L${q.x},${q.y + (sy as number) * L}`} fill="none" stroke={rgba(C.gold, 0.5 * axes)} strokeWidth={1.4} />;
        })}
        {/* trend line: layered strokes = light, not ink */}
        {lineOn > 0 && (
          <g>
            <path d={d} fill="none" stroke={rgba(C.clay, 0.16)} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke={rgba(C.ember, 0.28)} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke={rgba(C.gold, 0.95)} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} fill="none" stroke="rgba(255,250,240,0.95)" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {/* verified points */}
        {FACTS.points.map((p) => {
          const hp = clamp((headYr - p.yr) / 0.5 + 0.02);
          if (hp <= 0 && morph <= 0) return null;
          const q = pr(chartW(p.yr, p.v, morph));
          const age = (headYr - p.yr) * 1.4;
          const ring = clamp(age);
          return (
            <g key={p.id} opacity={clamp(hp * 2)}>
              <circle cx={q.x} cy={q.y} r={10 + 36 * ring} fill="none" stroke={rgba(C.gold, 0.55 * (1 - ring))} strokeWidth={2} />
              <circle cx={q.x} cy={q.y} r={16} fill="url(#c4head)" opacity={0.8} />
              <circle cx={q.x} cy={q.y} r={7} fill="none" stroke={C.ivory} strokeWidth={1.6} />
              <circle cx={q.x} cy={q.y} r={3.2} fill="#fff" />
            </g>
          );
        })}
        {lineOn > 0 && (
          <g>
            <circle cx={head.x} cy={head.y} r={46} fill="url(#c4head)" opacity={0.55} />
            <circle cx={head.x} cy={head.y} r={18} fill="url(#c4head)" />
            <line x1={head.x - 40} y1={head.y} x2={head.x + 40} y2={head.y} stroke="rgba(255,244,225,0.5)" strokeWidth={1} />
            <line x1={head.x} y1={head.y - 26} x2={head.x} y2={head.y + 26} stroke="rgba(255,244,225,0.35)" strokeWidth={1} />
          </g>
        )}
      </svg>

      {/* y labels */}
      {decades
        .filter((v) => v % 2 === 0)
        .map((v) => {
          const a = pr(chartW(CH.yr0, v, 0));
          const on = clamp(labels * 1.5 - (v - CH.v0) / 16) * logOp;
          return (
            <div key={v} style={{position: 'absolute', left: a.x - 22, top: a.y - 15, transform: 'translateX(-100%)', ...mono, color: rgba(C.ice, 0.78), opacity: on}}>
              <Pow exp={v} />
            </div>
          );
        })}
      {linOp > 0 &&
        [
          {v: -99, t: '0'},
          {v: Math.log10(5e25), t: 'half'},
          {v: 26, t: 'top'},
        ].map((L) => {
          const a = pr(chartW(CH.yr0, L.v, 1));
          return (
            <div key={L.t} style={{position: 'absolute', left: a.x - 22, top: a.y - 15, transform: 'translateX(-100%)', ...mono, color: rgba(C.gold, 0.85), opacity: linOp}}>
              {L.t === '0' ? '0' : L.t === 'half' ? <Pow mant="5" exp={25} /> : <Pow exp={26} />}
            </div>
          );
        })}
      {/* x labels */}
      {years
        .filter((yr) => yr % 2 === 0)
        .map((yr) => {
          const a = pr(chartW(yr, CH.v0, 0));
          const on = clamp(labels * 1.6 - (yr - CH.yr0) / 20);
          const hot = s.decade > 0 && yr >= 2010 && yr <= 2024 && chartX(yr) <= chartX(lerp(2010, 2024, s.decade)) + 1;
          return (
            <div key={yr} style={{position: 'absolute', left: a.x, top: a.y + 18, transform: 'translateX(-50%)', ...mono, color: hot ? C.gold : rgba(C.ice, 0.72), opacity: on}}>
              {yr}
            </div>
          );
        })}
      {/* axis title */}
      {(() => {
        const a = pr(pxW(CH.px0, CH.py1 - 24));
        return (
          <div style={{position: 'absolute', left: a.x - 4, top: a.y - 46, display: 'flex', gap: 16, alignItems: 'center', opacity: clamp(labels * 2)}}>
            <span style={{...lab, color: rgba(C.ivory, 0.9)}}>Training compute · FLOP</span>
            <span style={{...lab, fontSize: 22, letterSpacing: '0.18em', color: morph > 0.5 ? C.gold : rgba(C.ice, 0.85), border: `1px solid ${morph > 0.5 ? rgba(C.gold, 0.6) : rgba(C.ice, 0.4)}`, padding: '1px 9px 2px', borderRadius: 3}}>
              {morph > 0.5 ? 'Linear scale' : 'Log scale'}
            </span>
          </div>
        );
      })()}

      {/* callout card: floats in front of the chart plane (parallax) */}
      {s.callout > 0 &&
        (() => {
          const a = pr(pxW(430, 262, 0.9));
          const sc = a.k / 130 * 0.92;
          const c = prog(s.callout, 0, 1, E.out);
          return (
            <Glass x={a.x} y={a.y + (1 - c) * 18} s={sc} op={c * cardsOp} w={480}>
              <div style={{...lab, color: rgba(C.ice, 0.85)}}>Frontier training compute</div>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 2}}>
                <span style={{fontFamily: F.sans, fontWeight: 800, fontSize: 84, lineHeight: 1.05, color: C.gold, letterSpacing: '-0.01em', textShadow: `0 0 24px ${rgba(C.ember, 0.55)}`}}>
                  {FACTS.rate}
                </span>
                <span style={{...lab, fontSize: 26, color: C.ivory}}>per year</span>
              </div>
              <div style={{...mono, color: rgba(C.ivory, 0.75), marginTop: 4}}>
                {FACTS.period} · Source: {FACTS.source}
              </div>
            </Glass>
          );
        })()}

      {/* model cards with leader lines */}
      {FACTS.points.map((p, i) => {
        const hp = prog(headYr, p.yr + 0.05, p.yr + 0.9, E.out);
        if (hp <= 0) return null;
        const node = pr(chartW(p.yr, p.v, morph));
        const off: [number, number] = p.id === 'gpt3' ? [34, 26] : p.id === 'gpt4' ? [30, 24] : [34, -52];
        const a = pr(pxW(chartX(p.yr) + off[0], chartY0(p.v) + off[1], 0.45));
        const sc = (a.k / 130) * 0.95;
        return (
          <React.Fragment key={p.id}>
            <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: hp * cardsOp}}>
              <line x1={node.x} y1={node.y} x2={a.x} y2={a.y + 8} stroke={rgba(C.gold, 0.55)} strokeWidth={1.2} />
              <circle cx={a.x} cy={a.y + 8} r={2.5} fill={C.gold} />
            </svg>
            <Glass x={a.x + 8} y={a.y - 2 + (1 - hp) * 10} s={sc} op={hp * cardsOp}>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
                <span style={{fontFamily: F.sans, fontWeight: 750, fontSize: 25, letterSpacing: '0.08em', color: C.ivory}}>{p.name}</span>
                {i < 2 && <span style={{...mono, color: rgba(C.ice, 0.75)}}>{p.sub}</span>}
              </div>
              <div style={{...mono, color: C.gold, marginTop: 3}}>
                {i < 2 ? <Pow mant={p.mant} exp={p.exp} /> : <span>above <Pow exp={26} /></span>} FLOP
                {p.note && <span style={{color: rgba(C.ice, 0.65), marginLeft: 10, fontSize: 22}}>{i < 2 ? '· est.' : ''}</span>}
              </div>
              {i === 2 && <div style={{...mono, color: rgba(C.ice, 0.75), marginTop: 2}}>2025 · per Epoch AI</div>}
            </Glass>
          </React.Fragment>
        );
      })}

      {/* legend */}
      {(() => {
        const a = pr(pxW(1180, 772, 0.2));
        return (
          <div style={{position: 'absolute', left: a.x, top: a.y, display: 'flex', gap: 26, alignItems: 'center', opacity: clamp(s.callout * 2) * cardsOp * 0.9}}>
            <span style={{display: 'flex', alignItems: 'center', gap: 9, ...lab, fontSize: 22, letterSpacing: '0.14em', color: rgba(C.ice, 0.8)}}>
              <span style={{width: 10, height: 10, borderRadius: 5, background: '#fff', boxShadow: `0 0 10px ${C.gold}`}} /> Published / estimated
            </span>
            <span style={{display: 'flex', alignItems: 'center', gap: 9, ...lab, fontSize: 22, letterSpacing: '0.14em', color: rgba(C.ice, 0.8)}}>
              <span style={{width: 30, height: 3, background: C.gold, boxShadow: `0 0 8px ${C.ember}`}} /> Trend
            </span>
          </div>
        );
      })()}
    </div>
  );
};

const chartY0 = (v: number) => CH.py0 - ((v - CH.v0) / (CH.v1 - CH.v0)) * (CH.py0 - CH.py1);

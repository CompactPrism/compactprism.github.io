// The power gauge: a circular release timeline (outer ring), the SWE-bench Verified arc, a tick ring,
// five ability segments and the ClaudeSpark at the centre.
import React from 'react';
import {C, F, rgba} from '../../theme';
import {E, clamp, prog} from '../../lib/anim';

// Release timeline (FACTS.md §6). Ends on a generic Claude 5 family node (director's note).
export const RELEASES: {d: number; name: string; major?: boolean}[] = [
  {d: 2023 + 2.45 / 12, name: 'CLAUDE', major: true},
  {d: 2023 + 4.35 / 12, name: '100K CONTEXT'},
  {d: 2023 + 6.35 / 12, name: 'CLAUDE 2', major: true},
  {d: 2023 + 10.7 / 12, name: 'CLAUDE 2.1'},
  {d: 2024 + 2.1 / 12, name: 'CLAUDE 3', major: true},
  {d: 2024 + 5.65 / 12, name: 'CLAUDE 3.5 SONNET'},
  {d: 2024 + 9.7 / 12, name: 'COMPUTER USE'},
  {d: 2025 + 1.8 / 12, name: 'CLAUDE 3.7 SONNET'},
  {d: 2025 + 4.7 / 12, name: 'CLAUDE 4', major: true},
  {d: 2025 + 7.15 / 12, name: 'OPUS 4.1'},
  {d: 2025 + 8.95 / 12, name: 'SONNET 4.5'},
  {d: 2025 + 9.5 / 12, name: 'HAIKU 4.5'},
  {d: 2025 + 10.75 / 12, name: 'OPUS 4.5'},
  {d: 2026 + 1.15 / 12, name: 'OPUS 4.6'},
  {d: 2026 + 1.55 / 12, name: 'SONNET 4.6'},
  {d: 2026 + 3.5 / 12, name: 'OPUS 4.7'},
  {d: 2026 + 4.9 / 12, name: 'OPUS 4.8'},
  {d: 2026 + 5.5 / 12, name: 'CLAUDE 5 FAMILY', major: true},
];
// SWE-bench Verified, as reported by Anthropic (FACTS.md §9).
export const SWE = [
  {d: 2024 + 9.7 / 12, v: 49.0, who: '3.5 SONNET · OCT 2024'},
  {d: 2025 + 1.8 / 12, v: 62.3, who: '3.7 SONNET · FEB 2025'},
  {d: 2025 + 4.7 / 12, v: 72.5, who: 'OPUS 4 · MAY 2025'},
  {d: 2025 + 10.75 / 12, v: 80.9, who: 'OPUS 4.5 · NOV 2025'},
  {d: 2026 + 3.5 / 12, v: 87.6, who: 'OPUS 4.7 · APR 2026'},
];
export const T0 = 2023 + 1.5 / 12;
export const T1 = 2026 + 6.5 / 12;
const A0 = -90 + 16; // degrees, start of the timeline arc (top, clockwise)
const A1 = -90 + 344;
export const dateAngle = (d: number) => A0 + ((d - T0) / (T1 - T0)) * (A1 - A0);

const pol = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return {x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r};
};
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  if (a1 - a0 < 0.01) return '';
  const p0 = pol(cx, cy, r, a0);
  const p1 = pol(cx, cy, r, a1);
  return `M${p0.x},${p0.y} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x},${p1.y}`;
};

type Props = {
  t: number;
  cx: number;
  cy: number;
  r: number;
  boot: number; // 0..1 rings draw on
  cursor: number; // decimal year of the sweep cursor
  swe: number; // current fill value (0..100)
  unlocked: number[]; // 0..1 per ability
  ping: {d: number; k: number}[]; // release pings (date, intensity)
  op: number;
};

export const Gauge: React.FC<Props> = ({t, cx, cy, r, boot, cursor, swe, unlocked, ping, op}) => {
  const b1 = prog(boot, 0, 0.6, E.out);
  const b2 = prog(boot, 0.25, 0.85, E.out);
  const b3 = prog(boot, 0.45, 1, E.out);
  const rT = r; // timeline ring
  const rS = r - 24; // SWE arc
  const rK = r - 42; // tick ring
  const rA = r - 58; // ability segments
  const ca = dateAngle(Math.min(cursor, T1));
  const sweA = -90 + 3.6 * swe;
  const years = [2024, 2025, 2026];
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: op, overflow: 'visible'}}>
      <defs>
        <linearGradient id="sweg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.clay} />
          <stop offset="0.5" stopColor={C.coral} />
          <stop offset="1" stopColor={C.gold} />
        </linearGradient>
        <radialGradient id="gcore">
          <stop offset="0" stopColor={rgba(C.ember, 0.28)} />
          <stop offset="1" stopColor={rgba(C.ember, 0)} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r - 30} fill="url(#gcore)" opacity={b2} />
      {/* outer decorative rings */}
      <g opacity={b1}>
        <circle cx={cx} cy={cy} r={r + 44} fill="none" stroke={rgba(C.gold, 0.16)} strokeWidth={1} strokeDasharray="2 7" transform={`rotate(${-t * 6} ${cx} ${cy})`} />
        {[45, 135, 225, 315].map((a) => (
          <path key={a} d={arc(cx, cy, r + 58, a - 14 + t * 3, a + 14 + t * 3)} stroke={rgba(C.gold, 0.45)} strokeWidth={1.4} fill="none" />
        ))}
      </g>
      {/* timeline ring */}
      <path d={arc(cx, cy, rT, A0, A0 + (A1 - A0) * b1)} stroke={rgba(C.ivory, 0.22)} strokeWidth={1.2} fill="none" />
      <path d={arc(cx, cy, rT, A0, Math.max(A0, ca))} stroke={rgba(C.gold, 0.85)} strokeWidth={2} fill="none" />
      {years.map((y) => {
        const a = dateAngle(y);
        const p0 = pol(cx, cy, rT - 6, a);
        const p1 = pol(cx, cy, rT + 8, a);
        const pl = pol(cx, cy, rT + 30, a);
        return (
          <g key={y} opacity={b2}>
            <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={rgba(C.ivory, 0.5)} strokeWidth={1.2} />
            <text x={pl.x} y={pl.y + 8} textAnchor="middle" fontFamily={F.mono} fontSize={22} fill={rgba(C.ivory, cursor >= y ? 0.85 : 0.4)}>
              {y}
            </text>
          </g>
        );
      })}
      {(() => {
        const ps = pol(cx, cy, rT + 30, A0 - 9);
        return (
          <text x={ps.x} y={ps.y + 8} textAnchor="end" fontFamily={F.mono} fontSize={22} fill={rgba(C.ivory, 0.55 * b2)}>
            2023
          </text>
        );
      })()}
      {RELEASES.map((rel, i) => {
        const a = dateAngle(rel.d);
        const p = pol(cx, cy, rT, a);
        const lit = cursor >= rel.d;
        const pk = ping.reduce((m, g) => Math.max(m, Math.abs(g.d - rel.d) < 0.02 ? g.k : 0), 0);
        const flash = lit ? Math.exp(-Math.max(0, cursor - rel.d) * 9) : 0;
        return (
          <g key={i} opacity={b2}>
            {(flash > 0.02 || pk > 0.02) && <circle cx={p.x} cy={p.y} r={8 + 14 * Math.max(flash, pk)} fill={rgba(C.gold, 0.35 * Math.max(flash, pk))} />}
            <circle cx={p.x} cy={p.y} r={rel.major ? 4.2 : 3} fill={lit ? '#FFF1DA' : rgba(C.ivory, 0.25)} stroke={lit ? C.gold : 'none'} strokeWidth={1} />
          </g>
        );
      })}
      {/* sweep cursor */}
      {cursor > T0 && cursor < T1 + 0.3 && (
        <g>
          {(() => {
            const p0 = pol(cx, cy, rK - 4, ca);
            const p1 = pol(cx, cy, rT + 14, ca);
            return <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={rgba('#FFF1DA', 0.9 * clamp((T1 + 0.3 - cursor) * 4))} strokeWidth={1.6} />;
          })()}
        </g>
      )}
      {/* SWE-bench arc */}
      <circle cx={cx} cy={cy} r={rS} fill="none" stroke={rgba(C.ivory, 0.08)} strokeWidth={7} opacity={b2} />
      {swe > 0.1 && <path d={arc(cx, cy, rS, -90, sweA)} stroke="url(#sweg)" strokeWidth={7} fill="none" strokeLinecap="round" />}
      {swe > 0.1 &&
        (() => {
          const h = pol(cx, cy, rS, sweA);
          return (
            <>
              <circle cx={h.x} cy={h.y} r={11} fill={rgba(C.gold, 0.3)} />
              <circle cx={h.x} cy={h.y} r={4} fill="#FFF3E0" />
            </>
          );
        })()}
      {/* tick ring (slowly turning scanner) */}
      <g opacity={b3 * 0.9} transform={`rotate(${t * 9} ${cx} ${cy})`}>
        {Array.from({length: 72}, (_, i) => {
          const a = i * 5;
          const long = i % 6 === 0;
          const p0 = pol(cx, cy, rK, a);
          const p1 = pol(cx, cy, rK - (long ? 9 : 4), a);
          return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={rgba(C.gold, long ? 0.6 : 0.25)} strokeWidth={1} />;
        })}
      </g>
      {/* ability segments: one per power */}
      {unlocked.map((u, i) => {
        const a0 = -90 + i * 72 + 5;
        const a1 = a0 + 62;
        return (
          <g key={i} opacity={b3}>
            <path d={arc(cx, cy, rA, a0, a1)} stroke={rgba(C.ivory, 0.1)} strokeWidth={3} fill="none" />
            {u > 0 && <path d={arc(cx, cy, rA, a0, a0 + 62 * E.out(clamp(u)))} stroke={rgba(C.gold, 0.9)} strokeWidth={3} fill="none" />}
            {u > 0 && u < 1.5 && <path d={arc(cx, cy, rA, a0, a1)} stroke={rgba('#FFF3E0', 0.8 * Math.exp(-u * 3))} strokeWidth={9} fill="none" />}
          </g>
        );
      })}
    </svg>
  );
};

// Readout above the gauge: the latest verified SWE-bench Verified score as the sweep passes it.
export const Readout: React.FC<{cursor: number; op: number; x: number; y: number}> = ({cursor, op, x, y}) => {
  const cur = [...SWE].reverse().find((s) => cursor >= s.d);
  const since = cur ? cursor - cur.d : 0;
  const hot = cur ? Math.exp(-since * 10) : 0;
  return (
    <div style={{position: 'absolute', left: x - 300, width: 600, top: y, opacity: op, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{fontFamily: F.sans, fontWeight: 600, fontSize: 22, letterSpacing: '0.24em', color: rgba(C.gold, 0.85), whiteSpace: 'nowrap'}}>
        SWE-BENCH VERIFIED <span style={{fontFamily: F.mono, fontWeight: 400, letterSpacing: '0.04em', color: rgba(C.ivory, 0.5)}}>· ANTHROPIC</span>
      </div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 2}}>
        <div style={{fontFamily: F.mono, fontSize: 46, fontWeight: 500, color: hot > 0.3 ? '#FFF3E0' : C.ivory, textShadow: `0 0 ${8 + 24 * hot}px ${rgba(C.ember, 0.5 + 0.4 * hot)}`, minWidth: 150, textAlign: 'right'}}>
          {cur ? `${cur.v.toFixed(1)}%` : '—'}
        </div>
        <div style={{fontFamily: F.mono, fontSize: 22, color: rgba(C.ivory, 0.62), minWidth: 290, whiteSpace: 'nowrap'}}>{cur ? cur.who : 'MEASURING…'}</div>
      </div>
    </div>
  );
};

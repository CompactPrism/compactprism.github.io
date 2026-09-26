// L16: METR time horizon on a log scale. Trend: doubling every ~7 months (METR, Mar 2025), anchored on the
// Claude 3.7 Sonnet point; later Claude points (METR, Dec 2025 / Feb 2026) sit above it: "lately, even faster".
import React from 'react';
import {C, F, rgba} from '../../theme';
import {E, clamp, prog} from '../../lib/anim';

// FACTS.md §8 (search-snippet level, attributed to METR on screen)
export const METR = {
  doublingMonths: 7,
  points: [
    {d: 2025 + 1.8 / 12, s: 59 * 60, name: '3.7 SONNET', val: '~59 MIN'},
    {d: 2025 + 10.75 / 12, s: 4 * 3600 + 49 * 60, name: 'OPUS 4.5', val: '~4 H 49 M'},
    {d: 2026 + 1.15 / 12, s: 14.5 * 3600, name: 'OPUS 4.6', val: '~14.5 H', noisy: true},
  ],
};

const X0 = 2019;
const X1 = 2026.6;
const LY0 = 0; // log10 seconds: 1 s
const LY1 = Math.log10(86400 * 1.6);
const trend = (d: number) => METR.points[0].s * Math.pow(2, ((d - METR.points[0].d) * 12) / METR.doublingMonths);

type Props = {t: number; w: number; h: number; tLine: [number, number]; tBig: number; tLately: number; op: number};

export const Chart: React.FC<Props> = ({t, w, h, tLine, tBig, tLately}) => {
  const L = 150;
  const R = w - 50;
  const TOP = 150;
  const BOT = h - 78;
  const sx = (d: number) => L + ((d - X0) / (X1 - X0)) * (R - L);
  const sy = (s: number) => BOT - ((Math.log10(s) - LY0) / (LY1 - LY0)) * (BOT - TOP);
  const axis = prog(t, tLine[0] - 0.8, tLine[0], E.out);
  const lp = prog(t, tLine[0], tLine[1], E.inOut);
  const dEnd = X0 + (2025.35 - X0) * lp; // solid until the METR paper, dashed after
  const pts: string[] = [];
  for (let d = X0; d <= dEnd + 1e-6; d += 0.05) pts.push(`${sx(d).toFixed(1)},${sy(trend(d)).toFixed(1)}`);
  const ext = prog(t, tLine[1] - 0.2, tLine[1] + 0.6, E.out);
  const dExt = 2025.35 + (X1 - 2025.35) * ext;
  const big = prog(t, tBig, tBig + 0.7, E.out);
  const late = prog(t, tLately, tLately + 0.6, E.out);
  const head = {x: sx(dEnd), y: sy(trend(dEnd))};
  const yT = [
    {s: 1, l: '1 SEC'},
    {s: 60, l: '1 MIN'},
    {s: 3600, l: '1 HR'},
    {s: 86400, l: '1 DAY'},
  ];
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const accel = METR.points.map((p) => `${sx(p.d)},${sy(p.s)}`).join(' ');
  return (
    <div style={{position: 'relative', width: w, height: h}}>
      {/* title block */}
      <div style={{position: 'absolute', left: 40, top: 26, opacity: big, transform: `translateY(${(1 - big) * 12}px)`}}>
        <div style={{fontFamily: F.sans, fontWeight: 700, fontSize: 44, letterSpacing: '0.06em', color: C.ivory, textShadow: `0 0 24px ${rgba(C.ember, 0.35)}`, whiteSpace: 'nowrap'}}>
          DOUBLING EVERY <span style={{color: C.gold}}>~7 MONTHS</span>
        </div>
        <div style={{display: 'flex', gap: 22, marginTop: 6, alignItems: 'center'}}>
          <div style={{fontFamily: F.mono, fontSize: 22, color: rgba(C.ivory, 0.75), whiteSpace: 'nowrap'}}>TASK LENGTH AI COMPLETES · 50% SUCCESS</div>
          <div style={{fontFamily: F.sans, fontWeight: 700, fontSize: 22, letterSpacing: '0.22em', color: C.gold, opacity: late, whiteSpace: 'nowrap'}}>↗ AND ACCELERATING</div>
        </div>
      </div>
      <svg width={w} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
        <g opacity={axis}>
          {yT.map((y) => (
            <g key={y.l}>
              <line x1={L} x2={R} y1={sy(y.s)} y2={sy(y.s)} stroke={rgba(C.ivory, 0.14)} strokeWidth={1} />
              <text x={L - 16} y={sy(y.s) + 8} textAnchor="end" fontFamily={F.mono} fontSize={22} fill={rgba(C.ivory, 0.88)}>
                {y.l}
              </text>
            </g>
          ))}
          <line x1={L} x2={R} y1={BOT} y2={BOT} stroke={rgba(C.ivory, 0.35)} />
          {years.map((y) => (
            <g key={y}>
              <line x1={sx(y)} x2={sx(y)} y1={BOT} y2={BOT + 8} stroke={rgba(C.ivory, 0.35)} />
              <text x={sx(y)} y={BOT + 36} textAnchor="middle" fontFamily={F.mono} fontSize={22} fill={rgba(C.ivory, 0.82)}>
                {y}
              </text>
            </g>
          ))}
        </g>
        {/* the trend */}
        {pts.length > 1 && (
          <>
            <polyline points={pts.join(' ')} fill="none" stroke={rgba(C.ember, 0.25)} strokeWidth={10} strokeLinejoin="round" />
            <polyline points={pts.join(' ')} fill="none" stroke={C.gold} strokeWidth={2.6} strokeLinejoin="round" />
          </>
        )}
        {ext > 0 && <path d={`M${sx(2025.35)},${sy(trend(2025.35))} L${sx(dExt)},${sy(trend(dExt))}`} stroke={rgba(C.gold, 0.6)} strokeWidth={2} strokeDasharray="6 7" fill="none" />}
        {lp > 0 && lp < 1 && (
          <>
            <circle cx={head.x} cy={head.y} r={16} fill={rgba(C.gold, 0.25)} />
            <circle cx={head.x} cy={head.y} r={5} fill="#FFF3E0" />
          </>
        )}
        {/* x2 bracket: one doubling */}
        {(() => {
          const d0 = 2021.0;
          const d1 = d0 + 7 / 12;
          const k = prog(t, tLine[0] + 1.2, tLine[0] + 1.8, E.out);
          if (k <= 0) return null;
          const x0 = sx(d0);
          const x1 = sx(d1);
          const y0 = sy(trend(d0));
          const y1 = sy(trend(d1));
          return (
            <g opacity={k}>
              <path d={`M${x0},${y0} H${x1} V${y1}`} fill="none" stroke={rgba(C.ivory, 0.7)} strokeWidth={1.2} strokeDasharray="3 4" />
              <text x={x1 + 12} y={(y0 + y1) / 2 + 8} fontFamily={F.mono} fontSize={22} fill={C.ivory}>
                ×2
              </text>
              <text x={(x0 + x1) / 2} y={y0 + 30} textAnchor="middle" fontFamily={F.mono} fontSize={22} fill={rgba(C.ivory, 0.8)}>
                7 mo
              </text>
            </g>
          );
        })()}
        {/* measured Claude points */}
        {late > 0 && <polyline points={accel} fill="none" stroke={rgba(C.coral, 0.9 * late)} strokeWidth={2} strokeDasharray="2 5" />}
        {METR.points.map((p, i) => {
          const k = i === 0 ? prog(t, tLine[1] - 0.4, tLine[1] + 0.2, E.out) : prog(t, tLately + i * 0.25 - 0.1, tLately + i * 0.25 + 0.4, E.out);
          if (k <= 0) return null;
          const x = sx(p.d);
          const y = sy(p.s);
          const lx = i === 0 ? x + 22 : x - 18;
          const anchor = i === 0 ? 'start' : 'end';
          return (
            <g key={p.name} opacity={k}>
              <circle cx={x} cy={y} r={10 + 10 * (1 - k)} fill="none" stroke={rgba(C.gold, 0.7)} />
              <circle cx={x} cy={y} r={5.5} fill={p.noisy ? C.void : '#FFF3E0'} stroke={C.gold} strokeWidth={2} />
              <text x={lx} y={y + (i === 0 ? 46 : i === 1 ? -8 : -30)} textAnchor={anchor} fontFamily={F.mono} fontSize={22} fill={C.ivory}>
                {p.name} <tspan fill={C.gold}>{p.val}</tspan>
              </text>
              {p.noisy && (
                <text x={lx} y={y - 4} textAnchor={anchor} fontFamily={F.mono} fontSize={22} fill={rgba(C.ivory, 0.7)}>
                  noisy estimate
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{position: 'absolute', right: 40, top: 34, fontFamily: F.mono, fontSize: 22, color: rgba(C.ivory, 0.7), opacity: axis}}>SOURCE: METR, 2025–26</div>
    </div>
  );
};
export const clampChart = clamp;

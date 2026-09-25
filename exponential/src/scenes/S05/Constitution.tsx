// The constitution: a luminous document whose lines engrave themselves (a moving burn point leaves light behind).
import React from 'react';
import {C, F, rgba} from '../../theme';
import {E, clamp, prog} from '../../lib/anim';

// Verbatim from Claude's constitution (FACTS.md §14). Split into display lines.
export const QUOTE_LINES = ['“…exceptionally helpful', 'while also being honest, thoughtful,', 'and caring about the world.”'];

// Abstract "articles" below the quote (greeked light-lines, not text).
const ARTICLES = [
  {num: 'I', lines: [0.92, 0.78, 0.86, 0.52]},
  {num: 'II', lines: [0.88, 0.95, 0.64]},
];

type Props = {t: number; t0: number; op: number; recede: number; cx: number; cy: number; tilt: number};

export const DOC_W = 680;
export const DOC_H = 580;

const Burn: React.FC<{x: number; on: number}> = ({x, on}) =>
  on <= 0.001 ? null : (
    <div
      style={{
        position: 'absolute',
        left: x - 14,
        top: '50%',
        width: 28,
        height: 28,
        marginTop: -14,
        borderRadius: '50%',
        background: `radial-gradient(circle, #fff 0%, ${rgba(C.gold, 0.9)} 22%, ${rgba(C.ember, 0.35)} 48%, rgba(0,0,0,0) 72%)`,
        opacity: on,
      }}
    />
  );

export const Constitution: React.FC<Props> = ({t, t0, op, recede, cx, cy, tilt}) => {
  if (op <= 0.001) return null;
  const unroll = prog(t, t0 + 0.2, t0 + 1.0, E.out);
  const h = DOC_H * unroll;
  const headP = prog(t, t0 + 0.7, t0 + 1.2, E.out);
  const s = 1 - 0.13 * recede;
  // each quote line engraves over 0.55 s
  const qStart = t0 + 0.95;
  const artStart = t0 + 2.35;
  let li = 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - DOC_W / 2,
        top: cy - DOC_H / 2 - 36 * recede,
        width: DOC_W,
        height: DOC_H,
        opacity: op * (1 - 0.62 * recede),
        transform: `perspective(1600px) rotateX(${7 + 4 * recede}deg) rotateY(${tilt}deg) scale(${s})`,
        transformOrigin: '50% 50%',
      }}
    >
      {/* the sheet of light */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: (DOC_H - h) / 2,
          height: h,
          borderRadius: 6,
          background: `linear-gradient(180deg, ${rgba(C.clay, 0.16)} 0%, ${rgba(C.ink, 0.55)} 30%, ${rgba(C.ink, 0.55)} 70%, ${rgba(C.clay, 0.16)} 100%)`,
          boxShadow: `inset 0 0 0 1px ${rgba(C.gold, 0.28)}, 0 0 60px ${rgba(C.coral, 0.12)}`,
          overflow: 'hidden',
        }}
      />
      {/* scroll rods: bright edges that travel apart as it unrolls */}
      {[-1, 1].map((k) => (
        <div
          key={k}
          style={{
            position: 'absolute',
            left: -18,
            right: -18,
            top: DOC_H / 2 + (k * h) / 2 - 1.5,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, rgba(0,0,0,0), ${rgba(C.gold, 0.95)} 12%, #fff 50%, ${rgba(C.gold, 0.95)} 88%, rgba(0,0,0,0))`,
            boxShadow: `0 0 18px ${rgba(C.ember, 0.8)}`,
            opacity: 0.35 + 0.65 * (1 - prog(t, t0 + 1.0, t0 + 2.2)),
          }}
        />
      ))}
      <div style={{position: 'absolute', inset: 0, opacity: unroll > 0.7 ? 1 : 0, padding: '40px 64px'}}>
        {/* header: the idea's real date (Constitutional AI paper, Dec 2022) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            opacity: headP,
            marginBottom: 22,
            paddingBottom: 12,
            borderBottom: `1px solid ${rgba(C.gold, 0.28 * headP)}`,
          }}
        >
          <span style={{fontFamily: F.sans, fontWeight: 600, fontSize: 22, letterSpacing: '0.34em', color: rgba(C.gold, 0.88)}}>CONSTITUTIONAL AI</span>
          <span style={{fontFamily: F.mono, fontWeight: 500, fontSize: 22, letterSpacing: '0.12em', color: rgba(C.ivory, 0.62)}}>DEC 2022</span>
        </div>
        {/* verbatim quote, engraved line by line */}
        {QUOTE_LINES.map((line, i) => {
          const p = prog(t, qStart + i * 0.5, qStart + i * 0.5 + 0.62, E.inOut);
          return (
            <div key={i} style={{position: 'relative', height: 46, display: 'flex', justifyContent: 'center'}}>
              <div style={{position: 'relative'}}>
                <div
                  style={{
                    fontFamily: F.serif,
                    fontStyle: 'italic',
                    fontWeight: 350,
                    fontSize: 34,
                    lineHeight: '46px',
                    whiteSpace: 'nowrap',
                    color: C.ivory,
                    fontVariationSettings: '"opsz" 72, "SOFT" 60',
                    clipPath: `inset(-10px ${100 - p * 100}% -10px -10px)`,
                    textShadow: `0 0 16px ${rgba(C.ember, 0.55)}`,
                  }}
                >
                  {line}
                </div>
                <div style={{position: 'absolute', left: `${p * 100}%`, top: 0, bottom: 0}}>
                  <Burn x={0} on={p > 0 && p < 1 ? 1 : 0} />
                </div>
              </div>
            </div>
          );
        })}
        <div
          style={{
            textAlign: 'center',
            marginTop: 8,
            fontFamily: F.mono,
            fontSize: 22,
            letterSpacing: '0.08em',
            color: rgba(C.ivory, 0.55),
            opacity: prog(t, qStart + 1.4, qStart + 1.9),
          }}
        >
          — Claude’s constitution, 2026
        </div>
        <div style={{height: 1, margin: '18px 40px 18px', background: `linear-gradient(90deg, rgba(0,0,0,0), ${rgba(C.gold, 0.45)}, rgba(0,0,0,0))`, opacity: prog(t, artStart - 0.3, artStart + 0.3)}} />
        {/* abstract articles */}
        {ARTICLES.map((a, ai) => (
          <div key={ai} style={{display: 'flex', gap: 22, marginBottom: 16}}>
            <div style={{width: 34, fontFamily: F.serif, fontSize: 24, color: rgba(C.gold, 0.7), textAlign: 'right', opacity: prog(t, artStart + ai * 0.5, artStart + ai * 0.5 + 0.3)}}>{a.num}</div>
            <div style={{flex: 1}}>
              {a.lines.map((w, i) => {
                const k = li++;
                const st = artStart + k * 0.16;
                const p = prog(t, st, st + 0.5, E.inOut);
                return (
                  <div key={i} style={{position: 'relative', height: 20, display: 'flex', alignItems: 'center'}}>
                    <div
                      style={{
                        width: `${w * 100 * p}%`,
                        height: 3,
                        borderRadius: 2,
                        background: `linear-gradient(90deg, ${rgba(C.ivory, 0.42)}, ${rgba(C.gold, 0.55)})`,
                        boxShadow: `0 0 8px ${rgba(C.ember, 0.45)}`,
                      }}
                    />
                    <div style={{position: 'absolute', left: `${w * 100 * p}%`, top: 0, bottom: 0}}>
                      <Burn x={0} on={p > 0 && p < 1 ? 0.8 : 0} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {/* receding: the page's light drains toward the centre */}
      <div style={{position: 'absolute', inset: 0, borderRadius: 6, background: `radial-gradient(ellipse at 50% 50%, ${rgba(C.gold, 0.12 * clamp(recede))}, rgba(0,0,0,0) 60%)`}} />
    </div>
  );
};

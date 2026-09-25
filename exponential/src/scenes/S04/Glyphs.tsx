// "And new abilities emerge": star constellations spark inside the river, then resolve into small glyphs.
import React from 'react';
import {C, F, rgba} from '../../theme';
import {E, clamp, lerp, prog, rnd} from '../../lib/anim';

type P = [number, number];
type Glyph = {label: string; tag: string; pts: P[]; edges: [number, number][]};

const loop = (start: number, n: number): [number, number][] => Array.from({length: n}, (_, i) => [start + i, start + ((i + 1) % n)] as [number, number]);

const GLYPHS: Glyph[] = [
  {
    label: 'TRANSLATION',
    tag: 'EN → FR',
    pts: [
      [-0.95, -0.85], [0.2, -0.85], [0.2, -0.1], [-0.45, -0.1], [-0.72, 0.18], [-0.68, -0.1], [-0.95, -0.1],
      [-0.25, 0.08], [0.95, 0.08], [0.95, 0.78], [0.72, 0.78], [0.78, 1.02], [0.46, 0.78], [-0.25, 0.78],
      [-0.62, -0.28], [-0.38, -0.68], [-0.14, -0.28], [0.1, 0.35], [0.7, 0.35], [0.1, 0.55], [0.55, 0.55],
    ],
    edges: [...loop(0, 7), ...loop(7, 7), [14, 15], [15, 16], [17, 18], [19, 20]],
  },
  {
    label: 'SUMMARISING',
    tag: '4 PAGES → 1 LINE',
    pts: [
      [-0.95, -0.66], [-0.15, -0.66], [-0.95, -0.22], [-0.2, -0.22], [-0.95, 0.22], [-0.1, 0.22], [-0.95, 0.66], [-0.3, 0.66],
      [0.12, -0.36], [0.44, 0], [0.12, 0.36], [0.6, 0], [0.98, 0],
    ],
    edges: [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [9, 10], [11, 12]],
  },
  {
    label: 'CODE',
    tag: 'def f(x):',
    pts: [[-0.45, -0.45], [-0.95, 0], [-0.45, 0.45], [0.2, -0.7], [-0.2, 0.7], [0.45, -0.45], [0.95, 0], [0.45, 0.45]],
    edges: [[0, 1], [1, 2], [3, 4], [5, 6], [6, 7]],
  },
  {
    label: 'REASONING',
    tag: 'A → B → C',
    pts: [[0, -0.85], [-0.55, -0.1], [0.55, -0.1], [-0.85, 0.7], [-0.25, 0.7], [0.3, 0.7], [0.85, 0.7]],
    edges: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]],
  },
];

// Screen anchors (letterbox-safe), in order of appearance.
const SPOTS: P[] = [
  [470, 352],
  [1440, 330],
  [600, 690],
  [1330, 680],
];

export const Glyphs: React.FC<{t: number; t0: number; out0: number; warm: number}> = ({t, t0, out0, warm}) => {
  const outP = prog(t, out0, out0 + 0.8, E.inOut);
  if (t < t0 - 0.1 || outP >= 1) return null;
  const S = 46; // glyph half-size px
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <defs>
        <radialGradient id="gstar">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.25" stopColor={C.gold} stopOpacity="0.9" />
          <stop offset="1" stopColor={C.coral} stopOpacity="0" />
        </radialGradient>
      </defs>
      {GLYPHS.map((g, gi) => {
        const ts = t0 + gi * 0.34;
        const lt = t - ts;
        if (lt < 0) return null;
        const spark = prog(lt, 0, 0.3, E.out);
        const link = prog(lt, 0.12, 0.62, E.out);
        const res = prog(lt, 0.35, 1.05, E.inOut);
        const lab = prog(lt, 0.7, 1.2, E.out);
        const [cx, cy0] = SPOTS[gi];
        const cy = cy0 - lt * 10 - outP * 40;
        const op = 1 - outP;
        const pts = g.pts.map(([x, y], i) => {
          const sx = (rnd(`g${gi}x${i}`) - 0.5) * 2.6;
          const sy = (rnd(`g${gi}y${i}`) - 0.5) * 2.2;
          return [cx + lerp(sx, x, res) * S, cy + lerp(sy, y, res) * S] as P;
        });
        const coreCol = warm > 0.5 ? C.gold : C.ice;
        return (
          <g key={gi} opacity={op}>
            {/* constellation / glyph strokes */}
            {g.edges.map(([a, b], ei) => {
              const d = clamp(link * 1.4 - (ei / g.edges.length) * 0.4);
              if (d <= 0) return null;
              const [x1, y1] = pts[a];
              const x2 = lerp(x1, pts[b][0], d);
              const y2 = lerp(y1, pts[b][1], d);
              return (
                <g key={ei}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={rgba(C.ember, 0.22 + 0.2 * res)} strokeWidth={6} strokeLinecap="round" />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={rgba(C.ivory, 0.35 + 0.6 * res)} strokeWidth={lerp(1, 2.4, res)} strokeLinecap="round" />
                </g>
              );
            })}
            {/* stars */}
            {pts.map(([x, y], i) => {
              const s = prog(lt, i * 0.025, i * 0.025 + 0.25, E.out);
              const flash = Math.exp(-Math.max(0, lt - i * 0.025) * 5) * s;
              const r = (4 + 16 * flash) * (1 - 0.45 * res);
              return <circle key={i} cx={x} cy={y} r={r} fill="url(#gstar)" opacity={s} />;
            })}
            {pts.map(([x, y], i) => (
              <circle key={`c${i}`} cx={x} cy={y} r={lerp(2.2, 1.6, res)} fill={i % 3 === 0 ? '#fff' : coreCol} opacity={spark} />
            ))}
            {/* label */}
            <g opacity={lab}>
              <line x1={cx - 70} y1={cy + S + 22} x2={cx + 70} y2={cy + S + 22} stroke={rgba(C.gold, 0.5 * lab)} strokeWidth={1} />
              <text
                x={cx}
                y={cy + S + 54}
                textAnchor="middle"
                fill={C.ivory}
                style={{fontFamily: F.sans, fontWeight: 650, fontSize: 23, letterSpacing: `${lerp(0.4, 0.24, lab)}em`}}
              >
                {g.label}
              </text>
              <text x={cx} y={cy + S + 82} textAnchor="middle" fill={rgba(C.gold, 0.8)} style={{fontFamily: F.mono, fontSize: 22}}>
                {g.tag}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};

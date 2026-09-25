// Delicate line-art milestone icons (100x100 viewBox), drawn by stroke animation.
import React from 'react';
import {clamp, E} from '../../lib/anim';

const hW = (x: number, y: number, l: number) => `M${x} ${y - 3.6} L${x} ${y + 3.6} L${x + 7} ${y} Z M${x + 7} ${y} L${x + 7 + l} ${y}`; // horizontal wedge
const vW = (x: number, y: number, l: number) => `M${x - 3.6} ${y} L${x + 3.6} ${y} L${x} ${y + 7} Z M${x} ${y + 7} L${x} ${y + 7 + l}`; // vertical wedge
const aW = (x: number, y: number) => `M${x + 6} ${y - 5} L${x} ${y} L${x + 6} ${y + 5}`; // winkelhaken

const tube = (x: number, top: number) => [
  `M${x - 9} 82 L${x - 9} ${top + 10} Q${x - 9} ${top} ${x} ${top} Q${x + 9} ${top} ${x + 9} ${top + 10} L${x + 9} 82`,
  `M${x - 11} 82 L${x + 11} 82 L${x + 11} 89 L${x - 11} 89 Z M${x - 5} 89 L${x - 5} 95 M${x + 5} 89 L${x + 5} 95`,
  `M${x - 5} ${top + 17} L${x - 5} 74 L${x + 5} 74 L${x + 5} ${top + 17}`,
  `M${x - 2.5} ${top + 20} L${x + 2.5} ${top + 24} L${x - 2.5} ${top + 28} L${x + 2.5} ${top + 32} L${x - 2.5} ${top + 36}`,
];

// Each icon: list of stroke paths (drawn in order) + "hot" paths that glow when the node ignites.
export const ICONS: {paths: string[]; hot: string[]}[] = [
  {
    // writing: a cuneiform clay tablet
    paths: [
      'M24 10 C40 7 60 7 76 10 C80 30 80 70 76 90 C60 93 40 93 24 90 C20 70 20 30 24 10 Z',
      'M27 37 L73 37',
      'M27 64 L73 64',
      hW(29, 23, 12),
      vW(53, 16, 10),
      vW(61, 16, 10),
      aW(66, 23),
      aW(30, 50),
      hW(40, 46, 11),
      hW(40, 55, 11),
      vW(65, 43, 11),
      vW(32, 70, 10),
      hW(42, 77, 14),
      aW(62, 77),
    ],
    hot: [],
  },
  {
    // the printing press: a screw press
    paths: [
      'M12 90 L88 90',
      'M20 90 L20 79 L80 79 L80 90',
      'M27 79 L27 20 M73 79 L73 20',
      'M18 12 L82 12 L82 20 L18 20 Z',
      'M50 20 L50 50',
      'M44 25 L56 28 M44 31 L56 34 M44 37 L56 40 M44 43 L56 46',
      'M50 39 L90 46 M90 46 m-2.5 0 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0',
      'M34 50 L66 50 L66 57 L34 57 Z',
      'M36 72 L64 72 L64 79 L36 79 Z M41 72 L41 79 M46 72 L46 79 M51 72 L51 79 M56 72 L56 79 M60 72 L60 79',
    ],
    hot: [],
  },
  {
    // electricity: a filament bulb
    paths: [
      'M50 8 C32 8 22 22 22 38 C22 52 33 58 37 68 L63 68 C67 58 78 52 78 38 C78 22 68 8 50 8 Z',
      'M37 68 L37 74 L63 74 L63 68',
      'M38 78.5 L62 78.5 M39.5 83 L60.5 83',
      'M44 87.5 Q50 93 56 87.5',
      'M45 68 L45 45 M55 68 L55 45',
    ],
    hot: ['M45 45 C45 33 50 33 50 40 C50 33 55 33 55 45'],
  },
  {
    // the computer: vacuum tubes
    paths: [...tube(24, 32), ...tube(50, 14), ...tube(76, 32)],
    hot: ['M24 74 L24 50', 'M50 74 L50 32', 'M76 74 L76 50'],
  },
];

// draw 0..1 = stroke animation progress, lit 0..1 = glow of the "hot" parts.
export const Icon: React.FC<{i: number; size: number; draw: number; lit: number; color: string; hotColor: string}> = ({i, size, draw, lit, color, hotColor}) => {
  const ic = ICONS[i];
  const n = ic.paths.length;
  const seg = (k: number) => E.out(clamp(draw * (1 + n * 0.18) - k * 0.18));
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{overflow: 'visible', display: 'block'}}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* soft under-glow */}
        <g stroke={color} strokeOpacity={0.16} strokeWidth={4.5}>
          {ic.paths.map((d, k) => (
            <path key={k} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - seg(k)} />
          ))}
        </g>
        <g stroke={color} strokeWidth={1.7}>
          {ic.paths.map((d, k) => (
            <path key={k} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - seg(k)} />
          ))}
        </g>
        {ic.hot.map((d, k) => (
          <g key={k} opacity={lit}>
            <path d={d} stroke={hotColor} strokeOpacity={0.25} strokeWidth={7} />
            <path d={d} stroke={hotColor} strokeWidth={2} />
          </g>
        ))}
      </g>
    </svg>
  );
};

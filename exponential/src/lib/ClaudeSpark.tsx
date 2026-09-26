// THE HERO EMBLEM: a warm, hand-drawn-feeling starburst: the film's stand-in for Claude.
// Every scene that shows "the hero" should use this component so the emblem is identical everywhere.
import React, {useId} from 'react';
import {C} from '../theme';
import {clamp, E} from './anim';

// 12 rays with slightly irregular lengths/angles (fixed so the emblem never changes between scenes).
export const RAYS = [
  {a: 0, l: 1.0},
  {a: 31, l: 0.8},
  {a: 58, l: 0.95},
  {a: 91, l: 0.74},
  {a: 119, l: 0.98},
  {a: 148, l: 0.82},
  {a: 181, l: 0.93},
  {a: 209, l: 0.76},
  {a: 238, l: 1.0},
  {a: 269, l: 0.79},
  {a: 299, l: 0.9},
  {a: 329, l: 0.72},
];

type Props = {
  size: number; // px, full diameter of the longest ray
  draw?: number; // 0..1 rays grow out from the centre (staggered)
  glow?: number; // 0..1+ strength of the bloom halo
  rotate?: number; // degrees
  color?: string;
  core?: string; // colour of the hot centre
  pulse?: number; // 0..1 extra ray length breathing
  style?: React.CSSProperties;
};

export const ClaudeSpark: React.FC<Props> = ({
  size,
  draw = 1,
  glow = 0.6,
  rotate = 0,
  color = C.coral,
  core = C.gold,
  pulse = 0,
  style,
}) => {
  const R = 50; // viewBox radius
  const inner = 5.5;
  const rays = RAYS.map((r, i) => {
    const d = E.out(clamp(draw * 1.35 - (i / RAYS.length) * 0.35));
    const len = inner + (R - inner - 2) * r.l * d * (1 + pulse * 0.06 * Math.sin(i * 2.1));
    const ang = ((r.a - 90) * Math.PI) / 180;
    const w0 = 7.4 * r.l; // base width
    const x2 = Math.cos(ang) * len;
    const y2 = Math.sin(ang) * len;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    // tapered ray: wide at the centre, rounded narrow tip
    const tip = 1.9;
    const p = [
      [nx * w0 * 0.5, ny * w0 * 0.5],
      [x2 + nx * tip, y2 + ny * tip],
      [x2 - nx * tip, y2 - ny * tip],
      [-nx * w0 * 0.5, -ny * w0 * 0.5],
    ];
    return (
      <g key={i} opacity={d > 0.001 ? 1 : 0}>
        <path d={`M${p[0][0]},${p[0][1]} L${p[1][0]},${p[1][1]} A${tip},${tip} 0 0 1 ${p[2][0]},${p[2][1]} L${p[3][0]},${p[3][1]} Z`} />
      </g>
    );
  });
  const id = `spk${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div style={{width: size, height: size, position: 'relative', ...style}}>
      {glow > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: -size * 0.6,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}${Math.round(clamp(glow * 0.55) * 255)
              .toString(16)
              .padStart(2, '0')} 0%, ${color}00 60%)`,
            filter: `blur(${size * 0.06}px)`,
          }}
        />
      )}
      <svg
        viewBox="-50 -50 100 100"
        width={size}
        height={size}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'visible',
          transform: `rotate(${rotate}deg)`,
          filter: glow > 0 ? `drop-shadow(0 0 ${size * 0.02 * glow}px ${core}) drop-shadow(0 0 ${size * 0.06 * glow}px ${color})` : undefined,
        }}
      >
        <defs>
          <radialGradient id={id} cx="0" cy="0" r="50" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={core} />
            <stop offset="0.35" stopColor={color} />
            <stop offset="1" stopColor={color} />
          </radialGradient>
        </defs>
        <g fill={`url(#${id})`}>{rays}</g>
        <circle r={inner * 0.9 * clamp(draw * 3)} fill={core} />
      </svg>
    </div>
  );
};

// Superhero-comic chapter slam, overlaid by the Film at the start of S02, S05, S07 and S09.
// Occupies roughly the first 2.1 s of those scenes.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, F, rgba} from '../theme';
import {E, clamp, prog, ramp} from './anim';

export const CHAPTERS: Record<string, {num: string; title: string}> = {
  S02: {num: 'I', title: 'BEFORE'},
  S05: {num: 'II', title: 'THE HERO'},
  S07: {num: 'III', title: 'THE BATTLES'},
  S09: {num: 'IV', title: 'EXPONENTIAL'},
};

export const CHAPTER_LEN = 2.1; // seconds

export const ChapterCard: React.FC<{sceneId: string; t: number}> = ({sceneId, t}) => {
  const ch = CHAPTERS[sceneId];
  if (!ch || t > CHAPTER_LEN) return null;
  const inP = prog(t, 0.0, 0.45, E.out);
  const outP = prog(t, CHAPTER_LEN - 0.45, CHAPTER_LEN, E.in);
  const op = inP * (1 - outP);
  const track = 0.62 - 0.22 * prog(t, 0, CHAPTER_LEN, E.out); // letter-spacing (em) tightens
  const sweep = ramp(t, [0.15, 1.2], [-30, 130], E.inOut); // light sweep across the word (%)
  const lineW = 520 * prog(t, 0.1, 0.8, E.out) * (1 - outP * 0.6);
  const warm = sceneId === 'S02' ? C.ice : C.gold;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse at center, rgba(0,0,0,${0.55 * op}) 0%, rgba(0,0,0,${0.25 * op}) 60%, rgba(0,0,0,0) 100%)`}} />
      <div style={{opacity: op, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${1.06 - 0.06 * inP})`}}>
        <div
          style={{
            fontFamily: F.serif,
            fontStyle: 'italic',
            fontSize: 44,
            fontWeight: 400,
            color: rgba(warm, 0.9),
            letterSpacing: '0.2em',
            marginBottom: 6,
            fontVariationSettings: '"opsz" 72, "SOFT" 100',
          }}
        >
          {ch.num}
        </div>
        <div style={{width: lineW, height: 1.5, background: `linear-gradient(90deg, transparent, ${rgba(warm, 0.9)}, transparent)`, marginBottom: 18}} />
        <div
          style={{
            fontFamily: F.impact,
            fontSize: 120,
            letterSpacing: `${track}em`,
            paddingLeft: `${track}em`,
            color: 'transparent',
            backgroundImage: `linear-gradient(100deg, ${rgba(C.ivory, 0.78)} ${sweep - 18}%, #fff ${sweep - 4}%, ${warm} ${sweep}%, #fff ${sweep + 4}%, ${rgba(C.ivory, 0.78)} ${sweep + 18}%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            filter: `drop-shadow(0 0 ${18 * clamp(op)}px ${rgba(warm, 0.35)})`,
            lineHeight: 1,
          }}
        >
          {ch.title}
        </div>
      </div>
    </AbsoluteFill>
  );
};

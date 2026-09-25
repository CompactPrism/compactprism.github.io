// Persistent HUD in the TOP letterbox bar (the bottom bar carries captions):
// era stamp + chapter on the left; on the right a tiny exponential curve that draws itself across
// the whole film (its bright head = where we are in the story) and a live frame counter.
import React from 'react';
import {C, F, LETTERBOX, W, rgba} from '../theme';
import {TIMING} from './timing';

const ERA: Record<string, {era: string; ch: string}> = {
  S02: {era: 'c. 3200 BCE — 1946', ch: 'I · BEFORE'},
  S03: {era: '2017', ch: 'I · BEFORE'},
  S04: {era: '2018 — 2025', ch: 'I · BEFORE'},
  S05: {era: '2021 — 2023', ch: 'II · THE HERO'},
  S06: {era: '2023 — 2026', ch: 'II · THE HERO'},
  S07: {era: 'NOW', ch: 'III · THE BATTLES'},
  S08: {era: '2025 — 2026', ch: 'III · THE BATTLES'},
  S09: {era: 'NEXT', ch: 'IV · EXPONENTIAL'},
};

const CW = 300; // curve width
const CH = 46; // curve height
const K = 4.2; // steepness
const curveY = (u: number) => (Math.exp(K * u) - 1) / (Math.exp(K) - 1);

export const EraBar: React.FC<{g: number; amount: number}> = ({g, amount}) => {
  const sc = TIMING.scenes.find((s) => g >= s.start && g < s.start + s.duration);
  const info = sc ? ERA[sc.id] : undefined;
  if (!sc || !info || amount < 0.02) return null;
  const local = (g - sc.start) / TIMING.fps;
  // Appears after the chapter card that opens chapter scenes; otherwise stays up across cuts.
  const card = ['S02', 'S05', 'S07', 'S09'].includes(sc.id);
  const fadeIn = card ? Math.min(1, Math.max(0, (local - 2.1) / 0.6)) : 1;
  const op = amount * fadeIn;
  const u = g / TIMING.totalFrames;
  const x0 = W - 120 - CW - 230;
  const y0 = LETTERBOX / 2 + CH / 2;
  const pts = Array.from({length: 61}, (_, i) => {
    const a = i / 60;
    return `${(x0 + a * CW).toFixed(1)},${(y0 - curveY(a) * CH).toFixed(1)}`;
  });
  const done = pts.slice(0, Math.max(2, Math.round(u * 60) + 1));
  const hx = x0 + u * CW;
  const hy = y0 - curveY(u) * CH;
  const label: React.CSSProperties = {fontFamily: F.mono, fontSize: 17, letterSpacing: '0.14em', whiteSpace: 'nowrap'};
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: LETTERBOX * amount, overflow: 'hidden', opacity: op, pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 120, top: LETTERBOX / 2 - 12, display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{width: 8, height: 8, borderRadius: 4, background: C.coral, boxShadow: `0 0 10px ${C.coral}`}} />
        <div style={{...label, color: rgba(C.gold, 0.9)}}>{info.era}</div>
        <div style={{width: 28, height: 1, background: rgba(C.ivory, 0.25)}} />
        <div style={{...label, fontFamily: F.sans, fontSize: 14, fontWeight: 600, letterSpacing: '0.3em', color: rgba(C.ivory, 0.55)}}>{info.ch}</div>
      </div>
      <svg width={W} height={LETTERBOX} style={{position: 'absolute', left: 0, top: 0}}>
        <line x1={x0} y1={y0} x2={x0 + CW} y2={y0} stroke={rgba(C.ivory, 0.12)} strokeWidth={1} />
        <polyline points={pts.join(' ')} fill="none" stroke={rgba(C.ivory, 0.14)} strokeWidth={1.2} />
        <polyline points={done.join(' ')} fill="none" stroke={C.coral} strokeWidth={1.8} strokeLinecap="round" />
        <circle cx={hx} cy={hy} r={7} fill={rgba(C.gold, 0.25)} />
        <circle cx={hx} cy={hy} r={3.2} fill={C.gold} />
      </svg>
      <div style={{...label, position: 'absolute', right: 120, top: LETTERBOX / 2 - 12, color: rgba(C.ivory, 0.5), fontSize: 15}}>
        F {String(g).padStart(5, '0')}
        <span style={{color: rgba(C.ivory, 0.25)}}> / {String(TIMING.totalFrames).padStart(5, '0')}</span>
      </div>
    </div>
  );
};

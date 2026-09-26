// Editorial HUD for S08: glass "case file" cards that float in depth (parallax + slight 3D tilt + warm
// light spill), a case tag, leader labels pinned to 3D points, and a 24-hour dial.
import React from 'react';
import {C, F, rgba} from '../../theme';
import {E, clamp, prog} from '../../lib/anim';

type CardProps = {
  t: number;
  t0: number; // enters
  t1: number; // leaves
  x: number;
  y: number;
  w: number;
  depth?: number; // 0 near .. 1 far (more parallax drift, dimmer)
  drift?: {x: number; y: number};
  tilt?: number; // deg, rotateY
  children: React.ReactNode;
};

export const Card: React.FC<CardProps> = ({t, t0, t1, x, y, w, depth = 0.3, drift = {x: 0, y: 0}, tilt = 6, children}) => {
  const a = prog(t, t0, t0 + 0.7, E.out);
  const b = prog(t, t1 - 0.45, t1, E.inOut);
  const op = a * (1 - b);
  if (op <= 0.001) return null;
  const k = 1 - depth * 0.5;
  return (
    <div
      style={{
        position: 'absolute',
        left: x + drift.x * (1 + depth),
        top: y + drift.y * (1 + depth) + (1 - a) * 22 - b * 10,
        width: w,
        opacity: op * (0.75 + 0.25 * k),
        transform: `perspective(1400px) rotateY(${tilt * (1 - 0.4 * a)}deg) rotateX(${2 * (1 - a)}deg)`,
        transformOrigin: '0% 50%',
        padding: '22px 26px 20px',
        borderRadius: 14,
        background: `linear-gradient(140deg, ${rgba('#1A1D27', 0.7)} 0%, ${rgba('#0C0E14', 0.55)} 100%)`,
        border: `1px solid ${rgba(C.ivory, 0.13)}`,
        boxShadow: `0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 ${rgba(C.ivory, 0.08)}, 0 0 44px ${rgba(C.coral, 0.1 * a)}`,
        overflow: 'hidden',
      }}
    >
      <div style={{position: 'absolute', left: 0, top: 0, height: 2, width: `${100 * a}%`, background: `linear-gradient(90deg, ${C.gold}, ${rgba(C.coral, 0.2)})`}} />
      {children}
    </div>
  );
};

export const CardHead: React.FC<{date: string; kind?: string}> = ({date, kind = 'CASE FILE'}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 14, fontFamily: F.mono, fontSize: 22, letterSpacing: '0.16em', marginBottom: 12}}>
    <span style={{width: 8, height: 8, borderRadius: 4, background: C.gold, boxShadow: `0 0 10px ${C.gold}`}} />
    <span style={{color: C.gold}}>{date}</span>
    <span style={{color: rgba(C.mute, 0.8)}}>· {kind}</span>
  </div>
);
export const CardTitle: React.FC<{children: React.ReactNode; size?: number}> = ({children, size = 32}) => (
  <div style={{fontFamily: F.sans, fontWeight: 600, fontSize: size, lineHeight: 1.18, color: C.ivory, letterSpacing: '-0.005em'}}>{children}</div>
);
export const CardBody: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{fontFamily: F.sans, fontWeight: 450, fontSize: 25, lineHeight: 1.3, color: rgba(C.ivory, 0.78), marginTop: 8}}>{children}</div>
);
export const CardSource: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{fontFamily: F.mono, fontSize: 22, color: rgba(C.mute, 0.85), marginTop: 14, letterSpacing: '0.02em'}}>{children}</div>
);

// Two-bar micro chart (value vs baseline range), animated fill.
export const HitRate: React.FC<{p: number}> = ({p}) => {
  const bar = (label: string, lo: number, hi: number, warm: boolean, delay: number) => {
    const f = prog(p, delay, delay + 0.5, E.out);
    return (
      <div style={{marginTop: 12}}>
        <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: F.mono, fontSize: 22, color: warm ? C.gold : rgba(C.ice, 0.8)}}>
          <span>{label}</span>
          <span>{warm ? '~50%' : '10–15%'}</span>
        </div>
        <div style={{position: 'relative', height: 10, marginTop: 6, borderRadius: 5, background: rgba(C.ivory, 0.07)}}>
          <div
            style={{
              position: 'absolute',
              left: `${lo * f}%`,
              width: `${(hi - lo) * f}%`,
              top: 0,
              bottom: 0,
              borderRadius: 5,
              background: warm ? `linear-gradient(90deg, ${C.coral}, ${C.gold})` : rgba(C.cold, 0.7),
              boxShadow: warm ? `0 0 14px ${rgba(C.gold, 0.6)}` : 'none',
            }}
          />
        </div>
      </div>
    );
  };
  return (
    <div style={{marginTop: 6}}>
      {bar('Claude-designed', 0, 50, true, 0.15)}
      {bar('typical', 10, 15, false, 0.35)}
    </div>
  );
};

export const CaseTag: React.FC<{t: number; t0: number; t1: number; n: number; name: string; x?: number; y?: number}> = ({t, t0, t1, n, name, x = 150, y = 196}) => {
  const op = Math.min(prog(t, t0, t0 + 0.6, E.out), 1 - prog(t, t1 - 0.4, t1, E.inOut));
  if (op <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: op, display: 'flex', alignItems: 'center', gap: 16, fontFamily: F.mono, fontSize: 22, letterSpacing: '0.24em'}}>
      <span style={{color: rgba(C.cold, 0.95)}}>{`0${n} / 04`}</span>
      <span style={{width: 60 * op, height: 1, background: rgba(C.gold, 0.7)}} />
      <span style={{color: C.gold}}>{name}</span>
    </div>
  );
};

// Small label with a leader line pointing at a projected 3D point.
export const Leader: React.FC<{x: number; y: number; dx: number; dy: number; text: string; op: number; color?: string}> = ({x, y, dx, dy, text, op, color = C.gold}) => {
  if (op <= 0.001) return null;
  const len = Math.hypot(dx, dy);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <>
      <div style={{position: 'absolute', left: x, top: y, width: len * op, height: 1, background: rgba(color, 0.7), transform: `rotate(${ang}deg)`, transformOrigin: '0 0', opacity: op}} />
      <div style={{position: 'absolute', left: x - 4, top: y - 4, width: 8, height: 8, borderRadius: 4, border: `1.5px solid ${color}`, opacity: op}} />
      <div
        style={{
          position: 'absolute',
          left: x + dx + (dx >= 0 ? 10 : -10),
          top: y + dy - 14,
          transform: dx >= 0 ? 'none' : 'translateX(-100%)',
          fontFamily: F.mono,
          fontSize: 22,
          letterSpacing: '0.12em',
          color,
          opacity: op,
          whiteSpace: 'nowrap',
          textShadow: '0 2px 10px rgba(0,0,0,0.9)',
        }}
      >
        {text}
      </div>
    </>
  );
};

// 24-hour dial: "at any hour".
export const Dial: React.FC<{t: number; t0: number; t1: number; x: number; y: number; r?: number}> = ({t, t0, t1, x, y, r = 64}) => {
  const op = Math.min(prog(t, t0, t0 + 0.6, E.out), 1 - prog(t, t1 - 0.4, t1, E.inOut));
  if (op <= 0.001) return null;
  const hand = ((t - t0) * 140) % 360;
  const ticks = Array.from({length: 24}, (_, i) => i);
  return (
    <div style={{position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2 + 40, opacity: op}}>
      <svg width={r * 2} height={r * 2} viewBox={`${-r} ${-r} ${r * 2} ${r * 2}`} style={{overflow: 'visible'}}>
        <circle r={r - 2} fill="none" stroke={rgba(C.ivory, 0.18)} strokeWidth={1} />
        {ticks.map((i) => {
          const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
          const lit = ((i / 24) * 360 <= hand ? 1 : 0.25) * op;
          const l = i % 6 === 0 ? 12 : 6;
          return <line key={i} x1={Math.cos(a) * (r - 4)} y1={Math.sin(a) * (r - 4)} x2={Math.cos(a) * (r - 4 - l)} y2={Math.sin(a) * (r - 4 - l)} stroke={lit > 0.5 ? C.gold : rgba(C.ice, 0.5)} strokeWidth={i % 6 === 0 ? 2 : 1.2} />;
        })}
        <line x1={0} y1={0} x2={Math.cos(((hand - 90) * Math.PI) / 180) * (r - 16)} y2={Math.sin(((hand - 90) * Math.PI) / 180) * (r - 16)} stroke={C.gold} strokeWidth={2} strokeLinecap="round" />
        <circle r={3.5} fill={C.gold} />
      </svg>
      <div style={{fontFamily: F.mono, fontSize: 22, letterSpacing: '0.2em', color: rgba(C.ice, 0.85), textAlign: 'center', marginTop: 8, whiteSpace: 'nowrap', width: r * 2}}>00–24 H</div>
    </div>
  );
};

export const fadeWin = (t: number, t0: number, t1: number, fin = 0.5, fout = 0.5) => clamp(Math.min(prog(t, t0, t0 + fin, E.out), 1 - prog(t, t1 - fout, t1, E.inOut)));

// Five floating glass panels, one per power. Authentic micro-content: verified facts from FACTS.md plus
// real lines from THIS film's own source and pipeline.
import React from 'react';
import {C, F, rgba} from '../../theme';
import {E, clamp, prog} from '../../lib/anim';
import {TIMING} from '../../lib/timing';

const mono = (size = 22, color: string = rgba(C.ivory, 0.8)): React.CSSProperties => ({fontFamily: F.mono, fontSize: size, color, whiteSpace: 'nowrap', lineHeight: '27px'});

// ---------- icons (line art) ----------
const Icon: React.FC<{kind: string}> = ({kind}) => {
  const s = {fill: 'none', stroke: C.gold, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const};
  return (
    <svg width={26} height={26} viewBox="0 0 26 26">
      {kind === 'read' && (
        <>
          <path d="M3 6 Q8 4 13 7 Q18 4 23 6 V21 Q18 19 13 22 Q8 19 3 21 Z" {...s} />
          <path d="M13 7 V22" {...s} />
        </>
      )}
      {kind === 'see' && (
        <>
          <path d="M2 13 Q13 3 24 13 Q13 23 2 13 Z" {...s} />
          <circle cx={13} cy={13} r={4} {...s} />
        </>
      )}
      {kind === 'code' && (
        <>
          <path d="M8 7 L3 13 L8 19" {...s} />
          <path d="M18 7 L23 13 L18 19" {...s} />
          <path d="M15 5 L11 21" {...s} />
        </>
      )}
      {kind === 'computer' && (
        <>
          <rect x={2.5} y={4} width={21} height={14} rx={2} {...s} />
          <path d="M9 22 H17 M13 18 V22" {...s} />
        </>
      )}
      {kind === 'agents' && (
        <>
          <circle cx={5} cy={13} r={2.5} {...s} />
          <circle cx={21} cy={5} r={2.5} {...s} />
          <circle cx={21} cy={13} r={2.5} {...s} />
          <circle cx={21} cy={21} r={2.5} {...s} />
          <path d="M7.5 13 H18.5 M10 13 Q13 5 18.5 5 M10 13 Q13 21 18.5 21" {...s} />
        </>
      )}
    </svg>
  );
};

// ---------- glass shell ----------
export const Glass: React.FC<{
  w: number;
  h: number;
  kind: string;
  title: string;
  chip: string;
  spillSide: 'left' | 'right' | 'top';
  hot: number; // unlock flash 0..1
  children: React.ReactNode;
}> = ({w, h, kind, title, chip, spillSide, hot, children}) => {
  const dir = spillSide === 'left' ? 'to right' : spillSide === 'right' ? 'to left' : 'to bottom';
  return (
    <div style={{position: 'relative', width: w, height: h}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 12,
          background: `linear-gradient(160deg, ${rgba(C.ivory, 0.075)} 0%, ${rgba(C.ink, 0.72)} 38%, ${rgba(C.ink, 0.66)} 70%, ${rgba(C.clay, 0.12)} 100%)`,
          border: `1px solid ${rgba(C.gold, 0.26 + 0.6 * hot)}`,
          boxShadow: `0 24px 60px rgba(0,0,0,0.55), 0 0 ${30 + 60 * hot}px ${rgba(C.coral, 0.12 + 0.35 * hot)}, inset 0 1px 0 ${rgba(C.ivory, 0.12)}`,
        }}
      />
      {/* light spill from the hero on the side facing the gauge */}
      <div style={{position: 'absolute', inset: 0, borderRadius: 12, background: `linear-gradient(${dir}, ${rgba(C.ember, 0.2)}, ${rgba(C.ember, 0)} 45%)`}} />
      <div style={{position: 'absolute', left: 14, right: 14, top: 0, height: 1, background: `linear-gradient(90deg, rgba(0,0,0,0), ${rgba(C.ivory, 0.35)}, rgba(0,0,0,0))`}} />
      {/* corner ticks */}
      {[
        [0, 0, 1, 1],
        [1, 0, -1, 1],
        [0, 1, 1, -1],
        [1, 1, -1, -1],
      ].map(([x, y, dx, dy], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x ? w - 16 - 6 : 6,
            top: y ? h - 16 - 6 : 6,
            width: 16,
            height: 16,
            borderLeft: dx > 0 ? `1.5px solid ${rgba(C.gold, 0.7)}` : undefined,
            borderRight: dx < 0 ? `1.5px solid ${rgba(C.gold, 0.7)}` : undefined,
            borderTop: dy > 0 ? `1.5px solid ${rgba(C.gold, 0.7)}` : undefined,
            borderBottom: dy < 0 ? `1.5px solid ${rgba(C.gold, 0.7)}` : undefined,
          }}
        />
      ))}
      <div style={{position: 'absolute', left: 22, right: 22, top: 16, display: 'flex', alignItems: 'center', gap: 12}}>
        <Icon kind={kind} />
        <div style={{fontFamily: F.sans, fontWeight: 700, fontSize: 22, letterSpacing: '0.22em', color: C.ivory, flex: 1, whiteSpace: 'nowrap'}}>{title}</div>
        <div style={{...mono(22, rgba(C.gold, 0.95)), border: `1px solid ${rgba(C.gold, 0.4)}`, borderRadius: 5, padding: '0 8px'}}>{chip}</div>
      </div>
      <div style={{position: 'absolute', left: 22, right: 22, top: 58, bottom: 14, overflow: 'hidden'}}>{children}</div>
      {hot > 0.01 && <div style={{position: 'absolute', inset: 0, borderRadius: 12, background: rgba('#FFF3E0', 0.22 * hot)}} />}
    </div>
  );
};

// ---------- READ: a whole novel in seconds ----------
export const ReadBody: React.FC<{u: number; t: number}> = ({u}) => {
  const scan = prog(u, 0.05, 1.3, E.inOut); // reading sweep
  const found = prog(u, 1.3, 1.6, E.out);
  const secs = Math.round(22 * scan);
  const pages = 44;
  const hit = 29;
  const bars = [
    {k: '100K', d: 'MAY 2023', v: 5},
    {k: '200K', d: 'NOV 2023', v: 5.3},
    {k: '1M', d: '2026', v: 6},
  ];
  return (
    <div>
      <div style={{display: 'flex', gap: 3, height: 30, alignItems: 'flex-end'}}>
        {Array.from({length: pages}, (_, i) => {
          const f = i / pages;
          const read = f < scan;
          const isHit = i === hit && found > 0;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: isHit ? 30 : 18 + 6 * Math.sin(i * 1.7) ** 2,
                borderRadius: 1.5,
                background: isHit ? C.gold : read ? rgba(C.ember, 0.55) : rgba(C.ivory, 0.14),
                boxShadow: isHit ? `0 0 12px ${C.gold}` : undefined,
              }}
            />
          );
        })}
      </div>
      <div style={{...mono(22), marginTop: 10}}>
        The Great Gatsby <span style={{color: rgba(C.ivory, 0.45)}}>·</span> 72K tokens
      </div>
      <div style={{...mono(22, rgba(C.ivory, 0.62))}}>
        edited line found in <span style={{color: C.gold}}>{String(secs).padStart(2, '0')} s</span>
        <span style={{color: C.gold, opacity: found}}> ✓</span>
      </div>
      <div style={{marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2}}>
        {bars.map((b, i) => {
          const g = prog(u, 0.4 + i * 0.25, 1.0 + i * 0.25, E.out);
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 10, height: 25}}>
              <div style={{...mono(22, C.ivory), width: 58, textAlign: 'right'}}>{b.k}</div>
              <div style={{flex: 1, height: 6, background: rgba(C.ivory, 0.07), borderRadius: 3}}>
                <div style={{width: `${(b.v / 6) * 100 * g}%`, height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${C.clay}, ${i === 2 ? C.gold : C.coral})`}} />
              </div>
              <div style={{...mono(22, rgba(C.ivory, 0.5)), width: 118}}>{b.d}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- SEE: vision (the image it reads is this film's own curve) ----------
export const SeeBody: React.FC<{u: number; t: number}> = ({u, t}) => {
  const W = 240;
  const H = 150;
  const scan = (t * 0.55) % 1;
  const box = prog(u, 0.5, 0.9, E.out);
  const pts = Array.from({length: 30}, (_, i) => {
    const x = i / 29;
    const y = Math.pow(2, x * 5.5) / Math.pow(2, 5.5);
    return `${14 + x * (W - 28)},${H - 14 - y * (H - 34)}`;
  }).join(' ');
  const lines = [
    ['input', 'image'],
    ['found', 'line chart'],
    ['trend', 'exponential'],
  ];
  return (
    <div style={{display: 'flex', gap: 18}}>
      <svg width={W} height={H} style={{flex: 'none'}}>
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={6} fill={rgba(C.night, 0.8)} stroke={rgba(C.ivory, 0.2)} />
        <path d={`M14,${H - 14} H${W - 12} M14,${H - 14} V14`} stroke={rgba(C.ivory, 0.35)} strokeWidth={1} fill="none" />
        <polyline points={pts} fill="none" stroke={C.coral} strokeWidth={2} />
        {/* detection bracket */}
        {box > 0 && (
          <g opacity={box}>
            <rect x={W - 104} y={16} width={88 * box + 4} height={H - 40} fill="none" stroke={C.gold} strokeWidth={1.4} strokeDasharray="6 4" />
          </g>
        )}
        {/* vision scan line */}
        <rect x={14 + scan * (W - 28) - 1} y={6} width={2} height={H - 12} fill={rgba(C.electric, 0.75)} />
        <rect x={14 + scan * (W - 28) - 18} y={6} width={18} height={H - 12} fill={rgba(C.electric, 0.08)} />
      </svg>
      <div style={{display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4}}>
        {lines.map(([k, v], i) => (
          <div key={k} style={{opacity: prog(u, 0.3 + i * 0.22, 0.6 + i * 0.22)}}>
            <div style={mono(22, rgba(C.ivory, 0.45))}>{k}</div>
            <div style={{...mono(22, i === 2 ? C.gold : C.ivory), marginTop: -4}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- CODE: real lines from this film's engine (src/lib/ShaderCanvas.tsx) + the real render command ----------
const CODE: {tk: string; c: string}[][] = [
  [{tk: 'gl', c: C.ivory}, {tk: '.viewport', c: C.gold}, {tk: '(0, 0, pxW, pxH);', c: C.ivory}],
  [{tk: 'gl', c: C.ivory}, {tk: '.uniform1f', c: C.gold}, {tk: '(L(', c: C.ivory}, {tk: "'uTime'", c: C.coral}, {tk: '), t);', c: C.ivory}],
  [{tk: 'gl', c: C.ivory}, {tk: '.uniform1f', c: C.gold}, {tk: '(L(', c: C.ivory}, {tk: "'uFrame'", c: C.coral}, {tk: '), frame);', c: C.ivory}],
  [{tk: 'gl', c: C.ivory}, {tk: '.drawArrays', c: C.gold}, {tk: '(gl.TRIANGLES, 0, 3);', c: C.ivory}],
];
const CODE_LN = [112, 116, 117, 127]; // real line numbers in src/lib/ShaderCanvas.tsx
export const CodeBody: React.FC<{u: number; t: number}> = ({u}) => {
  const total = CODE.map((l) => l.reduce((s, x) => s + x.tk.length, 0));
  const frames = TIMING.scenes.find((s) => s.id === 'S05')?.duration ?? 810;
  const run = prog(u, 1.2, 2.4, E.inOut);
  const f = Math.round(frames * run);
  return (
    <div>
      <div style={mono(22, rgba(C.ivory, 0.42))}>src/lib/ShaderCanvas.tsx</div>
      <div style={{marginTop: 4}}>
        {CODE.map((line, li) => {
          let left = Math.floor((u * 1.6 - li * 0.2) * 34);
          return (
            <div key={li} style={{display: 'flex', ...mono(22), height: 27}}>
              <span style={{color: rgba(C.ivory, 0.28), width: 50, flex: 'none'}}>{CODE_LN[li]}</span>
              {line.map((tk, i) => {
                const n = Math.max(0, Math.min(tk.tk.length, left));
                left -= tk.tk.length;
                return (
                  <span key={i} style={{color: tk.c}}>
                    {tk.tk.slice(0, n)}
                  </span>
                );
              })}
              {Math.floor((u * 1.6 - li * 0.2) * 34) > 0 && Math.floor((u * 1.6 - li * 0.2) * 34) < total[li] && <span style={{color: C.gold}}>▌</span>}
            </div>
          );
        })}
      </div>
      <div style={{height: 1, background: rgba(C.ivory, 0.12), margin: '8px 0 6px'}} />
      <div style={{...mono(22, rgba(C.ivory, 0.8)), opacity: prog(u, 0.9, 1.1)}}>
        <span style={{color: C.gold}}>$</span> node scripts/render-film.mjs
      </div>
      <div style={{...mono(22, rgba(C.ivory, 0.62)), opacity: prog(u, 1.2, 1.3)}}>
        S05 {String(Math.round(run * 100)).padStart(3, ' ')}% ({f}/{frames}) <span style={{color: C.gold, opacity: run >= 1 ? 1 : 0}}>✓</span>
      </div>
    </div>
  );
};

// ---------- COMPUTER USE: a cursor drives an editor timeline of this film's real scenes ----------
export const ComputerBody: React.FC<{u: number; t: number}> = ({u, t}) => {
  const W = 436;
  const scenes = TIMING.scenes;
  const tot = scenes.reduce((s, x) => s + x.duration, 0);
  // cursor path: toolbar -> timeline block S05 -> drag -> render button
  const k = (t * 0.32) % 1;
  const path = [
    {x: 60, y: 22},
    {x: 170, y: 112},
    {x: 300, y: 112},
    {x: 390, y: 22},
  ];
  const seg = Math.min(2, Math.floor(k * 3));
  const f = E.inOut(k * 3 - seg);
  const cx = path[seg].x + (path[seg + 1].x - path[seg].x) * f;
  const cy = path[seg].y + (path[seg + 1].y - path[seg].y) * f;
  const click = seg === 2 && f > 0.95 ? 1 : seg === 0 && f > 0.95 ? 1 : 0;
  const play = seg >= 1 ? (seg === 1 ? f : 1) : 0;
  let acc = 0;
  const appear = prog(u, 0, 0.5, E.out);
  const playX = 18 + (W - 36) * (0.28 + 0.4 * play);
  const hover = scenes.find((s, i) => {
    const x0 = 18 + ((W - 36) * scenes.slice(0, i).reduce((a, b) => a + b.duration, 0)) / tot;
    const x1 = x0 + ((W - 36) * s.duration) / tot;
    return playX >= x0 && playX < x1;
  });
  return (
    <div style={{opacity: appear}}>
      <svg width={W} height={172}>
        <rect x={0.5} y={0.5} width={W - 1} height={170} rx={7} fill={rgba(C.night, 0.75)} stroke={rgba(C.ivory, 0.2)} />
        <path d={`M0,36 H${W}`} stroke={rgba(C.ivory, 0.14)} />
        {[16, 30, 44].map((x) => (
          <circle key={x} cx={x} cy={18} r={4.5} fill={rgba(C.ivory, 0.22)} />
        ))}
        <rect x={W - 92} y={8} width={80} height={20} rx={4} fill={click && seg === 2 ? C.gold : rgba(C.coral, 0.35)} stroke={rgba(C.gold, 0.7)} />
        <rect x={W - 80} y={16} width={56} height={4} rx={2} fill={rgba(C.ivory, 0.8)} />
        {/* scene blocks proportional to the real scene lengths */}
        {scenes.map((s, i) => {
          const x0 = 18 + ((W - 36) * acc) / tot;
          acc += s.duration;
          const w = ((W - 36) * s.duration) / tot - 3;
          const cur = hover?.id === s.id;
          return <rect key={s.id} x={x0} y={98} width={w} height={28} rx={3} fill={cur ? rgba(C.gold, 0.55) : rgba(C.coral, 0.16 + 0.03 * (i % 3))} stroke={rgba(C.gold, cur ? 0.9 : 0.25)} />;
        })}
        {[0, 1, 2].map((i) => (
          <rect key={i} x={18} y={50 + i * 13} width={[260, 180, 220][i]} height={5} rx={2.5} fill={rgba(C.ivory, 0.12)} />
        ))}
        <line x1={playX} y1={88} x2={playX} y2={134} stroke={C.gold} strokeWidth={1.6} />
        {/* cursor */}
        <g transform={`translate(${cx},${cy})`}>
          {click > 0 && <circle r={12} fill="none" stroke={rgba(C.gold, 0.8)} strokeWidth={1.4} />}
          <path d="M0,0 L0,17 L4.5,13 L8,20 L10.5,19 L7,12 L13,12 Z" fill={C.ivory} stroke={C.void} strokeWidth={1} />
        </g>
      </svg>
      <div style={{...mono(22, rgba(C.ivory, 0.6)), marginTop: 4}}>
        {hover ? (
          <>
            <span style={{color: C.gold}}>{hover.id}</span> {hover.name} · {Math.round(hover.duration / 30)} s
          </>
        ) : (
          'timeline'
        )}
      </div>
    </div>
  );
};

// ---------- AGENTS: works for hours; sub-agents = the real team that made this film ----------
const TEAM = ['research', 'voice', 'score', 'scenes', 'review'];
export const AgentsBody: React.FC<{u: number; t: number}> = ({u, t}) => {
  const clk = prog(u, 0, 2.2, (x) => x);
  const hand = clk * 360 * 4.8; // hours spin by
  return (
    <div style={{display: 'flex', gap: 22}}>
      <div style={{width: 130, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <svg width={92} height={92}>
          <circle cx={46} cy={46} r={40} fill="none" stroke={rgba(C.ivory, 0.12)} strokeWidth={3} />
          <path
            d={`M46,6 A40,40 0 ${clk * 0.8 > 0.5 ? 1 : 0} 1 ${46 + 40 * Math.sin(clk * 0.8 * 2 * Math.PI)},${46 - 40 * Math.cos(clk * 0.8 * 2 * Math.PI)}`}
            fill="none"
            stroke={C.gold}
            strokeWidth={3}
          />
          {Array.from({length: 12}, (_, i) => (
            <line key={i} x1={46 + 30 * Math.sin((i * Math.PI) / 6)} y1={46 - 30 * Math.cos((i * Math.PI) / 6)} x2={46 + 34 * Math.sin((i * Math.PI) / 6)} y2={46 - 34 * Math.cos((i * Math.PI) / 6)} stroke={rgba(C.ivory, 0.35)} />
          ))}
          <line x1={46} y1={46} x2={46 + 24 * Math.sin((hand * Math.PI) / 180)} y2={46 - 24 * Math.cos((hand * Math.PI) / 180)} stroke={C.ivory} strokeWidth={2} strokeLinecap="round" />
          <circle cx={46} cy={46} r={3} fill={C.gold} />
        </svg>
        <div style={{...mono(22, C.ivory), marginTop: 2}}>~4 h 49 m</div>
      </div>
      <div style={{flex: 1, position: 'relative'}}>
        <svg width={40} height={140} style={{position: 'absolute', left: 0, top: 0}}>
          {TEAM.map((_, i) => {
            const y = 13 + i * 27;
            const g = prog(u, 0.15 + i * 0.12, 0.45 + i * 0.12, E.out);
            return <path key={i} d={`M4,${13 + 2 * 27} C20,${13 + 2 * 27} 18,${y} 34,${y}`} fill="none" stroke={rgba(C.gold, 0.6)} strokeWidth={1.3} pathLength={1} strokeDasharray={`${g} 1`} />;
          })}
          <circle cx={4} cy={13 + 2 * 27} r={4} fill={C.gold} />
        </svg>
        {TEAM.map((name, i) => {
          const g = prog(u, 0.3 + i * 0.12, 0.6 + i * 0.12, E.out);
          const work = clamp((t * (0.16 + 0.05 * ((i * 7) % 5)) + i * 0.23) % 1.25);
          return (
            <div key={name} style={{position: 'absolute', left: 44, top: i * 27, height: 27, right: 0, display: 'flex', alignItems: 'center', gap: 12, opacity: g}}>
              <div style={{width: 8, height: 8, borderRadius: 4, background: C.coral, boxShadow: `0 0 8px ${C.coral}`}} />
              <div style={{...mono(22, C.ivory), width: 110}}>{name}</div>
              <div style={{flex: 1, height: 4, background: rgba(C.ivory, 0.08), borderRadius: 2}}>
                <div style={{width: `${Math.min(1, work) * 100}%`, height: 4, borderRadius: 2, background: rgba(C.gold, 0.8)}} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

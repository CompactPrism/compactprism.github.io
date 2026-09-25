// S11 Credits: the reveal that the whole film is code, with real counted stats, credits, sources,
// and the hero's catchphrase typed into an empty prompt.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, F, rgba} from '../theme';
import {useScene} from '../lib/timing';
import {ClaudeSpark} from '../lib/ClaudeSpark';
import {E, clamp, inOut, prog} from '../lib/anim';
import {ShaderCanvas} from '../lib/ShaderCanvas';
import stats from '../stats.json';

// Tiny syntax highlighter for the code wall.
const Highlight: React.FC<{line: string; warm: number}> = ({line, warm}) => {
  const parts: {t: string; c: string}[] = [];
  const re = /(\/\/.*$)|('[^']*'|"[^"]*"|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:const|let|return|import|export|from|float|vec2|vec3|vec4|uniform|void|if|for|type|new|mat2)\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push({t: line.slice(last, m.index), c: rgba(C.ivory, 0.55)});
    const col = m[1] ? rgba(C.mute, 0.7) : m[2] ? C.ice : m[3] ? C.gold : warm > 0.5 ? C.coral : C.cold;
    parts.push({t: m[0], c: col});
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push({t: line.slice(last), c: rgba(C.ivory, 0.55)});
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} style={{color: p.c}}>
          {p.t}
        </span>
      ))}
    </>
  );
};

const BG = /* glsl */ `
uniform float uWarm;
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float n = fbm(vec3(uv * 1.6, uTime * .04));
  vec3 col = COL_VOID + mix(COL_STEEL * .25, COL_CLAY * .35, uWarm) * smoothstep(-.3, .9, n) * smoothstep(1.3, .1, length(uv));
  vec2 q = uv - vec2(0., .26);
  col += mix(COL_COLD, COL_CORAL, uWarm) * (.10 * exp(-dot(q, q) * 9.) + .05 * exp(-dot(uv, uv) * 2.5)) * uWarm;
  fragColor = vec4(aces(col) + dither(gl_FragCoord.xy), 1.);
}`;

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

const Stat: React.FC<{value: number; label: string; p: number; suffix?: string}> = ({value, label, p, suffix}) => (
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: clamp(p * 1.6), transform: `translateY(${(1 - E.out(clamp(p))) * 24}px)`, minWidth: 250}}>
    <div style={{fontFamily: F.mono, fontSize: 64, fontWeight: 300, color: C.ivory, letterSpacing: '-0.02em', textShadow: `0 0 30px ${rgba(C.coral, 0.35)}`}}>
      {fmt(value * E.out(clamp(p)))}
      {suffix}
    </div>
    <div style={{fontFamily: F.sans, fontSize: 18, fontWeight: 600, letterSpacing: '0.26em', color: rgba(C.coral, 0.95), marginTop: 6}}>{label}</div>
  </div>
);

const CREDITS: {k: string; v: string}[] = [
  {k: 'Engine', v: 'Remotion · React · TypeScript · Three.js · GLSL'},
  {k: 'Voice', v: 'Kokoro-82M, an open-source text-to-speech model'},
  {k: 'Score', v: 'synthesised note by note in Python (NumPy, SciPy)'},
  {k: 'Facts', v: 'Anthropic · Epoch AI · METR · EMBL-EBI · “Machines of Loving Grace” (2024)'},
];

export const S11: React.FC = () => {
  const {t, dur, cue, end} = useScene('S11');
  const warm = prog(t, end('L29') - 1.0, end('L29') + 0.6, E.inOut);

  // Phase timings (seconds), all relative to the line and the scene length.
  const statsIn = end('L29') + 0.3;
  const creditsIn = statsIn + 1.6;
  const promptIn = Math.max(creditsIn + 4.2, dur - 5.2);
  const wallOut = 1 - prog(t, promptIn - 0.9, promptIn - 0.1, E.inOut);
  const typed = 'How can I help?';
  const nChars = Math.floor(clamp((t - (promptIn + 0.9)) / 1.1) * typed.length);
  const caretOn = Math.floor(t * 2.2) % 2 === 0 || (nChars > 0 && nChars < typed.length);
  const endFade = 1 - prog(t, dur - 0.9, dur - 0.05, E.inOut);

  const lineH = 30;
  const scroll = t * 42 + prog(t, cue('L29'), end('L29'), E.inOut) * 260;
  const sample = stats.sample.length ? stats.sample : ['// code'];
  const rows = 34;
  const first = Math.floor(scroll / lineH);

  const stat = (i: number) => prog(t, statsIn + i * 0.22, statsIn + i * 0.22 + 1.3, E.linear);

  return (
    <AbsoluteFill style={{background: C.void, opacity: endFade * clamp(t / 0.5)}}>
      <ShaderCanvas frag={BG} uniforms={{uWarm: warm}} scale={0.5} />

      {/* Wall of this film's own source code, in perspective */}
      <AbsoluteFill style={{perspective: 1100, opacity: wallOut * (0.12 + 0.5 * (1 - prog(t, statsIn - 0.4, statsIn + 0.6)))}}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 1700,
            height: rows * lineH,
            marginLeft: -850,
            marginTop: -(rows * lineH) / 2,
            transform: `rotateX(${28 - 6 * warm}deg) translateZ(${-120 + t * 6}px)`,
            transformOrigin: '50% 60%',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 70%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%, black 70%, transparent 100%)',
            fontFamily: F.mono,
            fontSize: 19,
            lineHeight: `${lineH}px`,
            whiteSpace: 'pre',
            overflow: 'hidden',
          }}
        >
          <div style={{transform: `translateY(${-(scroll % lineH)}px)`}}>
            {Array.from({length: rows + 1}, (_, i) => {
              const idx = (first + i) % sample.length;
              return (
                <div key={i} style={{paddingLeft: ((first + i) * 37) % 3 === 0 ? 40 : 0}}>
                  <span style={{color: rgba(C.mute, 0.45), marginRight: 24}}>{String(((first + i) % 9999) + 1).padStart(4, ' ')}</span>
                  <Highlight line={sample[idx]} warm={warm} />
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>

      {/* The hero, signing its work */}
      <AbsoluteFill style={{alignItems: 'center', opacity: wallOut}}>
        <div style={{position: 'absolute', top: 190, transform: `scale(${0.8 + 0.2 * E.out(warm)})`, opacity: warm}}>
          <ClaudeSpark size={96} draw={prog(t, end('L29') - 0.8, end('L29') + 0.6)} glow={0.9} rotate={t * 3} />
        </div>
      </AbsoluteFill>

      {/* Stats */}
      <AbsoluteFill style={{alignItems: 'center', opacity: wallOut}}>
        <div style={{position: 'absolute', top: 330, display: 'flex', gap: 34}}>
          <Stat value={stats.codeLines} label="LINES OF CODE" p={stat(0)} />
          <Stat value={stats.shaders} label="GLSL SHADERS" p={stat(1)} />
          <Stat value={stats.frames} label="FRAMES, ALL COMPUTED" p={stat(2)} />
          <Stat value={0} label="STOCK FOOTAGE" p={stat(3)} />
          <Stat value={0} label="GENERATED IMAGES" p={stat(4)} />
        </div>
      </AbsoluteFill>

      {/* Credits */}
      <AbsoluteFill style={{alignItems: 'center', opacity: wallOut}}>
        <div style={{position: 'absolute', top: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12}}>
          <div style={{opacity: prog(t, creditsIn - 0.3, creditsIn + 0.6), fontFamily: F.serif, fontSize: 38, fontWeight: 340, color: C.ivory, fontVariationSettings: '"opsz" 72, "SOFT" 50', marginBottom: 4}}>
            Written, designed, animated and scored entirely in code
          </div>
          <div style={{opacity: prog(t, creditsIn, creditsIn + 0.9), fontFamily: F.serif, fontStyle: 'italic', fontSize: 30, fontWeight: 340, color: rgba(C.gold, 0.95), fontVariationSettings: '"opsz" 72', marginBottom: 26}}>
            by Claude, in Claude Code
          </div>
          {CREDITS.map((c, i) => {
            const p = prog(t, creditsIn + 0.5 + i * 0.28, creditsIn + 0.5 + i * 0.28 + 0.9);
            return (
              <div key={c.k} style={{display: 'flex', gap: 22, alignItems: 'baseline', opacity: p, transform: `translateY(${(1 - p) * 12}px)`}}>
                <div style={{width: 160, textAlign: 'right', fontFamily: F.sans, fontSize: 18, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: rgba(C.coral, 0.9)}}>{c.k}</div>
                <div style={{width: 980, fontFamily: F.serif, fontSize: 26, fontWeight: 360, color: rgba(C.ivory, 0.92), fontVariationSettings: '"opsz" 36'}}>{c.v}</div>
              </div>
            );
          })}
          <div
            style={{
              marginTop: 22,
              fontFamily: F.sans,
              fontSize: 17,
              letterSpacing: '0.08em',
              color: rgba(C.mute, 0.95),
              opacity: prog(t, creditsIn + 2.0, creditsIn + 2.8),
            }}
          >
            An independent tribute made with Claude. Not an official Anthropic production.
          </div>
        </div>
      </AbsoluteFill>

      {/* Catchphrase: an empty prompt, and the hero's first words */}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: inOut(t, promptIn, dur + 1, 0.8, 0.1)}}>
        <div
          style={{
            width: 900,
            height: 104,
            borderRadius: 28,
            border: `1.5px solid ${rgba(C.ivory, 0.16)}`,
            background: `linear-gradient(180deg, ${rgba(C.ink, 0.9)}, ${rgba(C.void, 0.9)})`,
            boxShadow: `0 0 80px ${rgba(C.coral, 0.12 * prog(t, promptIn + 0.9, promptIn + 2.2))}, inset 0 1px 0 ${rgba(C.ivory, 0.06)}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 40px',
            gap: 26,
            transform: `scale(${0.97 + 0.03 * prog(t, promptIn, promptIn + 1.2)})`,
          }}
        >
          <ClaudeSpark size={44} draw={prog(t, promptIn + 0.2, promptIn + 1.0)} glow={0.5} rotate={t * 6} />
          <div style={{fontFamily: F.serif, fontSize: 46, fontWeight: 340, color: C.ivory, fontVariationSettings: '"opsz" 72, "SOFT" 60', display: 'flex', alignItems: 'center'}}>
            {typed.slice(0, nChars)}
            <span style={{display: 'inline-block', width: 3, height: 50, marginLeft: 6, background: C.coral, opacity: caretOn ? 0.95 : 0}} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

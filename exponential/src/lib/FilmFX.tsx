// Global cinematic finishing layers: film grain, vignette, letterbox bars, captions.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, F, H, LETTERBOX, rgba} from '../theme';
import {ShaderCanvas} from './ShaderCanvas';

const GRAIN = /* glsl */ `
uniform float uAmt;
void main(){
  vec2 fc = gl_FragCoord.xy;
  float n = hash12(fc + vec2(uFrame * 17.13, uFrame * 3.71)) + hash12(fc * 1.7 + uFrame) - 1.0;
  float g = 0.5 + n * uAmt;
  fragColor = vec4(vec3(g), 1.0);
}`;

// Organic animated grain, blended in overlay mode (invisible on pure black, lively on midtones).
export const Grain: React.FC<{amount?: number}> = ({amount = 0.09}) => (
  <ShaderCanvas frag={GRAIN} uniforms={{uAmt: amount}} scale={0.5} blend="overlay" />
);

export const Vignette: React.FC<{strength?: number}> = ({strength = 0.55}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: `radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

// amount: 1 = full 2.39:1 bars, 0 = open 16:9 frame.
export const Letterbox: React.FC<{amount: number}> = ({amount}) => {
  const h = LETTERBOX * amount;
  if (h < 0.5) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: h, background: '#000'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: h, background: '#000'}} />
    </AbsoluteFill>
  );
};

// One subtitle line centred in the lower letterbox bar: editorial serif, with *emphasis* words set in
// warm italic. `rise` (0..1) animates the line in. opacity handled by caller.
export const Caption: React.FC<{text: string; opacity: number; rise?: number}> = ({text, opacity, rise = 1}) => {
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  const long = text.replace(/\*/g, '').length > 78;
  return (
    <div
      style={{
        position: 'absolute',
        left: 150,
        right: 150,
        top: H - LETTERBOX + 16,
        height: LETTERBOX - 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontFamily: F.serif,
        fontSize: long ? 33 : 38,
        lineHeight: 1.18,
        fontWeight: 360,
        fontVariationSettings: '"opsz" 48, "SOFT" 30',
        letterSpacing: '0.005em',
        color: rgba(C.ivory, 0.94),
        opacity,
        transform: `translateY(${(1 - rise) * 10}px)`,
        textShadow: '0 2px 14px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.6)',
        textWrap: 'balance',
      }}
    >
      <span>
        {parts.map((p, i) =>
          p.startsWith('*') ? (
            <span key={i} style={{fontStyle: 'italic', color: C.gold, fontWeight: 380}}>
              {p.slice(1, -1)}
            </span>
          ) : (
            <span key={i}>{p}</span>
          )
        )}
      </span>
    </div>
  );
};

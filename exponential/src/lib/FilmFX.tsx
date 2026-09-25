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

// One subtitle line centred in the lower letterbox bar. opacity handled by caller.
export const Caption: React.FC<{text: string; opacity: number; lift?: number}> = ({text, opacity, lift = 0}) => (
  <div
    style={{
      position: 'absolute',
      left: 160,
      right: 160,
      top: H - LETTERBOX + 22 - lift,
      height: LETTERBOX - 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      fontFamily: F.sans,
      fontSize: 29,
      lineHeight: 1.32,
      fontWeight: 450,
      letterSpacing: 0.2,
      color: rgba(C.ivory, 0.9),
      opacity,
      textShadow: '0 2px 12px rgba(0,0,0,0.9)',
      textWrap: 'balance',
    }}
  >
    {text}
  </div>
);

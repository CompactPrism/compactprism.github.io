// S04 SCALE. A torrent of GPU particles accelerates upward; each scaling keyword widens and speeds it;
// abilities spark as constellations; then the river collapses onto a log-scale chart of training compute
// (verified points only, see ./S04/chart.ts FACTS) and finally flips to a linear axis to show the wall.
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ShaderCanvas} from '../lib/ShaderCanvas';
import {PointCloud} from '../lib/PointCloud';
import {useScene} from '../lib/timing';
import {C, F, rgba} from '../theme';
import {E, clamp, lerp, prog, ramp, shake} from '../lib/anim';
import {CAM_INIT, Cam, CameraRig, lerpCam, project} from './S04/cam';
import {wordCue} from './S04/vo';
import {Streaks} from './S04/Streaks';
import {Glyphs} from './S04/Glyphs';
import {Chart} from './S04/Chart';
import {CHART_GLSL, TREND, chartW, trendV} from './S04/chart';

const gv = (hex: string) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4));
  return `vec3(${c.join(',')})`;
};
const PAL = `
  const vec3 ELEC = ${gv(C.electric)}; const vec3 ICE = ${gv(C.ice)}; const vec3 COLD = ${gv(C.cold)};
  const vec3 CORAL = ${gv(C.coral)}; const vec3 EMBER = ${gv(C.ember)}; const vec3 GOLD = ${gv(C.gold)};
`;

// River: streams (lanes) of particles rising through a column, bent by curl noise. Needs `tr` (travel).
const RIVER = `
  float lane = floor(aSeed.x * 18.);
  float ga = lane * 2.39996;
  float rr = sqrt(fract(lane * .618034 + .21));
  vec2 sc = vec2(cos(ga), sin(ga)) * rr * 2.3 * uWidth;
  float mist = step(.7, aSeed2.w);
  vec2 off = (aSeed.zw - .5) * mix(.28, 3.6, mist) * (.6 + .4 * uWidth);
  float rate = .028 + .016 * aSeed2.z;
  float fy = fract(aSeed.y + tr * rate);
  float yy = mix(-11., 17., fy);
  vec3 rp = vec3(sc.x + off.x, yy, sc.y * .9 + off.y - 1.5);
  rp += curl(vec3(sc * .2 + lane * 3.1, yy * .08 - tr * .012, 1.3)) * (1.0 + .5 * uWidth);
  float ra = smoothstep(0., .1, fy) * smoothstep(1., .8, fy);
  vec3 cold = mix(ELEC, ICE, aSeed2.y * .7);
  vec3 warm = mix(CORAL, GOLD, aSeed2.y);
  float wk = clamp(uWarm * 1.5 - aSeed2.w * .5, 0., 1.);
  vec3 rc = mix(cold, warm, wk);
`;

const CLOUD = `
  ${PAL}
  ${CHART_GLSL}
  float tr = uTravel;
  ${RIVER}
  float rsize = mix(1.3, 3.2, pow(aSeed.w, 3.)) * (1. + mist * .6) * (1. + uPulse * .35);
  float rA = ra * mix(.5, .2, mist) * (1. + uPulse * .7);

  vec3 cp = rp; vec3 cc = rc; float cA = 0.; float cS = 2.;
  float role = aSeed2.x;
  float headYr = mix(${TREND.start.toFixed(1)}, ${TREND.end.toFixed(2)}, uDraw);
  if (role < .48) {
    float f = fract(aSeed2.y + uTime * (.06 + .05 * aSeed2.z));
    float yr = mix(2010., headYr, f);
    vec2 j = (aSeed.zw - .5) * .07 * (1. + 3. * pow(aSeed2.w, 6.));
    cp = vec3(CH_X(yr) + j.x, CH_Y(TREND_V(yr), uMorph) + j.y, (aSeed2.w - .5) * .3);
    cA = .45 * smoothstep(0., .08, f) * step(.001, uDraw);
    cc = mix(EMBER, GOLD, aSeed2.w);
    cS = mix(1.3, 2.8, pow(aSeed.w, 4.));
    if (aSeed2.z < .12) {
      vec3 hp = vec3(CH_X(headYr), CH_Y(TREND_V(headYr), uMorph), 0.);
      float an = aSeed.x * TAU + uTime * (1.5 + aSeed.y * 3.);
      float r = .04 + .5 * pow(aSeed.z, 2.2);
      cp = hp + vec3(cos(an) * r, sin(an) * r * .8, (aSeed.w - .5) * .5);
      cA = .6 * step(.001, uDraw);
      cc = mix(GOLD, vec3(1., .95, .86), aSeed.w);
      cS = mix(1.4, 3.6, aSeed.w);
    }
  } else if (role < .7) {
    float dec = floor(aSeed2.y * 12.);
    float xx = aSeed2.z;
    cp = vec3(mix(CH_X(2010.), CH_X(2026.), xx), CH_Y(16. + dec, uMorph), 0.);
    cA = .13 * step(xx, uGrid) * (1. - .75 * uMorph);
    cc = mix(ICE, ELEC, .35);
    cS = 1.2;
  } else if (role < .76) {
    float along = aSeed2.y;
    cp = aSeed2.z < .45 ? vec3(CH_X(2010.), mix(CH_Y(16., 0.), CH_Y(27., 0.), along), 0.)
                        : vec3(mix(CH_X(2010.), CH_X(2026.), along), CH_Y(16., 0.), 0.);
    cA = .3 * step(along, uAxes);
    cc = ICE; cS = 1.4;
  } else {
    float dz = aSeed.z;
    cp = vec3((aSeed.x - .5) * 34., mod(aSeed.y * 22. + uTime * (.12 + .2 * aSeed2.y), 22.) - 11., 4. - dz * 30.);
    cA = .22 * (.4 + .6 * dz);
    cc = mix(mix(COLD, ICE, .5), mix(CORAL, GOLD, aSeed2.y), uWarm);
    cS = mix(1.4, 5., pow(aSeed2.y, 5.));
  }
  float k = smoothstep(0., 1., clamp(uRes * 1.7 - aSeed2.w * .7, 0., 1.));
  pos = mix(rp, cp, k);
  color = mix(rc, cc, k);
  alpha = mix(rA, cA, k) * uFade;
  size = mix(rsize, cS, k);
`;

const STREAK = `
  ${PAL}
  ${RIVER}
  float fyH = fract(aSeed.y + uTravel * rate);
  float fyT = fract(aSeed.y + (uTravel - uTrail) * rate);
  float wrapped = step(fyH, fyT);
  pos = rp;
  color = mix(rc, vec3(1.), .25);
  alpha = ra * (1. - wrapped) * .55 * (1. - uRes) * uFade * (1. + uPulse);
`;

const BG = /* glsl */ `
uniform float uWarm, uTravel, uPulse, uChart, uFade;
uniform vec2 uHead;
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec3 cold = mix(COL_STEEL, COL_ELEC, .35);
  vec3 warm = mix(COL_CLAY, COL_EMBER, .45);
  vec3 tint = mix(cold, warm, uWarm);
  float river = 1. - uChart;
  // rising light shafts
  float n = fbm(vec3(uv.x * 2.4, uv.y * .35 - uTravel * .06, uTime * .05));
  float shafts = smoothstep(-.15, .8, n) * exp(-uv.x * uv.x * 2.2);
  vec3 col = COL_VOID + vec3(.004, .006, .012) * (1. - uv.y);
  col += tint * shafts * .16 * river;
  vec2 vp = uv - vec2(0., .42);
  col += tint * exp(-dot(vp, vp) * 2.5) * .16 * river;
  // hit pulse: expanding ring + bloom
  float r = length(uv * vec2(.9, 1.2));
  float rad = (1. - uPulse) * 1.3;
  col += mix(COL_ELEC, COL_GOLD, uWarm) * exp(-pow((r - rad) * 7., 2.)) * uPulse * .35;
  col += tint * uPulse * .12 * exp(-r * 1.5);
  // chart: soft warm atmosphere, glow behind the head of the curve
  vec2 h = uv - uHead;
  col += mix(COL_CLAY, COL_GOLD, .4) * uChart * (.03 + .22 * exp(-dot(h, h) * 7.));
  col += COL_STEEL * uChart * .12 * exp(-dot(uv, uv) * 1.2);
  col += stars(uv + vec2(0., uTravel * .004), 80., uTime) * .3;
  col *= uFade;
  fragColor = vec4(aces(col * 1.15) + dither(gl_FragCoord.xy), 1.);
}`;

const WORDS = [
  {w: 'BIGGER', tag: 'PARAMETERS ▲', size: 124},
  {w: 'MORE DATA', tag: 'TOKENS ▲', size: 124},
  {w: 'MORE COMPUTE', tag: 'FLOP ▲', size: 128},
];

export const S04: React.FC = () => {
  const {t, dur, cue, end, lines, fps} = useScene('S04');
  const W = (lid: string, ph: string, fb = 0.5) => wordCue(lines, fps, lid, ph, fb);
  const a9 = cue('L09');
  const b8 = end('L08');
  const hits = [W('L08', 'bigger') - 0.08, W('L08', 'more data') - 0.06, W('L08', 'more compute') - 0.06];
  const tEmerge = W('L08', 'abilities') - 0.25;
  const tFour = W('L09', 'four');
  const tDecade0 = W('L09', 'for more');
  const tDecade1 = W('L09', 'decade') + 0.3;
  const tMorph0 = Math.min(W('L09', 'decade') + 0.2, dur - 2.3);
  const tMorph1 = Math.min(tMorph0 + 1.2, dur - 0.6);

  // --- river dynamics (all pure functions of t) ---
  const resolveAt = (x: number) => prog(x, b8 - 0.1, a9 + 0.5, E.inOut);
  const speedAt = (x: number) => {
    let s = 0.9 + 0.08 * x;
    for (const h of hits) if (x > h) s += 0.45 + 2.6 * Math.exp(-(x - h) * 3);
    return s * (1 - 0.65 * resolveAt(x));
  };
  let travel = 0;
  for (let u = 0; u < t; u += 1 / 60) travel += speedAt(u) * Math.min(1 / 60, t - u);
  const speed = speedAt(t);
  const pulse = hits.reduce((a, h) => a + (t > h ? Math.exp(-(t - h) * 3.5) : 0), 0);
  const width = 1 + hits.reduce((a, h) => a + 0.42 * E.back(prog(t, h, h + 0.55, E.linear)), 0);
  const warm = ramp(t, [0, hits[0], hits[1], hits[2], a9, dur], [0, 0.25, 0.45, 0.65, 0.88, 1]);
  const res = resolveAt(t);
  const fadeIn = prog(t, 0, 0.4, E.out);
  const dip = prog(t, dur - 0.5, dur, E.in);

  // --- chart state ---
  const axes = prog(t, a9 - 0.5, a9 + 0.7, E.inOut);
  const labels = prog(t, a9 - 0.1, a9 + 1.1, E.out);
  const draw = prog(t, a9 + 0.55, tFour + 1.6, E.inOut);
  const callout = prog(t, tFour - 0.25, tFour + 0.55, E.out);
  const decade = prog(t, tDecade0, tDecade1, E.inOut);
  const morph = prog(t, tMorph0, tMorph1, E.inOut);

  // --- camera ---
  const sh = shake(t, hits[2], 0.09, 5);
  const riverCam: Cam = {
    pos: [Math.sin(t * 0.21) * 1.2 + sh.x, -6.3 + t * 0.08 + sh.y, 10.2 - t * 0.12],
    target: [Math.sin(t * 0.17) * 0.5, 4.2, -3.5],
    fov: 52,
    roll: 0.035 * Math.sin(t * 0.3),
  };
  const cp = prog(t, a9 - 0.8, dur, E.linear);
  const chartCam: Cam = {
    pos: [lerp(-0.8, 0.75, cp), 0.1 + 0.25 * morph, lerp(10.35, 9.55, cp)],
    target: [lerp(-0.25, 0.25, cp), 0.05 + 0.25 * morph, 0],
    fov: 45,
    roll: 0,
  };
  const cam = lerpCam(riverCam, chartCam, prog(t, b8 - 0.05, a9 + 0.75, E.inOut));

  const headYr = lerp(TREND.start, TREND.end, draw);
  const hp = project(cam, chartW(headYr, trendV(headYr), morph));
  const head: [number, number] = [(hp.x - 960) / 1080, (540 - hp.y) / 1080];

  const U = {uTravel: travel, uWidth: width, uWarm: warm, uRes: res, uDraw: draw, uGrid: labels, uMorph: morph, uPulse: Math.min(1, pulse), uFade: 1, uAxes: axes};

  return (
    <AbsoluteFill style={{background: C.void}}>
      <ShaderCanvas frag={BG} scale={0.5} uniforms={{uWarm: warm, uTravel: travel, uPulse: Math.min(1, pulse), uChart: res, uFade: 1, uHead: head}} />
      <ThreeCanvas width={1920} height={1080} camera={CAM_INIT} gl={GL} style={{position: 'absolute', inset: 0}}>
        <CameraRig cam={cam} />
        <PointCloud count={60000} seed={41} uniforms={U} body={CLOUD} />
        {res < 0.999 && <Streaks count={9000} seed={7} uniforms={{...U, uTrail: 0.05 + speed * 0.11}} body={STREAK} />}
      </ThreeCanvas>

      <Chart cam={cam} s={{on: prog(t, a9 - 0.6, a9 - 0.1), axes, labels, draw, callout, decade, morph, t}} />

      <Glyphs t={t} t0={tEmerge} out0={b8 + 0.05} warm={warm} />

      {/* kinetic keywords: each punches in from depth, then flies past camera as the next arrives */}
      {WORDS.map((wd, i) => {
        const h = hits[i];
        const next = i < 2 ? hits[i + 1] : tEmerge - 0.15;
        if (t < h - 0.06 || t > next + 0.45) return null;
        const pin = prog(t, h - 0.05, h + 0.32, E.out);
        const pout = prog(t, next - 0.04, next + 0.4, E.in);
        const scale = lerp(1.3, 1, pin) * (1 + pout * 1.4);
        const op = clamp(pin * 1.6) * (1 - pout);
        const track = lerp(0.62, 0.22, pin);
        const sweep = lerp(-20, 120, prog(t, h, h + 0.9, E.inOut));
        const ruleW = 1500 * prog(t, h - 0.02, h + 0.45, E.out);
        return (
          <AbsoluteFill key={wd.w} style={{alignItems: 'center', justifyContent: 'center', opacity: op}}>
            <div style={{position: 'absolute', top: 540 + 88, left: 960 - ruleW / 2, width: ruleW, height: 1.5, background: `linear-gradient(90deg, transparent, ${rgba(C.gold, 0.8 * (1 - pin * 0.5))}, transparent)`}} />
            <div style={{transform: `scale(${scale})`, display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -10}}>
              <div style={{fontFamily: F.mono, fontSize: 24, color: rgba(warm > 0.4 ? C.gold : C.electric, 0.9), letterSpacing: '0.3em', marginBottom: 6, paddingLeft: '0.3em'}}>{wd.tag}</div>
              <div
                style={{
                  fontFamily: F.sans,
                  fontWeight: 820,
                  fontSize: wd.size,
                  lineHeight: 1,
                  letterSpacing: `${track}em`,
                  paddingLeft: `${track}em`,
                  color: 'transparent',
                  backgroundImage: `linear-gradient(100deg, ${C.ivory} ${sweep - 22}%, #fff ${sweep - 5}%, ${C.gold} ${sweep}%, #fff ${sweep + 5}%, ${C.ivory} ${sweep + 22}%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  filter: `drop-shadow(0 0 22px ${rgba(i === 0 ? C.electric : C.ember, 0.45)}) drop-shadow(0 4px 18px rgba(0,0,0,0.7))`,
                }}
              >
                {wd.w}
              </div>
            </div>
          </AbsoluteFill>
        );
      })}

      {/* scale HUD panel: three dials that fill as each keyword lands */}
      <ScalePanel t={t} hits={hits} out0={b8 - 0.2} warm={warm} />

      <AbsoluteFill style={{background: '#000', opacity: Math.max(1 - fadeIn, dip), pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

const GL = {antialias: false, alpha: true, powerPreference: 'high-performance' as const};

// Verified micro-content: GPT-2 1.5B (Feb 2019) and GPT-3 175B (May 2020) parameters (FACTS §2).
const ScalePanel: React.FC<{t: number; hits: number[]; out0: number; warm: number}> = ({t, hits, out0, warm}) => {
  const on = prog(t, hits[0] - 0.1, hits[0] + 0.4, E.out) * (1 - prog(t, out0, out0 + 0.6, E.inOut));
  if (on <= 0) return null;
  const rows = [
    {k: 'Parameters', v: <>GPT-2 <b style={{color: C.gold, fontWeight: 500}}>1.5B</b> → GPT-3 <b style={{color: C.gold, fontWeight: 500}}>175B</b></>},
    {k: 'Training data', v: <>tokens</>},
    {k: 'Training compute', v: <>FLOP</>},
  ];
  const acc = warm > 0.4 ? C.gold : C.electric;
  return (
    <div
      style={{
        position: 'absolute',
        left: 150,
        top: 716 - (1 - on) * 14,
        width: 430,
        opacity: on,
        padding: '12px 18px 14px',
        borderRadius: 6,
        background: 'linear-gradient(160deg, rgba(24,28,40,0.6), rgba(8,10,16,0.5))',
        border: `1px solid ${rgba(acc, 0.3)}`,
        boxShadow: `0 0 24px ${rgba(acc, 0.12)}`,
      }}
    >
      <div style={{fontFamily: F.sans, fontWeight: 650, fontSize: 22, letterSpacing: '0.24em', color: rgba(C.ivory, 0.9), marginBottom: 8}}>SCALE</div>
      {rows.map((r, i) => {
        const p = prog(t, hits[i] - 0.05, hits[i] + 0.7, E.out);
        return (
          <div key={r.k} style={{marginTop: i ? 8 : 0, opacity: 0.35 + 0.65 * clamp(p * 3)}}>
            <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: F.mono, fontSize: 22, color: rgba(C.ice, 0.85)}}>
              <span style={{textTransform: 'uppercase', letterSpacing: '0.06em'}}>{r.k}</span>
              <span style={{color: rgba(C.ivory, 0.85)}}>{r.v}</span>
            </div>
            <div style={{height: 3, marginTop: 4, background: rgba(C.ice, 0.12)}}>
              <div style={{height: 3, width: `${12 + 88 * p}%`, background: `linear-gradient(90deg, ${rgba(acc, 0.4)}, ${acc})`, boxShadow: `0 0 8px ${acc}`}} />
            </div>
          </div>
        );
      })}
    </div>
  );
};



// S07 · ENEMIES. A cold storm. A lone warm light faces it; humanity's four oldest enemies condense out of dark
// dust, each on its word; the hero answers with a warm bolt that whites out the frame (S08 opens on the flash).
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {ShaderCanvas} from '../lib/ShaderCanvas';
import {ClaudeSpark} from '../lib/ClaudeSpark';
import {useScene} from '../lib/timing';
import {C, F, rgba} from '../theme';
import {E, clamp, drift, prog, ramp, rnd, shake} from '../lib/anim';
import {STORM} from './S07/storm';
import {Cam, CamSpec, GPoints, makeCamera, project, pxPerUnit, V3} from './S07/gl';
import {ASH, DISEASE, FOG, POVERTY, RAIN, SMOG, WISP} from './S07/enemies';
import {Globe} from './S07/globe';
import {BEATS, at} from './S07/beats';

// No statistics are shown in this scene (names only), so there is nothing to fact-check here.

type Enemy = {name: string; world: V3; scale: number; beat: number};
const ENEMIES: Enemy[] = [
  {name: 'DISEASE', world: [-9.6, 3.0, -10], scale: 2.1, beat: BEATS.L18.disease},
  {name: 'IGNORANCE', world: [-3.4, 5.1, -14], scale: 2.0, beat: BEATS.L18.ignorance},
  {name: 'POVERTY', world: [3.4, 5.1, -14], scale: 2.1, beat: BEATS.L18.poverty},
  {name: 'A WARMING PLANET', world: [9.6, 3.0, -10], scale: 2.0, beat: BEATS.L18.planet},
];
const HERO: V3 = [0, -0.32, 4];
const PITCH = 0.1078; // keeps the horizon ~160 px below centre

// Lightning: deterministic strobing flashes.
type Flash = {t: number; x: number; y: number; peak: number; r: number; bolt?: {x: number; top: number; bot: number}};
const strobe = (lt: number) => {
  if (lt < 0 || lt > 0.9) return 0;
  let e = Math.exp(-lt * 16);
  if (lt > 0.08) e += Math.exp(-(lt - 0.08) * 20) * 0.75;
  if (lt > 0.21) e += Math.exp(-(lt - 0.21) * 11) * 0.45;
  return e;
};

const GLYPHS = ['A', 'π', 'Ω', '∑', '?', '√', 'λ', '文', 'अ', '∞', 'ع', 'Ж', 'é', '7', 'φ', 'a', 'ß', '∫', '3', 'x', 'M', 'ψ', 'क', '字', 'R', '!', 'Σ', 'g', '9', 'θ', 'ت', 'e'];

export const S07: React.FC = () => {
  const {t, dur, cue, end} = useScene('S07');
  const l17 = cue('L17');
  const l18 = cue('L18');
  const l18e = end('L18');
  const tW = ENEMIES.map((e) => at(cue, end, 'L18', e.beat));

  // ---------- camera ----------
  const push = prog(t, 0, dur, E.inOut);
  const dr = drift(t, 0.06, 3);
  const sh = [0, 1, 2, 3].reduce(
    (a, i) => {
      const s = shake(t, tW[i] + 0.02, 0.05, 7);
      return {x: a.x + s.x, y: a.y + s.y};
    },
    {x: 0, y: 0}
  );
  const endShake = shake(t, dur - 0.34, 0.09, 5);
  const camZ = 12.6 - 1.7 * push;
  const camPos: V3 = [dr.x + sh.x + endShake.x, 0.2 + dr.y * 0.6 + sh.y + endShake.y, camZ];
  const spec: CamSpec = {pos: camPos, target: [camPos[0] * 0.6, camPos[1] + PITCH * 14, camZ - 14], fov: 40};
  const cam = makeCamera(spec);
  const toUv = (x: number, y: number): [number, number] => [(x - 960) / 1080, (540 - y) / 1080];

  const hero = project(cam, HERO);
  const horizon = project(cam, [0, camPos[1], camZ - 2000]);
  const en = ENEMIES.map((e) => {
    const p = project(cam, e.world);
    return {...p, rpx: pxPerUnit(cam, p.depth) * e.scale};
  });

  // ---------- timeline ----------
  const fade = ramp(t, [0, 0.5, 1.9, 3.2], [0, 0.42, 0.5, 1], E.inOut);
  const gather = prog(t, l18 - 0.2, tW[0], E.inOut);
  const heroDraw = prog(t, l17 - 0.15, l17 + 1.4, E.out);
  const charge = prog(t, l18e - 0.3, dur - 0.42, E.inOut);
  const warm = prog(t, dur - 0.42, dur - 0.05, E.linear);
  const whiteout = prog(t, dur - 0.28, dur - 0.03, E.in);
  const rvl = tW.map((w) => t - w);
  const shown = rvl.map((r) => prog(r, -0.25, 0.9, E.out));

  // ---------- lightning ----------
  const flashes: Flash[] = [];
  let tt = 0.7;
  for (let k = 0; tt < dur - 0.6; k++) {
    const calm = tt < 2.2 ? 0.28 : tt < l18 ? 0.7 : 1;
    const near = tW.some((w) => Math.abs(tt - w) < 0.45);
    if (!near)
      flashes.push({
        t: tt,
        x: (rnd(`fx${k}`) - 0.5) * 1.5,
        y: 0.1 + rnd(`fy${k}`) * 0.24,
        peak: (0.35 + rnd(`fp${k}`) * 0.55) * calm,
        r: 0.16 + rnd(`fr${k}`) * 0.14,
        bolt: rnd(`fb${k}`) > 0.72 && tt > 2.4 ? {x: (rnd(`fx${k}`) - 0.5) * 1.5, top: 0.36, bot: horizon.visible ? toUv(0, horizon.y)[1] + 0.01 : -0.15} : undefined,
      });
    tt += 0.9 + rnd(`ft${k}`) * 1.5;
  }
  en.forEach((p, i) => {
    const [x, y] = toUv(p.x, p.y);
    flashes.push({t: tW[i] - 0.06, x, y: y + 0.06, peak: 1.5, r: 0.26, bolt: {x: x + (i % 2 ? 0.05 : -0.05), top: 0.37, bot: y - 0.02}});
  });
  const live = flashes
    .map((f) => ({f, i: strobe(t - f.t) * f.peak}))
    .filter((a) => a.i > 0.003)
    .sort((a, b) => b.i - a.i);
  const L = [0, 1, 2].map((k) => (live[k] ? [live[k].f.x, live[k].f.y, live[k].i, live[k].f.r] : [0, 0, 0, 0.2]));
  const bolts = live.filter((a) => a.f.bolt && t - a.f.t < 0.35).slice(0, 2);
  const B = [0, 1].map((k) => (bolts[k] ? [bolts[k].f.bolt!.x, bolts[k].f.bolt!.top, bolts[k].f.bolt!.bot, Math.min(1.2, bolts[k].i)] : [0, 0, 0, 0]));
  const flashTotal = live.reduce((s, a) => s + a.i, 0);
  const localFl = en.map((p, i) => strobe(t - (tW[i] - 0.06)) * 1.2);

  const [hx, hy] = toUv(hero.x, hero.y);
  const eU = en.map((p, i) => {
    const [x, y] = toUv(p.x, p.y);
    const back = shown[i] * (0.55 + 0.25 * Math.sin(t * 2.3 + i)) + localFl[i] * 0.8 + gather * 0.12;
    return [x, y, back, (p.rpx / 1080) * 1.5];
  });

  const uniforms = {
    uFade: fade,
    uCam: [camPos[0] / 14, 0, (12.6 - camZ) * 0.22],
    uHero: [hx, hy, heroDraw * (0.85 + 0.15 * Math.sin(t * 3.1)), charge],
    uL0: L[0],
    uL1: L[1],
    uL2: L[2],
    uB0: B[0],
    uB1: B[1],
    uE0: eU[0],
    uE1: eU[1],
    uE2: eU[2],
    uE3: eU[3],
    uFog: shown[1],
    uWarm: warm,
    uHz: horizon.visible ? toUv(0, horizon.y)[1] : -0.15,
  };

  const eu = (i: number) => ({uT: t, uRv: rvl[i], uG: gather, uFl: localFl[i] + flashTotal * 0.15, uS: ENEMIES[i].scale, uC: ENEMIES[i].world as number[]});
  const heroSize = 50 + 18 * charge + 10 * warm;

  return (
    <AbsoluteFill style={{background: C.void}}>
      <ShaderCanvas frag={STORM} uniforms={uniforms} scale={0.5} />

      {/* IGNORANCE: glyphs of knowledge spiralling into the fog (under the fog particles) */}
      {shown[1] > 0.001 && (
        <AbsoluteFill style={{pointerEvents: 'none'}}>
          {GLYPHS.map((g, i) => {
            const period = 3.4;
            const ph = (((rnd(`gp${i}`) + (t - tW[1] + 0.3) / period) % 1) + 1) % 1;
            const R0 = en[1].rpx * 1.05;
            const r = R0 * (1.08 - 0.95 * ph);
            const a = rnd(`ga${i}`) * Math.PI * 2 + t * (0.5 + 1.6 * ph);
            const op = clamp(ph / 0.14) * (1 - clamp((ph - 0.5) / 0.4)) * shown[1];
            const size = 24 + rnd(`gs${i}`) * 18;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: en[1].x + Math.cos(a) * r,
                  top: en[1].y + Math.sin(a) * r * 0.55,
                  transform: `translate(-50%,-50%) scale(${1 - 0.45 * ph}) rotate(${(a * 30) % 360}deg)`,
                  fontFamily: i % 3 === 0 ? F.mono : F.serif,
                  fontSize: size,
                  color: rgba(C.ice, 0.85),
                  opacity: op,
                  textShadow: `0 0 10px ${rgba(C.electric, 0.35)}`,
                }}
              >
                {g}
              </div>
            );
          })}
        </AbsoluteFill>
      )}

      <ThreeCanvas width={1920} height={1080} style={{position: 'absolute', inset: 0}} gl={{antialias: false}}>
        <Cam spec={spec} />
        <GPoints count={2600} seed={71} body={ASH} uniforms={{uT: t, uAsh: fade, uFlash: flashTotal * 0.3}} />
        {shown[3] > 0.001 && (
          <Globe
            radius={ENEMIES[3].scale * 0.98}
            position={ENEMIES[3].world}
            u={{uT: t, uSmog: 1, uClean: 0, uHalo: 0, uOpacity: prog(rvl[3], 0.05, 0.8, E.out), uSpin: t * 0.12, uSun: [-0.6, 0.5, 0.6], uLights: 0}}
          />
        )}
        {gather > 0 && (
          <>
            <GPoints count={9000} seed={11} body={DISEASE} uniforms={eu(0)} />
            <GPoints count={1400} seed={12} body={FOG} uniforms={eu(1)} blending="normal" sprite="soft" />
            <GPoints count={2600} seed={13} body={WISP} uniforms={eu(1)} />
            <GPoints count={4900} seed={14} body={POVERTY} uniforms={eu(2)} />
            <GPoints count={4200} seed={15} body={SMOG} uniforms={eu(3)} />
          </>
        )}
        <GPoints count={18000} seed={72} body={RAIN} uniforms={{uT: t, uHero: HERO as number[], uCharge: charge + warm, uRain: clamp(fade * 1.2), uFlash: flashTotal * 0.3}} />
      </ThreeCanvas>

      {/* enemy names, in cold steel */}
      {en.map((p, i) => {
        const s = shown[i];
        if (s <= 0.001) return null;
        const slam = prog(rvl[i], -0.02, 0.55, E.out);
        const glint = ramp(rvl[i], [0, 0.9], [-40, 140], E.inOut);
        const track = 0.62 - 0.3 * slam;
        const long = ENEMIES[i].name.length > 10;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: p.y + p.rpx * (i === 3 ? 1.3 : 1.12) + 8,
              transform: `translate(-50%, 0) scale(${1.22 - 0.22 * slam})`,
              opacity: clamp(rvl[i] / 0.12) * (1 - whiteout),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{fontFamily: F.mono, fontSize: 22, letterSpacing: '0.3em', color: rgba(C.cold, 0.9), marginBottom: 8}}>
              {`0${i + 1} / 04`}
            </div>
            <div
              style={{
                fontFamily: F.sans,
                fontWeight: 800,
                fontSize: long ? 34 : 40,
                letterSpacing: `${track}em`,
                paddingLeft: `${track}em`,
                color: 'transparent',
                backgroundImage: `linear-gradient(100deg, ${C.ice} ${glint - 30}%, #FFFFFF ${glint - 6}%, ${C.ice} ${glint + 4}%, #8FA3B8 ${glint + 40}%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                filter: `drop-shadow(0 2px 10px rgba(0,0,0,0.9))`,
                lineHeight: 1,
              }}
            >
              {ENEMIES[i].name}
            </div>
            <div style={{width: 60 + 120 * slam, height: 1.5, marginTop: 14, background: `linear-gradient(90deg, transparent, ${rgba(C.ice, 0.7)}, transparent)`}} />
          </div>
        );
      })}

      {/* the hero: small, warm, alone */}
      {heroDraw > 0.001 && (
        <div style={{position: 'absolute', left: hero.x - heroSize / 2, top: hero.y - heroSize / 2}}>
          <ClaudeSpark size={heroSize} draw={heroDraw} glow={0.9 + charge * 0.8} rotate={t * (5 + 40 * charge)} pulse={0.5 + 0.5 * Math.sin(t * 4)} />
        </div>
      )}

      {/* the hero's warm strike whites out the frame; S08 decays from it */}
      {whiteout > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at ${(hero.x / 19.2).toFixed(1)}% ${(hero.y / 10.8).toFixed(1)}%, #FFFBF2 0%, ${C.gold} ${20 + 80 * whiteout}%, ${rgba(C.ember, 0.9)} 100%)`,
            opacity: whiteout,
          }}
        />
      )}
      {whiteout > 0.6 && <AbsoluteFill style={{background: '#FFF7EA', opacity: prog(whiteout, 0.6, 1, E.in)}} />}
    </AbsoluteFill>
  );
};

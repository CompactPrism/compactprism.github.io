import React from 'react';
import {AbsoluteFill, Audio, Sequence, getStaticFiles, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C} from './theme';
import {ensureFonts} from './fonts';
import {TIMING, sceneById} from './lib/timing';
import {SCENES} from './scenes';
import {Caption, Grain, Letterbox, Vignette} from './lib/FilmFX';
import {ChapterCard} from './lib/ChapterCard';
import {E, prog} from './lib/anim';

ensureFonts();

// Letterbox amount (1 = 2.39:1 bars, 0 = open frame) at a global frame.
// The bars retract during S09 as the curve goes vertical: the frame literally opens up.
export const letterboxAt = (g: number, fps: number) => {
  const s9 = sceneById('S09');
  const l23 = s9.lines.find((l) => l.id === 'L23')!;
  const openStart = (s9.start + l23.start) / fps + 0.2;
  const tt = g / fps;
  if (g < s9.start) return 1;
  if (g >= s9.start + s9.duration) return 0;
  return 1 - prog(tt, openStart, openStart + 1.6, E.inOut);
};

const captionAt = (g: number, fps: number) => {
  for (const s of TIMING.scenes) {
    for (const l of s.lines) {
      const a = l.globalStart - 3;
      const b = l.globalStart + l.duration + Math.round(0.35 * fps);
      if (g >= a && g < b) {
        const op = Math.min(1, (g - a) / 5, (b - g) / 6);
        return {text: l.text, op};
      }
    }
  }
  return null;
};

// Everything that sits on top of the picture, driven by the GLOBAL frame.
export const Overlays: React.FC<{g: number}> = ({g}) => {
  const {fps} = useVideoConfig();
  const lb = letterboxAt(g, fps);
  const cap = captionAt(g, fps);
  const sc = TIMING.scenes.find((s) => g >= s.start && g < s.start + s.duration);
  return (
    <>
      {sc && <ChapterCard sceneId={sc.id} t={(g - sc.start) / fps} />}
      <Vignette strength={0.5} />
      <Grain amount={0.085} />
      <Letterbox amount={lb} />
      {cap && <Caption text={cap.text} opacity={cap.op} />}
    </>
  );
};

const hasAudio = () => getStaticFiles().some((f) => f.name === 'audio/master.wav');

export const Film: React.FC = () => {
  const g = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: C.void}}>
      {TIMING.scenes.map((s) => {
        const Comp = SCENES[s.id];
        return (
          <Sequence key={s.id} from={s.start} durationInFrames={s.duration} name={`${s.id} ${s.name}`}>
            <Comp />
          </Sequence>
        );
      })}
      <Overlays g={g} />
      {hasAudio() && <Audio src={staticFile('audio/master.wav')} />}
    </AbsoluteFill>
  );
};

// A single scene with the same finishing layers, for fast iteration: composition ids S01..S11.
export const makeSceneComp = (id: string) => {
  const Comp = SCENES[id];
  const s = sceneById(id);
  const SceneComp: React.FC = () => {
    const f = useCurrentFrame();
    return (
      <AbsoluteFill style={{background: C.void}}>
        <Comp />
        <Overlays g={s.start + f} />
      </AbsoluteFill>
    );
  };
  return SceneComp;
};

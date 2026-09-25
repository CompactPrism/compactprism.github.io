// Scene timing, generated from the voiceover by scripts/build-timing.mjs. NEVER hard-code absolute
// times for VO-driven beats: use cue()/end() so the choreography follows the voice if it changes.
import {useCurrentFrame, useVideoConfig} from 'remotion';
import timing from '../timing.json';

export type Line = {
  id: string;
  text: string;
  start: number; // frames, relative to scene start
  duration: number;
  globalStart: number;
  startS: number;
  durationS: number;
};
export type SceneT = {
  id: string;
  name: string;
  start: number;
  duration: number;
  letterbox: number;
  lines: Line[];
};

export const TIMING = timing as unknown as {
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  totalSeconds: number;
  scenes: SceneT[];
};

export const sceneById = (id: string) => {
  const s = TIMING.scenes.find((x) => x.id === id);
  if (!s) throw new Error('Unknown scene ' + id);
  return s;
};

// Inside a scene component: const {t, dur, cue, end} = useScene('S03');
//   t      current time in seconds (scene-relative)
//   dur    scene length in seconds
//   cue(L) second at which VO line L starts; end(L) second at which it ends
export const useScene = (id: string) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = sceneById(id);
  const line = (lid: string) => {
    const l = s.lines.find((x) => x.id === lid);
    if (!l) throw new Error(`Line ${lid} not in scene ${id}`);
    return l;
  };
  return {
    t: frame / fps,
    frame,
    fps,
    dur: s.duration / fps,
    cue: (lid: string) => line(lid).start / fps,
    end: (lid: string) => (line(lid).start + line(lid).duration) / fps,
    lines: s.lines,
  };
};

import React from 'react';
import {Composition} from 'remotion';
import {Film, makeSceneComp} from './Film';
import {TIMING} from './lib/timing';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={TIMING.totalFrames} fps={TIMING.fps} width={1920} height={1080} />
    {TIMING.scenes.map((s) => (
      <Composition key={s.id} id={s.id} component={makeSceneComp(s.id)} durationInFrames={s.duration} fps={TIMING.fps} width={1920} height={1080} />
    ))}
  </>
);

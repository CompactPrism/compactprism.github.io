import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, F} from '../theme';
import {useScene, sceneById} from './timing';

// Temporary stand-in used until a scene is built.
export const makePlaceholder = (id: string) => {
  const P: React.FC = () => {
    const {t, dur} = useScene(id);
    const s = sceneById(id);
    return (
      <AbsoluteFill style={{background: C.ink, alignItems: 'center', justifyContent: 'center', color: C.mute, fontFamily: F.mono, fontSize: 36}}>
        {id} {s.name} · {t.toFixed(1)} / {dur.toFixed(1)}s
      </AbsoluteFill>
    );
  };
  return P;
};

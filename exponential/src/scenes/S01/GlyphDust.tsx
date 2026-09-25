// Title-to-dust: samples the real glyph ink of the DOM title (same font, size, tracking) into points,
// then releases them in a left-to-right wave, lets them drift, and collapses them into one point.
// Fully deterministic: the sample depends only on the font; motion is a closed-form function of time.
import React, {useLayoutEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import type {} from '@react-three/fiber';
import {continueRender, delayRender} from 'remotion';

export type GlyphSample = {pts: Float32Array; count: number; boxW: number; boxH: number};

type Css = {family: string; weight: number; size: number; spacingEm: number};

const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Returns glyph points in px, relative to the centre of the DOM text box (the box includes the
// trailing letter-spacing and a matching paddingLeft, exactly like the title element).
export const useGlyphSample = (text: string, css: Css, step = 2): GlyphSample | null => {
  const [res, setRes] = useState<GlyphSample | null>(null);
  const [handle] = useState(() => delayRender('S01: sampling title glyphs'));
  useLayoutEffect(() => {
    const font = `${css.weight} ${css.size}px ${css.family}`;
    let cancelled = false;
    document.fonts
      .load(font, text)
      .then(() => {
        if (cancelled) return;
        const ls = css.spacingEm * css.size;
        const div = document.createElement('div');
        Object.assign(div.style, {
          position: 'absolute',
          left: '-99999px',
          top: '0px',
          fontFamily: css.family,
          fontWeight: String(css.weight),
          fontSize: `${css.size}px`,
          letterSpacing: `${ls}px`,
          paddingLeft: `${ls}px`,
          lineHeight: '1',
          whiteSpace: 'nowrap',
        });
        div.textContent = text;
        document.body.appendChild(div);
        const boxW = div.offsetWidth;
        const boxH = div.offsetHeight;
        const mark = document.createElement('span');
        Object.assign(mark.style, {display: 'inline-block', width: '0px', height: '0px', verticalAlign: 'baseline'});
        div.appendChild(mark);
        const baseline = mark.offsetTop;
        document.body.removeChild(div);

        const pad = 24;
        const W = Math.ceil(boxW + pad * 2);
        const H = Math.ceil(boxH + pad * 2);
        const cnv = document.createElement('canvas');
        cnv.width = W;
        cnv.height = H;
        const ctx = cnv.getContext('2d', {willReadFrequently: true})!;
        ctx.font = font;
        (ctx as unknown as {letterSpacing: string}).letterSpacing = `${ls}px`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#fff';
        ctx.fillText(text, pad + ls, pad + baseline);
        const img = ctx.getImageData(0, 0, W, H).data;
        const out: number[] = [];
        let k = 0;
        for (let y = 0; y < H; y += step) {
          for (let x = 0; x < W; x += step) {
            const a = img[(y * W + x) * 4 + 3];
            if (a > 100) {
              out.push(x - pad - boxW / 2 + (hash(k) - 0.5) * step, y - pad - boxH / 2 + (hash(k + 0.5) - 0.5) * step);
              k++;
            }
          }
        }
        setRes({pts: new Float32Array(out), count: out.length / 2, boxW, boxH});
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return res;
};

type Props = {
  sample: GlyphSample;
  t: number;
  t0: number; // release wave start (s)
  wave: number; // wave duration across the word (s)
  anchor: [number, number, number]; // world pos of the title box centre
  unit: number; // world units per title px
  coll: number; // 0..1 collapse progress
  target: [number, number, number];
};

const VERT = /* glsl */ `
uniform float uT, uT0, uWave, uUnit, uColl, uBoxW;
uniform vec3 uAnchor, uTarget;
attribute vec2 aP; attribute vec4 aS;
varying vec3 vColor; varying float vAlpha;
void main(){
  float xn = aP.x / uBoxW + .5;
  float tr = uT0 + xn * uWave + aS.x * .10;
  float age = uT - tr;
  vec3 base = uAnchor + vec3(aP.x, -aP.y, 0.) * uUnit;
  vec3 pos = base;
  float alpha = 0.;
  vec3 col = vec3(1., .96, .9);
  if (age > 0.) {
    vec3 v = vec3(.45 + aS.y * .8, .18 + (aS.z - .5) * .9, (aS.w - .5) * 2.2);
    float a = 1. - exp(-age * 2.2);
    pos += v * a * 1.1 + v * age * .25;
    pos.x += sin(age * 2.3 + aS.z * 20.) * .05 * a;
    pos.y += cos(age * 1.9 + aS.w * 17.) * .05 * a;
    alpha = smoothstep(0., .04, age) * (.65 + .6 * exp(-age * 2.5)) * (.65 + .35 * sin(age * 9. + aS.z * 30.));
    col = mix(vec3(1., .93, .8), mix(vec3(1., .8, .5), vec3(.95, .56, .38), aS.y), clamp(age * 1.2, 0., 1.)) * 1.2;
  }
  float k = clamp(uColl * 1.35 - aS.x * .35, 0., 1.);
  k = k * k * k;
  vec3 rel = pos - uTarget;
  float sw = k * 2.2;
  rel.xy = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * rel.xy;
  pos = uTarget + rel * (1. - k);
  alpha *= 1. - .3 * k;
  vec4 mv = modelViewMatrix * vec4(pos, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (2.2 + aS.w * 2.6) * (8.5 / max(.001, -mv.z));
  vColor = col; vAlpha = alpha;
}`;

const FRAG = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main(){ vec2 c = gl_PointCoord - .5; float d = length(c);
  float a = exp(-d * d * 18.) * vAlpha; if (a < .003) discard;
  gl_FragColor = vec4(vColor * a, a); }`;

export const GlyphDust: React.FC<Props> = ({sample, t, t0, wave, anchor, unit, coll, target}) => {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = sample.count;
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n * 4; i++) seeds[i] = hash(i * 1.37 + 11);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aP', new THREE.BufferAttribute(sample.pts, 2));
    g.setAttribute('aS', new THREE.BufferAttribute(seeds, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [sample]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uT: {value: 0},
          uT0: {value: 0},
          uWave: {value: 1},
          uUnit: {value: 0.01},
          uColl: {value: 0},
          uBoxW: {value: sample.boxW},
          uAnchor: {value: new THREE.Vector3()},
          uTarget: {value: new THREE.Vector3()},
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
      }),
    [sample]
  );
  const u = material.uniforms;
  u.uT.value = t;
  u.uT0.value = t0;
  u.uWave.value = wave;
  u.uUnit.value = unit;
  u.uColl.value = coll;
  (u.uAnchor.value as THREE.Vector3).set(...anchor);
  (u.uTarget.value as THREE.Vector3).set(...target);
  return <points geometry={geometry} material={material} frustumCulled={false} />;
};

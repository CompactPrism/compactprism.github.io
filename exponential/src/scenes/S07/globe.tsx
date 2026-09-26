// A lit GLSL planet shared by S07 (the WARMING PLANET enemy, choked in bruise smog) and S08 (the same
// planet cleared to calm blue with a warm halo). Ray-lit sphere mesh + an additive atmosphere shell.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {GMesh, V3} from './gl';

const VERT = /* glsl */ `
varying vec3 vN; varying vec3 vObj; varying vec3 vW; varying float vCamD;
void main(){
  vObj = position;
  vCamD = length(cameraPosition - (modelMatrix * vec4(0., 0., 0., 1.)).xyz) / length((modelMatrix * vec4(1., 0., 0., 0.)).xyz);
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vObj; varying vec3 vW; varying float vCamD;
float fbmG(vec3 p){ return snoise(p) * .5 + snoise(p * 2.03 + 17.1) * .25 + snoise(p * 4.1 + 31.7) * .125; }
void main(){
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(uSun);
  vec3 sp = normalize(vObj);
  sp.xz = rot(uSpin) * sp.xz;
  float c = fbmG(sp * 1.6 + 4.) + .06 * snoise(sp * 7.);
  float land = smoothstep(.05, .11, c);
  land = max(land, smoothstep(.8, .4, acos(clamp(dot(normalize(vObj), normalize(uClr.xyz)), -1., 1.))) * step(0., uClr.w));
  float ndl = dot(n, L);
  float diff = clamp(ndl, 0., 1.);
  float night = 1. - smoothstep(-.12, .22, ndl);
  float clr0 = smoothstep(uClr.w, uClr.w - .35, acos(clamp(dot(normalize(vObj), normalize(uClr.xyz)), -1., 1.)));
  float cln = max(uClean, clr0);
  vec3 ocean = mix(vec3(.04, .05, .065), vec3(.02, .10, .27), cln);
  vec3 landc = mix(vec3(.10, .095, .10), mix(vec3(.08, .17, .09), vec3(.30, .26, .17), smoothstep(.15, .45, c)), cln);
  vec3 col = mix(ocean, landc, land) * (diff * 1.3 + .025);
  vec3 Hh = normalize(L + V);
  col += vec3(1., .9, .78) * pow(max(dot(n, Hh), 0.), 50.) * (1. - land) * .55 * cln * diff;
  if (cln > .01) {
    float cl = smoothstep(.15, .6, fbmG(sp * 3.2 + vec3(uT * .03, 0., 0.)) + .1);
    col = mix(col, vec3(.88, .9, .94) * (diff * .95 + .02), cl * .5 * cln);
  }
  // warm lights of the connected world (night side)
  if (uLights * night > .01) {
    float grid = smoothstep(.55, .95, snoise(sp * 24.) * .6 + snoise(sp * 7.) * .6);
    col += vec3(1., .66, .36) * grid * land * night * uLights * 1.4;
  }
  // smog with rising heat shimmer
  float smogA = uSmog * (1. - clr0);
  if (smogA > .005) {
    vec3 sh = sp + .05 * vec3(1., .6, 0.) * snoise(sp * 8. + vec3(0., uT * 1.7, 0.));
    float sm = fbmG(sh * 2.3 + vec3(0., -uT * .15, uT * .06)) * .5 + .5;
    float smog = clamp(smogA * (smoothstep(.25, .7, sm) + .45), 0., .96);
    vec3 smogC = mix(vec3(.13, .07, .17), vec3(.40, .24, .44), sm) * (.25 + diff * .95);
    col = mix(col, smogC, smog);
  }
  // atmosphere at the limb
  float fr = pow(1. - max(dot(n, V), 0.), 2.4);
  vec3 atmo = mix(vec3(.46, .26, .52) * uSmog, mix(vec3(.32, .58, 1.), vec3(1., .74, .44), uHalo), cln);
  col += atmo * fr * ((1. - night) * .9 + .3 + uHalo * .5) * smoothstep(1.25, 2.2, vCamD);
  gl_FragColor = vec4(col * uOpacity, uOpacity);
}`;

const ATMO_VERT = /* glsl */ `
varying float vZ;
void main(){
  vec3 nv = normalize(normalMatrix * normal);
  vZ = nv.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;
const ATMO_FRAG = /* glsl */ `
varying float vZ;
void main(){
  float g = pow(clamp(-vZ * 1.9, 0., 1.), 2.2);
  vec3 atmo = mix(vec3(.46, .26, .52) * uSmog, mix(vec3(.32, .58, 1.), vec3(1., .72, .42), uHalo) * uClean, uClean);
  gl_FragColor = vec4(atmo * g * uOpacity * 1.1, 0.);
}`;

export type GlobeU = {
  uT: number;
  uSmog: number; // 0..1 bruise smog
  uClean: number; // 0..1 calm blue, clouds, specular
  uHalo: number; // 0..1 warm halo tint of the atmosphere
  uOpacity: number;
  uSpin: number;
  uSun: V3;
  uLights: number; // warm night-side lights
  uClr?: number[]; // smog clearing: direction xyz (object space) + angular radius (rad)
};

export const Globe: React.FC<{u: GlobeU; radius: number; position: V3; rotation?: V3}> = ({u, radius, position, rotation = [0.3, 0, 0.2]}) => {
  const geo = useMemo(() => new THREE.SphereGeometry(1, 128, 80), []);
  const uni = {...u, uSun: u.uSun as number[], uClr: u.uClr ?? [0, 1, 0, -1]};
  return (
    <>
      <GMesh geometry={geo} vert={VERT} frag={FRAG} uniforms={uni} transparent position={position} rotation={rotation} scale={radius} renderOrder={2} />
      <GMesh geometry={geo} vert={ATMO_VERT} frag={ATMO_FRAG} uniforms={{uSmog: u.uSmog, uClean: u.uClean, uHalo: u.uHalo, uOpacity: u.uOpacity}} additive depthWrite={false} side="back" position={position} scale={radius * 1.16} renderOrder={3} />
    </>
  );
};

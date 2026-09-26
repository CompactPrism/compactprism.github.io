// "A country of geniuses in a datacenter": ~10k instanced towers with procedural flickering window-lights
// (each a mind), a street grid carrying light traffic, and a sky whose haze doubles as atmospheric fog.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import type {} from '@react-three/fiber';
import {Cam, camBasis} from '../S04/cam';
import {PILLAR, CV} from './curve';

const mulberry = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const f = (n: number) => n.toFixed(4);
const PX = f(PILLAR[0]);
const PZ = f(PILLAR[2]);

// Shared by sky, ground and towers: warm city haze near the horizon, deep night above.
const SKY = /* glsl */ `
uniform float uCity; uniform vec3 uCamPos; uniform float uBoost;
vec3 skyCol(vec3 d){
  float el = d.y;
  vec3 zen = vec3(.006, .008, .02);
  vec3 hor = mix(vec3(.025, .028, .04), vec3(.15, .066, .04), uCity);
  float hz = exp(-max(el, 0.) * 8.);
  vec3 c = mix(zen, hor, hz);
  vec2 pd = normalize(vec2(${PX}, ${PZ}) - uCamPos.xz + 1e-3);
  vec2 dd = normalize(d.xz + 1e-5);
  float toward = pow(max(dot(dd, pd), 0.), 5.);
  c += vec3(.32, .15, .07) * toward * hz * (.25 + .75 * uCity);
  if (el < 0.) c = mix(hor, hor * .7, clamp(-el * 3., 0., 1.));
  return c * (1. + uBoost);
}
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

const TOWER_V = /* glsl */ `
varying vec3 vW; varying vec3 vN; varying vec3 vL; varying float vSeed;
void main(){
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.);
  vW = w.xyz; vN = normal; vL = position;
  vec3 o = instanceMatrix[3].xyz;
  vSeed = fract(sin(dot(o.xz, vec2(12.9898, 78.233))) * 43758.5453);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const TOWER_F = /* glsl */ `
uniform float uTime; uniform float uIgn; uniform float uFog;
varying vec3 vW; varying vec3 vN; varying vec3 vL; varying float vSeed;
${SKY}
void main(){
  vec3 V = vW - cameraPosition; float dist = length(V);
  float dp = length(vW.xz - vec2(${PX}, ${PZ}));
  float on = smoothstep(uIgn, uIgn - 70., dp);
  float front = exp(-pow((dp - uIgn) / 22., 2.)) * step(1., uIgn);
  vec3 col;
  if (vN.y > .5) {
    vec2 e = abs(vL.xz) * 2.;
    float rim = smoothstep(.88, 1., max(e.x, e.y));
    col = vec3(.008, .008, .011) + vec3(.9, .45, .2) * rim * (.08 + .14 * on) + vec3(.42, .58, .8) * rim * .06;
    float led = step(.93, h21(floor(vW.xz * .5) + vSeed * 91.));
    col += vec3(1., .7, .4) * led * on * (.5 + .5 * sin(uTime * 3. + vSeed * 50.)) * .5;
  } else {
    // server racks: 1.5-unit bays, a status LED + activity bar every .5 units, light seams between bays and floors
    float along = abs(vN.x) > .5 ? vW.z : vW.x;
    vec2 cell = vec2(along / 1.5, vW.y / .5);
    vec2 id = floor(cell); vec2 fr = fract(cell);
    vec2 fw2 = fwidth(cell);
    float fw = max(fw2.x, fw2.y);
    float detail = 1. - smoothstep(.3, .9, fw);
    float h = h21(id + vSeed * 137.);
    float h2 = h21(id.yx * 1.3 + vSeed * 17.);
    float led = smoothstep(.22, .1, length((fr - vec2(.18, .5)) * vec2(1.6, 1.)));
    float bar = step(.36, fr.x) * step(fr.x, .36 + .52 * h2) * step(.4, fr.y) * step(fr.y, .6);
    float active = step(.28, h);
    float fl = .55 + .45 * sin(uTime * (1. + h * 7.) + h * 60.);
    float blink = step(.5, fract(uTime * (.6 + 2.5 * h2) + h));
    float ledOn = active * mix(fl, blink, step(.75, h2));
    float px = led * ledOn + bar * active * .5 * fl;
    float light = mix(.16, px, detail);
    float seamX = 1. - smoothstep(0., .05 + fw2.x, min(fr.x, 1. - fr.x));
    float fy = vW.y / 6.; float fyf = fract(fy);
    float seamY = 1. - smoothstep(0., .015 + fwidth(fy), min(fyf, 1. - fyf));
    float seams = mix(.08, max(seamX * .3, seamY), detail);
    vec3 ledC = mix(vec3(1., .6, .26), vec3(1., .86, .56), h2);
    ledC = mix(ledC, vec3(.55, .84, 1.), step(.94, h));
    ledC = mix(ledC, vec3(1.), step(.985, h));
    col = vec3(.007, .007, .01);
    col += ledC * light * (2.8 * on + .05);
    col += vec3(1., .48, .2) * seams * (.4 * on + .012);
    float e = abs(vN.x) > .5 ? abs(vL.z) : abs(vL.x);
    col += vec3(.42, .58, .8) * smoothstep(.465, .5, e) * (.1 + .12 * on);
    col += vec3(1., .78, .5) * front * (.25 + .8 * px);
    col += vec3(.8, .36, .15) * exp(-vW.y * .3) * .14 * on;
  }
  float fog = 1. - exp(-dist * uFog);
  col = mix(col * (1. + uBoost), skyCol(normalize(V)), fog);
  gl_FragColor = vec4(col, 1.);
}`;

const GROUND_V = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const GROUND_F = /* glsl */ `
uniform float uTime; uniform float uIgn; uniform float uFog; uniform float uDraw;
varying vec3 vW;
${SKY}
void main(){
  vec3 V = vW - cameraPosition; float dist = length(V);
  vec2 p = (vW.xz + 5.) / 10.;
  vec2 fr = fract(p); vec2 dd = min(fr, 1. - fr);
  vec2 fw = fwidth(p);
  float sx = 1. - smoothstep(.035, .035 + fw.x * 1.5, dd.x);
  float sz = 1. - smoothstep(.035, .035 + fw.y * 1.5, dd.y);
  float detail = 1. - smoothstep(.2, .6, max(fw.x, fw.y));
  float street = mix(.07, max(sx, sz), detail);
  float dp = length(vW.xz - vec2(${PX}, ${PZ}));
  float on = smoothstep(uIgn, uIgn - 70., dp);
  // traffic: light packets running along the streets
  vec2 cid = floor(p);
  float tx = step(.82, fract(vW.x * .025 - uTime * (1.2 + 2. * h21(vec2(cid.y, 3.))) + h21(vec2(cid.y, 9.)))) * sz;
  float tz = step(.82, fract(vW.z * .025 + uTime * (1.2 + 2. * h21(vec2(cid.x, 5.))) + h21(vec2(cid.x, 1.)))) * sx;
  float traffic = mix(.03, max(tx, tz), detail);
  vec3 col = vec3(.006, .006, .008);
  col += vec3(.75, .36, .16) * street * .16 * on + vec3(1., .78, .5) * traffic * .9 * on;
  // light pooled under the curve along the avenue, and around the pillar's base
  float u = clamp((${f(CV.Z0)} - vW.z) / ${f(CV.L)}, 0., 1.);
  float yc = ${f(CV.Y0)} + ${f(CV.H)} * (exp(${f(CV.k)} * u) - 1.) / ${f(Math.exp(CV.k) - 1)};
  float drawn = step(u, uDraw) * step(vW.z, ${f(CV.Z0)});
  col += vec3(1., .5, .22) * drawn * exp(-(vW.x * vW.x) / (30. + yc * yc * .8)) * .5 / (1. + yc * .06);
  col += vec3(1., .55, .25) * exp(-dp / 45.) * .35 * step(.98, uDraw);
  float fog = 1. - exp(-dist * uFog);
  col = mix(col * (1. + uBoost), skyCol(normalize(V)), fog);
  gl_FragColor = vec4(col, 1.);
}`;

const SKY_V = /* glsl */ `
varying vec2 vP;
void main(){ vP = position.xy; gl_Position = vec4(position.xy, .99999, 1.); }`;
const SKY_F = /* glsl */ `
uniform vec3 uR; uniform vec3 uU; uniform vec3 uF; uniform float uTan; uniform float uAsp; uniform float uTime;
varying vec2 vP;
${SKY}
void main(){
  vec3 d = normalize(uF + vP.x * uTan * uAsp * uR + vP.y * uTan * uU);
  vec3 col = skyCol(d);
  if (d.y > 0.) {
    vec2 sp = d.xz / (d.y + .25) * 90.;
    vec2 id = floor(sp); vec2 fr = fract(sp) - .5;
    float h = h21(id);
    float st = step(.985, h) * smoothstep(.12, 0., length(fr)) * (.6 + .4 * sin(uTime * 2. + h * 90.));
    col += vec3(.8, .85, 1.) * st * smoothstep(.02, .3, d.y) * .5;
  }
  gl_FragColor = vec4(col, 1.);
}`;

type Props = {cam: Cam; t: number; ign: number; city: number; draw: number; boost: number};

export const City: React.FC<Props> = ({cam, t, ign, city, draw, boost}) => {
  const towers = useMemo(() => {
    const r = mulberry(90210);
    const m = new THREE.Matrix4();
    const mats: THREE.Matrix4[] = [];
    const CELL = 10;
    for (let ix = -52; ix <= 52; ix++) {
      for (let iz = -150; iz <= 5; iz++) {
        const x = ix * CELL;
        const z = iz * CELL;
        const a = r(), b = r(), c = r(), d = r(), e = r();
        const dp = Math.hypot(x - PILLAR[0], z - PILLAR[2]);
        if (Math.abs(x) < 18 && z > PILLAR[2] - 10) continue; // the avenue the curve runs along
        if (dp < 34) continue; // plaza round the pillar
        if (a < (iz < -95 ? 0.4 : 0.1)) continue;
        const w = CELL * 0.74;
        const dd = CELL * (c < 0.25 ? 0.74 : 0.74);
        let h = 3 + 19 * Math.pow(d, 2.3);
        h *= 1 + 2.3 * Math.exp(-dp / 190);
        if (e > 0.985) h *= 2.1;
        m.makeScale(w, h, dd);
        m.setPosition(x, 0, z);
        mats.push(m.clone());
      }
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    return {geo, mats};
  }, []);

  const mats = useMemo(() => {
    const common = {uTime: {value: 0}, uIgn: {value: 0}, uFog: {value: 0.0019}, uCity: {value: 0}, uCamPos: {value: new THREE.Vector3()}, uBoost: {value: 0}};
    const tower = new THREE.ShaderMaterial({uniforms: {...common}, vertexShader: TOWER_V, fragmentShader: TOWER_F});
    const ground = new THREE.ShaderMaterial({uniforms: {...common, uDraw: {value: 0}}, vertexShader: GROUND_V, fragmentShader: GROUND_F});
    const sky = new THREE.ShaderMaterial({
      uniforms: {...common, uR: {value: new THREE.Vector3()}, uU: {value: new THREE.Vector3()}, uF: {value: new THREE.Vector3()}, uTan: {value: 1}, uAsp: {value: 16 / 9}},
      vertexShader: SKY_V,
      fragmentShader: SKY_F,
      depthTest: false,
      depthWrite: false,
    });
    return {tower, ground, sky};
  }, []);

  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(towers.geo, mats.tower, towers.mats.length);
    towers.mats.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    return im;
  }, [towers, mats]);

  const {r, u, f: fw} = camBasis(cam);
  for (const m of [mats.tower, mats.ground, mats.sky]) {
    m.uniforms.uTime.value = t;
    m.uniforms.uIgn.value = ign;
    m.uniforms.uCity.value = city;
    m.uniforms.uBoost.value = boost;
    (m.uniforms.uCamPos.value as THREE.Vector3).set(...cam.pos);
  }
  mats.ground.uniforms.uDraw.value = draw;
  (mats.sky.uniforms.uR.value as THREE.Vector3).set(...r);
  (mats.sky.uniforms.uU.value as THREE.Vector3).set(...u);
  (mats.sky.uniforms.uF.value as THREE.Vector3).set(...fw);
  mats.sky.uniforms.uTan.value = Math.tan((cam.fov * Math.PI) / 360);

  return (
    <>
      <mesh material={mats.sky} renderOrder={-10} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <mesh material={mats.ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -500]} renderOrder={-5}>
        <planeGeometry args={[4000, 3200]} />
      </mesh>
      <primitive object={mesh} />
    </>
  );
};

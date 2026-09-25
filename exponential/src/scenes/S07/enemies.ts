// Vertex bodies for the four enemies of S07. Every enemy begins as a swirl of dark dust around its centre
// (uG = gathering 0..1) and condenses into its form when revealed (uRv = seconds since its word, <0 before).
// uFl = local lightning intensity (lights the particles up), uS = scale, uC = centre (world).
export const ENEMY_U = {uT: 0, uRv: -9, uG: 0, uFl: 0, uS: 1, uC: [0, 0, 0] as number[]};

const CONVERGE = /* glsl */ `
  vec3 rel0 = (aSeed.xyz - .5) * vec3(3.2, 2.4, 2.4) * uS;
  rel0.xz = rot(uT * (.35 + aSeed2.z * .35)) * rel0.xz;
  rel0 *= mix(1.25, .7, uG);
  vec3 scat = uC + rel0 + curl(rel0 * .35 + uT * .12) * .35 * uS;
  float k = clamp((uRv + .22 - aSeed2.w * .5) / .75, 0., 1.);
  k = 1. - pow(1. - k, 3.);
  float dustA = (.07 + .1 * uG) * (1. - k) * step(.45, aSeed2.z);
`;

// DISEASE: three spiked virions with RNA-like tangles, toxic green-grey, rim-lit.
export const DISEASE = /* glsl */ `
  ${CONVERGE}
  float vir = aSeed2.y < .6 ? 0. : (aSeed2.y < .84 ? 1. : 2.);
  float R = vir < .5 ? 1. : (vir < 1.5 ? .52 : .38);
  vec3 off = vir < .5 ? vec3(0.) : (vir < 1.5 ? vec3(-1.2, -.8, -.6) : vec3(1.1, .95, -.9));
  float cls = aSeed2.x;
  float zz = aSeed.x * 2. - 1.; float aa = aSeed.y * TAU;
  vec3 dir = vec3(sqrt(1. - zz * zz) * cos(aa), zz, sqrt(1. - zz * zz) * sin(aa));
  vec3 tg; float br = 1.; vec3 nrm = dir;
  if (cls < .58) {
    tg = dir * R * (1. + .06 * snoise(dir * 3. + uT * .4));
  } else if (cls < .9) {
    float id = floor(aSeed.z * 24.);
    vec3 sd = fib(id, 24.);
    float u = aSeed.w;
    tg = sd * R * (1. + .42 * u);
    if (u > .8) tg += (hash31(aIndex) - .5) * .12 * R;
    nrm = sd; br = .7 + u * .9;
  } else {
    float s = aSeed.w * TAU * 2.;
    float id = floor(aSeed.z * 3.);
    tg = R * 1.35 * vec3(sin(s * 1.3 + id * 2.1), sin(s * 1.7 + id) * .8, cos(s * .9 + id * 1.3));
    tg += curl(tg * 1.2 + id) * .12;
    br = .45;
  }
  float sp = uT * (.22 + vir * .12) + vir;
  tg.xz = rot(sp) * tg.xz; nrm.xz = rot(sp) * nrm.xz;
  tg.yz = rot(.35) * tg.yz; nrm.yz = rot(.35) * nrm.yz;
  vec3 target = uC + (off + tg) * uS;
  pos = mix(scat, target, k);
  vec3 Vd = normalize(cameraPosition - pos);
  float rim = 1. - abs(dot(normalize(nrm), Vd));
  float lit = (cls < .58 ? (.22 + 1.2 * pow(rim, 2.2)) : br) * (1. + uFl * 2.5);
  vec3 cA = vec3(.49, .60, .42), cB = vec3(.74, .80, .64);
  color = mix(mix(cA, cB, rim * rim), vec3(.34, .42, .40), cls > .9 ? .6 : 0.);
  size = (cls < .58 ? 3.0 : 3.4) * uS;
  alpha = mix(dustA, .34 * lit * (1. - .8 * clamp((uRv - .2) / .8, 0., 1.)), k);
  color = mix(vec3(.55, .6, .66), color, k);
`;

// POVERTY: a tilted grid of lights fractured into drifting shards; many lights flicker and die.
export const POVERTY = /* glsl */ `
  ${CONVERGE}
  float N = 70.;
  float gi = mod(aIndex, N), gj = floor(aIndex / N);
  vec2 uv = (vec2(gi, gj) / (N - 1.) - .5) * 2.8;
  float d1 = 9., d2 = 9., id = 0.; vec2 cc = vec2(0.);
  for (int s = 0; s < 8; s++) {
    vec2 sc = (hash31(float(s) * 7.13 + 1.).xy - .5) * 2.8;
    float dd = length(uv - sc);
    if (dd < d1) { d2 = d1; d1 = dd; id = float(s); cc = sc; } else if (dd < d2) { d2 = dd; }
  }
  float edge = d2 - d1;
  vec3 hs = hash31(id * 3.7 + 2.);
  float frac = clamp(uRv * .5, 0., 1.);
  vec3 tg = vec3(uv.x, 0., uv.y);
  tg.xz += cc * .12 * frac;
  tg.y -= (hs.x - .3) * .35 * frac;
  tg.xy = rot((hs.y - .5) * .25 * frac) * tg.xy;
  tg.yz = rot(-1.05) * tg.yz;
  tg.xz = rot(.28 + uT * .05) * tg.xz;
  vec3 target = uC + tg * uS * .85;
  pos = mix(scat, target, k);
  float cell = hash13(vec3(gi, gj, 3.));
  float on = step(cell, .62);
  float fl = .55 + .45 * sin(uT * (4. + hs.z * 9.) + cell * 40.);
  float die = smoothstep(hs.z * 2.2 + .4, hs.z * 2.2 + 1.8, uRv);
  float crack = smoothstep(.035, .075, edge);
  float lip = 1. - smoothstep(.075, .16, edge);
  float lum = (on * fl * mix(1., .12, die) + .18 + lip * .5) * crack;
  color = mix(vec3(.28, .34, .44), vec3(.74, .84, .96), on * (1. - die));
  size = (2.6 + on * 1.4) * uS;
  alpha = mix(dustA, .34 * lum * (1. + uFl * 2.) * (1. - .85 * clamp((uRv - .2) / .8, 0., 1.)), k);
  color = mix(vec3(.55, .6, .66), color, k);
`;

// IGNORANCE: occluding dark fog (normal blending) swirling into a vortex.
export const FOG = /* glsl */ `
  ${CONVERGE}
  float r = pow(aSeed.x, .6) * 1.15;
  float a = aSeed.y * TAU + uT * (.55 / (r + .35));
  vec3 tg = vec3(cos(a) * r, (aSeed.z - .5) * .9 * (1.2 - r * .4), sin(a) * r * .45);
  tg += curl(tg * .8 + uT * .15) * .18;
  vec3 target = uC + tg * uS;
  pos = mix(scat, target, k);
  color = vec3(.006, .008, .012);
  size = (26. + aSeed.w * 34.) * uS;
  alpha = .3 * k * smoothstep(1.25, .45, r);
  occ = 1.;
`;

// IGNORANCE wisps: faint cold filaments being pulled in.
export const WISP = /* glsl */ `
  ${CONVERGE}
  float r = mix(1.35, .2, fract(aSeed.x + uT * .18));
  float a = aSeed.y * TAU + uT * (.8 / (r + .25));
  vec3 tg = vec3(cos(a) * r, (aSeed.z - .5) * .5, sin(a) * r * .45);
  vec3 target = uC + tg * uS;
  pos = mix(scat, target, k);
  color = vec3(.55, .66, .82);
  size = 3.2 * uS;
  alpha = mix(dustA, .2 * smoothstep(.25, .9, r) * (1. + uFl * 2.), k);
`;

// WARMING PLANET: bruise smog shell swirling around the globe (the globe itself is a mesh).
export const SMOG = /* glsl */ `
  ${CONVERGE}
  float zz = aSeed.x * 2. - 1.; float aa = aSeed.y * TAU + uT * (.25 + aSeed.w * .2);
  vec3 dir = vec3(sqrt(1. - zz * zz) * cos(aa), zz, sqrt(1. - zz * zz) * sin(aa));
  float rr = .93 + pow(aSeed.w, 2.) * .42;
  vec3 tg = dir * rr + curl(dir * 2. + uT * .2) * .08;
  tg.y += fract(aSeed.z + uT * .12) * .25 * (rr - 1.);
  vec3 target = uC + tg * uS;
  pos = mix(scat, target, k);
  color = mix(vec3(.36, .22, .42), vec3(.52, .30, .50), aSeed2.x);
  size = (3. + aSeed2.y * 5.) * uS;
  alpha = mix(dustA, .12 * (1. + uFl * 2.), k);
`;

// Rain streaks: 6 points per streak, falling on a slant, warm-tinted near the hero.
export const RAIN = /* glsl */ `
  float sIdx = floor(aIndex / 6.);
  float kk = mod(aIndex, 6.) / 5.;
  vec3 h = hash31(sIdx * 1.37 + .5);
  float h4 = hash11(sIdx * 7.31 + .2);
  float z = mix(-18., 9.5, h.z);
  float x = (h.x - .5) * (26. + (9.5 - z) * 1.1);
  float speed = 10. + 6. * h4;
  float fall = mod(uT * speed + h.y * 14., 14.);
  vec3 dir = normalize(vec3(-.3, -1., .05));
  pos = vec3(x + 4., 11., z) + dir * (fall + kk * .55);
  float near = smoothstep(-18., 4., z);
  size = 1.1 + near * .9;
  alpha = sin(kk * PI) * (.08 + .17 * near) * uRain * smoothstep(-1.2, 0., pos.y);
  float wd = length(pos - uHero);
  float w = exp(-wd * wd / (2.2 + 4. * uCharge)) * (.6 + uCharge * 1.6);
  color = mix(vec3(.62, .72, .86), vec3(1., .72, .45), clamp(w, 0., 1.));
  alpha *= 1. + w * 3. + uFlash * 1.5;
`;

// Ash / bokeh dust: slow drifting motes, a few big soft ones near the lens.
export const ASH = /* glsl */ `
  vec3 p0 = (aSeed.xyz - .5) * vec3(30., 12., 26.) + vec3(0., 3., -4.);
  p0 += curl(p0 * .08 + uT * .05) * 1.2;
  p0.x += mod(uT * (.4 + aSeed.w * .4) + aSeed2.x * 30., 30.) - 15.;
  p0.y -= uT * .15 * aSeed2.y;
  pos = p0;
  float near = step(.94, aSeed2.z);
  if (near > .5) pos = vec3((aSeed.x - .5) * 7., (aSeed.y - .5) * 3.2 + .3, 8.5 + aSeed.z * 2.);
  size = mix(1.4 + aSeed.w * 1.4, 18. + aSeed.w * 22., near);
  color = mix(vec3(.55, .63, .75), vec3(.6, .66, .76), near);
  alpha = mix(.18, .035, near) * uAsh * (1. + uFlash);
`;

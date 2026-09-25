// PointCloud bodies for S05 (GLSL, three.js ShaderMaterial on WebGL2 => GLSL ES 3.00 syntax is fine).

// Cold ground grid: the vast dark world the team sits in. The campfire warms the dots around it.
export const GROUND = /* glsl */ `
  float ix = mod(aIndex, 150.);
  float iz = floor(aIndex / 150.);
  vec3 P = vec3((ix - 75.) * .42 + (aSeed.x - .5) * .06, uGy, 6. - iz * .5);
  P.y += snoise(vec3(P.xz * .16, uTime * .06)) * .05;
  pos = P;
  float dist = length(P.xz - uFireXZ.xy);
  float w = exp(-dist * dist / 3.2) * uFireXZ.z;
  color = mix(vec3(.30, .38, .50), vec3(.96, .58, .38), clamp(w, 0., 1.));
  float far = smoothstep(-44., -8., P.z) * smoothstep(7., 3.5, P.z);
  alpha = uGround * far * (.16 + .55 * aSeed.y * aSeed.y + 1.1 * w);
  size = 1.25 + .6 * aSeed.z + 1.2 * w;
`;

// Floating dust: gives depth; big soft points near the camera read as bokeh.
export const DUST = /* glsl */ `
  vec3 P = vec3((aSeed.x - .5) * 22., (aSeed.y - .5) * 11., mix(-18., 8.5, aSeed.z));
  P += vec3(sin(uTime * .07 + aSeed.w * 6.), cos(uTime * .05 + aSeed2.x * 6.), 0.) * .35;
  P.x += uTime * .04 * (aSeed2.y - .3);
  pos = P;
  vec4 mvq = modelViewMatrix * vec4(P, 1.);
  float dz = -mvq.z;
  color = mix(vec3(.55, .66, .80), vec3(.96, .70, .48), clamp(uWarmD + (aSeed2.z - .5) * .3, 0., 1.));
  float near = smoothstep(4., .8, dz);
  size = (1.3 + 2.2 * aSeed2.w) * (1. + near * 4.) * clamp(dz / 1.2, .15, 1.);
  alpha = uDust * (.1 + .25 * aSeed2.y) * (1. - near * .75) * smoothstep(.3, .9, dz);
`;

// THE REVEAL: tens of thousands of particles converge from everywhere into the 12-ray starburst
// (same ray table as ClaudeSpark), then split into absorbed / burst / orbiting sparks after ignition.
export const HERO_PTS = /* glsl */ `
  float RA[12] = float[12](0., 31., 58., 91., 119., 148., 181., 209., 238., 269., 299., 329.);
  float RL[12] = float[12](1., .8, .95, .74, .98, .82, .93, .76, 1., .79, .9, .72);
  int ri = int(min(11., floor(aSeed.y * 12.)));
  float u = pow(aSeed.z, .8);
  float along = 5.5 + (50. - 5.5 - 2.) * RL[ri] * u;
  float ang = radians(RA[ri] - 90.);
  float halfw = mix(7.4 * RL[ri] * .5, 1.9, u);
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 tp = dir * along + nrm * (aSeed.w * 2. - 1.) * halfw * .95;
  if (aSeed2.x < .1) { float rr = sqrt(aSeed2.y) * 6.; float aa = aSeed2.z * TAU; tp = vec2(cos(aa), sin(aa)) * rr; }
  vec3 T = vec3(tp.x, -tp.y, (aSeed2.w - .5) * 3.) * (uSz / 100.);
  T.xy = rot(radians(uRotE)) * T.xy;

  // start: a huge shell around the scene (some behind the camera, they rush past)
  float ph = aSeed.x * TAU;
  float ct = aSeed2.y * 2. - 1.;
  float st = sqrt(1. - ct * ct);
  vec3 S = vec3(cos(ph) * st, ct * .6, sin(ph) * st) * (6. + 16. * aSeed2.z);
  S.z = min(S.z, 5. + 7. * aSeed.w);

  float delay = aSeed2.w * .55 + aSeed.z * .12;
  float l = clamp((uConv - delay * .5) / .5, 0., 1.);
  float e = l * l * (3. - 2. * l);
  vec3 P = mix(S, T, e);
  float sw = (1. - e) * 2.6;
  P.xy = rot(sw) * P.xy;
  P += curl(P * .18 + aSeed.xyz * 3.) * (1. - e) * 1.4;

  // after ignition
  float kind = aSeed2.x; // <.62 absorbed, <.84 burst, else orbit
  vec3 outd = normalize(vec3(T.xy, T.z * .2) + vec3(0., 0., .001)) ;
  if (kind > .62 && kind < .84) {
    P += outd * uBurst * (.6 + 1.6 * aSeed.w) + vec3(0., 0., (aSeed.x - .5) * uBurst * 1.2);
  }
  if (kind >= .84) {
    float fam = floor(aSeed.w * 3.);
    float ro = 1.25 + 1.5 * aSeed.z;
    float a0 = aSeed.x * TAU + uTime * (.9 / ro) * (fam == 1. ? -1. : 1.);
    vec3 O = vec3(cos(a0) * ro, 0., sin(a0) * ro * .35);
    O.yz = rot(.35 + fam * .5) * O.yz;
    O.xy = rot(fam * 1.9 + .3) * O.xy;
    P = mix(P, O, smoothstep(0., 1., uPost));
  }
  pos = P;

  vec4 mvq = modelViewMatrix * vec4(P, 1.);
  float dz = -mvq.z;
  vec3 coldC = mix(vec3(.50, .78, 1.), vec3(.72, .80, .87), aSeed.w);
  vec3 warmC = mix(vec3(.93, .54, .37), vec3(.96, .76, .48), aSeed.z);
  color = mix(coldC, warmC, smoothstep(.2, .85, e)) ;
  color = mix(color, vec3(1., .93, .82), smoothstep(.9, 1., e) * .5 * (1. - uPost));
  float fadeIn = smoothstep(0., .12, l) * uOn;
  float post = kind < .62 ? (1. - smoothstep(0., .25, uPost)) : (kind < .84 ? (1. - smoothstep(.1, 1., uPost)) : 1.);
  alpha = fadeIn * post * (.35 + .5 * e) ;
  size = (1.2 + 1.8 * aSeed2.y) * (1. + (1. - e) * 1.2) * clamp(dz / 2.5, .15, 1.);
  if (kind >= .84) { size *= 1. + uPost * .8; alpha *= 1. + uPost * .6; }
`;

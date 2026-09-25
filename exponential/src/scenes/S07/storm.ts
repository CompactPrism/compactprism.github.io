// S07 cold storm: a perspective cloud deck (domain-warped fbm) receding to the horizon, lit from inside by
// lightning (density-weighted scattering + a directional "silver lining" term), a wet ground plane that
// reflects the flashes and the hero's warm light, per-enemy backlights, the IGNORANCE fog vortex, and the
// hero's final warm bolt. All positions are screen uv (y up, centred, / height).
export const STORM = /* glsl */ `
uniform float uFade;
uniform vec3 uCam;      // x pan, y unused, z travel
uniform vec4 uHero;     // xy pos, z intensity, w charge
uniform vec4 uL0; uniform vec4 uL1; uniform vec4 uL2; // lightning: xy, intensity, radius
uniform vec4 uB0; uniform vec4 uB1;                   // visible bolts: x0, yTop, yBottom, strength
uniform vec4 uE0; uniform vec4 uE1; uniform vec4 uE2; uniform vec4 uE3; // enemies: xy, backlight, radius
uniform float uFog;     // ignorance fog strength
uniform float uWarm;    // hero's warm bolt (0..1)
uniform float uHz;      // horizon y

float fbm3v(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++){ s += a * vnoise(p); p = rot(.5) * p * 2.03 + 11.7; a *= .5; } return s / .875; }
vec3 tm(vec3 c){ return 1. - exp(-c * 1.12); }

float boltX(float y, float seed){
  return (vnoise(vec2(y * 9., seed)) - .5) * .11 + (vnoise(vec2(y * 34., seed + 3.1)) - .5) * .035;
}
vec3 bolt(vec2 p, vec4 b, float seed){
  if (b.w < .01 || p.y > b.y || p.y < b.z) return vec3(0.);
  float x = b.x + boltX(p.y, seed) + (b.y - p.y) * .06;
  float d = abs(p.x - x);
  float taper = smoothstep(b.z, b.z + .05, p.y) * .7 + .3;
  return (vec3(.85, .92, 1.) * smoothstep(.0045, .0, d) * 1.6 + vec3(.45, .6, .85) * exp(-d * 70.) * .35) * b.w * taper;
}
float lamp(vec2 p, vec4 L){
  if (L.z < .001) return 0.;
  vec2 q = (p - L.xy) * vec2(.8, 1.25);
  return L.z * exp(-dot(q, q) / (L.w * L.w));
}
vec3 enemyLight(vec2 p, vec4 E, vec3 col, float d){
  if (E.z < .001) return vec3(0.);
  vec2 q = p - E.xy;
  float r = length(q);
  return col * E.z * exp(-r * r / (E.w * E.w)) * (.35 + 1.3 * d);
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 p = (fc - .5 * uRes) / uRes.y;
  if (abs(p.y) > .38) { fragColor = vec4(0., 0., 0., 1.); return; }
  float t = uTime;
  vec3 col = vec3(0.);
  float h = p.y - uHz;
  float d = .5;
  vec3 ICE = vec3(.62, .74, .92);

  float Lsum = lamp(p, uL0) + lamp(p, uL1) + lamp(p, uL2);

  if (h > 0.) {
    // ---- cloud deck in perspective ----
    float dist = .40 / (h + .03);
    vec2 cp = vec2((p.x + uCam.x) * dist * 1.25, dist + uCam.z);
    vec2 q = vec2(fbm3v(cp * .45 + vec2(0., t * .05)), fbm3v(cp * .45 + vec2(5.2, 1.3) - vec2(t * .04, 0.)));
    vec2 wp = cp * .8 + q * 2.6 + vec2(t * .09, -t * .03);
    d = fbm2(wp);
    float thick = smoothstep(.32, .72, d);
    // brighter where thin (light from above leaks through), dark and heavy where thick
    vec3 hiC = vec3(.085, .10, .13);
    vec3 loC = vec3(.003, .004, .009);
    col = mix(hiC, loC, thick);
    // billow ridges: a second look at the density for rolling structure
    float ridge = 1. - abs(fbm3v(wp * 2.1 + 3.) * 2. - 1.);
    col += vec3(.05, .06, .08) * pow(ridge, 4.) * (1. - thick * .7);
    // distance haze towards the horizon (cold, faintly lit band)
    float haze = 1. - exp(-dist * .22);
    col = mix(col, vec3(.05, .062, .085), haze * .75);
    // lightning: scattered inside the cloud mass
    if (Lsum > .002) {
      vec2 dir = normalize(uL0.xy - p + 1e-4);
      float d2 = fbm2(wp + vec2(dir.x, -dir.y) * .12);
      float lining = clamp((d - d2) * 5. + .45, 0., 1.4);
      col += ICE * Lsum * (.05 + 2.6 * pow(d, 3.) + .9 * pow(lining, 2.) * (1. - thick * .5));
    }
    // hero warm light on the cloud bases above it (grows with charge)
    vec2 hq = (p - uHero.xy) * vec2(.55, 1.);
    float hl = exp(-dot(hq, hq) * (9. - 6. * uHero.w));
    col += vec3(.95, .55, .32) * hl * (uHero.z * .03 + uHero.w * .22) * (.3 + d);
  } else {
    // ---- wet ground plane ----
    float gd = .16 / (-h + .008);
    vec2 gp = vec2((p.x + uCam.x * .6) * gd * 1.3, gd + uCam.z * 1.4);
    float g = fbm3v(gp * vec2(1.1, 2.6));
    float rip = (g - .5) * .05;
    col = vec3(.010, .012, .018) * (.55 + .9 * g);
    float fres = exp(h * 9.);
    // reflections of the flashes (mirrored about the horizon, rippled)
    vec2 pr = vec2(p.x + rip, 2. * uHz - p.y);
    float Lr = lamp(pr, uL0) + lamp(pr, uL1) + lamp(pr, uL2);
    col += ICE * Lr * (.12 + .25 * fres) * (.6 + .8 * g);
    col += vec3(.06, .075, .1) * fres * .6;
    // hero: pool of light on the ground + long reflection streak
    float hy = uHero.y - .045;
    float gdh = .16 / (-(hy - uHz) + .008);
    vec2 gph = vec2((uHero.x + uCam.x * .6) * gdh * 1.3, gdh + uCam.z * 1.4);
    vec2 dg = (gp - gph) * vec2(1., .55);
    float pool = exp(-dot(dg, dg) * 6.);
    float streak = exp(-abs(p.x + rip * 1.4 - uHero.x) * 55.) * smoothstep(uHero.y + .01, uHero.y - .03, p.y);
    float warmI = uHero.z * (1. + 1.8 * uHero.w);
    col += vec3(.95, .5, .3) * warmI * (pool * .16 + streak * (.10 + .2 * g) * exp((p.y - uHz) * 4.));
  }

  // visible bolts
  col += bolt(p, uB0, 3.7) + bolt(p, uB1, 8.3);
  // sky-wide flash lift
  col += vec3(.05, .06, .08) * (uL0.z + uL1.z + uL2.z) * .18;

  // enemy backlights (cold) and the planet's sick bruise glow with heat shimmer
  col += enemyLight(p, uE0, vec3(.30, .40, .34), d);
  col += enemyLight(p, uE1, vec3(.28, .34, .46), d);
  col += enemyLight(p, uE2, vec3(.30, .38, .52), d);
  if (uE3.z > .001) {
    vec2 q = p - uE3.xy;
    float r = length(q);
    float a = atan(q.y, q.x);
    float shim = (vnoise(vec2(a * 5. + 3., r * 26. - t * 3.2)) - .5) * .035 * smoothstep(.0, uE3.w * .8, r);
    float rr = r + shim;
    float ring = exp(-pow((rr - uE3.w * .62) / (uE3.w * .16), 2.));
    col += vec3(.36, .20, .42) * uE3.z * (exp(-rr * rr / (uE3.w * uE3.w)) * (.35 + d) + ring * .55);
  }

  // IGNORANCE: a dark fog vortex that eats the light
  if (uFog > .001) {
    vec2 q = p - uE1.xy;
    float r = length(q);
    float R = uE1.w * .95;
    if (r < R * 1.6) {
      float a = atan(q.y, q.x);
      vec2 sp = vec2(cos(a - t * .5 + 2. / (r + .06) * .12), sin(a - t * .5 + 2. / (r + .06) * .12)) * (r * 6.) + vec2(0., -t * .15);
      float n = fbm3v(sp + 7.);
      float mask = smoothstep(R * 1.35, R * .1, r + (n - .5) * R * .7);
      col = mix(col, vec3(.004, .005, .008), clamp(mask * uFog * 1.05, 0., .97));
      col += vec3(.22, .28, .38) * uFog * .09 * exp(-pow((r - R * 1.05) / (R * .12), 2.)) * n;
    }
  }

  // hero glow (the emblem itself is drawn on top in the DOM)
  float hr = length((p - uHero.xy) * vec2(1., 1.));
  col += vec3(.96, .62, .38) * uHero.z * (.012 / (hr + .012)) * .22 * (1. + 1.5 * uHero.w);

  // the hero strikes back: a warm bolt climbing from the emblem into the storm
  if (uWarm > .001) {
    float top = uHero.y + .62 * clamp(uWarm * 1.6, 0., 1.);
    if (p.y > uHero.y && p.y < top) {
      float x = uHero.x + boltX(p.y * 1.3, 12.1) * .8 + (p.y - uHero.y) * .02;
      float dd = abs(p.x - x);
      col += (vec3(1., .93, .8) * smoothstep(.006, .0, dd) * 2.2 + vec3(1., .6, .32) * exp(-dd * 45.) * .7) * smoothstep(0., .2, uWarm);
    }
    col += vec3(1., .82, .58) * uWarm * uWarm * (.6 + 1.2 * d) * exp(-length(p - uHero.xy) * 1.2);
  }

  col = tm(col * uFade);
  fragColor = vec4(col + dither(fc), 1.);
}
`;

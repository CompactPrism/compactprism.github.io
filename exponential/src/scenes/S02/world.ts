// S02 world constants + the full-screen GLSL that renders the cold filament of history,
// its glossy floor reflection, haze and the warm glint at the end.
import {GLSL_CAM} from './cam';

// World layout (units are arbitrary; the floor is y = 0, the timeline runs along +X at z = 0).
export const YL = 0.08; // the line hugs the floor
export const X0 = -5; // where the point from S01 sits (deep prehistory)
export const NODE_X = [0, 3.4, 6.8, 10.2]; // writing, press, electricity, computer
export const XLIFT = 10.7; // the line starts (barely) lifting here
export const XEND = 14.2; // the present: the warm glint
export const LIFT = 0.62;
export const KL = 1.25;
export const XFAR = -320; // the deep past (fades into haze)

export const lineY = (x: number) => YL + LIFT * Math.max(0, Math.exp((x - XEND) / KL) - Math.exp((XLIFT - XEND) / KL));

const f = (n: number) => n.toFixed(4);

export const WORLD_FRAG = /* glsl */ `
${GLSL_CAM}
uniform float uXL; uniform float uXR; uniform float uLineI; uniform float uTipI;
uniform float uX0; uniform float uPointI; uniform vec3 uPointCol;
uniform float uIgn[4]; uniform float uIgnT[4];
uniform float uGlint; uniform float uPush; uniform float uEnv; uniform float uWake;

const float YL = ${f(YL)};
const float XLIFT = ${f(XLIFT)};
const float XEND = ${f(XEND)};
const float LIFT = ${f(LIFT)};
const float KL = ${f(KL)};
const float NX[4] = float[4](${NODE_X.map(f).join(',')});

float lineY(float x){ return YL + LIFT * max(0., exp((x - XEND) / KL) - exp((XLIFT - XEND) / KL)); }

// closest approach between a ray and a segment: (distance, ray param, x on segment)
vec3 raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b){
  vec3 ba = b - a; vec3 w = ro - a;
  float bb = dot(ba, ba), bd = dot(ba, rd), wd = dot(w, rd), wb = dot(w, ba);
  float den = max(bb - bd * bd, 1e-6);
  float h = clamp((wb - bd * wd) / den, 0., 1.);
  float s = max(dot(a + ba * h - ro, rd), 1e-3);
  h = clamp(dot(ro + rd * s - a, ba) / bb, 0., 1.);
  vec3 q = a + ba * h;
  return vec3(length(ro + rd * s - q), s, mix(a.x, b.x, h));
}

// glow of a point light seen along a ray (angular falloff, world-size core)
float pglow(vec3 ro, vec3 rd, vec3 p, float r, float pix, float rough){
  vec3 op = p - ro; float s = dot(op, rd); if (s < .01) return 0.;
  float dA = length(op - rd * s) / s;
  float w = max(r / s, pix) * (1. + rough * 2.5);
  return exp(-dA * dA / (w * w)) * 1.2 + exp(-dA / (w * 5.)) * .22 + exp(-dA / (w * 22.)) * .05;
}

// Everything that emits light, seen along a ray. rough > 0 widens it (glossy reflection).
vec3 emit(vec3 ro, vec3 rd, float rough, float pix){
  vec3 col = vec3(0.);
  float xr = min(uXR, XEND);
  if (xr > uXL + 1e-3 && uLineI > 0.) {
    float xa = min(xr, XLIFT);
    vec3 r = raySeg(ro, rd, vec3(uXL, YL, 0.), vec3(max(xa, uXL + 1e-3), YL, 0.));
    float best = r.x / r.y; float bs = r.y; float bx = r.z;
    if (xr > XLIFT) {
      for (int i = 0; i < 5; i++) {
        float x1 = mix(XLIFT, xr, float(i) / 5.), x2 = mix(XLIFT, xr, float(i + 1) / 5.);
        vec3 r2 = raySeg(ro, rd, vec3(x1, lineY(x1), 0.), vec3(x2, lineY(x2), 0.));
        float d2 = r2.x / r2.y;
        if (d2 < best) { best = d2; bs = r2.y; bx = r2.z; }
      }
    }
    float wc = max(.012 / bs, pix * .9) * (1. + rough * 4.);
    float wh = max(.11 / bs, pix * 3.) * (1. + rough * 1.5);
    float core = exp(-best * best / (wc * wc));
    float halo = exp(-best / wh);
    float scat = exp(-best / (wh * 7.));
    // intensity along the line: the deep past fades, slow crawling pulses, wakes behind each ignition
    float fx = smoothstep(-300., -25., bx);
    float crawl = .78 + .3 * pow(.5 + .5 * sin(bx * 1.1 - uTime * .7), 8.);
    float wake = 0.;
    for (int i = 0; i < 4; i++) {
      float front = NX[i] + max(uTime - uIgnT[i], 0.) * .9;
      float on = step(uIgnT[i], uTime) * step(NX[i], bx);
      wake += on * smoothstep(front, front - .6, bx) * exp(-(bx - NX[i]) * .35) * .55;
      wake += on * exp(-pow((bx - front) * 3.5, 2.)) * .9 * exp(-(uTime - uIgnT[i]) * .5);
    }
    float fog = exp(-bs * .016);
    float warm = smoothstep(XEND - 2.2, XEND, bx) * uGlint;
    vec3 lc = mix(COL_ICE, mix(COL_EMBER, COL_GOLD, .6), warm);
    float I = uLineI * fx * fog * (crawl + wake * uWake);
    col += lc * I * (core * 1.25 + halo * .38 + scat * .07);
    // hot heads while the line is being drawn out of the point
    col += COL_ICE * uTipI * (pglow(ro, rd, vec3(uXL, YL, 0.), .02, pix, rough) + pglow(ro, rd, vec3(xr, lineY(xr), 0.), .02, pix, rough));
  }
  // milestone nodes
  for (int i = 0; i < 4; i++) {
    if (uIgn[i] > .001) col += mix(COL_ICE, COL_IVORY, .5) * uIgn[i] * pglow(ro, rd, vec3(NX[i], YL, 0.), .035, pix, rough);
  }
  // the point from S01 (warm cooling to ice)
  if (uPointI > .001) col += uPointCol * uPointI * pglow(ro, rd, vec3(uX0, YL, 0.), .012, pix, rough);
  // the warm glint at the present
  if (uGlint > .001) {
    vec3 gp = vec3(XEND, lineY(XEND), 0.);
    col += mix(COL_CORAL, COL_GOLD, .55) * uGlint * pglow(ro, rd, gp, .028, pix, rough) * 1.4;
  }
  return col;
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = (fc - .5 * uRes) / uRes.y;
  vec3 ro = uCamPos; vec3 rd = camRay(fc);
  float pix = 1. / (uRes.y * uFocal);

  // --- sky: deep night, faint cold horizon haze, very high thin veils
  float el = rd.y;
  vec3 sky = mix(vec3(.010, .013, .022), vec3(.003, .004, .007), smoothstep(-.02, .32, el));
  float az = atan(rd.x, -rd.z);
  float veil = fbm(vec3(az * 2.2, el * 9., uTime * .02)) * .5 + .5;
  sky += COL_COLD * .018 * veil * smoothstep(.3, .0, el);
  sky += COL_COLD * .07 * exp(-abs(el) * 26.) * uEnv;
  vec3 col = sky;

  // --- glassy floor
  if (rd.y < 0.) {
    float sF = -ro.y / rd.y;
    vec3 hp = ro + rd * sF;
    vec2 q = hp.xz;
    float n1 = snoise(vec3(q.x * .35, q.y * 1.1, 2.3));
    float n2 = snoise(vec3(q.x * 1.7, q.y * 3.1, 5.1));
    vec3 nrm = normalize(vec3(n1 * .010 + n2 * .004, 1., n2 * .010));
    vec3 rr = reflect(rd, nrm);
    float cosI = max(dot(-rd, nrm), 0.);
    float fres = .035 + .965 * pow(1. - cosI, 5.);
    float rough = .35 + .25 * (n1 * .5 + .5);
    vec3 refl = emit(hp, rr, rough, pix);
    // cold light spill from the filament onto the glass
    float inX = smoothstep(uXL - .8, uXL + .8, hp.x) * smoothstep(min(uXR, XEND) + .8, min(uXR, XEND) - .8, hp.x);
    float spill = uLineI * inX * smoothstep(-300., -25., hp.x) / (1. + hp.z * hp.z * 6.);
    vec3 base = vec3(.005, .007, .011) * (1. + .5 * n1);
    vec3 fl = base + COL_COLD * spill * .045 + refl * (fres * .85 + .05);
    // distance haze towards the horizon
    float fogA = 1. - exp(-sF * .028);
    col = mix(fl, sky + COL_STEEL * .06 * uEnv, fogA);
  }

  // --- direct light
  col += emit(ro, rd, 0., pix);

  // --- anamorphic streak through the warm glint (cinema lens)
  vec3 gp = vec3(XEND, lineY(XEND), 0.);
  vec2 g = camProject(gp);
  float front = step(0., dot(gp - ro, uCamFw));
  vec2 dv = uv - g;
  col += mix(COL_CORAL, COL_GOLD, .5) * uGlint * front * exp(-abs(dv.y) * 420.) * exp(-abs(dv.x) * 2.6) * .35;

  // --- motion streaks for the final push (radial, centred on the glint)
  if (uPush > .001) {
    float r = length(dv); float a = atan(dv.y, dv.x);
    float id = floor(a * 120. / TAU);
    float h = hash11(id * 1.37);
    float lane = smoothstep(.5, .0, abs(fract(a * 120. / TAU) - .5) - .2);
    float seg = smoothstep(.0, .3, fract(r * (1.5 + h * 2.) - uTime * (3. + 5. * h) * uPush - h * 7.));
    float st = step(.55, h) * lane * seg * smoothstep(.05, .5, r) * uPush * uPush;
    col += mix(COL_ICE, COL_GOLD, smoothstep(.9, .1, r)) * st * .5;
    col += mix(COL_EMBER, COL_GOLD, .6) * exp(-r * 3.) * uPush * uPush * .7;
  }

  col = aces(col * 1.05);
  fragColor = vec4(col + dither(fc), 1.);
}
`;

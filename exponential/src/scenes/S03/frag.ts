// S03 background light: cold deep space, the bloom of the paper of light, the warm volumetric
// glow of the attention web, the column of light of the Transformer stack, rising streaks.
import {GLSL_CAM} from '../S02/cam';

export const S03_FRAG = /* glsl */ `
${GLSL_CAM}
uniform vec3 uPapC; uniform vec3 uPapU; uniform vec3 uPapV; uniform float uPapI;
uniform float uWebI; uniform float uWarm; uniform float uRowW;
uniform vec3 uStackA; uniform vec3 uStackB; uniform float uStackI;
uniform float uRise; uniform float uHit; uniform float uEnv;
uniform vec2 uStackUV;

vec3 raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b){
  vec3 ba = b - a; float L = max(length(ba), 1e-5); vec3 u = ba / L; vec3 w = ro - a;
  float bd = dot(u, rd), wd = dot(w, rd), wu = dot(w, u);
  float h = clamp((wu - bd * wd) / max(1. - bd * bd, 1e-6), 0., L);
  float s = max(dot(a + u * h - ro, rd), 1e-3);
  h = clamp(dot(ro + rd * s - a, u), 0., L);
  return vec3(length(ro + rd * s - (a + u * h)), s, h / L);
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = (fc - .5 * uRes) / uRes.y;
  vec3 ro = uCamPos; vec3 rd = camRay(fc);

  // deep space: a faint cold nebula that warms as the web forms
  vec2 sp = vec2(atan(rd.x, -rd.z), rd.y) * 2.;
  float n = fbm(vec3(sp * 1.3, uTime * .015));
  float n2 = snoise(vec3(sp * 3.1 + 4., uTime * .02));
  vec3 neb = mix(COL_STEEL * .5, COL_BRUISE * .6, smoothstep(-.2, .6, n2)) * smoothstep(-.1, .9, n) * .22;
  vec3 wneb = mix(COL_CLAY, COL_EMBER, smoothstep(0., .8, n2)) * smoothstep(-.2, .8, n) * .16;
  vec3 col = COL_VOID * .8 + mix(neb, wneb, uWarm * .8) * uEnv;
  col += stars(sp * 1.4, 60., uTime) * .35 * uEnv;
  col += stars(sp * 2.3 + 7., 90., uTime) * .2 * uEnv;

  // the paper of light: soft bloom around a floating sheet
  if (uPapI > .001) {
    vec3 N = normalize(cross(uPapU, uPapV));
    float den = dot(rd, N);
    if (abs(den) > 1e-4) {
      float s = dot(uPapC - ro, N) / den;
      if (s > 0.) {
        vec3 p = ro + rd * s - uPapC;
        float lu = length(uPapU), lv = length(uPapV);
        vec2 l = vec2(dot(p, uPapU) / lu, dot(p, uPapV) / lv);
        vec2 e = max(abs(l) - vec2(lu, lv), 0.);
        float dist = length(e);
        float inside = 1. - smoothstep(0., .01, dist);
        float grad = .75 + .25 * (l.y / lv);
        col += mix(COL_ICE, COL_IVORY, .55) * uPapI * (inside * .085 * grad + exp(-dist * 7.) * .16 + exp(-dist * 1.8) * .07);
      }
    }
  }

  // volumetric glow of the attention web around the token row
  if (uWebI > .001) {
    vec3 r = raySeg(ro, rd, vec3(-uRowW, 0., 0.), vec3(uRowW, 0., 0.));
    float d = r.x;
    vec3 wc = mix(COL_ELEC * .8, mix(COL_EMBER, COL_GOLD, .5), uWarm);
    col += wc * uWebI * (exp(-d * 1.4) * .16 + exp(-d * 4.5) * .22);
  }

  // column of light through the Transformer stack
  if (uStackI > .001) {
    vec3 r = raySeg(ro, rd, uStackA, uStackB);
    float d = r.x;
    col += mix(COL_EMBER, COL_GOLD, .6) * uStackI * (exp(-d * 1.2) * .13 + exp(-d * 4.) * .15);
  }

  // rising streaks as the stack dissolves upward
  if (uRise > .001) {
    float lx = (uv.x - uStackUV.x) * 1.4;
    float fa = uv.x * 260.;
    float h = hash11(floor(fa) * 1.93);
    float lane = smoothstep(.2, .0, abs(fract(fa) - .5));
    float y = uv.y * (.8 + h) - uTime * (1.2 + 2.5 * h) - h * 9.;
    float seg = smoothstep(0., .6, fract(y)) * smoothstep(1., .85, fract(y));
    float st = step(.62, h) * lane * seg * exp(-lx * lx * 2.2) * smoothstep(-.6, .1, uv.y - uStackUV.y);
    col += mix(COL_EMBER, COL_GOLD, h) * st * uRise * .9;
    col += mix(COL_EMBER, COL_GOLD, .5) * exp(-lx * lx * 3.) * smoothstep(-.4, .5, uv.y) * uRise * .18;
  }

  // light hit (title words, snap of the block)
  col += mix(COL_ICE, COL_GOLD, uWarm) * uHit * .06 * exp(-dot(uv, uv) * 2.5);

  col = aces(col * 1.1);
  fragColor = vec4(col + dither(fc), 1.);
}
`;

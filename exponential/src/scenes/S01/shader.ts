// S01 background + light pass (one full-screen GLSL canvas, rendered at half res).
// Everything that is soft light lives here: nebula wisps lit by the spark, starfield, spark bloom,
// curve bloom (distance to a polyline passed as uniforms), title slam flash + shockwave.
// All positions are passed in 1920x1080 screen px (y down).
export const S01_FRAG = /* glsl */ `
uniform vec2 uSpark; uniform float uSparkI; uniform float uSparkR;
uniform float uNeb; uniform vec2 uNebOff; uniform float uNebK;
uniform float uStarI; uniform vec2 uStarOff; uniform float uStarK;
uniform float uCX[40]; uniform float uCY[40]; uniform float uCN; uniform float uCurveI;
uniform vec2 uHead; uniform float uHeadI;
uniform float uFlash; uniform vec2 uFlashC; uniform float uRing; uniform float uRingI;
uniform vec4 uTitle;
uniform float uExpo;

vec2 screenPx(){ vec2 q = gl_FragCoord.xy / uRes; return vec2(q.x * 1920., (1. - q.y) * 1080.); }

// Pixel-sized stars (gaussian dots) on a jittered grid; uv in world units of the star plane.
float starLayer(vec2 uv, float cell, float thresh, float t){
  vec2 g = uv / cell; vec2 id = floor(g); vec2 f = fract(g);
  vec2 h = hash22(id);
  if (h.x < thresh) return 0.;
  vec2 o = .2 + .6 * hash22(id + 7.3);
  vec2 d = (f - o) * cell;
  float tw = .65 + .35 * sin(t * (.8 + 2.5 * h.y) + h.x * 40.);
  return exp(-dot(d, d) / 1.5) * tw * (.35 + .65 * h.y);
}

void main(){
  vec2 p = screenPx();
  vec2 c = (p - vec2(960., 540.)) / 1080.;
  vec3 col = vec3(.010, .012, .020) * (1. - .6 * dot(c, c));

  // ---- deep nebula plane (parallax): only visible where the spark's light catches it
  vec2 q = vec2(c.x, -c.y) * uNebK + uNebOff;
  float n1 = fbm2(q * .07 + vec2(uTime * .006, -uTime * .004));
  float n2 = fbm2(q * .16 + vec2(n1 * 1.9, n1 * 1.1) + 3.1);
  float wisp = smoothstep(.40, .80, n2) * smoothstep(.22, .72, n1);
  float fil = smoothstep(.45, .95, vnoise(q * .55 + n2 * 3.));
  vec2 ds = (p - uSpark) / 1080.;
  float lit = uSparkI / (1. + dot(ds, ds) * 9.);
  vec3 cold = COL_STEEL * .7 + COL_BRUISE * .25;
  vec3 warm = mix(COL_CLAY, COL_EMBER, .3);
  col += mix(cold, warm, clamp(lit * 1.3, 0., 1.)) * wisp * (.7 + .5 * fil) * (.04 + lit * .75) * uNeb;

  // ---- far stars (cold, faint)
  vec2 sq = (p - vec2(960., 540.)) / uStarK + uStarOff;
  float st = starLayer(sq, 34., .84, uTime) + .6 * starLayer(sq + 91., 19., .93, uTime * 1.3);
  col += vec3(.70, .78, .92) * st * .55 * uStarI;

  // ---- the spark: hot core, bloom, volumetric shafts, anamorphic streak
  float dsp = length(p - uSpark);
  float I = uSparkI;
  col += COL_GOLD * I * (1.3 * exp(-dsp / (3.2 * uSparkR)) + .42 * exp(-dsp / (20. * uSparkR)) + .10 * exp(-dsp / (95. * uSparkR)));
  col += COL_EMBER * I * .045 * exp(-dsp / 340.);
  float ang = atan(p.y - uSpark.y, p.x - uSpark.x);
  float sh = vnoise(vec2(ang * 6.5, uTime * .22)) * vnoise(vec2(ang * 15. + 4., -uTime * .27));
  col += COL_CORAL * I * sh * .16 * exp(-dsp / 230.) * smoothstep(6., 50., dsp);
  float ay = abs(p.y - uSpark.y), ax = abs(p.x - uSpark.x);
  col += mix(COL_GOLD, COL_EMBER, .35) * I * exp(-ay / 2.4) * exp(-ax / (230. * uSparkR)) * .38;

  // ---- curve bloom
  if (uCurveI > .001 && uCN > 1.5) {
    float dc = 1e5;
    for (int i = 0; i < 39; i++) {
      if (float(i) >= uCN - 1.) break;
      dc = min(dc, sdSegment(p, vec2(uCX[i], uCY[i]), vec2(uCX[i + 1], uCY[i + 1])));
    }
    col += mix(COL_EMBER, COL_GOLD, .45) * uCurveI * (.42 * exp(-dc / 4.5) + .18 * exp(-dc / 24.) + .055 * exp(-dc / 105.));
  }
  // ---- curve head (leading light)
  if (uHeadI > .001) {
    float dh = length(p - uHead);
    col += COL_GOLD * uHeadI * (2.0 * exp(-dh / 3.6) + .55 * exp(-dh / 22.) + .12 * exp(-dh / 110.));
    col += COL_GOLD * uHeadI * exp(-abs(p.y - uHead.y) / 2.) * exp(-abs(p.x - uHead.x) / 170.) * .42;
  }

  // ---- warm light behind the title
  vec2 tq = (p - uTitle.xy) / vec2(uTitle.z, 85.);
  col += mix(COL_GOLD, COL_CORAL, .35) * uTitle.w * exp(-dot(tq, tq)) * .09;

  // ---- slam flash + shockwave
  if (uFlash > .001) {
    vec2 fq = (p - uFlashC) / 1080.;
    float fr = length(fq * vec2(.75, 1.5));
    col += mix(COL_IVORY, COL_GOLD, .5) * uFlash * (1.4 * exp(-fr * 2.8) + .14);
    col += COL_GOLD * uFlash * exp(-abs(p.y - uFlashC.y) / 9.) * 1.6;
  }
  if (uRingI > .001) {
    vec2 rp = p - uFlashC;
    float th = 2.5 + uRing * .022;
    float r1 = length(rp * vec2(1., 2.7));
    col += mix(COL_GOLD, COL_EMBER, .3) * uRingI * exp(-abs(r1 - uRing) / th) * .95;
    col += COL_CORAL * uRingI * exp(-abs(length(rp) - uRing * .6) / (th * 3.5)) * .22;
  }

  col = 1. - exp(-col * uExpo);
  fragColor = vec4(col + dither(gl_FragCoord.xy), 1.);
}`;

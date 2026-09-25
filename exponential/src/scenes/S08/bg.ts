// S08 background: one uniform-driven shader shared by the four vignettes (gradient sky anchored to a
// horizon, domain-warped haze, two positional glows, stars, and a warm light-sweep band).
export const BG = /* glsl */ `
uniform float uFade;
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot; uniform float uHz;
uniform vec4 uHaze; uniform float uHazeS;
uniform vec4 uGA; uniform vec3 uGAC;
uniform vec4 uGB; uniform vec3 uGBC;
uniform float uStars;
uniform vec2 uDrift;
uniform vec4 uSweep; // x, width, intensity, -
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 p = (fc - .5 * uRes) / uRes.y;
  if (abs(p.y) > .38) { fragColor = vec4(0., 0., 0., 1.); return; }
  vec2 q = p + uDrift;
  float h = p.y - uHz;
  vec3 col = h > 0. ? mix(uMid, uTop, smoothstep(0., .42, h)) : mix(uMid, uBot, smoothstep(0., .2, -h));
  if (uHaze.w > .001) {
    vec2 hq = q * uHazeS;
    float w = fbm2(hq * .5 + vec2(3.1, uTime * .03));
    float n = fbm2(hq + w * 1.6 + vec2(uTime * .025, -uTime * .01));
    col += uHaze.rgb * uHaze.w * smoothstep(.3, .85, n);
  }
  vec2 a = p - uGA.xy;
  col += uGAC * uGA.w * exp(-dot(a, a) / (uGA.z * uGA.z));
  vec2 b = p - uGB.xy;
  col += uGBC * uGB.w * exp(-dot(b, b) / (uGB.z * uGB.z));
  if (uStars > .001) col += (stars(q, 90., uTime) * .9 + stars(q * 1.6 + 4.2, 150., uTime) * .45) * uStars * vec3(.85, .9, 1.);
  if (uSweep.z > .001) {
    float d = p.x - uSweep.x;
    col += vec3(1., .74, .45) * uSweep.z * exp(-d * d / (uSweep.y * uSweep.y));
  }
  col = 1. - exp(-col * 1.1);
  fragColor = vec4(col * uFade + dither(fc), 1.);
}`;

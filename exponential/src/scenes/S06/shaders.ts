// S06 GLSL. BG: warm-dark holographic space with a receding floor grid and light spill pools under the panels.
// WIND: the cold front that rolls in from the edges at the end (drawn ON TOP of the HUD).
export const BG6 = /* glsl */ `
uniform vec2 uCam;
uniform vec3 uGauge;       // x, y (px), intensity
uniform float uSpill[15];  // 5 x (x, y, intensity) in px
uniform vec3 uChart;       // chart glow x, y, intensity
uniform float uCold;       // cold creep at the end
uniform float uFade;

vec2 fpx(){ return vec2(gl_FragCoord.x / uRes.x * 1920., (1. - gl_FragCoord.y / uRes.y) * 1080.); }

void main(){
  vec2 p = fpx();
  vec2 uv = (p - vec2(960., 540.)) / 1080.;
  float T = uTime;
  vec2 q = uv + uCam / 1080. * .3;
  float n = fbm2(q * 2.3 + vec2(T * .01, T * .006));
  vec3 col = COL_VOID;
  col += mix(COL_STEEL * .35, COL_CLAY * .32, smoothstep(.9, .1, length(uv))) * smoothstep(.35, .85, n) * .9;
  col += stars(uv + uCam / 1080. * .5, 58., T) * .35 * COL_IVORY;

  // holographic floor grid receding below the HUD
  float hz = 610.;
  if (p.y > hz) {
    float dy = (p.y - hz) / 540.;
    float z = .22 / dy;                      // depth
    vec2 g = vec2((p.x - 960. - uCam.x * .8) / 1080. * z * 5., z * 3. - T * .25);
    vec2 gf = abs(fract(g) - .5);
    float line = smoothstep(.03 * z + .01, 0., min(gf.x, gf.y) * .9);
    float fade = smoothstep(0., .25, dy) * exp(-z * .35);
    col += mix(COL_CORAL, COL_GOLD, .3) * line * fade * .35;
  }

  // light spill: gauge + panels
  vec2 dg = p - uGauge.xy;
  float r = length(dg);
  col += COL_EMBER * uGauge.z * (exp(-r * r / 26000.) * .55 + 90. / (r + 260.) * .25);
  for (int i = 0; i < 5; i++) {
    vec3 s = vec3(uSpill[i * 3], uSpill[i * 3 + 1], uSpill[i * 3 + 2]);
    if (s.z > .001) {
      vec2 d = (p - s.xy) / vec2(330., 190.);
      col += mix(COL_CORAL, COL_GOLD, .35) * s.z * exp(-dot(d, d)) * .22;
    }
  }
  if (uChart.z > .001) {
    vec2 d = (p - uChart.xy) / vec2(700., 360.);
    col += COL_CLAY * uChart.z * exp(-dot(d, d)) * .35;
  }
  // the cold creeps in at the end
  float edge = length(uv * vec2(.9, 1.3));
  col = mix(col, COL_STEEL * .25 + COL_COLD * .08 * n, uCold * smoothstep(.2, .8, edge + uCold * .4));

  col = aces(col * 1.1) * uFade;
  fragColor = vec4(col + dither(gl_FragCoord.xy), 1.);
}`;

export const WIND = /* glsl */ `
uniform float uWind;  // 0..1
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float T = uTime;
  vec2 c = uv - .5;
  float side = sign(c.x);
  // haze streams inward from both sides, fast, streaky (wind), plus top/bottom creep
  vec2 w = vec2(uv.x * 2.2 + side * T * 1.6, uv.y * 9.);
  float streak = fbm2(w + vec2(0., T * .2));
  float streak2 = fbm2(vec2(uv.x * 5. + side * T * 3.1, uv.y * 22.) + 5.);
  float edge = max(abs(c.x) * 2., abs(c.y) * 2.4);           // 0 centre .. 1 edges
  float front = 1. - uWind * 1.35;                              // front moves inward
  float mask = smoothstep(front - .05, front + .35, edge + (streak - .5) * .35);
  vec3 col = mix(COL_STEEL * .5, COL_ICE * .55, smoothstep(.45, .8, streak2)) * (.35 + .65 * streak);
  float a = mask * (.55 + .45 * streak) * clamp(uWind * 1.4, 0., 1.);
  col += COL_ICE * pow(smoothstep(.62, .8, streak2), 2.) * .35 * mask;
  fragColor = vec4(col * a, a);
}`;

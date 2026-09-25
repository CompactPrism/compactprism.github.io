// S05 GLSL: the living background (void, nebula, stars), campfire light, the raw-energy sphere that gets
// calmed (cold chaos -> warm order), the hero core glow, god rays and the shockwave.
// All positions are passed in FRAME pixels (1920x1080, y down) so they line up with DOM/SVG layers.
export const BG_FRAG = /* glsl */ `
uniform vec2 uCam;      // parallax offset (px)
uniform float uWarm;    // global grade cold -> warm
uniform vec3 uFire;     // campfire x, y (px), intensity
uniform vec4 uSph;      // energy sphere x, y, radius (px), intensity
uniform float uChaos;   // 1 = raw crackling energy, 0 = calm
uniform float uOrder;   // 0 = cold electric, 1 = warm ordered
uniform float uSpin;
uniform vec4 uCore;     // hero core x, y, radius (px), intensity
uniform float uRays;    // god rays
uniform vec2 uShock;    // shockwave radius (px), intensity
uniform float uNeb;     // nebula intensity
uniform float uFade;

vec2 fpx(){ return vec2(gl_FragCoord.x / uRes.x * 1920., (1. - gl_FragCoord.y / uRes.y) * 1080.); }

void main(){
  vec2 p = fpx();
  vec2 uv = (p - vec2(960., 540.)) / 1080.;
  vec2 q = uv + uCam / 1080. * .35;
  float T = uTime;

  // ---- deep background: cold nebula that warms over the scene
  float n = fbm2(q * 2.1 + vec2(T * .012, -T * .008));
  float n2 = fbm2(q * 4.3 - vec2(T * .01, 0.) + 7.);
  vec3 cold = mix(COL_STEEL * .55, COL_BRUISE * .5, smoothstep(.35, .75, n2));
  vec3 warm = mix(COL_CLAY * .42, COL_CORAL * .22, smoothstep(.4, .8, n2));
  vec3 col = COL_VOID + mix(cold, warm, uWarm) * smoothstep(.32, .85, n) * uNeb * (.45 + .55 * smoothstep(1.2, .15, length(uv)));
  vec2 sq = uv + uCam / 1080. * .6;
  col += stars(sq, 64., T) * .55 * mix(COL_ICE, COL_IVORY, uWarm);
  col += stars(sq * 1.7 + 3.1, 44., T * .8) * .28 * COL_ICE;

  // ---- campfire: warm pool of light (round glow + flattened pool on the ground)
  if (uFire.z > .001) {
    vec2 d = p - uFire.xy;
    float r = length(d);
    float pool = exp(-length(d * vec2(1., 3.2)) / 150.);
    col += COL_EMBER * uFire.z * (exp(-r * r / 3200.) * .9 + exp(-r / 120.) * .55 + pool * .35);
    col += COL_GOLD * uFire.z * exp(-r * r / 500.) * .8;
  }

  // ---- the energy sphere
  if (uSph.w > .001) {
    vec2 d = (p - uSph.xy) / uSph.z;
    d.y = -d.y;
    float r = length(d);
    if (r < 2.8) {
      float flick = .78 + .22 * hash11(floor(T * 22.)) ;
      vec3 cC = mix(COL_ELEC, COL_ICE, .35);
      vec3 cO = mix(COL_GOLD, COL_EMBER, .25);
      vec3 cc = mix(cC, cO, uOrder);
      float chaosK = uChaos * flick;
      if (r < 1.) {
        float z = sqrt(1. - r * r);
        vec3 nr = vec3(d, z);
        nr.xz = rot(uSpin) * nr.xz;
        nr.yz = rot(.35) * nr.yz;
        vec3 qq = nr * 2.1;
        vec3 wv = vec3(snoise(qq + vec3(0., 0., T * .8)), snoise(qq + vec3(5.2, 1.3, -T * .7)), snoise(qq + vec3(-3.1, 7.7, T * .5)));
        float f = snoise(qq * 1.5 + wv * (.25 + 1.1 * uChaos) + vec3(0., 0., T * (.2 + .9 * uChaos)));
        float fil = .045 / (abs(f) + .045);
        fil = fil * fil;
        // ordered weave: latitude bands and meridians, slowly turning
        float lat = asin(clamp(nr.y, -1., 1.));
        float lon = atan(nr.z, nr.x);
        float ob = .05 / (abs(sin(lat * 5. + T * .25)) + .05);
        float om = .05 / (abs(sin(lon * 3. + T * .1)) + .05) * smoothstep(1.4, .2, abs(lat));
        float ord = max(ob * ob, om * om * .7) * .55;
        float pat = mix(fil, ord, uOrder);
        float rim = pow(1. - z, 2.2);
        vec3 inner = cc * (pat * .75 + rim * 1.3 + z * .18);
        inner += vec3(1.) * pow(fil, 2.2) * .35 * chaosK;
        col += inner * uSph.w * (.8 + .4 * chaosK);
      }
      // corona: electric bolts arcing off the surface (chaos only)
      float ang = atan(d.y, d.x);
      float rr = r - 1.;
      if (rr > -.05 && chaosK > .01) {
        vec2 cs = vec2(cos(ang), sin(ang));
        float b = snoise(vec3(cs * 2.6, rr * 2.4 - T * 3.1));
        b += .5 * snoise(vec3(cs * 5.3 + 3., rr * 4. - T * 4.2));
        float bl = .025 / (abs(b) + .025);
        col += cC * bl * bl * exp(-max(rr, 0.) * 2.8) * chaosK * uSph.w * .85;
      }
      col += cc * exp(-max(r - 1., 0.) * 3.2) * .38 * uSph.w;
      col += cc * exp(-max(r - 1., 0.) * .9) * .08 * uSph.w;
    }
  }

  // ---- hero core, god rays, shockwave
  vec2 dc = p - uCore.xy;
  float dl = length(dc);
  if (uCore.w > .001) {
    col += COL_EMBER * uCore.w * (exp(-dl * dl / (uCore.z * uCore.z)) * 1.1 + .45 * uCore.z / (dl + uCore.z));
    col += COL_GOLD * uCore.w * exp(-dl * dl / (uCore.z * uCore.z * .12)) * .8;
  }
  if (uRays > .001) {
    float a = atan(dc.y, dc.x);
    vec2 cs = vec2(cos(a), sin(a));
    float rn = vnoise(cs * 5.5 + vec2(T * .05, 0.)) * .6 + vnoise(cs * 13. - vec2(0., T * .08)) * .4;
    float shaft = pow(smoothstep(.35, .9, rn), 1.6);
    float fall = 260. / (dl + 160.) * smoothstep(20., 120., dl);
    col += mix(COL_GOLD, COL_EMBER, .35) * shaft * fall * uRays;
    col += COL_CORAL * uRays * .12 * fall;
  }
  if (uShock.y > .001) {
    float w = 10. + uShock.x * .05;
    float sw = exp(-pow((dl - uShock.x) / w, 2.));
    float sw2 = exp(-pow((dl - uShock.x * .82) / (w * 2.5), 2.));
    col += mix(COL_GOLD, COL_IVORY, .45) * sw * uShock.y * 1.4 + COL_CORAL * sw2 * uShock.y * .35;
  }

  col = aces(col * 1.05);
  col *= uFade;
  fragColor = vec4(col + dither(gl_FragCoord.xy), 1.);
}`;

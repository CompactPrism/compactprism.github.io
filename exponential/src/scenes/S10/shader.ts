// S10 Earth-from-orbit pass. Analytic ray/sphere Earth (radius 1 at the origin) seen from a camera in
// orbit, with procedural continents, ocean glint, clouds, a thin scattering limb, a night side whose city
// lights ignite in a warm wave, and the hero's light rising beyond the limb as a sun whose corona is the
// emblem's own 12-ray starburst. Screen-space god rays, lens ghosts and an anamorphic streak on top.
export const S10_FRAG = /* glsl */ `
uniform vec3 uCamP; uniform vec3 uCamR; uniform vec3 uCamU; uniform vec3 uCamF; uniform float uFocal;
uniform vec3 uSunDir; uniform vec3 uLightDir; uniform vec2 uSunPx;
uniform float uSunI; uniform float uCorona; uniform float uRayLen; uniform float uRayRot;
uniform float uRayA[12]; uniform float uRayL[12];
uniform float uGod; uniform float uFlare; uniform float uBloom; uniform float uFlash;
uniform float uIgn; uniform float uSpin; uniform float uStarI; uniform float uExpo; uniform float uNightCity;

vec2 screenPx(){ vec2 q = gl_FragCoord.xy / uRes; return vec2(q.x * 1920., (1. - q.y) * 1080.); }

vec3 camRay(vec2 px){
  vec2 uv = vec2(px.x - 960., 540. - px.y) / 1080.;
  return normalize(uv.x * uCamR + uv.y * uCamU + uFocal * uCamF);
}

float fbm4(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * snoise(p); p = p * 2.03 + 11.3; a *= .5; } return s; }

float starLayer(vec2 uv, float cell, float thresh, float t){
  vec2 g = uv / cell; vec2 id = floor(g); vec2 f = fract(g);
  vec2 h = hash22(id);
  if (h.x < thresh) return 0.;
  vec2 o = .2 + .6 * hash22(id + 7.3);
  vec2 d = (f - o) * cell;
  float tw = .65 + .35 * sin(t * (.8 + 2.5 * h.y) + h.x * 40.);
  return exp(-dot(d, d) / 1.6) * tw * (.3 + .7 * h.y * h.y);
}

// Sky visibility for a view ray: 0 behind the Earth, with a ragged cloud-top horizon for god rays.
float skyVis(vec3 rd){
  float b = dot(uCamP, rd);
  float c = dot(uCamP, uCamP) - 1.;
  vec3 pc = uCamP + rd * max(-b, 0.);
  float hgt = length(pc) - 1.;
  vec3 n = normalize(pc);
  float ct = .0035 * (vnoise(vec2(atan(n.x, n.y) * 90., 3.)) + .6 * vnoise(vec2(atan(n.x, n.y) * 260., 9.)));
  return smoothstep(0., .0025, hgt - ct);
}

void main(){
  vec2 px = screenPx();
  vec3 rd = camRay(px);
  vec3 ro = uCamP;
  float b = dot(ro, rd);
  float c = dot(ro, ro) - 1.;
  float h = b * b - c;
  float tHit = -b - sqrt(max(h, 0.));
  bool hit = h > 0. && tHit > 0.;
  vec3 sunC = vec3(1., .84, .62);
  float sd = dot(rd, uSunDir);
  float sAng = acos(clamp(sd, -1., 1.));
  vec3 col = vec3(0.);

  if (!hit) {
    // ---------- space: stars + thin atmospheric limb
    vec2 sp = vec2(atan(rd.x, -rd.z), asin(clamp(rd.y, -1., 1.))) * 1350.;
    float st = starLayer(sp, 30., .8, uTime) + .7 * starLayer(sp + 57., 17., .9, uTime * 1.2);
    col += vec3(.72, .8, .95) * st * .6 * uStarI;
    col += vec3(.012, .016, .03);
    vec3 pc = ro + rd * max(-b, 0.);
    float hgt = max(length(pc) - 1., 0.);
    vec3 n = normalize(pc);
    float sunward = dot(n, uLightDir);
    float litA = smoothstep(-.35, .25, sunward);
    float fwd = pow(max(sd, 0.), 10.);
    vec3 blue = vec3(.22, .48, 1.);
    vec3 warm = mix(vec3(1., .62, .36), vec3(1., .8, .55), fwd);
    vec3 limbCol = mix(blue * .18, mix(blue * .9, warm * 1.4, clamp(fwd * 1.5 + litA * .35, 0., 1.)), litA);
    col += limbCol * (exp(-hgt / .0065) * 1.1 + exp(-hgt / .03) * .22) * (1. + fwd * 3.);
  } else {
    // ---------- the planet
    vec3 N = normalize(ro + rd * tHit);
    vec3 Np = N;
    Np.yz = rot(.35) * Np.yz;
    Np.xz = rot(uSpin) * Np.xz;
    float cont = fbm(Np * 1.9 + vec3(4.1, 1.7, -2.3));
    float land = smoothstep(.02, .07, cont);
    float coast = 1. - smoothstep(0., .08, abs(cont - .045));
    float tv = snoise(Np * 7.3) * .5 + .5;
    vec3 landCol = mix(vec3(.07, .09, .05), vec3(.30, .23, .14), tv);
    landCol = mix(landCol, vec3(.42, .40, .38), smoothstep(.6, .85, abs(Np.y)));
    vec3 oceanCol = vec3(.008, .026, .06);
    vec3 surf = mix(oceanCol, landCol, land);
    float cl = fbm4(Np * 3.1 + vec3(uSpin * .4, 2., 0.));
    float clouds = smoothstep(.08, .55, cl) * .9;

    float ndl = dot(N, uLightDir);
    float day = smoothstep(-.06, .2, ndl);
    float mu = max(dot(N, -rd), 0.);
    vec3 sunL = vec3(1., .8, .56) * 1.7;
    vec3 colDay = surf * sunL * max(ndl, 0.) * 1.3;
    vec3 R = reflect(rd, N);
    float fres = .03 + .97 * pow(1. - mu, 5.);
    float spec = pow(max(dot(R, uLightDir), 0.), 45.) * (1. - land) * (1. - clouds);
    colDay += sunL * spec * (.35 + 2.2 * fres);
    vec3 cloudDay = mix(vec3(1., .66, .45), vec3(1., .94, .86), smoothstep(0., .35, ndl)) * max(ndl + .05, 0.) * 1.25;
    colDay = mix(colDay, cloudDay, clouds);
    float twi = exp(-pow(ndl / .09, 2.));
    colDay += COL_CORAL * twi * .12 * (.4 + clouds);

    // night side: faint cold ambient + city lights
    vec3 night = surf * vec3(.05, .08, .15) * .3 + clouds * vec3(.04, .06, .1) * .25;
    float c1 = snoise(Np * 34.) * .5 + .5;
    float c2 = snoise(Np * 120.) * .5 + .5;
    float city = smoothstep(.6, .92, c1 * .5 + c2 * .55 + coast * .3) * land;
    city *= smoothstep(.05, .3, mu);
    float front = ndl + uIgn + (c1 - .5) * .16;
    float ign = smoothstep(0., .04, front);
    float flare = exp(-pow(front / .03, 2.)) * step(.001, uIgn);
    vec3 coldCity = vec3(.45, .58, .8) * .22;
    vec3 warmCity = vec3(1., .7, .36) * 1.9;
    vec3 cityCol = mix(coldCity, warmCity, ign) * city * (1. - clouds * .75) * uNightCity;
    cityCol += vec3(1., .78, .5) * flare * (city * 2.5 + land * .05) * (1. - clouds * .6);
    col = mix(night + cityCol, colDay, day) + cityCol * .15 * day;

    // atmosphere haze on the disc (thin blue rim, warm on the sun side)
    float rim = pow(1. - mu, 3.5);
    float fwd = pow(max(sd, 0.), 6.);
    col += mix(vec3(.18, .38, .95) * .22, vec3(1., .66, .42) * 1.1, clamp(fwd + day * .4, 0., 1.)) * rim * (.25 + 1.4 * day);
  }

  // ---------- the hero's sun: core, bloom, veil (hidden behind the planet)
  float vis = hit ? 0. : 1.;
  col += sunC * uSunI * vis * (7. * exp(-sAng / .0035) + 1.3 * exp(-sAng / .018) * uBloom);
  col += sunC * uSunI * (.45 * exp(-sAng / .075) * vis + .09 * exp(-sAng / .3)) * uBloom;
  col += COL_EMBER * uSunI * .05 * exp(-sAng / .6) * uBloom;

  // corona: the emblem's own 12 rays, as light
  vec2 d = px - uSunPx;
  float r = length(d);
  float a = atan(d.y, d.x);
  float rays = 0.;
  for (int i = 0; i < 12; i++) {
    float da = abs(mod(a - uRayA[i] - uRayRot + PI, TAU) - PI);
    float w = 1.6 + r * .012;
    float len = uRayL[i] * uRayLen;
    rays += exp(-pow(da * r / w, 2.)) * exp(-r / len) * smoothstep(0., 14., r);
  }
  float fine = pow(vnoise(vec2(a * 36., uTime * .15)), 5.) * exp(-r / (uRayLen * .45));
  float cover = hit ? .3 : 1.;
  col += sunC * (rays * 1.3 + fine * .5) * uCorona * cover;

  // god rays: radial march toward the sun through a ragged horizon
  if (uGod > .001) {
    vec2 dir = uSunPx - px;
    float acc = 0.;
    float jit = hash12(px + fract(uTime));
    for (int i = 0; i < 18; i++) {
      float s = (float(i) + jit) / 18.;
      vec2 q = px + dir * s;
      float w = exp(-length(uSunPx - q) / 260.);
      acc += skyVis(camRay(q)) * w;
    }
    acc /= 18.;
    col += vec3(1., .72, .45) * acc * uGod * (hit ? .35 : 1.);
  }

  // lens: anamorphic streak + ghosts along the optical axis
  if (uFlare > .001) {
    col += vec3(1., .76, .5) * uFlare * exp(-abs(px.y - uSunPx.y) / 2.5) * exp(-abs(px.x - uSunPx.x) / 650.) * .9;
    col += vec3(1., .6, .4) * uFlare * exp(-abs(px.y - uSunPx.y) / 16.) * exp(-abs(px.x - uSunPx.x) / 380.) * .12;
    vec2 ax = vec2(960., 540.) - uSunPx;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float k = .45 + fi * .42;
      float rad = 22. + 38. * hash11(fi * 3.7) + fi * 14.;
      vec2 g = uSunPx + ax * k * 2.;
      float dg = length(px - g);
      vec3 gc = mix(vec3(1., .62, .38), vec3(.55, .75, 1.), step(3., fi) * .6);
      col += gc * uFlare * (smoothstep(rad, rad * .8, dg) * .045 + exp(-abs(dg - rad) / 2.) * .05);
    }
    float halo = length(px - uSunPx);
    col += vec3(1., .7, .5) * uFlare * exp(-abs(halo - 330.) / 22.) * .03;
  }

  col += vec3(1., .94, .82) * uFlash * 3.;
  col = 1. - exp(-col * uExpo);
  fragColor = vec4(col + dither(gl_FragCoord.xy), 1.);
}`;

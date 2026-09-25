// Shared GLSL ES 3.00 snippets, auto-prepended to every ShaderCanvas fragment shader.
// Available in every shader: uRes (vec2, px), uTime (float, seconds), uFrame (float), fragColor (out vec4).

export const GLSL_COMMON = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718

// Palette (linear-ish sRGB, matches theme.ts)
const vec3 COL_VOID  = vec3(0.020, 0.024, 0.039);
const vec3 COL_CORAL = vec3(0.851, 0.467, 0.341);
const vec3 COL_EMBER = vec3(0.933, 0.541, 0.369);
const vec3 COL_GOLD  = vec3(0.957, 0.761, 0.478);
const vec3 COL_IVORY = vec3(0.953, 0.933, 0.894);
const vec3 COL_CLAY  = vec3(0.710, 0.333, 0.227);
const vec3 COL_COLD  = vec3(0.435, 0.545, 0.651);
const vec3 COL_ICE   = vec3(0.725, 0.800, 0.867);
const vec3 COL_STEEL = vec3(0.165, 0.212, 0.271);
const vec3 COL_ELEC  = vec3(0.498, 0.820, 1.000);
const vec3 COL_BRUISE= vec3(0.353, 0.247, 0.400);

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash33(vec3 p3){ p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

// Ashima 3D simplex noise, returns [-1, 1]
vec3 _m289(vec3 x){ return x - floor(x * (1. / 289.)) * 289.; }
vec4 _m289(vec4 x){ return x - floor(x * (1. / 289.)) * 289.; }
vec4 _perm(vec4 x){ return _m289(((x * 34.) + 1.) * x); }
vec4 _tis(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1. / 6., 1. / 3.); const vec4 D = vec4(0., .5, 1., 2.);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1. - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = _m289(i);
  vec4 p = _perm(_perm(_perm(i.z + vec4(0., i1.z, i2.z, 1.)) + i.y + vec4(0., i1.y, i2.y, 1.)) + i.x + vec4(0., i1.x, i2.x, 1.));
  float n_ = .142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49. * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7. * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1. - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2. + 1.; vec4 s1 = floor(b1) * 2. + 1.; vec4 sh = -step(h, vec4(0.));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = _tis(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.); m = m * m;
  return 42. * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * snoise(p); p = p * 2.02 + 17.1; a *= .5; } return s; }
float fbm2(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = rot(.5) * p * 2.03 + 11.7; a *= .5; } return s; }

// Soft glow falloff for a distance d (0 at the shape). k = radius, p = sharpness.
float glow(float d, float k, float p){ return pow(k / max(abs(d), 1e-4), p); }

// Twinkling starfield layer. uv in screen units (aspect-corrected), density ~ 40-120.
float stars(vec2 uv, float density, float t){
  vec2 g = uv * density; vec2 id = floor(g); vec2 f = fract(g) - .5;
  vec2 h = hash22(id); float s = step(.86, h.x);
  vec2 o = (h - .5) * .7; float d = length(f - o);
  float tw = .6 + .4 * sin(t * (1. + 3. * h.y) + h.x * 50.);
  return s * smoothstep(.06 * (.4 + h.y), 0., d) * tw;
}

// ACES filmic tonemap: use for HDR-style bloom (add light freely, then tonemap).
vec3 aces(vec3 x){ const float a = 2.51, b = .03, c = 2.43, d = .59, e = .14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0., 1.); }

float sdCircle(vec2 p, float r){ return length(p) - r; }
float sdSegment(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }

// Screen-space dithering to kill banding in dark gradients. Add to final colour.
vec3 dither(vec2 fc){ return (hash12(fc + fract(uTime)) - .5) / 255. * vec3(1.); }
`;

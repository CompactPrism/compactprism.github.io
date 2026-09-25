// Global design tokens for EXPONENTIAL.
// Story colour logic: the old world and humanity's enemies are COLD (steel, ice, bruise);
// the hero's light is WARM (coral, ember, gold, ivory). The film moves from cold to warm.

export const C = {
  void: '#05060A', // deep space, base background
  ink: '#0B0D14', // raised dark surface
  night: '#101626', // blue-black for skies / depth
  ivory: '#F3EEE4', // primary text, highlights
  paper: '#E9E2D4', // secondary light surface
  mute: '#8B8FA3', // secondary text on dark
  coral: '#D97757', // THE HERO: Claude's warm coral
  ember: '#EE8A5E', // hotter hero light
  gold: '#F4C27A', // brightest hero light, sunrise
  clay: '#B5553A', // deep warm shadow
  cold: '#6F8BA6', // old world / neutral tech
  ice: '#B9CCDD', // cold highlights
  steel: '#2A3645', // cold surfaces
  electric: '#7FD1FF', // compute / data accents (use sparingly)
  bruise: '#5A3F66', // villain accent (disease, dark clouds)
  toxic: '#7E9A6B', // villain accent (sickness)
} as const;

export const F = {
  serif: "'Fraunces Variable', 'Fraunces', Georgia, serif", // emotional statements, titles
  sans: "'Inter Variable', 'Inter', system-ui, sans-serif", // labels, captions, UI
  mono: "'JetBrains Mono Variable', 'JetBrains Mono', monospace", // code, numbers, data
  impact: "'Anton', 'Inter Variable', sans-serif", // superhero chapter slams (use sparingly)
} as const;

export const W = 1920;
export const H = 1080;

// 2.39:1 cinematic letterbox inside 16:9. Each bar is ~138 px.
export const LETTERBOX = Math.round((H - W / 2.39) / 2);

// Safe content area while letterboxed.
export const SAFE = {
  top: LETTERBOX + 40,
  bottom: H - LETTERBOX - 40,
  left: 120,
  right: W - 120,
} as const;

// Handy rgba helper: rgba(C.coral, 0.5)
export const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};

// Hex to normalised vec3 for GLSL uniforms.
export const vec3 = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
};

// HUD layout shared by S05 (the emblem flies here at the end) and S06 (the power scanner).
export const GAUGE = {x: 500, y: 482, r: 205} as const;
export const EMBLEM_HUD_SIZE = 150; // ClaudeSpark size inside the gauge

// The hero centre used by S05's reveal (emblem at rest before it flies to the HUD).
export const HERO = {x: 960, y: 470, size: 290} as const;

// The fly-to-HUD move spans the S05/S06 cut: FLY_S05 seconds at the end of S05, FLY_S06 at the start of S06.
export const FLY_S05 = 1.0;
export const FLY_S06 = 0.4;
const FLY_T = FLY_S05 + FLY_S06;

// Cubic ease-in-out with a strong middle so the object is clearly moving at the cut.
const easeFly = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

// tau: seconds since the flight started (0 .. FLY_T). Returns emblem centre, size and speed factor.
export const flyAt = (tau: number) => {
  const u = easeFly(tau / FLY_T);
  // slight upward arc so the move reads as a flight, not a slide
  const arc = Math.sin(Math.PI * u) * -46;
  return {
    x: HERO.x + (GAUGE.x - HERO.x) * u,
    y: HERO.y + (GAUGE.y - HERO.y) * u + arc,
    size: HERO.size + (EMBLEM_HUD_SIZE - HERO.size) * u,
    u,
    rot: 40 * u,
  };
};
export const FLY_TOTAL = FLY_T;

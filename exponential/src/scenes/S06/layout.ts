// HUD layout shared by S05 (the emblem pulls back into the HUD at the end) and S06 (the power scanner).
// The power HUD is centred: ClaudeSpark inside a circular gauge, glass panels floating around it.
export const GAUGE = {x: 960, y: 486, r: 150} as const;
export const EMBLEM_HUD_SIZE = 118; // ClaudeSpark size inside the gauge

// The hero pose at the end of S05's reveal (emblem at rest just before it pulls back into the HUD).
export const HERO = {x: 960, y: 470, size: 290} as const;
export const HERO_ROT_END = 18; // degrees: rotation the emblem settles to at the end of the move

// The pull-back spans the S05/S06 cut: FLY_S05 seconds at the end of S05, FLY_S06 at the start of S06.
export const FLY_S05 = 1.0;
export const FLY_S06 = 0.45;
export const FLY_TOTAL = FLY_S05 + FLY_S06;

const easeFly = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
};

// tau: seconds since the move started (0 .. FLY_TOTAL). Same function on both sides of the cut,
// so the emblem is mid-motion at the cut and S06 finishes the move.
export const flyAt = (tau: number) => {
  const u = easeFly(tau / FLY_TOTAL);
  const arc = Math.sin(Math.PI * u) * 34; // a small dip: reads as a flight into the HUD, not a zoom
  return {
    x: HERO.x + (GAUGE.x - HERO.x) * u,
    y: HERO.y + (GAUGE.y - HERO.y) * u + arc,
    size: HERO.size + (EMBLEM_HUD_SIZE - HERO.size) * u,
    rot: HERO_ROT_END * u + 150 * u * (1 - u) * 0, // rotation handled by caller
    spin: 90 * (1 - Math.cos(Math.PI * Math.min(1, tau / FLY_TOTAL))) / 2, // 0 -> 90 deg whip
    u,
  };
};

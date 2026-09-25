// Animation helpers. Write choreography in SECONDS (t = frame / fps) so the film is fps-agnostic.
import {Easing, interpolate, random} from 'remotion';

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

// Named easings.
export const E = {
  out: Easing.bezier(0.16, 1, 0.3, 1), // expo-ish out: fast start, long settle (default for reveals)
  inOut: Easing.bezier(0.65, 0, 0.35, 1), // cinematic camera moves
  in: Easing.bezier(0.7, 0, 0.84, 0), // accelerate into a cut
  back: Easing.bezier(0.34, 1.56, 0.64, 1), // overshoot pop
  linear: (x: number) => x,
};

// Map t (seconds) from [t0, t1] to [0, 1] with an easing, clamped.
export const prog = (t: number, t0: number, t1: number, ease: (x: number) => number = E.out) =>
  ease(invLerp(t0, t1, t));

// Range mapping with clamping, in seconds. ramp(t, [0, 1, 2], [0, 1, 0])
export const ramp = (
  t: number,
  input: number[],
  output: number[],
  ease: (x: number) => number = E.inOut
) =>
  interpolate(t, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });

// Fade in over `fin` seconds from `t0`, hold, fade out over `fout` seconds ending at `t1`.
export const inOut = (t: number, t0: number, t1: number, fin = 0.5, fout = 0.5) =>
  Math.min(prog(t, t0, t0 + fin, E.out), 1 - prog(t, t1 - fout, t1, E.inOut));

// Deterministic randomness. Never use Math.random() in a component.
export const rnd = (seed: string | number) => random(seed);
export const rndRange = (seed: string | number, a: number, b: number) => a + (b - a) * random(seed);

// Stagger: returns start time for item i of n spread over `span` seconds starting at t0.
export const stagger = (i: number, n: number, t0: number, span: number) =>
  n <= 1 ? t0 : t0 + (span * i) / (n - 1);

// Subtle hand-held camera drift (deterministic), amplitude in px.
export const drift = (t: number, amp = 6, seed = 1) => ({
  x: Math.sin(t * 0.7 + seed) * amp + Math.sin(t * 1.9 + seed * 2.1) * amp * 0.35,
  y: Math.cos(t * 0.6 + seed * 1.3) * amp * 0.8 + Math.sin(t * 2.3 + seed) * amp * 0.25,
});

// Screen shake that decays after an impact at time t0.
export const shake = (t: number, t0: number, amp = 18, decay = 6) => {
  if (t < t0) return {x: 0, y: 0};
  const k = Math.exp(-(t - t0) * decay) * amp;
  return {x: Math.sin((t - t0) * 83) * k, y: Math.cos((t - t0) * 71) * k};
};

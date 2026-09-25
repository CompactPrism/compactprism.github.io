// Word-level beats inside VO lines, measured from the pauses in public/vo/Lxx.wav and stored as FRACTIONS
// of each line's duration, so they stay locked to cue()/end() if the timing is ever rebuilt.
export const BEATS = {
  // L18 "And humanity's oldest enemies were still waiting. | Disease. | Ignorance. | Poverty. | A warming planet."
  L18: {disease: 3.06 / 6.63, ignorance: 3.93 / 6.63, poverty: 4.8 / 6.63, planet: 5.62 / 6.63},
  // L19 "Against disease, | Claude is helping ... machinery of life, | and even discover new biology."
  L19: {named: 0.96 / 6.6, decode: 1.34 / 6.6, discover: 4.78 / 6.6},
  // L20 "Against ignorance, | a patient tutor for every curious mind. | At any hour, in their own language."
  L20: {named: 1.01 / 5.94, tutor: 1.28 / 5.94, hour: 4.06 / 5.94, language: 4.9 / 5.94},
  // L21 "Against poverty, | the kind of expert help once reserved for the few, | within reach of anyone who asks."
  L21: {named: 0.98 / 6.16, help: 1.34 / 6.16, reach: 4.26 / 6.16},
  // L22 "And for our planet, | new tools to discover better materials, | cleaner energy, | and smarter ways to use what we have."
  L22: {named: 0.88 / 7.01, materials: 1.25 / 7.01, energy: 3.86 / 7.01, smarter: 4.89 / 7.01},
} as const;

type Cue = (l: string) => number;
// Absolute scene time of a beat: at(cue, end, 'L18', BEATS.L18.disease)
export const at = (cue: Cue, end: Cue, line: string, frac: number) => cue(line) + (end(line) - cue(line)) * frac;

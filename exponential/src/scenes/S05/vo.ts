// VO word-timing estimates inside a line. Lines only give start/end, so we estimate where a word
// falls by weighting each token by its letters plus a pause for punctuation (TTS pauses at , : .).
// Everything stays relative to cue()/end(), so it follows the voice if the line moves.

const tokens = (text: string) => text.trim().split(/\s+/);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, '');

const weight = (tok: string, last: boolean) => {
  let w = norm(tok).length + 2;
  if (!last && /[,;]$/.test(tok)) w += 5;
  if (!last && /[.:!?]$/.test(tok)) w += 9;
  return w;
};

// Time (s) at which `word` starts (plus `frac` of the word) in a line spoken from t0 for dur seconds.
export const wordAt = (text: string, word: string, t0: number, dur: number, frac = 0.15, nth = 0) => {
  const tk = tokens(text);
  const ws = tk.map((x, i) => weight(x, i === tk.length - 1));
  const total = ws.reduce((a, b) => a + b, 0);
  const target = norm(word);
  let seen = 0;
  let acc = 0;
  for (let i = 0; i < tk.length; i++) {
    if (norm(tk[i]).startsWith(target)) {
      if (seen === nth) return t0 + (dur * (acc + frac * ws[i])) / total;
      seen++;
    }
    acc += ws[i];
  }
  return t0 + dur * 0.5;
};

// Word/phrase positions MEASURED from the final VO audio (public/vo/Lxx.wav, pause detection), stored as a
// fraction of the line's duration so they follow cue()/end() if the line is ever re-timed.
export const VO_FRAC = {
  L10: {y2021: 0.05, anthropic: 0.54, conviction: 0.8},
  L11: {powerful: 0.37, history: 0.57, built: 0.8, safely: 0.885},
  L12: {constitution: 0.36, principles: 0.57, helpful: 0.705, honest: 0.796, harmless: 0.912},
  L13: {march: 0.08, claude: 0.834},
  L14: {stronger: 0.62},
  // L15 phrases start at 0, .344, .452, .613, .785 (pauses in the audio); stings on the key verb
  L15: {read: 0.075, see: 0.36, code: 0.47, computer: 0.63, agents: 0.8},
  L16: {doubled: 0.42, months: 0.62, lately: 0.775, faster: 0.9},
} as const;

// Split a line into sentences/phrases (on . ! ?) and time them in proportion to their WORD count.
// Returns the start time of each phrase plus its word boundaries.
export const phrases = (text: string, t0: number, dur: number) => {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const counts = parts.map((p) => tokens(p).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const per = dur / total;
  let acc = 0;
  return parts.map((p, i) => {
    const start = t0 + acc * per;
    acc += counts[i];
    return {text: p, start, end: t0 + acc * per, words: counts[i], perWord: per};
  });
};

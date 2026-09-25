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

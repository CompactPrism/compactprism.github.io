// Estimate when a phrase is spoken inside a VO line, from its character position (punctuation adds pauses).
// Keyed to the line's cue/duration, so it follows the voice if timings change.
import type {Line} from '../../lib/timing';

const weight = (s: string) => s.length + (s.match(/[.!?]/g)?.length ?? 0) * 6 + (s.match(/[,;:]/g)?.length ?? 0) * 3;

export const wordCue = (lines: Line[], fps: number, lid: string, phrase: string, fallback = 0.5) => {
  const l = lines.find((x) => x.id === lid);
  if (!l) throw new Error(`no line ${lid}`);
  const text = l.text.replace(/\*/g, '');
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  const frac = idx < 0 ? fallback : weight(text.slice(0, idx)) / weight(text);
  return (l.start + l.duration * frac) / fps;
};

// S03 world geometry: the paper, the token row, the attention web and the Transformer block.
import {rnd} from '../../lib/anim';
import type {V3} from '../S02/cam';

// ---------- the paper (local coords: x in [-1,1] across, y in [-1,1] down->up)
export const PAPER_HW = 0.95;
export const PAPER_HH = 1.23;

// Abstract "text" as light bars: [x0, x1, y, thickness] in paper-local coords.
export const PAPER_BARS: [number, number, number, number][] = (() => {
  const b: [number, number, number, number][] = [];
  // title block (two centred bars)
  b.push([-0.62, 0.62, 0.8, 0.045]);
  // author rows (8 authors live as points on y = 0.64; affiliations as thin bars)
  b.push([-0.55, 0.55, 0.555, 0.012]);
  b.push([-0.4, 0.4, 0.515, 0.012]);
  // "Abstract" heading + indented abstract
  b.push([-0.12, 0.12, 0.43, 0.02]);
  for (let i = 0; i < 7; i++) {
    const y = 0.37 - i * 0.052;
    const r = i === 6 ? -0.05 + 0.3 * rnd(`ab${i}`) : 0.7;
    b.push([-0.7, r, y, 0.014]);
  }
  // body text: two paragraphs + section heading
  let y = -0.04;
  b.push([-0.84, -0.46, y, 0.022]);
  y -= 0.075;
  for (let p = 0; p < 2; p++) {
    const n = p === 0 ? 7 : 6;
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      const x0 = i === 0 ? -0.76 : -0.84;
      const x1 = last ? -0.5 + 0.9 * rnd(`bd${p}${i}`) : 0.84;
      b.push([x0, x1, y, 0.013]);
      y -= 0.052;
    }
    y -= 0.03;
  }
  return b;
})();
export const AUTHOR_Y = 0.64;
export const AUTHOR_X = Array.from({length: 8}, (_, i) => -0.63 + (i * 1.26) / 7);

// ---------- tokens
export const TOKENS = ['Attention', 'Is', 'All', 'You', 'Need'];
export const TOKEN_SP = 1.12;
export const tokenPos = (i: number): V3 => [(i - (TOKENS.length - 1) / 2) * TOKEN_SP, 0, 0];

// ---------- attention arcs: every token to every other token, several heads in different planes
export const HEADS = 5;
export type Arc = {i: number; j: number; h: number; w: number; theta: number; seed: number};
export const ARCS: Arc[] = (() => {
  const out: Arc[] = [];
  const n = TOKENS.length;
  for (let h = 0; h < HEADS; h++) {
    for (let i = 0; i < n; i++) {
      // softmax over the other tokens for this query / head
      const logits = Array.from({length: n}, (_, j) => (j === i ? -1e9 : rnd(`lg${h}-${i}-${j}`) * 3.4));
      const mx = Math.max(...logits);
      const ex = logits.map((l) => Math.exp(l - mx));
      const s = ex.reduce((a, b) => a + b, 0);
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const base = ((h - (HEADS - 1) / 2) / ((HEADS - 1) / 2)) * 1.05; // -1.05..1.05 rad
        const theta = (j > i ? 0 : Math.PI) + base + (rnd(`th${h}${i}${j}`) - 0.5) * 0.12;
        out.push({i, j, h, w: ex[j] / s, theta, seed: rnd(`sd${h}${i}${j}`)});
      }
    }
  }
  return out;
})();

// Attention matrix for the HUD card (head 0 weights).
export const WEIGHTS: number[][] = TOKENS.map((_, i) => TOKENS.map((__, j) => ARCS.find((a) => a.h === 0 && a.i === i && a.j === j)?.w ?? 0));

// Point on an arc (u in 0..1) in world space. Arcs bulge out of the row in their head's plane.
export const arcPoint = (a: Arc, u: number, lift = 1): V3 => {
  const p = tokenPos(a.i);
  const q = tokenPos(a.j);
  const span = Math.abs(a.j - a.i);
  const hgt = (0.32 + 0.3 * span) * lift;
  const b = 4 * u * (1 - u); // parabola 0..1..0
  const x = p[0] + (q[0] - p[0]) * u;
  return [x, Math.cos(a.theta) * hgt * b, Math.sin(a.theta) * hgt * b * 0.9];
};

// ---------- the Transformer block (local 2D coords, y up), as polylines
type P2 = [number, number];
const rect = (x0: number, y0: number, x1: number, y1: number, r = 0.06): P2[] => {
  const pts: P2[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (k / 4) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x1 - r, y0 + r, -Math.PI / 2);
  corner(x1 - r, y1 - r, 0);
  corner(x0 + r, y1 - r, Math.PI / 2);
  corner(x0 + r, y0 + r, Math.PI);
  pts.push(pts[0]);
  return pts;
};
export const BOX = {
  mha: [-0.85, -0.92, 0.85, -0.44] as const,
  an1: [-0.85, -0.3, 0.85, -0.08] as const,
  ff: [-0.85, 0.1, 0.85, 0.52] as const,
  an2: [-0.85, 0.68, 0.85, 0.9] as const,
  frame: [-1.28, -1.08, 1.08, 1.04] as const,
};
export const BLOCK_LINES: {pts: P2[]; kind: 'box' | 'wire' | 'res' | 'frame'}[] = [
  {pts: rect(...BOX.frame, 0.1), kind: 'frame'},
  {pts: rect(...BOX.mha), kind: 'box'},
  {pts: rect(...BOX.an1), kind: 'box'},
  {pts: rect(...BOX.ff), kind: 'box'},
  {pts: rect(...BOX.an2), kind: 'box'},
  // input, split into Q K V
  {pts: [[0, -1.3], [0, -1.14]], kind: 'wire'},
  {pts: [[0, -1.14], [-0.45, -1.02], [-0.45, -0.92]], kind: 'wire'},
  {pts: [[0, -1.14], [0, -0.92]], kind: 'wire'},
  {pts: [[0, -1.14], [0.45, -1.02], [0.45, -0.92]], kind: 'wire'},
  // stack of connections
  {pts: [[0, -0.44], [0, -0.3]], kind: 'wire'},
  {pts: [[0, -0.08], [0, 0.1]], kind: 'wire'},
  {pts: [[0, 0.52], [0, 0.68]], kind: 'wire'},
  {pts: [[0, 0.9], [0, 1.3]], kind: 'wire'},
  {pts: [[-0.07, 1.2], [0, 1.3], [0.07, 1.2]], kind: 'wire'},
  // residual paths (around the sub-layers, into Add & Norm)
  {pts: [[0, -1.2], [-1.08, -1.2], [-1.08, -0.19], [-0.85, -0.19]], kind: 'res'},
  {pts: [[0, 0.01], [-1.08, 0.01], [-1.08, 0.79], [-0.85, 0.79]], kind: 'res'},
];
// Resample a polyline to n points (for morphing arcs into block lines).
export const resample = (pts: P2[], n: number): P2[] => {
  const d: number[] = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1] || 1;
  const out: P2[] = [];
  let k = 0;
  for (let s = 0; s < n; s++) {
    const tl = (s / (n - 1)) * L;
    while (k < d.length - 2 && d[k + 1] < tl) k++;
    const f = (tl - d[k]) / (d[k + 1] - d[k] || 1);
    out.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
  }
  return out;
};
export const ARC_N = 26; // samples per arc
export const BLOCK_SAMPLED = BLOCK_LINES.map((l) => resample(l.pts, ARC_N));

// Log-scale training-compute chart: one mapping shared by the TS overlay and the GLSL particles.
// Chart lives on the world plane z = 0; with the canonical camera (0,0,10), fov 45, it lands on these px.
import type {V3} from './cam';

// Facts checked against research/FACTS.md (sections 2, 3 and 23).
export const FACTS = {
  rate: '4–5×', // Epoch AI: frontier training compute grows 4–5x per year, 2010 to 2024 (FACTS §3)
  period: '2010–2024',
  source: 'Epoch AI',
  points: [
    // GPT-3: 3.14e23 FLOP, GPT-3 paper (May 2020), used by Epoch (FACTS §3, §23)
    {id: 'gpt3', name: 'GPT-3', sub: 'OpenAI · May 2020', yr: 2020.37, v: Math.log10(3.14e23), mant: '3.14', exp: 23, approx: false, note: ''},
    // GPT-4: ~2.1e25 FLOP, Epoch estimate (FACTS §3, §23); Mar 2023
    {id: 'gpt4', name: 'GPT-4', sub: 'OpenAI · Mar 2023', yr: 2023.2, v: Math.log10(2.1e25), mant: '~2', exp: 25, approx: true, note: 'EPOCH ESTIMATE'},
    // First model above 1e26 in Epoch's dataset: Feb 2025 (FACTS §3, §23)
    {id: 'e26', name: 'FIRST MODELS', sub: 'above 10²⁶ FLOP', yr: 2025.1, v: 26, mant: '>1', exp: 26, approx: true, note: '2025 · EPOCH AI'},
  ],
};

export const CH = {px0: 360, px1: 1500, py0: 830, py1: 240, yr0: 2010, yr1: 2026, v0: 16, v1: 27};
export const K0 = 540 / (10 * Math.tan((22.5 * Math.PI) / 180)); // px per world unit at z = 0
export const TREND = {v0: Math.log10(3.14e23), yr0: 2020.37, slope: Math.log10(4.5), start: 2010, end: 2025.6};
export const LIN_TOP = 0.93; // 1e26 sits at 93% of the plot height on the linear axis

export const trendV = (yr: number) => TREND.v0 + TREND.slope * (yr - TREND.yr0);
export const chartX = (yr: number) => CH.px0 + ((yr - CH.yr0) / (CH.yr1 - CH.yr0)) * (CH.px1 - CH.px0);
export const chartY = (v: number, morph: number) => {
  const yLog = CH.py0 - ((v - CH.v0) / (CH.v1 - CH.v0)) * (CH.py0 - CH.py1);
  const yLin = CH.py0 - Math.min(Math.pow(10, v - 26), 14) * LIN_TOP * (CH.py0 - CH.py1);
  return yLog + (yLin - yLog) * morph;
};
export const pxW = (px: number, py: number, z = 0): V3 => [(px - 960) / K0, (540 - py) / K0, z];
export const chartW = (yr: number, v: number, morph: number, z = 0): V3 => pxW(chartX(yr), chartY(v, morph), z);

const f = (n: number) => n.toFixed(5);
// GLSL macros mirroring the functions above (safe to paste inside a shader body).
export const CHART_GLSL = `
#define CH_X(yr) ((${f(CH.px0)} + ((yr) - ${f(CH.yr0)}) / ${f(CH.yr1 - CH.yr0)} * ${f(CH.px1 - CH.px0)} - 960.) / ${f(K0)})
#define CH_YLOG(v) (${f(CH.py0)} - ((v) - ${f(CH.v0)}) / ${f(CH.v1 - CH.v0)} * ${f(CH.py0 - CH.py1)})
#define CH_YLIN(v) (${f(CH.py0)} - min(pow(10., (v) - 26.), 14.) * ${f(LIN_TOP)} * ${f(CH.py0 - CH.py1)})
#define CH_Y(v, m) ((540. - mix(CH_YLOG(v), CH_YLIN(v), (m))) / ${f(K0)})
#define TREND_V(yr) (${f(TREND.v0)} + ${f(TREND.slope)} * ((yr) - ${f(TREND.yr0)}))
`;

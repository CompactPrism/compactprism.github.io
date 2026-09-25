// The leitmotif curve in S09 world space: exponential rise along -z from the avenue, then a vertical beam.
// Same function in TS (camera, overlays, geometry) and GLSL (particles).
import type {V3} from '../S04/cam';

export const CV = {Z0: 30, L: 150, Y0: 0.6, H: 150, k: 4.2, a: 7};
const EK = Math.exp(CV.k) - 1;
export const VRISE = (CV.H * CV.k * Math.exp(CV.k)) / EK; // dy/du at u = 1 (kept constant above)
export const U_MAX = 1.6;

export const curveAt = (u: number): V3 => {
  if (u <= 1) return [0, CV.Y0 + (CV.H * (Math.exp(CV.k * u) - 1)) / EK, CV.Z0 - CV.L * u];
  const d = u - 1;
  return [0, CV.Y0 + CV.H + VRISE * d, CV.Z0 - CV.L - (CV.L * (1 - Math.exp(-CV.a * d))) / CV.a];
};

export const PILLAR: V3 = curveAt(1);

const f = (n: number) => n.toFixed(5);
export const CURVE_GLSL = `
vec3 curveAt(float u){
  if (u <= 1.) return vec3(0., ${f(CV.Y0)} + ${f(CV.H)} * (exp(${f(CV.k)} * u) - 1.) / ${f(EK)}, ${f(CV.Z0)} - ${f(CV.L)} * u);
  float d = u - 1.;
  return vec3(0., ${f(CV.Y0 + CV.H)} + ${f(VRISE)} * d, ${f(CV.Z0 - CV.L)} - ${f(CV.L)} * (1. - exp(-${f(CV.a)} * d)) / ${f(CV.a)});
}
`;

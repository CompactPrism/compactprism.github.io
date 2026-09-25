// Full-resolution additive line work (Canvas2D, 'lighter' compositing): crisp cores with a cheap
// three-pass glow. Everything is recomputed from props each frame, so it is deterministic.
import React, {useLayoutEffect, useRef} from 'react';

export type RGB = [number, number, number];
export type Stroke = {pts: [number, number][]; c: RGB; w: number; a: number; glow?: number};
export type Dot = {x: number; y: number; r: number; c: RGB; a: number};
export type Quad = {pts: [number, number][]; c: RGB; a: number};

const css = (c: RGB, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, a)).toFixed(4)})`;

export const LightCanvas: React.FC<{strokes: Stroke[]; dots?: Dot[]; quads?: Quad[]}> = ({strokes, dots = [], quads = []}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cv.width, cv.height);
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const q of quads) {
      if (q.a < 0.003 || q.pts.length < 3) continue;
      g.fillStyle = css(q.c, q.a);
      g.beginPath();
      g.moveTo(q.pts[0][0], q.pts[0][1]);
      for (let i = 1; i < q.pts.length; i++) g.lineTo(q.pts[i][0], q.pts[i][1]);
      g.closePath();
      g.fill();
    }
    const path = (s: Stroke) => {
      g.beginPath();
      g.moveTo(s.pts[0][0], s.pts[0][1]);
      for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i][0], s.pts[i][1]);
    };
    // glow passes first (wide, faint), then cores
    for (const [mul, am] of [
      [7, 0.05],
      [2.8, 0.16],
    ] as const) {
      for (const s of strokes) {
        const gl = s.glow ?? 1;
        if (s.a * gl < 0.004 || s.pts.length < 2) continue;
        g.strokeStyle = css(s.c, s.a * am * gl);
        g.lineWidth = s.w * mul;
        path(s);
        g.stroke();
      }
    }
    for (const s of strokes) {
      if (s.a < 0.004 || s.pts.length < 2) continue;
      g.strokeStyle = css(s.c, s.a);
      g.lineWidth = s.w;
      path(s);
      g.stroke();
    }
    for (const d of dots) {
      if (d.a < 0.004) continue;
      const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 4);
      gr.addColorStop(0, css([255, 252, 245], d.a));
      gr.addColorStop(0.18, css(d.c, d.a * 0.8));
      gr.addColorStop(1, css(d.c, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.arc(d.x, d.y, d.r * 4, 0, Math.PI * 2);
      g.fill();
    }
  });
  return <canvas ref={ref} width={1920} height={1080} style={{position: 'absolute', inset: 0, width: 1920, height: 1080}} />;
};

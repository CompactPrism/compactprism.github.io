import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {GLSL_COMMON} from './glsl';

export type Uniforms = Record<string, number | number[]>;

type Props = {
  // Fragment shader BODY in GLSL ES 3.00 (no #version / precision lines).
  // Declare your own extra uniforms at the top. Write to `fragColor`.
  // Built-ins: uRes (canvas px), uTime (seconds), uFrame. All GLSL_COMMON helpers are available.
  frag: string;
  uniforms?: Uniforms;
  // Render resolution as a fraction of the composition size (0.5 = quarter the pixels, CSS-upscaled).
  // Soft/glowy shaders look identical at 0.5 and render ~4x faster. Use 1 for crisp lines.
  scale?: number;
  // Override the canvas size (defaults to composition width/height).
  width?: number;
  height?: number;
  // Time in seconds passed as uTime (defaults to frame / fps of the enclosing Sequence).
  time?: number;
  style?: React.CSSProperties;
  blend?: React.CSSProperties['mixBlendMode'];
  opacity?: number;
};

const VERT = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const HEADER = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uFrame;
out vec4 fragColor;
`;

type GLState = {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  locs: Map<string, WebGLUniformLocation | null>;
  frag: string;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src
      .split('\n')
      .map((l, i) => `${String(i + 1).padStart(4)}| ${l}`)
      .join('\n');
    throw new Error(`Shader compile error: ${log}\n${numbered}`);
  }
  return s;
};

export const ShaderCanvas: React.FC<Props> = ({
  frag,
  uniforms = {},
  scale = 0.5,
  width,
  height,
  time,
  style,
  blend,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const cfg = useVideoConfig();
  const cssW = width ?? cfg.width;
  const cssH = height ?? cfg.height;
  const pxW = Math.max(2, Math.round(cssW * scale));
  const pxH = Math.max(2, Math.round(cssH * scale));
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef<GLState | null>(null);
  const t = time ?? frame / cfg.fps;

  useLayoutEffect(() => {
    const canvas = ref.current!;
    let s = st.current;
    if (!s || s.frag !== frag) {
      const gl =
        s?.gl ??
        (canvas.getContext('webgl2', {
          preserveDrawingBuffer: true,
          premultipliedAlpha: true,
          alpha: true,
          antialias: false,
        }) as WebGL2RenderingContext);
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, HEADER + GLSL_COMMON + frag));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error('Shader link error: ' + gl.getProgramInfoLog(prog));
      }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      s = {gl, prog, locs: new Map(), frag};
      st.current = s;
    }
    const {gl, prog, locs} = s;
    const L = (name: string) => {
      if (!locs.has(name)) locs.set(name, gl.getUniformLocation(prog, name));
      return locs.get(name)!;
    };
    gl.viewport(0, 0, pxW, pxH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(L('uRes'), pxW, pxH);
    gl.uniform1f(L('uTime'), t);
    gl.uniform1f(L('uFrame'), frame);
    for (const [k, v] of Object.entries(uniforms)) {
      const l = L(k);
      if (l === null) continue;
      if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v.length === 2) gl.uniform2fv(l, v);
      else if (v.length === 3) gl.uniform3fv(l, v);
      else if (v.length === 4) gl.uniform4fv(l, v);
      else gl.uniform1fv(l, v); // float array: declare `uniform float uArr[N];`
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  });

  // Free the GL context when the scene unmounts (Chromium caps live contexts at ~16).
  useLayoutEffect(() => {
    return () => {
      const gl = st.current?.gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      st.current = null;
    };
  }, []);

  return (
    <AbsoluteFill style={{mixBlendMode: blend, opacity, pointerEvents: 'none', ...style}}>
      <canvas ref={ref} width={pxW} height={pxH} style={{width: cssW, height: cssH, display: 'block'}} />
    </AbsoluteFill>
  );
};

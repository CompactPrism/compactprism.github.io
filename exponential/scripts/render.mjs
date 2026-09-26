// Render a composition (or a frame range) to video.
//   node scripts/render.mjs Film out/film.mp4 [--range=0-299] [--concurrency=4] [--crf=16] [--muted]
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=')[1] : d;
};
const id = pos[0] ?? 'Film';
const output = path.resolve(root, pos[1] ?? `out/${id}.mp4`);
const BROWSER = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const chromiumOptions = {gl: 'swangle'};

const t0 = Date.now();
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), enableCaching: false});
const composition = await selectComposition({serveUrl, id, browserExecutable: BROWSER, chromiumOptions});
const range = opt('range') ? opt('range').split('-').map(Number) : null;
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: output,
  crf: Number(opt('crf', '16')),
  pixelFormat: 'yuv420p',
  x264Preset: opt('preset', 'medium'),
  imageFormat: 'jpeg',
  jpegQuality: 95,
  concurrency: Number(opt('concurrency', '4')),
  frameRange: range ? [range[0], range[1]] : undefined,
  muted: args.includes('--muted'),
  browserExecutable: BROWSER,
  chromiumOptions,
  timeoutInMilliseconds: 240000,
  onProgress: ({renderedFrames, progress}) => {
    const pct = Math.floor(progress * 100);
    if (pct !== last && pct % 2 === 0) {
      last = pct;
      const el = (Date.now() - t0) / 1000;
      console.log(`${pct}%  frames ${renderedFrames}  ${el.toFixed(0)}s elapsed  ${(renderedFrames / el).toFixed(2)} fps`);
    }
  },
});
console.log(`done -> ${path.relative(root, output)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

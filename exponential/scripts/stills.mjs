// Render review stills of one composition + a contact sheet.
//   node scripts/stills.mjs S03 --at=1,2.5,4,8        (seconds, scene-relative)
//   node scripts/stills.mjs S03 --n=12                  (12 evenly spaced frames)
//   node scripts/stills.mjs Film --frames=100,2000      (explicit frames)
//   options: --scale=0.5 (output size), --out=out/stills/S03, --no-sheet
// Prints the paths of every JPEG and the contact sheet (tiles are labelled with their time).
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
if (!id) throw new Error('usage: node scripts/stills.mjs <CompositionId> [--at=s,s] [--n=12] [--frames=f,f]');
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=')[1] : d;
};
const flag = (k) => args.includes(`--${k}`);
const scale = Number(opt('scale', '0.5'));
const outDir = path.resolve(root, opt('out', `out/stills/${id}`));
fs.mkdirSync(outDir, {recursive: true});

const BROWSER = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const t0 = Date.now();
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), enableCaching: false});
const browser = await openBrowser('chrome', {browserExecutable: BROWSER, chromiumOptions: {gl: 'swangle'}});
const comp = await selectComposition({serveUrl, id, puppeteerInstance: browser, browserExecutable: BROWSER, chromiumOptions: {gl: 'swangle'}});

let frames;
if (opt('frames')) frames = opt('frames').split(',').map(Number);
else if (opt('at')) frames = opt('at').split(',').map((s) => Math.round(Number(s) * comp.fps));
else {
  const n = Number(opt('n', '12'));
  frames = Array.from({length: n}, (_, i) => Math.round(((i + 0.5) / n) * (comp.durationInFrames - 1)));
}
frames = frames.map((f) => Math.max(0, Math.min(comp.durationInFrames - 1, f)));

const files = [];
for (const f of frames) {
  const file = path.join(outDir, `${id}_${String(f).padStart(5, '0')}.jpg`);
  const s = Date.now();
  await renderStill({composition: comp, serveUrl, output: file, frame: f, imageFormat: 'jpeg', jpegQuality: 88, scale, puppeteerInstance: browser, browserExecutable: BROWSER, chromiumOptions: {gl: 'swangle'}, overwrite: true});
  files.push({file, f});
  console.log(`frame ${f} (${(f / comp.fps).toFixed(2)}s) -> ${path.relative(root, file)}  [${Date.now() - s} ms]`);
}
await browser.close({silent: true});

if (!flag('no-sheet') && files.length > 1) {
  let ffmpeg = 'ffmpeg';
  try {
    ffmpeg = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
  } catch {}
  const cols = files.length <= 4 ? 2 : files.length <= 9 ? 3 : 4;
  const rows = Math.ceil(files.length / cols);
  const tmp = path.join(outDir, '_sheet');
  fs.rmSync(tmp, {recursive: true, force: true});
  fs.mkdirSync(tmp);
  // Tiles are in the order the frames were requested (left-to-right, top-to-bottom).
  files.forEach(({file}, i) => {
    const dst = path.join(tmp, `${String(i).padStart(3, '0')}.jpg`);
    execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', file, '-vf', 'scale=640:-1', dst]);
  });
  console.log('sheet order: ' + files.map(({f}) => `${(f / comp.fps).toFixed(2)}s`).join(', '));
  const sheet = path.join(outDir, `${id}_sheet.jpg`);
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-framerate', '1', '-i', path.join(tmp, '%03d.jpg'), '-vf', `tile=${cols}x${rows}:padding=4:color=0x333333`, '-frames:v', '1', '-q:v', '3', sheet]);
  fs.rmSync(tmp, {recursive: true, force: true});
  console.log(`contact sheet -> ${path.relative(root, sheet)}`);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

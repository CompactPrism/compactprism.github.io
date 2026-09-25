// Final render pipeline: render the Film scene-by-scene into muted chunks (resumable), join them
// losslessly, then mux the mastered soundtrack.
//   node scripts/render-film.mjs                 render missing chunks, then assemble
//   node scripts/render-film.mjs --only=S05,S08  (re)render just these scenes, then assemble
//   node scripts/render-film.mjs --assemble      only join + mux
// Output: out/film/EXPONENTIAL_master.mp4 (H.264 CRF 14 + AAC 320k)
import path from 'node:path';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=')[1] : d;
};
const only = opt('only') ? opt('only').split(',') : null;
const assembleOnly = args.includes('--assemble');
const outDir = path.join(root, 'out/film');
const chunkDir = path.join(outDir, 'chunks');
fs.mkdirSync(chunkDir, {recursive: true});

const timing = JSON.parse(fs.readFileSync(path.join(root, 'src/timing.json'), 'utf8'));
const BROWSER = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const chromiumOptions = {gl: 'swangle'};
const ffmpeg = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();

if (!assembleOnly) {
  const t0 = Date.now();
  const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), enableCaching: false});
  const composition = await selectComposition({serveUrl, id: 'Film', browserExecutable: BROWSER, chromiumOptions});
  for (const s of timing.scenes) {
    const file = path.join(chunkDir, `${s.id}.mp4`);
    const want = only ? only.includes(s.id) : !fs.existsSync(file);
    if (!want) continue;
    const ts = Date.now();
    let last = -1;
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      output: file + '.part.mp4',
      crf: Number(opt('crf', '14')),
      pixelFormat: 'yuv420p',
      x264Preset: 'medium',
      imageFormat: 'jpeg',
      jpegQuality: 96,
      concurrency: Number(opt('concurrency', '4')),
      frameRange: [s.start, s.start + s.duration - 1],
      muted: true,
      browserExecutable: BROWSER,
      chromiumOptions,
      timeoutInMilliseconds: 300000,
      onProgress: ({progress, renderedFrames}) => {
        const pct = Math.floor(progress * 100);
        if (pct !== last && pct % 10 === 0) {
          last = pct;
          const el = (Date.now() - ts) / 1000;
          console.log(`${s.id} ${pct}% (${renderedFrames}/${s.duration}) ${el.toFixed(0)}s ${(renderedFrames / Math.max(el, 1)).toFixed(2)} fps`);
        }
      },
    });
    fs.renameSync(file + '.part.mp4', file);
    console.log(`${s.id} done in ${((Date.now() - ts) / 1000).toFixed(0)}s (total ${((Date.now() - t0) / 60000).toFixed(1)} min)`);
  }
}

// Assemble: lossless concat of chunks in scene order.
const missing = timing.scenes.filter((s) => !fs.existsSync(path.join(chunkDir, `${s.id}.mp4`)));
if (missing.length) {
  console.log('Not assembling; missing chunks: ' + missing.map((s) => s.id).join(', '));
  process.exit(0);
}
const list = path.join(chunkDir, 'list.txt');
fs.writeFileSync(list, timing.scenes.map((s) => `file '${path.join(chunkDir, s.id + '.mp4')}'`).join('\n'));
const silent = path.join(outDir, 'film_silent.mp4');
execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
const master = path.join(root, 'public/audio/master.wav');
const out = path.join(outDir, 'EXPONENTIAL_master.mp4');
if (fs.existsSync(master)) {
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', silent, '-i', master, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
  console.log('master -> ' + path.relative(root, out));
} else {
  fs.copyFileSync(silent, out);
  console.log('no public/audio/master.wav yet; wrote silent master -> ' + path.relative(root, out));
}

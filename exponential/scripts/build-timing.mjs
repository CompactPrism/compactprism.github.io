// Builds src/timing.json from script/script.json and the voiceover manifest (public/vo/manifest.json).
// Before the VO exists, line durations are estimated from word count so scenes can be built in parallel.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const script = JSON.parse(fs.readFileSync(path.join(root, 'script/script.json'), 'utf8'));
const manifestPath = path.join(root, 'public/vo/manifest.json');
const fpsArg = process.argv.find((a) => a.startsWith('--fps='));
const fps = fpsArg ? Number(fpsArg.split('=')[1]) : script.fps;

let durations = {};
let estimated = true;
if (fs.existsSync(manifestPath)) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const l of m) durations[l.id] = l.duration_s;
  estimated = false;
}
const est = (text) => text.split(/\s+/).length / 2.55 + 0.35 * (text.match(/[.,:;!?]/g) || []).length * 0.5;

const f = (s) => Math.round(s * fps);
let cursor = 0;
const scenes = [];
for (const sc of script.scenes) {
  let t = sc.lead;
  const lines = [];
  sc.lines.forEach((l, i) => {
    if (i > 0) t += l.gap ?? 0.5;
    const d = durations[l.id] ?? est(l.text);
    lines.push({id: l.id, text: l.text, start: f(t), duration: f(d), startS: +t.toFixed(3), durationS: +d.toFixed(3)});
    t += d;
  });
  let total = t + sc.tail;
  if (total < sc.min) total = sc.min;
  const duration = f(total);
  scenes.push({
    id: sc.id,
    name: sc.name,
    start: cursor,
    duration,
    letterbox: sc.letterbox,
    lines: lines.map((l) => ({...l, globalStart: cursor + l.start})),
  });
  cursor += duration;
}

const out = {fps, width: 1920, height: 1080, totalFrames: cursor, totalSeconds: +(cursor / fps).toFixed(2), estimated, scenes};
fs.writeFileSync(path.join(root, 'src/timing.json'), JSON.stringify(out, null, 2));
console.log(`timing.json: ${scenes.length} scenes, ${out.totalSeconds}s @ ${fps}fps (${estimated ? 'ESTIMATED' : 'from VO manifest'})`);
for (const s of scenes) console.log(`  ${s.id} ${s.name.padEnd(12)} start ${(s.start / fps).toFixed(1).padStart(6)}s  dur ${(s.duration / fps).toFixed(1).padStart(5)}s`);

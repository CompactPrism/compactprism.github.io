// Counts what the film is made of, for the end credits (src/stats.json). Run after all code is final.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const walk = (dir, exts, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'models', 'samples', 'out', '.cache'].includes(e.name)) continue;
      walk(p, exts, out);
    } else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
  }
  return out;
};
const lines = (f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim().length > 0).length;

const tsFiles = walk(path.join(root, 'src'), ['.ts', '.tsx']).concat(walk(path.join(root, 'scripts'), ['.mjs']));
const pyFiles = walk(path.join(root, 'audio'), ['.py']);
const all = tsFiles.concat(pyFiles);
const src = tsFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

// GLSL: count fragment/vertex shader programs (each `void main` inside a template string).
const shaders = (src.match(/void main\s*\(/g) || []).length;
// Particles: sum of literal PointCloud counts.
const particles = [...src.matchAll(/count=\{(\d[\d_]*)\}/g)].reduce((a, m) => a + Number(m[1].replace(/_/g, '')), 0);
const glslLines = [...src.matchAll(/\/\*\s*glsl\s*\*\/\s*`([\s\S]*?)`/g)].reduce((a, m) => a + m[1].split('\n').filter((l) => l.trim()).length, 0);

const timing = JSON.parse(fs.readFileSync(path.join(root, 'src/timing.json'), 'utf8'));

// A few real lines of this project's own source, for the credits' code wall.
const sample = [];
for (const f of tsFiles.filter((f) => f.includes('/scenes/') || f.includes('/lib/'))) {
  const ls = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim().length > 12 && l.length < 110);
  for (let i = 0; i < ls.length && sample.length < 400; i += 7) sample.push(ls[i].replace(/\t/g, '  '));
}

const stats = {
  codeLines: all.reduce((a, f) => a + lines(f), 0),
  tsLines: tsFiles.reduce((a, f) => a + lines(f), 0),
  pyLines: pyFiles.reduce((a, f) => a + lines(f), 0),
  glslLines,
  files: all.length,
  shaders,
  particles,
  frames: timing.totalFrames,
  seconds: timing.totalSeconds,
  fps: timing.fps,
  sample,
};
fs.writeFileSync(path.join(root, 'src/stats.json'), JSON.stringify(stats, null, 1));
console.log({...stats, sample: `${sample.length} lines`});

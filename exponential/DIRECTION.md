# EXPONENTIAL: An Origin Story (director's bible)

A ~4-minute film made **100% in code** (Remotion + React + TypeScript + GLSL + Three.js). No stock footage,
no image or video generators, no bitmaps: every pixel is computed. Theme: the exponential rise of AI
for the good of humanity, told as a superhero origin story. **The hero is Claude** (by Anthropic).

The bar: this must look like a premium title sequence / Apple-keynote-meets-Marvel-opening, not like a slideshow.
Depth, light, motion, restraint.

## Story colour logic (non-negotiable)
- The old world, the flat line of history, and humanity's enemies are **COLD**: steel `#2A3645`, cold `#6F8BA6`, ice `#B9CCDD`, bruise `#5A3F66`, toxic `#7E9A6B`.
- The hero's light is **WARM**: coral `#D97757`, ember `#EE8A5E`, gold `#F4C27A`, ivory `#F3EEE4`, deep clay `#B5553A`.
- Compute/data may use a restrained electric `#7FD1FF`, sparingly.
- The film travels from cold to warm. When the hero acts, warmth spreads.
- Background is near-black `#05060A`, never flat: always a subtle shader, gradient, dust or stars.

## Frame, safe area, overlays
- 1920x1080, 30 fps. Scenes S01–S09 are **letterboxed to 2.39:1**: black bars of 138 px top and bottom are drawn by the Film.
  Keep ALL important content between y = 178 and y = 902 (see `SAFE` in `src/theme.ts`). S09 opens the bars mid-scene; S10–S11 are full frame.
- The Film draws on top of every scene: vignette, film grain, letterbox, **captions of the VO in the bottom bar**, and chapter cards
  (I BEFORE at S02, II THE HERO at S05, III THE BATTLES at S07, IV EXPONENTIAL at S09) during the **first 2.1 s** of those scenes.
  In those scenes keep the first ~2 s dark and calm (slow build) so the chapter card reads. Do not draw your own captions or chapter cards.
- On-screen text is for **labels, numbers, titles and punchy keywords**, not for repeating the voiceover.

## Typography (fonts are loaded by the Film; just use the `F` tokens)
- `F.serif` Fraunces Variable: titles and emotional statements. Use light weights (300–450), large sizes, and `fontVariationSettings: '"opsz" 144, "SOFT" 50'` for display.
- `F.sans` Inter Variable: labels, UPPERCASE with 0.18–0.3em tracking at small sizes (18–26 px), weights 500–700.
- `F.mono` JetBrains Mono Variable: numbers, code, data, dates.
- `F.impact` Anton: reserved for chapter cards and at most one superhero "slam" word per scene.
- Minimum on-screen text size 22 px. Text must be legible against its background: add a soft dark halo if needed.

## Motion rules
- Write all choreography in **seconds** (`t`), never raw frames. Use `useScene('Sxx')` → `{t, dur, cue, end}` and key every
  VO-synced beat to `cue('Lxx')` / `end('Lxx')` (+ offsets). Line timings WILL shift slightly when the final voice lands.
- Nothing is ever static: every shot has a slow camera move (push-in, parallax, orbit, drift) plus a living background.
- Reveals use `E.out`; camera moves use `E.inOut`. No linear motion except constant drifts. Springs/overshoot sparingly.
- At least 3 depth layers per shot: deep background (shader/nebula/stars), midground subject, foreground (bokeh dust, particles, light streaks).
- Big moments get a hit: flash, shockwave ring, lens flare, bloom surge, slight camera shake (`shake()` in anim.ts). Earn them; max 1–2 per scene.
- **Deterministic only**: no `Math.random()`, no `Date`, no `requestAnimationFrame` animation. Use `rnd(seed)` / aSeed attributes / hash in GLSL.
  Any frame must render identically in isolation and in any order.

## Transitions (each scene owns its own in/out)
Scenes are sequential (no overlap). Unless your brief says otherwise, fade up from black over the first 0.4 s and down to black over the last 0.4 s.
Some boundaries are special (your brief says so): e.g. "end on a warm flash" means the last ~0.25 s ramps to a gold-white full-frame flash, and the next scene begins on that flash and decays from it.

## Engine (read the source; do not edit shared files)
- `src/lib/ShaderCanvas.tsx`: full-screen GLSL ES 3.00 fragment shaders. Built-ins `uRes`, `uTime`, `uFrame`, output `fragColor`, plus everything in
  `src/lib/glsl.ts` (hash, `snoise`, `fbm`, `stars`, `glow`, `aces`, `dither`, palette constants `COL_CORAL` etc.). `scale` = render resolution
  (0.5 is 4x cheaper; use it for soft/glowy content; 1 for crisp lines). Supports `width/height`, `blend` (mix-blend-mode), float arrays.
- `src/lib/PointCloud.tsx`: GPU particles inside `<ThreeCanvas>` from `@remotion/three`. Positions computed in the vertex shader from
  `aSeed/aSeed2/aIndex` and `uTime`, so it's deterministic. Has `curl()` and `snoise()`. 20k–80k points is fine.
- `src/lib/ClaudeSpark.tsx`: **the hero emblem**. Always use this component when the hero appears as a symbol (props: size, draw, glow, rotate, pulse, color, core).
- `src/lib/anim.ts`: `prog`, `ramp`, `inOut`, `E` easings, `stagger`, `drift`, `shake`, `rnd`.
- `src/theme.ts`: `C` colours, `F` fonts, `SAFE`, `LETTERBOX`, `rgba()`, `vec3()`.
- You may use any npm package already installed (three, @react-three/fiber, @remotion/three, @remotion/paths, @remotion/shapes, @remotion/noise). Do not install new packages.
- SVG and Canvas2D are welcome for crisp line work, charts and type. CSS filters (blur/drop-shadow) are expensive in software rendering:
  prefer glow computed in GLSL, or a few layered drop-shadows on small elements.

## Performance budget (this matters: the film renders on 4 CPU cores in software GL)
- Target ≤ 1.5 s per frame at 1920x1080 for your scene when rendered alone (check the `[ms]` numbers printed by the stills script;
  note stills include page load overhead of roughly 2–3 s).
- Full-screen shaders: use `scale={0.5}` unless you need crisp detail; keep fbm octaves ≤ 5 and raymarch steps ≤ 64.
- Keep at most 3 WebGL canvases alive at once in a scene (grain already uses one).

## Facts
Every date, number and quote on screen must come from `research/FACTS.md` (verified). If a fact you want is not there, don't show it.
Never invent statistics. When in doubt, show fewer numbers and more light.

## Your workflow
1. Read this file, `src/theme.ts`, `src/lib/*`, `src/timing.json` (your scene's lines and duration) and `script/script.json` (your scene brief).
2. Build your scene in `src/scenes/Sxx.tsx` (you may add helpers in `src/scenes/Sxx/`). Export exactly `export const Sxx: React.FC`.
3. Type-check: `npx tsc --noEmit -p .` (from `exponential/`).
4. Render review stills: `node scripts/stills.mjs Sxx --n=12` (contact sheet) and `--at=4.5,7.2 --scale=1` for full-res detail. Look at them with the Read tool.
   Critique like a demanding creative director (composition, hierarchy, legibility, depth, colour story, polish), then iterate. Do at least 3 rounds.
5. Only edit your own scene files. If you believe a shared file needs a change, say so in your final report instead.
6. Final report: what the scene shows beat by beat (with times), the facts used and where from, per-frame render time, any known issues.

## Benchmark: the film we must beat (read this)
Two frames from the reference film are in `out/reference/` (look at them once). What it does well:
- **Information density with authentic micro-content.** Every shot carries 4–7 layers of *real, specific* detail:
  an era stamp, a model card (name · lab · date · params), a micro-chart or formula with its citation, a real prompt/completion,
  real code (`def attention(q, k, v): ...`), a real terminal line (`$ pytest -q … 42 passed in 1.21s`), sub-agent cards.
- Editorial HUD layout (corners used deliberately), thin warm line-work, glass UI panels, glowing curved connectors with data packets.
- A recurring protagonist (a token called "the") and big serif captions with italic emphasis.
Where it is weak, and where we win: it is flat 2D (no real light, depth or camera), one amber hue throughout, generic network graphs.
**We must match its information density AND beat it on light, depth, motion and story.** So:
1. Every key shot has 3–5 layers of verified micro-content (from FACTS.md), in clear hierarchy: one hero visual, then cards/labels/micro-charts.
2. UI, if shown, is glass panels floating in 3D space with parallax, depth-of-field (blur on far panels) and light spill: never flat.
3. Do NOT copy its beats (no unicorns, no "the" token, no Kaplan formula, no pytest line). Our protagonist is the ClaudeSpark.
4. The Film now draws an era stamp + chapter + a progress curve + frame counter in the TOP bar, and serif captions (with *italic* emphasis) in the BOTTOM bar. Don't duplicate an era stamp inside your scene.
5. Timing in `src/timing.json` is now FINAL (generated from the real voiceover). Scene lengths: S01 13, S02 15, S03 19, S04 18, S05 27, S06 23, S07 14, S08 34, S09 21, S10 21, S11 16 s.

## Usage budget (we hit an account rate limit once, so be economical)
- Contact sheets with `--n=6` to `--n=9`, at most 2 full-res stills per round, at most 3 review rounds per scene.
- Don't re-read files you have already read. Keep reports short.

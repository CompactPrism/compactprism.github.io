#!/usr/bin/env bash
# Finish the film after the scene batches: wait for them, count stats for the credits, render the last
# chunks (S07, S08, S11), assemble + mux the soundtrack, then encode a web version and a poster frame.
set -u
cd "$(dirname "$0")/.."
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
C=renders/film/chunks

while pgrep -f "render-film.mjs --only" > /dev/null; do sleep 20; done
for s in S01 S02 S03 S04 S05 S06 S09 S10; do [ -f $C/$s.mp4 ] || MISSING="${MISSING:-} $s"; done
if [ -n "${MISSING:-}" ]; then
  echo "re-rendering missing:${MISSING}"
  node scripts/render-film.mjs --only=$(echo ${MISSING} | tr ' ' ',') --concurrency=4
fi

node scripts/stats.mjs
node scripts/render-film.mjs --only=S07,S08,S11 --concurrency=4
node scripts/render-film.mjs --assemble

M=renders/film/EXPONENTIAL_master.mp4
[ -f "$M" ] || { echo "FAILED: no master"; exit 1; }
# Web version for GitHub Pages: H.264 high, 2-pass-quality CRF capped so the file stays well under 100 MB.
$FF -loglevel error -y -i "$M" -c:v libx264 -preset slow -crf 21 -maxrate 3000k -bufsize 6000k \
  -pix_fmt yuv420p -profile:v high -c:a aac -b:a 192k -movflags +faststart ../videos/exponential.mp4
# Poster: the hero reveal.
S05=$(node -e "const t=require('./src/timing.json');const s=t.scenes.find(x=>x.id==='S05');console.log(((s.start+s.duration-60)/t.fps).toFixed(2))")
$FF -loglevel error -y -ss "$S05" -i "$M" -frames:v 1 -q:v 3 ../videos/exponential_poster.jpg
ls -la "$M" ../videos/exponential.mp4 ../videos/exponential_poster.jpg
echo "FINISHED"

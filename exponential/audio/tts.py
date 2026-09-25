#!/usr/bin/env python3
"""Offline narration renderer: Kokoro-82M (kokoro-onnx) -> 24 kHz mono WAVs.

    python3 tts.py script.json out_dir/ [--voice af_heart] [--speed 0.95] [--raw]

script.json is a list of lines:

    [{"id": "L01", "text": "...", "voice": "bf_emma", "speed": 0.9,
      "phonemes": "..."}]                      # voice/speed/phonemes optional

Each line becomes out_dir/<id>.wav (24 kHz, mono, 16-bit), trimmed to ~40 ms
of silence at each end, and out_dir/manifest.json lists every line as
{id, file, duration_s, text, voice, speed, phonemes, g2p, peak_dbfs,
speech_rms_dbfs}. Kokoro is not bit-exact between runs (durations can move
by ~0.05 s), so drive Remotion timing from manifest.json, not constants.

Pronunciation control, from lightest to heaviest:
  * lexicon.json (next to this file, or --lexicon): word -> phonemes, applied
    to every line. A value is a string, or {"us": ..., "gb": ...}.
  * inline in "text": [AlphaFold](/ˈælfəfˌOld/) overrides one word.
  * "phonemes" on a line: the whole line as phonemes; G2P is skipped.
Phonemes use Kokoro's (misaki) alphabet: IPA plus A=eɪ I=aɪ O=oʊ Q=əʊ(GB)
W=aʊ Y=ɔɪ, T=flap t, ᵊ=reduced schwa, ʤ ʧ, stress marks ˈ ˌ.

G2P: misaki (the G2P Kokoro v1.0 was trained with) when installed, otherwise
kokoro-onnx's espeak-ng mapped to misaki symbols. Voices starting with "b"
use British G2P.

Setup (models/ is git-ignored):
  pip install kokoro-onnx soundfile scipy
  pip install --no-deps misaki==0.9.4 num2words && pip install addict regex spacy
  pip install https://github.com/explosion/spacy-models/releases/download/\
en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
  curl -L -o models/kokoro-v1.0.onnx https://github.com/thewh1teagle/\
kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx
  curl -L -o models/voices-v1.0.bin https://github.com/thewh1teagle/\
kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

HERE = Path(__file__).resolve().parent
SR = 24000
DEFAULT_MODEL = HERE / "models" / "kokoro-v1.0.onnx"
DEFAULT_VOICES = HERE / "models" / "voices-v1.0.bin"
DEFAULT_LEXICON = HERE / "lexicon.json"
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")

# --------------------------------------------------------------------------
# G2P
# --------------------------------------------------------------------------

# espeak-ng IPA -> misaki symbols (after misaki.espeak.EspeakFallback, Apache-2.0)
_E2M = sorted({
    "ʔˌn\u0329": "ʔn", "ʔn\u0329": "ʔn",
    "aɪ": "I", "aʊ": "W", "dʒ": "ʤ", "eɪ": "A", "tʃ": "ʧ", "ɔɪ": "Y",
    "ʲo": "jo", "ʲə": "jə", "ʲ": "",
    "ɚ": "əɹ", "r": "ɹ", "x": "k", "ç": "k", "ɐ": "ə", "ɬ": "l", "\u0303": "",
}.items(), key=lambda kv: -len(kv[0]))

# [word](/phonemes/)  -- misaki's inline override syntax
LINK_RE = re.compile(r"\[([^\]]+)\]\(/([^/)]*)/\)")


def espeak_to_misaki(ps: str, british: bool) -> str:
    for old, new in _E2M:
        ps = ps.replace(old, new)
    ps = re.sub("(\\S)\u0329", "ᵊ\\1", ps).replace("\u0329", "")
    if british:
        ps = ps.replace("eə", "ɛː").replace("iə", "ɪə").replace("əʊ", "Q")
    else:
        ps = ps.replace("oʊ", "O").replace("ɜːɹ", "ɜɹ").replace("ɜː", "ɜɹ")
        ps = ps.replace("ɪə", "iə").replace("ː", "")
    ps = ps.replace("ɹɹ", "ɹ")  # "ɚɹ" (linking r) -> "əɹɹ" otherwise
    return ps.replace("ɾ", "T").replace("ʔ", "t")


def _spell_years(text: str) -> str:
    """espeak reads 2017 as "two thousand seventeen"; say "twenty seventeen"."""
    try:
        from num2words import num2words
    except ImportError:
        return text
    return re.sub(r"(?<![\d.,$£€])\b(1[1-9]\d\d|20\d\d)\b(?![\d%]|[.,]\d)",
                  lambda m: num2words(int(m.group(1)), to="year").replace("-", " "),
                  text)


def _plural(ps: str, british: bool) -> str:
    """Phonemes for a possessive/plural 's after a word ending in ps."""
    last = ps.rstrip("ˈˌ")[-1:]
    if last in "szʃʒʧʤ":
        return ps + ("ɪz" if british else "ᵻz")
    return ps + ("s" if last in "ptkfθ" else "z")


class G2P:
    """Text -> Kokoro phoneme string, with lexicon and inline overrides."""

    def __init__(self, mode: str, tokenizer, lexicon: dict):
        self.tokenizer = tokenizer  # kokoro_onnx Tokenizer (espeak path)
        self.lexicon = lexicon
        self._misaki = {}
        self.mode = mode
        if mode in ("auto", "misaki"):
            try:
                import misaki.en  # noqa: F401
                import misaki.espeak  # noqa: F401
                self.mode = "misaki"
            except Exception as e:  # pragma: no cover - depends on install
                if mode == "misaki":
                    sys.exit(f"misaki G2P unavailable: {e}")
                self.mode = "espeak"
                print(f"[tts] misaki unavailable ({e}); using espeak-ng G2P",
                      file=sys.stderr)

    def _lex(self, word: str, british: bool) -> str | None:
        v = self.lexicon.get(word)
        if v is None:
            return None
        if isinstance(v, dict):
            return v.get("gb" if british else "us") or v.get("us") or v.get("gb")
        return v

    def apply_lexicon(self, text: str, british: bool) -> str:
        """Rewrite lexicon words (and their 's forms) as [word](/phonemes/)."""
        if not self.lexicon:
            return text
        words = sorted(self.lexicon, key=len, reverse=True)
        pat = re.compile(
            r"(?<![\w\[])(" + "|".join(map(re.escape, words)) + r")(['’]s)?(?![\w\]])")

        def sub(m):
            ps = self._lex(m.group(1), british)
            if m.group(2):
                ps = _plural(ps, british)
            return f"[{m.group(0)}](/{ps}/)"

        out, last = [], 0
        for m in LINK_RE.finditer(text):  # leave explicit overrides alone
            out.append(pat.sub(sub, text[last:m.start()]))
            out.append(m.group(0))
            last = m.end()
        out.append(pat.sub(sub, text[last:]))
        return "".join(out)

    def _misaki_g2p(self, british: bool):
        if british not in self._misaki:
            from misaki import en, espeak
            self._misaki[british] = en.G2P(
                trf=False, british=british,
                fallback=espeak.EspeakFallback(british=british))
        return self._misaki[british]

    def __call__(self, text: str, british: bool) -> str:
        text = self.apply_lexicon(text.strip(), british)
        if self.mode == "misaki":
            ps, _ = self._misaki_g2p(british)(text)
        else:
            lang = "en-gb" if british else "en-us"
            parts, last = [], 0
            text = _spell_years(text)
            for m in LINK_RE.finditer(text):
                chunk = text[last:m.start()]
                if chunk.strip():
                    parts.append(espeak_to_misaki(
                        self.tokenizer.phonemize(chunk, lang), british))
                parts.append(m.group(2))
                last = m.end()
            if text[last:].strip():
                parts.append(espeak_to_misaki(
                    self.tokenizer.phonemize(text[last:], lang), british))
            ps = " ".join(parts)
            # glue punctuation back onto the preceding word
            ps = re.sub(r"\s+([,.;:!?…])", r"\1", ps)
        return " ".join(ps.split())


# --------------------------------------------------------------------------
# DSP
# --------------------------------------------------------------------------

def db(x):
    return 20 * np.log10(np.maximum(x, 1e-12))


def shelf(kind: str, f0: float, gain_db: float, s: float = 0.7):
    """RBJ-cookbook shelving biquad as an sos row."""
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / 2 * np.sqrt((a + 1 / a) * (1 / s - 1) + 2)
    k = 2 * np.sqrt(a) * alpha
    if kind == "low":
        b = [a * ((a + 1) - (a - 1) * cw + k), 2 * a * ((a - 1) - (a + 1) * cw),
             a * ((a + 1) - (a - 1) * cw - k)]
        d = [(a + 1) + (a - 1) * cw + k, -2 * ((a - 1) + (a + 1) * cw),
             (a + 1) + (a - 1) * cw - k]
    else:
        b = [a * ((a + 1) + (a - 1) * cw + k), -2 * a * ((a - 1) + (a + 1) * cw),
             a * ((a + 1) + (a - 1) * cw - k)]
        d = [(a + 1) - (a - 1) * cw + k, 2 * ((a - 1) - (a + 1) * cw),
             (a + 1) - (a - 1) * cw - k]
    b, d = np.array(b) / d[0], np.array(d) / d[0]
    return np.concatenate([b, d])[None, :]


# Narrator chain settings (see master()).
HPF_HZ = 70           # 2nd-order Butterworth high-pass: rumble / DC
WARM_HZ, WARM_DB = 180, 1.5      # low-shelf body
AIR_HZ, AIR_DB = 7000, -2.0      # high-shelf: softens esses + vocoder fizz
COMP = dict(thresh_db=-18.0, ratio=2.0, knee_db=8.0, attack_ms=8.0,
            release_ms=150.0)
CEILING_DBFS = -1.0
SPEECH_DBFS = -20.0   # --norm speech target (RMS of speech, pauses excluded)

_EQ = np.vstack([
    signal.butter(2, HPF_HZ, "highpass", fs=SR, output="sos"),
    shelf("low", WARM_HZ, WARM_DB),
    shelf("high", AIR_HZ, AIR_DB),
])


def compress(x, thresh_db, ratio, knee_db, attack_ms, release_ms):
    """Soft-knee feed-forward RMS compressor (1 kHz control rate)."""
    hop = SR // 1000
    c = np.exp(-1 / (0.005 * SR))                       # 5 ms RMS window
    level = 10 * np.log10(signal.lfilter([1 - c], [1, -c], x * x)[::hop] + 1e-12)
    over = level - thresh_db
    slope = 1 - 1 / ratio
    gr = np.where(over <= -knee_db / 2, 0.0,
                  np.where(over >= knee_db / 2, slope * over,
                           slope * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    at, rt = np.exp(-1 / attack_ms), np.exp(-1 / release_ms)
    sm = np.empty_like(gr)
    g = 0.0
    for i, target in enumerate(gr):  # attack when GR rises, release when it falls
        k = at if target > g else rt
        g = k * g + (1 - k) * target
        sm[i] = g
    gain = np.interp(np.arange(len(x)), np.arange(len(sm)) * hop, sm)
    return x * 10 ** (-gain / 20), float(sm.max()) if len(sm) else 0.0


def peak_normalise(x, dbfs=CEILING_DBFS):
    peak = np.abs(x).max()
    return x * (10 ** (dbfs / 20) / peak) if peak > 0 else x


def speech_rms_db(x, within_db=40.0):
    """RMS of the 10 ms frames within within_db of the loudest (pauses ignored)."""
    lv = frame_rms_db(x)
    act = lv[lv > lv.max() - within_db]
    return float(10 * np.log10(np.mean(10 ** (act / 10))))


def master(x, norm="peak"):
    """Cinematic narrator chain: HPF 70 Hz, +1.5 dB low shelf @180 Hz,
    -2 dB high shelf @7 kHz, gentle 2:1 soft-knee compression, then
    norm="peak": peak to -1 dBFS; norm="speech": speech RMS to SPEECH_DBFS,
    peak still capped at -1 dBFS (keeps one-word lines from jumping out).
    No reverb/saturation: the music mix adds space later."""
    x = signal.sosfilt(_EQ, x.astype(np.float64))
    x = peak_normalise(x)                  # fixed level into the compressor
    x, _ = compress(x, **COMP)
    x = peak_normalise(x)
    if norm == "speech":
        x = x * 10 ** (min(SPEECH_DBFS - speech_rms_db(x), 0.0) / 20)
    return x


def frame_rms_db(x, frame=240):
    n = len(x) // frame
    if n == 0:
        return np.array([db(np.sqrt(np.mean(x ** 2)))]) if len(x) else np.array([])
    return db(np.sqrt((x[: n * frame].reshape(n, frame) ** 2).mean(1)))


def trim(x, pad_ms=40, below_peak_db=40.0, fade_ms=8):
    """Cut to the first/last 10 ms frame within below_peak_db of the loudest
    frame, keep pad_ms either side, and fade the outer edges."""
    frame = SR // 100
    lv = frame_rms_db(x, frame)
    if len(lv) == 0:
        return x
    active = np.flatnonzero(lv > lv.max() - below_peak_db)
    pad = int(pad_ms * SR / 1000)
    start = max(0, active[0] * frame - pad)
    end = min(len(x), (active[-1] + 1) * frame + pad)
    y = x[start:end].copy()
    f = min(int(fade_ms * SR / 1000), len(y) // 2)
    if f > 0:
        ramp = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, f))
        y[:f] *= ramp
        y[-f:] *= ramp[::-1]
    return y


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def load_script(path: Path) -> list[dict]:
    lines = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(lines, list):
        sys.exit("script.json must be a JSON list of line objects")
    seen = set()
    for i, ln in enumerate(lines):
        if not isinstance(ln, dict) or "id" not in ln or not (
                ln.get("text") or ln.get("phonemes")):
            sys.exit(f"line {i}: needs 'id' and 'text' (or 'phonemes')")
        lid = str(ln["id"])
        if not ID_RE.match(lid):
            sys.exit(f"line {i}: id {lid!r} must be a plain file-name stem")
        if lid in seen:
            sys.exit(f"line {i}: duplicate id {lid!r}")
        seen.add(lid)
    return lines


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Render script.json lines to WAV with Kokoro-82M.")
    ap.add_argument("script", type=Path, nargs="?")
    ap.add_argument("out_dir", type=Path, nargs="?")
    ap.add_argument("--voice", default="af_heart",
                    help="default voice (per-line 'voice' wins)")
    ap.add_argument("--speed", type=float, default=0.95,
                    help="default speed 0.5-2.0 (per-line 'speed' wins)")
    ap.add_argument("--norm", choices=["peak", "speech"], default="peak",
                    help="final level: peak -1 dBFS (default), or speech RMS "
                         f"{SPEECH_DBFS:g} dBFS capped at -1 dBFS peak")
    ap.add_argument("--raw", action="store_true",
                    help="skip the narrator EQ/compression/normalise chain "
                         "(silence trim still applies)")
    ap.add_argument("--g2p", choices=["auto", "misaki", "espeak"], default="auto")
    ap.add_argument("--lexicon", type=Path, default=DEFAULT_LEXICON,
                    help="word->phonemes JSON (default: lexicon.json here, if any)")
    ap.add_argument("--pad-ms", type=float, default=40.0,
                    help="silence kept at each end after trimming")
    ap.add_argument("--sentence-pause", type=float, default=0.25,
                    help="min pause (s) after . ! ? inside a line")
    ap.add_argument("--clause-pause", type=float, default=0.1,
                    help="min pause (s) after , ; : inside a line")
    ap.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    ap.add_argument("--voices", type=Path, default=DEFAULT_VOICES)
    ap.add_argument("--dry-run", action="store_true",
                    help="print the phonemes for each line; write nothing")
    ap.add_argument("--list-voices", action="store_true")
    args = ap.parse_args(argv)

    from kokoro_onnx import Kokoro
    for p in (args.model, args.voices):
        if not p.exists():
            sys.exit(f"missing {p} - download from https://github.com/"
                     "thewh1teagle/kokoro-onnx/releases (model-files-v1.1)")
    kokoro = Kokoro(str(args.model), str(args.voices))
    voices = set(kokoro.get_voices())
    if args.list_voices:
        print("\n".join(sorted(voices)))
        return

    if args.script is None or (args.out_dir is None and not args.dry_run):
        ap.error("script.json and out_dir/ are required")
    lines = load_script(args.script)
    lexicon = {}
    if args.lexicon and args.lexicon.exists():
        lexicon = {k: v for k, v in json.loads(
            args.lexicon.read_text(encoding="utf-8")).items()
            if not k.startswith("_")}
    g2p = G2P(args.g2p, kokoro.tokenizer, lexicon)
    vocab = kokoro.tokenizer.vocab

    if not args.dry_run:
        args.out_dir.mkdir(parents=True, exist_ok=True)
    manifest, audio_s, synth_s = [], 0.0, 0.0
    t_all = time.perf_counter()
    for ln in lines:
        lid = str(ln["id"])
        voice = ln.get("voice") or args.voice
        speed = float(ln.get("speed", args.speed))
        if voice not in voices:
            sys.exit(f"{lid}: unknown voice {voice!r} (see --list-voices)")
        if not 0.5 <= speed <= 2.0:
            sys.exit(f"{lid}: speed {speed} outside 0.5-2.0")
        british = voice.startswith("b")
        if ln.get("phonemes"):
            ps, how = " ".join(ln["phonemes"].split()), "phonemes"
        else:
            ps, how = g2p(ln["text"], british), g2p.mode
        dropped = sorted({c for c in ps if c not in vocab and not c.isspace()})
        if dropped:
            print(f"[tts] {lid}: not in Kokoro vocab, dropped: {''.join(dropped)}"
                  f"  (unknown word? add it to the lexicon)", file=sys.stderr)
        if args.dry_run:
            print(f"{lid}\t{voice}\t{ps}")
            continue

        t0 = time.perf_counter()
        try:
            audio, _ = kokoro.create(
                ps, voice=voice, speed=speed, is_phonemes=True, trim=True,
                sentence_pause=args.sentence_pause, clause_pause=args.clause_pause)
        except ValueError as e:
            sys.exit(f"{lid}: {e}")
        synth_s += time.perf_counter() - t0
        audio = np.asarray(audio, dtype=np.float64)
        if not args.raw:
            audio = master(audio, args.norm)
        audio = np.clip(trim(audio, pad_ms=args.pad_ms), -1.0, 1.0)

        fname = f"{lid}.wav"
        sf.write(args.out_dir / fname, audio, SR, subtype="PCM_16")
        dur = len(audio) / SR
        audio_s += dur
        manifest.append({
            "id": lid, "file": fname, "duration_s": round(dur, 3),
            "text": ln.get("text", ""), "voice": voice, "speed": speed,
            "phonemes": ps, "g2p": how,
            "peak_dbfs": round(float(db(np.abs(audio).max())), 1),
            "speech_rms_dbfs": round(speech_rms_db(audio), 1),
        })
        print(f"{lid}  {dur:6.2f}s  {voice}  {how}", file=sys.stderr)

    if args.dry_run:
        return
    (args.out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    wall = time.perf_counter() - t_all
    print(f"[tts] {len(manifest)} lines, {audio_s:.1f}s audio; model "
          f"{audio_s / max(synth_s, 1e-9):.1f}x realtime, end-to-end "
          f"{audio_s / max(wall, 1e-9):.1f}x (incl. G2P + post)", file=sys.stderr)


if __name__ == "__main__":
    main()

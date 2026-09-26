#!/usr/bin/env python3
"""EXPONENTIAL: An Origin Story -- original score, synthesised from nothing.

    python3 audio/score.py            # -> public/audio/music.wav (48 kHz, stereo, 24-bit)
    python3 audio/score.py --jobs 2   # fewer worker processes (default 3)

No samples, no soundfonts: every sound is additive / subtractive / FM synthesis
in numpy + scipy. The file is organised as

  1. INSTRUMENTS   functions that return peak-normalised stereo float32 (2, n)
  2. CUE SHEET     one function per scene; every time is derived from
                   src/timing.json (scene start/duration, VO line cue/end), so a
                   new voiceover re-syncs the whole score on the next run
  3. MIXER         render cues in parallel -> dry + 3 reverb sends (convolution
                   with synthetic stereo IRs) -> automation (breaths, pre-hit
                   gap) -> VO "pocket" (dynamic 1-4 kHz dip while lines play) ->
                   mono bass -> true-peak-safe limiter -> 24-bit WAV

The HERO MOTIF (D major): D4 - A4 - G4 - B4 - A4
  a rising fifth (the hero stands up), a turn down to G and a lift to the sixth
  (B, the yearning note), landing on the fifth, open and hopeful. Its answer
  phrase climbs to the octave through the leading tone: D4 A4 G4 D5 C#5 -> D5.
  Minor (enemy) form in B minor: B3 F#4 E4 G4 F#4.
  Hint (S01 bells, S05 piano) -> full at the reveal (S05) -> fragments and
  minor/major variations through the battles (S06, S08) -> choir theme (S09)
  -> slow noble statement + final title chord (S10) -> piano reprise (S11).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import zlib
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import uniform_filter1d

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dsp import (F32, SR, biquad, bp, convolve_st, db, env_ar, env_pts, hp, hz, zhp,  # noqa: E402
                 limiter, lp, make_ir, midi, nharm, ns, phase_of, smoothstep, true_peak_db,
                 tvec, tvfilt, wt, wtable, zbp, zlp, lufs_integrated)

ROOT = Path(__file__).resolve().parent.parent
TIMING = ROOT / 'src' / 'timing.json'
OUT = ROOT / 'public' / 'audio' / 'music.wav'
ANALYSIS = ROOT / 'audio' / 'analysis'


# =============================================================================
# 1. INSTRUMENTS
# =============================================================================
def _norm(x, peak=1.0):
    m = float(np.abs(x).max()) if x.size else 0.0
    return (x * (peak / m)).astype(F32) if m > 0 else x.astype(F32)


def _drift(n, rate, rng):
    """Smooth random curve in [-1, 1] (cosine-interpolated random points)."""
    k = int(n / SR * rate) + 3
    p = rng.uniform(-1, 1, k)
    x = np.linspace(0, k - 2.0001, n)
    i = x.astype(np.int32)
    f = x - i
    f = f * f * (3 - 2 * f)
    return p[i] + (p[i + 1] - p[i]) * f


def _st(x):
    """Mono -> (2, n)."""
    return np.stack([x, x]).astype(F32)


def saw_stack(freqs, n, rng, det=12.0, nv=6, tilt=1.0, vib=0.0, vib_rate=5.2, vib_delay=0.6,
              drift=3.0, width=0.9, scoop=0.0, glide=None, amps=None, hlimit=12000.0):
    """Unison of `nv` detuned band-limited saws per note, spread across the stereo field.
    det/drift/vib/scoop in cents; glide = cents curve (array) applied to every voice."""
    t = tvec(n)
    out = np.zeros((2, n))
    venv = smoothstep((t - vib_delay) / 1.2) if vib else None
    sc = -scoop * 100.0 * np.exp(-t / 0.07) if scoop else 0.0
    gmax = float(np.max(glide)) if glide is not None else 0.0
    for j, f in enumerate(freqs):
        a = 1.0 if amps is None else amps[j]
        tab = wtable(nharm(f * 2 ** ((gmax + det + 30) / 1200), hlimit), tilt)
        for v in range(nv):
            c = ((v / (nv - 1)) * 2 - 1) * det if nv > 1 else 0.0
            cents = c + rng.normal(0, 0.12 * det + 0.3) + drift * _drift(n, 0.2 + 0.25 * rng.random(), rng) + sc
            if glide is not None:
                cents = cents + glide
            if vib:
                r = vib_rate * (1 + 0.07 * rng.standard_normal())
                cents = cents + vib * venv * np.sin(2 * np.pi * r * t + rng.uniform(0, 6.283))
            y = wt(phase_of(f * np.exp2(cents / 1200.0), rng.random()), tab)
            p = (((v + 0.5 * (j % 2)) % nv) / max(nv - 1, 1) * 2 - 1) * width if nv > 1 else 0.0
            th = (p + 1) * np.pi / 4
            out[0] += a * np.cos(th) * y
            out[1] += a * np.sin(th) * y
    return out


BRIGHT = 1.35  # global string/brass brightness (the VO pocket protects the voice band)


def pad(notes, dur, att=1.2, rel=2.0, fc=1400.0, fc_pts=None, fc_floor=None, follow=0.0, q=0.8,
        det=12.0, nv=6, tilt=1.0, vib=0.0, vib_rate=5.2, drift=3.0, width=0.9, scoop=0.0, drive=0.0,
        dec=None, sus=1.0, att_curve=1.0, amps=None, amp_pts=None, glide_pts=None, stages=2,
        hlimit=12000.0, seed=0):
    """Warm detuned-saw string/brass pad through a resonant (time-varying) low-pass.
    follow>0 makes the cutoff track the amplitude envelope (brassy 'blat')."""
    rng = np.random.default_rng(seed)
    e = env_ar(dur, att, rel, dec, sus, att_curve)
    n = len(e)
    if amp_pts:
        e = e * env_pts(amp_pts, n)
    glide = env_pts(glide_pts, n).astype(np.float64) if glide_pts else None
    x = saw_stack([hz(m) for m in notes], n, rng, det, nv, tilt, vib, vib_rate, drift=drift, width=width,
                  scoop=scoop, glide=glide, amps=amps, hlimit=hlimit)
    fcc = (env_pts(fc_pts, n) if fc_pts else np.full(n, fc, F32)) * BRIGHT
    if follow:
        lo = fc_floor if fc_floor is not None else 0.25 * fcc
        fcc = lo + (fcc - lo) * np.clip(e, 0, 1) ** follow
    y = tvfilt(x, 'lp', fcc, q, stages=stages) * e
    if drive:
        y = np.tanh(drive * _norm(y))
    return _norm(y)


def brass(notes, dur, att=0.12, rel=0.9, bright=2600.0, dark=260.0, q=1.1, nv=3, det=7.0, vib=6.0,
          drive=1.3, seed=0, **kw):
    """Horn/brass section: few voices, scoop into pitch, cutoff follows loudness, saturated."""
    return pad(notes, dur, att=att, rel=rel, fc=bright, fc_floor=dark, follow=1.6, q=q, nv=nv, det=det,
               vib=vib, scoop=0.3, drive=drive, tilt=0.9, seed=seed, **kw)


def braam(notes, dur=0.6, rel=2.5, bright=2400.0, drive=3.0, seed=0):
    """Trailer 'braam': low brass cluster, fast resonant filter blast, heavy saturation."""
    rng = np.random.default_rng(seed)
    e = env_ar(dur, 0.012, rel, dec=0.45, sus=0.5)
    n = len(e)
    x = saw_stack([hz(m) for m in notes], n, rng, det=18, nv=5, tilt=0.8, drift=6, width=1.0, hlimit=9000)
    fc = env_pts([(0, 220), (0.07, bright), (0.55, bright * 0.45), (dur + rel, 260)], n)
    y = tvfilt(x, 'lp', fc, q=2.6, stages=2) * e
    y = np.tanh(drive * _norm(y))
    f0 = hz(notes[0])
    t = tvec(n)
    y = y + 0.6 * np.sin(2 * np.pi * f0 * t) * e
    return _norm(y)


VOWELS = {  # formant freqs (Hz), gains (dB), bandwidths (Hz): alto-ish choir
    'ah': ([800, 1150, 2800, 3500], [0, -4, -20, -36], [80, 90, 120, 130]),
    'oh': ([450, 800, 2830, 3500], [0, -9, -16, -28], [70, 80, 100, 130]),
    'oo': ([325, 700, 2530, 3500], [0, -12, -30, -40], [50, 60, 170, 180]),
}


def _formant(x, vowel, bws=1.7):
    F, A, B = VOWELS[vowel]
    y = np.zeros_like(x)
    for f, a, b in zip(F, A, B):
        y += db(a) * biquad(x, 'bp', f, q=f / (b * bws))
    return y


def choir(notes, dur, att=2.0, rel=2.5, vowel='oo', to_vowel=None, morph=(0.2, 0.8), nv=4, vib=16.0,
          breath=0.05, width=1.0, amps=None, amp_pts=None, att_curve=1.0, seed=0):
    """Formant-filtered choir pad: glottal-ish saw ensemble with vibrato -> vowel formant bank."""
    rng = np.random.default_rng(seed)
    e = env_ar(dur, att, rel, att_curve=att_curve)
    n = len(e)
    if amp_pts:
        e = e * env_pts(amp_pts, n)
    src = saw_stack([hz(m) for m in notes], n, rng, det=9, nv=nv, tilt=1.2, vib=vib, vib_rate=5.3,
                    vib_delay=0.35, drift=6, width=width, amps=amps, hlimit=8000)
    src = _norm(src) + breath * hp(rng.standard_normal((2, n)).astype(F32), 400)
    y = _formant(src, vowel)
    if to_vowel:
        m = env_pts([(0, 0), (morph[0] * dur, 0), (morph[1] * dur, 1), (dur + rel + 1, 1)], n)
        y = y * (1 - m) + _formant(src, to_vowel) * m
    return _norm(y * e)


def piano(note, dur=2.0, vel=0.6, rel=0.3, seed=0):
    """Additive/modal 'piano': inharmonic partials as damped resonators (lfilter), two
    slightly detuned strings per partial (beating + double decay), velocity-dependent
    hammer pulse (softer = wider = darker), hammer-position comb, damper on release."""
    rng = np.random.default_rng(seed)
    f0 = hz(note)
    T = float(np.clip(7.5 * (130.0 / f0) ** 0.55, 1.2, 14.0))
    B = 0.00012 * (f0 / 130.0) ** 1.2 + 0.00004
    n = ns(dur + rel + 0.05)
    w = max(4, ns(0.0016 - 0.0012 * vel))
    exc = np.zeros(n)
    exc[:w] = np.hanning(w)
    exc /= exc.sum()
    out = np.zeros(n)
    for k in range(1, 48):
        fk = k * f0 * np.sqrt(1 + B * k * k)
        if fk > 15000:
            break
        amp = (abs(np.sin(np.pi * k * 0.118)) + 0.06) / k ** 0.55
        tk = T / (1 + 0.3 * (k - 1) ** 1.15)
        for dc, tau, g in ((-1, tk * 0.2, 0.62), (1, tk, 0.38)):
            fr = fk * 2 ** (dc * (0.22 + 0.04 * k) / 1200)
            r = np.exp(-1.0 / (tau * SR))
            w0 = 2 * np.pi * fr / SR
            out += amp * g * signal.lfilter([np.sin(w0)], [1, -2 * r * np.cos(w0), r * r], exc)
    t = tvec(n)
    off = t > dur
    out[off] *= np.exp(-(t[off] - dur) / max(rel / 4, 0.02))
    knock = lp(rng.standard_normal(n), 900 + 2500 * vel) * np.exp(-t / 0.005) * 0.004 * vel
    y = out + knock
    p = float(np.clip((midi(note) - 62) / 36.0, -0.5, 0.5))
    return _norm(np.stack([y * np.cos((p + 1) * np.pi / 4), y * np.sin((p + 1) * np.pi / 4)])) * (0.3 + 0.7 * vel)


def bell(note, dur=4.0, ratio=3.5, index=3.0, tau=1.8, tau_i=0.5, det=3.0, body=0.3, seed=0):
    """2-operator FM bell/pluck. ratio 3.5 / 1.41 = cold steel; 2.0 / 4.0 = warm / celesta;
    ratio 1 with a fast index decay = pluck."""
    f = hz(note)
    n = ns(dur)
    t = tvec(n)
    idx = index * np.exp(-t / tau_i)
    ys = [np.sin(2 * np.pi * f * 2 ** (c / 1200) * t + idx * np.sin(2 * np.pi * f * 2 ** (c / 1200) * ratio * t))
          for c in (-det, det)]
    y = np.stack(ys)
    y = y + body * np.sin(2 * np.pi * f * t)[None] * np.exp(-t / (tau * 1.5))
    y = y * np.exp(-t / tau) * smoothstep(t / 0.0015)
    y[:, -ns(0.05):] *= np.linspace(1, 0, ns(0.05))
    return _norm(y)


def shimmer(notes, dur, att=1.0, rel=1.5, trem=5.0, breathe=0.0, seed=0):
    """High sine cluster with independent tremolo per voice (glints of light)."""
    rng = np.random.default_rng(seed)
    e = env_ar(dur, att, rel)
    n = len(e)
    t = tvec(n)
    y = np.zeros((2, n))
    for m in notes:
        for ch in range(2):
            f = hz(m) * 2 ** (rng.normal(0, 4) / 1200)
            am = 0.6 + 0.4 * np.sin(2 * np.pi * trem * (0.7 + 0.6 * rng.random()) * t + rng.uniform(0, 6.28))
            y[ch] += am * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
    if breathe:
        y *= 0.55 + 0.45 * np.sin(2 * np.pi * breathe * t - np.pi / 2)
    return _norm(y * e)


def spark(seed=0):
    """The hero's first spark: a tiny celesta arpeggio + a breathing high shimmer."""
    n = ns(7.0)
    out = np.zeros((2, n), F32)
    for k, (m, dt) in enumerate([('A6', 0.0), ('D7', 0.07), ('F#7', 0.15), ('A7', 0.28)]):
        b = bell(m, 3.0, ratio=4.0, index=1.0, tau=0.8, tau_i=0.15, body=0.6, seed=seed + k) * 0.8 ** k
        i0 = ns(dt) if dt else 0
        out[:, i0:i0 + b.shape[1]] += b[:, :n - i0]
    sh = shimmer(['D7', 'A7', 'E8'], 5.2, att=0.8, rel=1.2, trem=7.0, breathe=0.35, seed=seed)
    out[:, ns(0.1):ns(0.1) + sh.shape[1]] += 0.35 * sh[:, :n - ns(0.1)]
    return _norm(out)


def impact(f0=110.0, f1=32.0, tau=1.6, ptau=0.09, crack=1.0, body=1.0, drive=2.5, length=None, seed=0):
    """Trailer impact: pitched sine drop + low thump + noise crack, saturated."""
    rng = np.random.default_rng(seed)
    n = ns(length or max(2.5, 4 * tau))
    t = tvec(n)
    f = f1 + (f0 - f1) * np.exp(-t / ptau)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.55 * tau)) * smoothstep(t / 0.003)
    nz = rng.standard_normal((2, n)).astype(F32)
    thump = bp(nz[0], 60, 320, 2) * np.exp(-t / 0.12) * 4.0 * body
    cr = hp(nz, 1800, 2) * np.exp(-t / 0.028) + 0.6 * bp(nz, 300, 2500) * np.exp(-t / 0.07)
    st = (boom + 0.5 * thump)[None] + crack * 0.35 * cr / (np.abs(cr).max() + 1e-9) * 2.0
    st = st / np.abs(st).max()
    y = np.tanh(drive * st) / np.tanh(drive)
    y[:, -ns(0.3):] *= np.linspace(1, 0, ns(0.3))
    return _norm(y)


def crash(dur=3.5, att=0.002, seed=0):
    """Cymbal-ish wash: bright noise bands, exponential decay."""
    rng = np.random.default_rng(seed)
    n = ns(dur)
    t = tvec(n)
    nz = rng.standard_normal((2, n)).astype(F32)
    y = hp(nz, 3500, 2) * np.exp(-t / (dur * 0.28)) + 0.7 * bp(nz, 5000, 11000, 2) * np.exp(-t / (dur * 0.18))
    return _norm(y * smoothstep(t / att))


def revcym(dur=1.5, seed=0):
    """Reversed cymbal: swells into the downbeat."""
    return _norm(crash(dur, seed=seed)[:, ::-1] * smoothstep(tvec(ns(dur)) / (0.4 * dur)))


def riser(dur=4.0, f0=250.0, f1=9000.0, q=2.0, shape=2.5, pitched=None, seed=0):
    """Noise sweep (rising resonant band) + optional pitched saw glissando up an octave."""
    rng = np.random.default_rng(seed)
    n = ns(dur)
    t = tvec(n)
    x = t / dur
    nz = rng.standard_normal((2, n)).astype(F32)
    fc = f0 * (f1 / f0) ** (x ** 1.4)
    y = tvfilt(nz, 'bp', fc, q) + 0.35 * tvfilt(nz, 'lp', fc * 0.5, 0.7)
    y = _norm(y)
    if pitched:
        g = -1200.0 * (1 - x) ** 1.5
        s = saw_stack([hz(m) for m in pitched], n, rng, det=14, nv=4, tilt=1.0, drift=4, glide=g, hlimit=9000)
        y = y + 0.8 * _norm(tvfilt(s, 'lp', 300 + 5000 * x ** 2, 1.2))
    y = y * x ** shape
    y[:, -ns(0.006):] *= np.linspace(1, 0, ns(0.006))
    return _norm(y)


_IR_CACHE = {}


def revswell(notes, dur=3.0, bright=3500.0, seed=0):
    """Reversed reverb of a chord: swells from nothing and stops dead on the downbeat."""
    src = pad(notes, 0.3, att=0.004, rel=0.25, fc=bright, q=0.7, nv=5, det=10, seed=seed)
    key = round(dur, 2)
    if key not in _IR_CACHE:
        _IR_CACHE[key] = make_ir(rt60=max(2.2, dur * 0.95), length=dur + 0.2, predelay=0.0, seed=91, er=False)
    ir = _IR_CACHE[key]
    m = ns(dur + 0.2)
    x = np.zeros((2, m), F32)
    x[:, :min(m, src.shape[1])] = src[:, :m]
    wet = convolve_st(x, ir)[:, :ns(dur)][:, ::-1]
    wet = wet * smoothstep(tvec(wet.shape[1]) / (0.7 * dur))
    wet[:, -ns(0.004):] *= np.linspace(1, 0, ns(0.004))
    return _norm(wet)


def shepard(dur, rate0=0.08, rate1=1.2, f_lo=32.0, n_oct=8, chord=(0, 7), amp_pts=None, att=1.5, rel=0.08,
            harm=0.3, seed=0):
    """Shepard-Risset glissando: octave-spaced (D + A) components glide up forever under a
    raised-cosine window over log-frequency; the climb rate accelerates exponentially."""
    rng = np.random.default_rng(seed)
    n = ns(dur)
    t = tvec(n)
    rate = rate0 * (rate1 / rate0) ** (t / dur)
    x = np.cumsum(rate) / SR
    y = np.zeros((2, n))
    for k in range(n_oct):
        for iv in chord:
            pos = np.mod(k + iv / 12.0 + x, n_oct)
            w = np.sin(np.pi * pos / n_oct) ** 2
            for ch, dc in enumerate((-5.0, 5.0)):
                ph = 2 * np.pi * np.cumsum(f_lo * np.exp2(pos + dc / 1200)) / SR + rng.uniform(0, 6.28)
                y[ch] += w * (np.sin(ph) + harm * np.sin(2 * ph))
    e = env_ar(dur - rel, att, rel)[:n]
    e = np.pad(e, (0, n - len(e)))
    if amp_pts:
        e = e * env_pts(amp_pts, n)
    return _norm(lp(y * e, 6000, 2))


def timp(note='D2', vel=0.8, dur=2.5, seed=0):
    """Timpani-like drum: inharmonic membrane modes, pitch settles after the stroke, felt thud."""
    rng = np.random.default_rng(seed)
    f = hz(note)
    n = ns(dur)
    t = tvec(n)
    pitch = 1 + 0.05 * vel * np.exp(-t / 0.05)
    y = np.zeros(n)
    for r, a, d in ((1.0, 1.0, 1.0), (1.504, 0.55, 0.55), (1.742, 0.35, 0.45), (2.0, 0.3, 0.4),
                    (2.245, 0.18, 0.3), (2.494, 0.12, 0.25)):
        y += a * np.exp(-t / (dur * 0.33 * d)) * np.sin(2 * np.pi * np.cumsum(f * r * pitch) / SR + rng.uniform(0, 6))
    y += lp(rng.standard_normal(n), 500 + 1800 * vel) * np.exp(-t / 0.022) * 0.35 / 0.05
    y = np.tanh(1.5 * _norm(y * smoothstep(t / 0.0015)))
    y[-ns(0.05):] *= np.linspace(1, 0, ns(0.05))
    return _norm(_st(y)) * (0.25 + 0.75 * vel)


def drum(f=52.0, vel=0.9, dur=1.2, seed=0):
    """Low taiko-style drum: fast pitch drop, skin slap, body noise."""
    rng = np.random.default_rng(seed)
    n = ns(dur)
    t = tvec(n)
    ff = f + f * 1.4 * np.exp(-t / 0.025)
    y = np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t / 0.28)
    nz = rng.standard_normal(n)
    y += 0.5 * bp(nz, 80, 500) * np.exp(-t / 0.06) / 0.1 * 0.1
    y += 0.12 * hp(nz, 1500) * np.exp(-t / 0.01)
    y = np.tanh(1.8 * _norm(y))
    y[-ns(0.05):] *= np.linspace(1, 0, ns(0.05))
    return _norm(_st(y)) * (0.25 + 0.75 * vel)


def tick(kind='tick', vel=1.0, seed=0):
    """Clock tick / tock, hat, sub kick."""
    rng = np.random.default_rng(seed)
    n = ns(0.6 if kind == 'kick' else 0.15)
    t = tvec(n)
    nz = rng.standard_normal(n)
    if kind == 'tick':
        y = hp(nz, 6000, 2) * np.exp(-t / 0.0035) + 0.25 * np.sin(2 * np.pi * 7300 * t) * np.exp(-t / 0.005)
    elif kind == 'tock':
        y = (np.sin(2 * np.pi * 480 * t) * np.exp(-t / 0.03) + 0.35 * np.sin(2 * np.pi * 1130 * t) * np.exp(-t / 0.015)
             + 0.3 * bp(nz, 250, 1200) * np.exp(-t / 0.008) * 4)
    elif kind == 'hat':
        y = hp(nz, 8000, 2) * np.exp(-t / 0.02)
    else:  # kick
        f = 44 + 80 * np.exp(-t / 0.028)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.2)
    y = y * smoothstep(t / 0.0008)
    y[-ns(0.01):] *= np.linspace(1, 0, ns(0.01))
    return _norm(_st(y)) * vel


def spic(note, vel=0.8, dur=0.14, bright=1800.0, seed=0):
    """Spiccato string note for ostinati: short bowed saw unison, bright attack."""
    rng = np.random.default_rng(seed)
    n = ns(dur + 0.22)
    t = tvec(n)
    x = saw_stack([hz(note)], n, rng, det=7, nv=3, drift=2, width=0.7, hlimit=8000)
    e = smoothstep(t / 0.004) * (0.75 * np.exp(-t / 0.06) + 0.25) * 0.5 * (1 + np.cos(np.pi * np.clip((t - dur) / 0.2, 0, 1)))
    y = biquad(x, 'lp', bright * (0.55 + 0.45 * vel), q=1.1) * e
    return _norm(y) * vel


def wind(dur, att=1.0, rel=1.5, lo=250.0, hi=1400.0, seed=0):
    """Cold wind: noise through slowly wandering resonant bands + low rumble."""
    rng = np.random.default_rng(seed)
    e = env_ar(dur, att, rel)
    n = len(e)
    nz = rng.standard_normal((2, n)).astype(F32)
    y = np.zeros((2, n), F32)
    for k in range(2):
        c = np.exp(np.log(lo) + (np.log(hi) - np.log(lo)) * (0.5 + 0.5 * _drift(n, 0.35, rng)))
        y += tvfilt(nz, 'bp', c, q=5.0, block=512) * (0.6 + 0.4 * _drift(n, 0.5, rng))
    y = _norm(y) + 0.6 * _norm(lp(nz, 160, 2))
    return _norm(y * e)


def thunder(dur=5.0, seed=0):
    """Distant thunder: low rumble + rolling mid band + a few crackles."""
    rng = np.random.default_rng(seed)
    n = ns(dur)
    t = tvec(n)
    nz = rng.standard_normal((2, n)).astype(F32)
    rumble = _norm(lp(nz, 110, 2)) * smoothstep(t / 0.2) * np.exp(-t / (dur * 0.35))
    roll = _norm(lp(nz, 450, 2)) * (0.5 + 0.5 * _drift(n, 2.5, rng)) * np.exp(-t / (dur * 0.2)) * smoothstep(t / 0.05)
    cr = np.zeros((2, n))
    band = _norm(bp(nz, 250, 2200, 2))
    for _ in range(6):
        t0 = rng.uniform(0.0, 0.9)
        cr += band * np.where(t > t0, np.exp(-(t - t0) / 0.07), 0.0) * rng.uniform(0.2, 0.6)
    y = rumble + 0.6 * roll + 0.5 * cr
    y[:, -ns(0.2):] *= np.linspace(1, 0, ns(0.2))
    return _norm(y)


def air(dur, att=2.0, rel=2.0, seed=0):
    """Dark room tone: low noise + a whisper of air."""
    rng = np.random.default_rng(seed)
    e = env_ar(dur, att, rel)
    n = len(e)
    nz = rng.standard_normal((2, n)).astype(F32)
    y = _norm(lp(nz, 200, 2)) + 0.03 * _norm(hp(nz, 9000, 2))
    return _norm(y * e * (0.75 + 0.25 * _drift(n, 0.15, rng)))


def sub(notes, dur, att=0.5, rel=1.0, breathe=0.0, drive=1.3, seed=0):
    """Sub-bass: sines with gentle saturation (adds audible 2nd/3rd harmonics)."""
    rng = np.random.default_rng(seed)
    e = env_ar(dur, att, rel)
    n = len(e)
    t = tvec(n)
    y = sum(np.sin(2 * np.pi * hz(m) * t + rng.uniform(0, 6)) for m in notes)
    if breathe:
        y = y * (0.7 + 0.3 * np.sin(2 * np.pi * breathe * t))
    y = np.tanh(drive * _norm(y * e))
    return _norm(_st(y))


INSTR = dict(pad=pad, brass=brass, braam=braam, choir=choir, piano=piano, bell=bell, shimmer=shimmer,
             spark=spark, impact=impact, crash=crash, revcym=revcym, riser=riser, revswell=revswell,
             shepard=shepard, timp=timp, drum=drum, tick=tick, spic=spic, wind=wind, thunder=thunder,
             air=air, sub=sub)


def seq(inner, events, seed=0, **base):
    """Sequence of notes/hits of one instrument: events = [(t_rel, {kwargs, 'amp'})]."""
    fn = INSTR[inner]
    parts = []
    for i, (tr, kw) in enumerate(events):
        k = dict(base, **kw)
        amp = k.pop('amp', 1.0)
        k.setdefault('seed', seed * 131 + i)
        parts.append((int(round(tr * SR)), fn(**k) * amp))
    n = max(i0 + y.shape[1] for i0, y in parts)
    out = np.zeros((2, n), F32)
    for i0, y in parts:
        out[:, i0:i0 + y.shape[1]] += y
    return out


INSTR['seq'] = seq


# =============================================================================
# 2. MUSIC + CUE SHEET (all times derived from src/timing.json)
# =============================================================================
MOTIF_A = [('D4', 1.0), ('A4', 1.5), ('G4', 0.5), ('B4', 1.0), ('A4', 3.0)]
MOTIF_B = [('D4', 1.0), ('A4', 1.5), ('G4', 0.5), ('D5', 1.0), ('C#5', 1.0), ('D5', 3.0)]
MOTIF_MIN = [('B3', 1.0), ('F#4', 1.5), ('E4', 0.5), ('G4', 1.0), ('F#4', 3.0)]

CH = {
    'D': ['D2', 'A2', 'D3', 'F#3', 'A3'], 'Dadd9': ['D2', 'A2', 'E3', 'F#3', 'A3'],
    'D/F#': ['F#2', 'A2', 'D3', 'F#3', 'A3'], 'Dm9': ['D2', 'A2', 'E3', 'F3', 'A3'],
    'Bm': ['B1', 'F#2', 'B2', 'D3', 'F#3'], 'Bm7': ['B1', 'F#2', 'A2', 'D3', 'F#3'],
    'G': ['G1', 'D2', 'G2', 'B2', 'D3'], 'Gmaj7': ['G1', 'D2', 'F#2', 'B2', 'D3'],
    'A': ['A1', 'E2', 'A2', 'C#3', 'E3'], 'Asus': ['A1', 'E2', 'A2', 'D3', 'E3'],
    'Em': ['E2', 'B2', 'E3', 'G3', 'B3'], 'Gm': ['G1', 'D2', 'G2', 'Bb2', 'D3'],
    'F#m': ['F#2', 'C#3', 'F#3', 'A3', 'C#4'], 'Em7': ['E2', 'B2', 'D3', 'G3', 'B3'],
}


def up(notes, octaves=1):
    return [midi(m) + 12 * octaves for m in notes]


def root1(notes):
    """Chord root in octave 1 (sub-bass register)."""
    m = midi(notes[0])
    while m > 38:
        m -= 12
    while m < 26:
        m += 12
    return m


def motif(t0, beat, notes=MOTIF_A, tr=0, last=None):
    ev, t = [], t0
    for i, (m, b) in enumerate(notes):
        d = last if (last is not None and i == len(notes) - 1) else b * beat
        ev.append((t, d, midi(m) + tr))
        t += b * beat
    return ev


class Timing:
    """Scene/line times in seconds from src/timing.json (same maths as src/lib/timing.ts)."""

    def __init__(self, path):
        d = json.loads(Path(path).read_text())
        fps = d['fps']
        self.fps, self.total, self.estimated = fps, d['totalFrames'] / fps, d.get('estimated')
        self.sc = {s['id']: (s['start'] / fps, s['duration'] / fps) for s in d['scenes']}
        self.ln = {l['id']: (l['globalStart'] / fps, l['duration'] / fps, l['text'])
                   for s in d['scenes'] for l in s['lines']}

    def s(self, sid): return self.sc[sid][0]
    def d(self, sid): return self.sc[sid][1]
    def e(self, sid): return self.sc[sid][0] + self.sc[sid][1]
    def cue(self, lid): return self.ln[lid][0]
    def dur(self, lid): return self.ln[lid][1]
    def end(self, lid): return self.ln[lid][0] + self.ln[lid][1]
    def text(self, lid): return self.ln[lid][2]
    def at(self, lid, frac): return self.cue(lid) + frac * self.dur(lid)
    def lines(self): return [(k, v[0], v[0] + v[1]) for k, v in self.ln.items()]


@dataclass
class Cue:
    t: float
    label: str
    instr: str
    kw: dict
    gain: float = -12.0
    hall: float = 0.25
    plate: float = 0.0
    huge: float = 0.0
    scene: str = ''


@dataclass
class Sheet:
    T: Timing
    cues: list = field(default_factory=list)
    auto: list = field(default_factory=list)  # (t0, t1, level, fade): master gain dips
    scene: str = ''

    def add(self, t, label, instr, gain=-12.0, hall=0.25, plate=0.0, huge=0.0, **kw):
        kw.setdefault('seed', zlib.crc32(f'{self.scene}{label}'.encode()) & 0xFFFF)
        self.cues.append(Cue(float(t), label, instr, kw, gain, hall, plate, huge, self.scene))

    def chords(self, prog, label, instr='pad', gain=-18.0, hall=0.3, xf=0.8, gains=None, **kw):
        """prog = [(t0, t1, notes)] -> overlapping (cross-faded) chord cues."""
        for i, (t0, t1, notes) in enumerate(prog):
            k = dict(kw)
            k.setdefault('att', xf)
            k.setdefault('rel', xf * 1.5)
            g = gains[i] if gains else gain
            self.add(t0, f'{label} {i}', instr, g, hall, notes=notes, dur=max(0.1, t1 - t0), **k)

    def subs(self, prog, label, gain=-18.0, **kw):
        for i, (t0, t1, notes) in enumerate(prog):
            self.add(t0, f'{label} {i}', 'sub', gain, 0.0, notes=[root1(notes)], dur=max(0.1, t1 - t0),
                     att=kw.get('att', 0.4), rel=kw.get('rel', 0.6))

    def melody(self, label, ev, instr='brass', gain=-12.0, hall=0.35, legato=0.12, amps=None, **kw):
        t0 = ev[0][0]
        events = []
        for i, (t, d, m) in enumerate(ev):
            if instr == 'bell':
                o = {'note': m}
            elif instr in ('piano', 'spic'):
                o = {'note': m, 'dur': d}
            else:
                o = {'notes': [m], 'dur': d + legato}
            if amps is not None:
                o['amp'] = amps[i]
            events.append((t - t0, o))
        self.add(t0, label, 'seq', gain, hall, inner=instr, events=events, **kw)

    def hits(self, label, times, inner, gain, hall=0.2, amps=None, **kw):
        """Sequence of one-shots at absolute times (clock ticks, drum patterns, rolls)."""
        times = sorted(times)
        if not times:
            return
        ev = [(t - times[0], {'amp': (amps[i] if amps is not None else 1.0)}) for i, t in enumerate(times)]
        self.add(times[0], label, 'seq', gain, hall, inner=inner, events=ev, **kw)

    def gate(self, t0, t1, level=0.0, fade=0.03):
        self.auto.append((t0, t1, level, fade))


def roll(t0, t1, rate0=8.0, rate1=18.0, v0=0.15, v1=1.0):
    """Accelerating roll: times and velocities from t0 to t1."""
    ts, vs, t = [], [], t0
    while t < t1:
        x = (t - t0) / max(t1 - t0, 1e-3)
        ts.append(t)
        vs.append(v0 + (v1 - v0) * x ** 1.6)
        t += 1.0 / (rate0 + (rate1 - rate0) * x)
    return ts, vs


def ostinato(sh, label, t0, t1, prog, step=0.125, pattern=(0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 12, 0, 7, 0, 12, 7),
             accents=(0, 3, 6, 8, 11, 14), gain=-16.0, octave=0, bright=1600.0, v_lo=0.5, ramp=None, hall=0.2):
    """Spiccato ostinato following a chord progression (root-based pattern, 3+3+2 accents)."""
    ev, t, i = [], t0, 0
    while t < t1 - 1e-3:
        ch = next((c for (a, b, c) in prog if a - 1e-6 <= t < b), prog[-1][2])
        r = root1(ch) + 12 * (1 + octave)
        acc = (i % len(pattern)) in accents
        v = (1.0 if acc else v_lo)
        if ramp:
            v *= ramp[0] + (ramp[1] - ramp[0]) * (t - t0) / max(t1 - t0, 1e-3)
        ev.append((t - t0, {'note': r + pattern[i % len(pattern)], 'vel': v, 'bright': bright}))
        t += step
        i += 1
    if ev:
        sh.add(t0, label, 'seq', gain, hall, inner='spic', events=ev)


def arp(sh, label, t0, t1, prog, step, pattern, voicing, gain, inner='bell', hall=0.35, ramp=(1, 1), **kw):
    """Arpeggio over a progression. voicing(ch_name_notes) -> list of arp notes."""
    ev, t, i = [], t0, 0
    while t < t1 - 1e-3:
        ch = next((c for (a, b, c) in prog if a - 1e-6 <= t < b), prog[-1][2])
        tones = voicing(ch)
        x = (t - t0) / max(t1 - t0, 1e-3)
        ev.append((t - t0, dict(kw, note=tones[pattern[i % len(pattern)] % len(tones)],
                                amp=ramp[0] + (ramp[1] - ramp[0]) * x)))
        t += step
        i += 1
    if ev:
        sh.add(t0, label, 'seq', gain, hall, inner=inner, events=ev)


PLUCK = dict(dur=0.9, ratio=1.0, index=1.8, tau=0.35, tau_i=0.07, det=4.0, body=0.25)
GLASS = dict(dur=1.4, ratio=4.0, index=0.9, tau=0.5, tau_i=0.12, det=3.0, body=0.4)
WARM_BELL = dict(dur=4.0, ratio=2.0, index=1.6, tau=1.8, tau_i=0.4, det=3.0, body=0.5)
COLD_BELL = dict(dur=5.0, ratio=3.5, index=2.6, tau=2.2, tau_i=0.8, det=4.0, body=0.25)
STEEL = dict(dur=6.0, ratio=1.41, index=4.0, tau=2.8, tau_i=1.2, det=6.0, body=0.1)


def chord_tones(ch, lo=62, n=4):
    """Pitch classes of a chord voiced upward from MIDI `lo`."""
    pcs = []
    for m in ch:
        pc = int(midi(m)) % 12
        if pc not in pcs:
            pcs.append(pc)
    out, m = [], lo
    while len(out) < n:
        if m % 12 in pcs:
            out.append(m)
        m += 1
    return out


def word_fracs(text):
    """Start fraction of each sentence/phrase in a line, proportional to word counts."""
    ph = [p for p in re.split(r'(?<=[.!?])\s+', text.strip()) if p]
    wc = [len(p.split()) for p in ph]
    tot = sum(wc)
    return [sum(wc[:i]) / tot for i in range(len(wc))]


# ----------------------------------------------------------------------------- S01
def sc01(sh, T):
    s, e = T.s('S01'), T.e('S01')
    slam = T.end('L02') + 0.7
    sh.add(s, 'room tone', 'air', -36, 0.0, dur=slam - s, att=2.5, rel=0.4)
    sh.add(s + 0.3, 'sub hum D1+D2', 'sub', -24, 0.0, notes=['D1', 'D2'], dur=slam - s - 0.5, att=3.5, rel=0.3,
           breathe=0.12)
    sh.add(s + 0.8, 'SPARK', 'spark', -23, 0.8)
    th = T.end('L01') + 0.3  # motif hint 1: the rising fifth, far away
    sh.add(th, 'hint D5', 'bell', -25, 0.85, note='D5', **dict(GLASS, dur=4.0, tau=1.4))
    sh.add(th + 0.6, 'hint A5', 'bell', -26, 0.85, note='A5', **dict(GLASS, dur=4.0, tau=1.6))
    sh.add(T.cue('L02') - 0.6, 'cold bed Dm', 'pad', -27, 0.4, notes=['D2', 'A2', 'F3'],
           dur=slam - T.cue('L02') + 0.4, att=2.5, rel=0.25, fc=450, tilt=1.3, nv=5)
    sh.add(slam - 5.0, 'rev swell > title', 'revswell', -14, 0.0, notes=['D2', 'A2', 'D3', 'F3', 'A3', 'D4'], dur=5.0)
    sh.add(slam - 3.2, 'noise riser > title', 'riser', -21, 0.2, dur=3.2, f0=120, f1=5000, shape=3.0)
    sh.add(slam, 'TITLE SLAM impact', 'impact', -7.5, 0.2, huge=0.5, f0=110, f1=32, tau=1.5, crack=1.0)
    sh.add(slam, 'TITLE SLAM braam', 'braam', -12.5, 0.3, huge=0.35, notes=['D1', 'A1', 'D2', 'A2', 'F3'], dur=0.7, rel=2.6)
    sh.add(slam, 'TITLE SLAM low brass', 'brass', -11.5, 0.4, huge=0.3, notes=['D2', 'A2', 'D3', 'F3', 'A3'], dur=0.5,
           att=0.01, rel=2.0, bright=2200, drive=2.0)
    sh.add(slam, 'title sub', 'sub', -14, 0.0, notes=['D1'], dur=1.2, att=0.005, rel=1.8)
    sh.add(slam, 'title ring D5', 'bell', -19, 0.6, huge=0.3, note='D5', **dict(COLD_BELL, dur=e - slam))
    sh.add(slam + 0.02, 'title ring A5', 'bell', -22, 0.6, huge=0.3, note='A5', **dict(COLD_BELL, dur=e - slam))
    sh.add(slam + 0.1, 'title ringing strings', 'pad', -24, 0.6, notes=['A4', 'D5', 'A5'],
           dur=max(0.5, e - slam - 2.4), att=0.6, rel=1.8, fc=2600, tilt=1.8, vib=5)


# ----------------------------------------------------------------------------- S02
def sc02(sh, T):
    s, e = T.s('S02'), T.e('S02')
    sh.add(s, 'CH I boom', 'impact', -13, 0.2, huge=0.6, f0=72, f1=30, tau=2.0, crack=0.15, drive=1.5)
    sh.add(s + 0.4, 'cold drone Dm9', 'pad', -22, 0.45, notes=CH['Dm9'], dur=e - s - 3.2, att=3.0, rel=2.0,
           fc_pts=[(0, 380), (6, 650), (12, 420)], q=1.0, tilt=1.15, det=6, nv=5)
    sh.add(s + 0.4, 'cold sub', 'sub', -25, 0.0, notes=['D1'], dur=e - s - 3.0, att=3.0, rel=1.5)
    # slow clock: 1 Hz tick/tock, then accelerating into the warm flash
    t, ticks, tocks, k = s + 2.0, [], [], 0
    while t < e - 3.0:
        (ticks if k % 2 == 0 else tocks).append(t)
        t, k = t + 1.0, k + 1
    dt = 0.8
    while t < e - 0.1:
        (ticks if k % 2 == 0 else tocks).append(t)
        t, k, dt = t + dt, k + 1, max(0.07, dt * 0.8)
    sh.hits('clock tick', ticks, 'tick', -27, 0.15, kind='tick')
    sh.hits('clock tock', tocks, 'tick', -29, 0.15, kind='tock')
    sh.hits('clock pulse', [x for x in ticks if x < e - 3.0][::2], 'tick', -24, 0.0, kind='kick')
    # four milestones: cold bells, the line barely rises (D E F G)
    c4, d4 = T.cue('L04'), T.dur('L04')
    for i, m in enumerate(['D5', 'E5', 'F5', 'G5']):
        t = c4 + i * 0.45 * d4 / 3
        sh.add(t, f'milestone bell {i + 1}', 'bell', -20, 0.55, note=m, **COLD_BELL)
        sh.add(t, f'milestone steel {i + 1}', 'bell', -27, 0.4, note=midi(m) - 24, **STEEL)
    # riser into the warm flash (exactly at the S02/S03 boundary)
    sh.add(e - 3.2, 'riser > warm flash', 'riser', -18, 0.2, dur=3.2, f0=200, f1=8000, shape=2.5)
    sh.add(e - 3.0, 'rev swell > warm flash', 'revswell', -14, 0.0, notes=['D3', 'F#3', 'A3', 'D4', 'F#4'], dur=3.0)


# ----------------------------------------------------------------------------- S03
def sc03(sh, T):
    s, e = T.s('S03'), T.e('S03')
    tf = T.end('L07') - 0.5  # "Transformer"
    c6, c7, d7 = T.cue('L06'), T.cue('L07'), T.dur('L07')
    sh.add(s, 'WARM FLASH impact', 'impact', -8, 0.25, huge=0.4, f0=95, f1=36, tau=1.3, crack=0.7)
    sh.add(s, 'warm flash stab', 'brass', -11, 0.5, notes=['D3', 'A3', 'D4', 'F#4', 'A4'], dur=0.35, att=0.01, rel=2.6)
    sh.add(s, 'warm flash bell', 'bell', -21, 0.6, note='F#5', **WARM_BELL)
    sh.add(s, 'flash sub', 'sub', -16, 0.0, notes=['D1'], dur=0.5, att=0.005, rel=2.5)
    mid = c7 + 0.5 * (tf - c7)
    prog = [(s + 0.5, c6 - 0.2, CH['Dadd9']), (c6 - 0.2, c7 - 0.2, CH['Bm7']), (c7 - 0.2, mid, CH['Gmaj7']),
            (mid, tf, CH['Asus'])]
    sh.chords(prog, 'warm strings', gain=-20, hall=0.4, xf=1.2, fc=750, q=0.8, tilt=1.1, vib=6, nv=6)
    sh.subs(prog, 'warm sub', gain=-24)
    # "attention": FM pluck arpeggio, 8ths at 100 bpm, then interlocking layers during L07
    q8 = 0.3
    a0 = s + 2.4
    voi = lambda ch: chord_tones(ch, 62, 4)  # noqa: E731
    arp(sh, 'attention arp', a0, tf - 0.02, prog, q8, (0, 1, 2, 3, 2, 1), voi, -21, ramp=(0.35, 1.0), **PLUCK)
    arp(sh, 'attn layer triplets', c7, tf - 0.02, prog, q8 * 2 / 3, (0, 2, 1, 3, 1, 2),
        lambda ch: chord_tones(ch, 74, 4), -27, ramp=(0.3, 1.0), **GLASS)
    arp(sh, 'attn layer dotted', c7 + 0.25 * d7, tf - 0.02, prog, q8 * 1.5, (0, 1, 2),
        lambda ch: chord_tones(ch, 50, 3), -22, ramp=(0.5, 1.0), **dict(PLUCK, tau=0.5))
    arp(sh, 'attn layer 16ths', c7 + 0.5 * d7, tf - 0.02, prog, q8 / 2, (0, 3, 1, 2, 3, 0, 2, 1),
        lambda ch: chord_tones(ch, 86, 4), -31, ramp=(0.4, 1.0), **dict(GLASS, dur=0.6, tau=0.18))
    tp = [c7 + 0.7 * d7 + i * 0.6 for i in range(int((tf - c7 - 0.7 * d7) / 0.6) + 1) if c7 + 0.7 * d7 + i * 0.6 < tf - 0.1]
    sh.hits('attn pulse', tp, 'tick', -22, 0.0, amps=np.linspace(0.5, 1, len(tp)) if tp else None, kind='kick')
    # "Transformer": the warm chord lands
    sh.add(tf - 1.3, 'rev swell > Transformer', 'revswell', -17, 0.0, notes=['D3', 'A3', 'F#4', 'A4', 'C#5'], dur=1.3)
    sh.add(tf, 'TRANSFORMER impact', 'impact', -14, 0.2, huge=0.4, f0=85, f1=36, tau=1.2, crack=0.35)
    ld = max(0.5, e - tf - 0.6)
    sh.add(tf, 'TRANSFORMER brass', 'brass', -11, 0.45, notes=['D2', 'A2', 'D3', 'F#3', 'A3', 'C#4', 'E4'],
           dur=ld, att=0.06, rel=2.2, bright=2000)
    sh.add(tf, 'TRANSFORMER strings', 'pad', -15, 0.5, notes=['D3', 'A3', 'E4', 'F#4', 'A4', 'C#5'], dur=ld,
           att=0.25, rel=2.5, fc=2600, vib=8)
    sh.add(tf, 'TRANSFORMER choir', 'choir', -16, 0.6, notes=['D4', 'F#4', 'A4', 'E5'], dur=ld, att=0.4, rel=2.5,
           vowel='oo', to_vowel='ah')
    sh.add(tf, 'TRANSFORMER sub', 'sub', -15, 0.0, notes=['D1', 'D2'], dur=ld, att=0.01, rel=2.0)
    sh.add(tf, 'TRANSFORMER bell', 'bell', -21, 0.6, note='A5', **WARM_BELL)


# ----------------------------------------------------------------------------- S04
def sc04(sh, T):
    s, e = T.s('S04'), T.e('S04')
    # three hits on "bigger" / "more data" / "more compute" (word onsets, within the first ~65% of L08)
    h = [T.at('L08', f) for f in (0.36, 0.53, 0.65)]
    c9 = T.cue('L09')
    cut = e - 0.4
    seg = [c9 - 0.3 + i * (cut - c9 + 0.3) / 5 for i in range(6)]
    prog = [(s + 0.2, h[0], CH['Bm']), (h[0], h[1], CH['G']), (h[1], h[2], CH['A']), (h[2], seg[0], CH['D'])]
    prog += [(seg[i], seg[i + 1], CH[c]) for i, c in enumerate(['D', 'Em7', 'F#m', 'G', 'A'])]
    sh.chords(prog[:4], 'scale strings', gain=-21, hall=0.35, xf=0.5, fc=900, tilt=1.1, vib=5)
    sh.chords(prog[4:], 'rising strings', gains=[-20, -19, -18, -17, -15], hall=0.35, xf=0.4, fc=1300, tilt=1.0,
              vib=6, rel=0.3)
    sh.subs(prog, 'scale sub', gain=-22, rel=0.2)
    # pulse: quarters -> +8th ticks -> +spiccato 8ths -> +16th hats -> 16th spiccato and timpani
    q = 0.5
    grid = lambda a, b, st: [x for x in np.arange(a, b - 1e-3, st)]  # noqa: E731
    sh.hits('pulse kick', grid(s + 0.3, cut, q), 'tick', -19, 0.0, kind='kick')
    sh.hits('pulse ticks', grid(s + 0.3, cut, q / 2), 'tick', -30, 0.1, kind='tick')
    ostinato(sh, 'scale ostinato 8ths', h[0], c9 - 0.3, prog, step=q / 2, pattern=(0, 12, 7, 12), accents=(0,),
             gain=-19, octave=0, bright=1300)
    sh.hits('hats 16ths', grid(h[1], cut, q / 4), 'tick', -31, 0.1, kind='hat')
    ostinato(sh, 'scale ostinato 16ths', c9 - 0.3, cut, prog, step=q / 4, gain=-19, octave=0, bright=1500,
             ramp=(0.6, 1.0))
    tt = grid(h[2], cut, q)
    sh.hits('scale timpani', tt, 'timp', -18, 0.25, amps=np.linspace(0.5, 1.0, len(tt)), note='D2', vel=0.8)
    # rising line under L09 (strings, D4 -> D5 -> E5)
    line = ['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5', 'E5']
    st = (cut - c9) / len(line)
    sh.melody('rising line', [(c9 + i * st, st, midi(m)) for i, m in enumerate(line)], 'pad', -18, 0.4,
              legato=0.1, amps=list(np.linspace(0.6, 1.0, len(line))), att=0.12, rel=0.25, fc=2200, vib=10, nv=5)
    # hits
    for i, (t, ch) in enumerate(zip(h, ['G', 'A', 'D'])):
        sh.add(t, f'scale hit {i + 1}', 'impact', -16 + 1.5 * i, 0.2, huge=0.3, f0=80, f1=36, tau=0.8, crack=0.5)
        sh.add(t, f'scale stab {i + 1}', 'brass', -14 + 1.0 * i, 0.4, notes=up(CH[ch], 1), dur=0.25, att=0.01, rel=1.2)
    sh.add(cut - 2.5, 'riser > cut', 'riser', -20, 0.1, dur=2.5, f0=300, f1=9000, shape=2.0)
    sh.gate(cut, e, 0.0, fade=0.03)  # a breath of silence


# ----------------------------------------------------------------------------- S05
def sc05(sh, T):
    s, e = T.s('S05'), T.e('S05')
    sh.add(s, 'CH II boom', 'impact', -12, 0.2, huge=0.6, f0=70, f1=30, tau=2.2, crack=0.2, drive=1.5)
    # motif hint 2: soft piano, the rising fifth and the turn
    for i, (dt, m) in enumerate([(0.9, 'D4'), (1.7, 'A4'), (2.9, 'G4')]):
        sh.add(s + dt, f'piano hint {i}', 'piano', -20 - i, 0.5, note=m, dur=2.5, vel=0.35)
    c11, r11, c12, c13 = T.cue('L11'), T.at('L11', 0.86), T.cue('L12'), T.cue('L13')
    rv = T.end('L13') - 0.45  # THE HERO REVEAL
    sh.chords([(s + 0.8, c11 - 0.1, CH['D'])], 'campfire pad', gain=-21, hall=0.45, xf=2.5, fc=520, tilt=1.25, vib=5)
    sh.add(s + 0.8, 'campfire sub', 'sub', -25, 0.0, notes=['D1'], dur=c11 - s - 0.9, att=2.5, rel=1.2)
    # tension cluster (L11) resolving warm on "built safely"
    sh.add(c11 - 0.4, 'tension cluster', 'pad', -18, 0.4, notes=['G2', 'A2', 'Bb2', 'C3', 'Eb3'], dur=r11 - c11 + 0.4,
           att=r11 - c11, att_curve=2.0, rel=0.7, fc_pts=[(0, 300), (r11 - c11, 1300)], q=1.4, det=22, vib=14,
           vib_rate=7.0)
    rt, rvel = roll(r11 - 2.2, r11 - 0.05, 7, 16, 0.1, 0.8)
    sh.hits('tension timp roll', rt, 'timp', -21, 0.3, amps=rvel, note='A1', vel=0.6, dur=1.0)
    sh.add(r11 - 1.2, 'rev swell > safely', 'revswell', -18, 0.0, notes=['F#3', 'A3', 'D4', 'F#4'], dur=1.2)
    stamps = [T.at('L12', f) for f in (0.69, 0.80, 0.92)]  # helpful, honest, harmless
    prog = [(r11, c12 + 0.4 * T.dur('L12'), CH['D/F#']), (c12 + 0.4 * T.dur('L12'), stamps[0], CH['G']),
            (stamps[0], T.end('L12') + 0.2, CH['D'])]
    sh.chords(prog, 'warm resolve', gains=[-18, -19, -18], hall=0.45, xf=0.6, fc=800, tilt=1.15, vib=6)
    sh.subs(prog, 'resolve sub', gain=-23)
    sh.add(r11, 'resolve choir', 'choir', -22, 0.6, notes=['D4', 'F#4', 'A4'], dur=c12 - r11 + 1.0, att=0.8, rel=2.0)
    hb = [x for x in np.arange(c12, stamps[0] - 0.2, 0.75)]
    sh.hits('heartbeat timp', hb, 'timp', -22, 0.25, amps=np.linspace(0.4, 0.8, len(hb)), note='D2', vel=0.5)
    # three stamps: helpful, honest, harmless
    for i, t in enumerate(stamps):
        sh.add(t, f'stamp {i + 1} impact', 'impact', -17 + i, 0.2, huge=0.3, f0=75, f1=38, tau=0.7, crack=0.6)
        sh.add(t, f'stamp {i + 1} timp', 'timp', -15 + i, 0.3, note='D2', vel=0.9)
        sh.add(t, f'stamp {i + 1} brass', 'brass', -16 + i, 0.4, notes=['D3', 'A3', ['D4', 'F#4', 'A4'][i]],
               dur=0.3, att=0.01, rel=1.3)
        sh.add(t, f'stamp {i + 1} bell', 'bell', -23, 0.5, note=['A5', 'B5', 'D6'][i], **WARM_BELL)
    # the huge riser into THE HERO REVEAL
    r0 = T.end('L12') + 0.1
    rd = rv - r0
    hero = ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4']
    sh.add(r0, 'HERO riser noise', 'riser', -15, 0.2, dur=rd, f0=150, f1=9000, shape=2.2, pitched=['D3', 'A3'])
    sh.add(rv - min(rd, 3.5), 'HERO rev swell', 'revswell', -11, 0.0, notes=hero, dur=min(rd, 3.5))
    sh.add(rv - 1.6, 'HERO rev cymbal', 'revcym', -17, 0.0, dur=1.6)
    rt, rvel = roll(r0, rv - 0.03, 5, 22, 0.15, 1.0)
    sh.hits('HERO timp roll', rt, 'timp', -17, 0.3, amps=rvel, note='A1', vel=0.7, dur=1.0)
    # THE HERO REVEAL: biggest hit so far, then the hero motif in full (horns, choir, strings)
    sh.add(rv, 'HERO REVEAL impact', 'impact', -3, 0.2, huge=0.6, f0=140, f1=30, tau=2.2, crack=1.0, drive=3.0)
    sh.add(rv, 'HERO REVEAL braam', 'braam', -7, 0.3, huge=0.4, notes=['D1', 'A1', 'D2', 'F#2', 'A2', 'D3'], dur=0.8,
           rel=2.5, bright=2800)
    sh.add(rv, 'HERO crash', 'crash', -17, 0.3, huge=0.3, dur=4.0)
    sh.add(rv, 'HERO sub', 'sub', -11, 0.0, notes=['D1'], dur=e - rv + 0.5, att=0.005, rel=1.5)
    beat = float(np.clip((e - 0.9 - rv) / 4.0, 0.42, 0.7))
    last = e - (rv + 4 * beat) + 1.4
    ev = motif(rv, beat, MOTIF_A, last=last)
    sh.melody('HERO MOTIF horns', ev, 'brass', -9, 0.45, huge=0.15, bright=2600, nv=4, det=9, vib=8, rel=0.5)
    sh.melody('HERO MOTIF horns 8vb', [(t, d, m - 12) for t, d, m in ev], 'brass', -12, 0.4, bright=1800, rel=0.5)
    sh.melody('HERO MOTIF choir', [(t, d, m + 12) for t, d, m in ev], 'choir', -12, 0.6, vowel='ah', att=0.12,
              rel=0.9, vib=20)
    sh.melody('HERO MOTIF glock', [(t, min(d, 2.0), m + 24) for t, d, m in ev], 'bell', -22, 0.5, **dict(WARM_BELL, dur=2.0))
    tG = rv + 2.5 * beat
    sh.chords([(rv, tG, hero), (tG, rv + 4 * beat, CH['G'] + ['G3', 'B3', 'D4']),
               (rv + 4 * beat, e + 0.6, CH['D'] + ['D4', 'F#4'])],
              'HERO strings', gain=-13, hall=0.5, xf=0.25, fc=2400, vib=9, att=0.05)


# ----------------------------------------------------------------------------- S06
def sc06(sh, T):
    s, e = T.s('S06'), T.e('S06')
    bar = 2.0
    drain = e - 1.0
    lift = s + round((T.cue('L16') - 0.5 - s) / bar) * bar
    prog, t, i = [], s, 0
    while t < lift - 1e-3:
        prog.append((t, t + bar, CH[['D', 'Bm', 'G', 'A'][i % 4]]))
        t, i = t + bar, i + 1
    i = 0
    while t < drain - 1e-3:
        prog.append((t, min(t + bar, drain), CH[['G', 'A', 'Bm', 'D'][i % 4]]))
        t, i = t + bar, i + 1
    ostinato(sh, 'HEROIC ostinato', s, drain, prog, step=0.125, gain=-15, octave=0, bright=1500, ramp=(0.8, 1.0))
    ostinato(sh, 'ostinato 8va (lift)', lift, drain, prog, step=0.125, gain=-21, octave=1, bright=2200,
             pattern=(12, 7, 12, 0, 12, 7, 12, 4), accents=(0, 4))
    sh.chords(prog, 'action brass', gain=-19, instr='brass', hall=0.35, xf=0.3, att=0.35, bright=1200, dark=300)
    sh.subs(prog, 'action sub', gain=-19, att=0.05, rel=0.3)
    beats = np.arange(s, drain - 1e-3, 0.5)
    sh.hits('taiko', [b for k, b in enumerate(beats) if k % 4 in (0,)] + [b + 0.75 for k, b in enumerate(beats) if k % 4 == 2],
            'drum', -14, 0.25, f=50)
    sh.hits('timp downbeats', [b for k, b in enumerate(beats) if k % 8 == 0], 'timp', -16, 0.3, note='D2', vel=0.9)
    sh.hits('hats 8ths', list(np.arange(T.cue('L15'), drain, 0.25)), 'tick', -30, 0.1, kind='hat')
    sh.hits('hats 16ths (lift)', list(np.arange(lift, drain, 0.125)), 'tick', -32, 0.1, kind='hat')
    # motif fragments in the gaps: the rising fifth
    g1 = T.end('L14') + 0.05
    if T.cue('L15') - g1 > 0.6:
        sh.melody('motif fragment 1', motif(g1, 0.4, MOTIF_A[:2], last=0.8), 'brass', -15, 0.4, bright=2000)
    # five unlock stings (read, see, code, computer use, agents)
    tops = ['D5', 'E5', 'F#5', 'A5', 'D6']
    for i, f in enumerate(word_fracs(T.text('L15'))[:5]):
        t = T.at('L15', f)
        sh.add(t - 0.3, f'unlock {i + 1} swoosh', 'riser', -24, 0.2, dur=0.3, f0=1500, f1=12000, shape=1.5)
        sh.add(t, f'unlock {i + 1} bell', 'bell', -17, 0.5, note=tops[i], **dict(WARM_BELL, index=2.2))
        sh.add(t, f'unlock {i + 1} glass', 'bell', -23, 0.5, note=midi(tops[i]) + 12, **GLASS)
        sh.add(t, f'unlock {i + 1} hit', 'impact', -19, 0.2, huge=0.2, f0=90, f1=45, tau=0.4, crack=0.8)
    # lift under L16: choir + high strings
    lp_ = [(a, b, c) for (a, b, c) in prog if a >= lift - 1e-3]
    sh.chords([(a, b, up(c[2:], 1)) for (a, b, c) in lp_], 'lift choir', instr='choir', gain=-18, hall=0.6, xf=0.5,
              vowel='oo')
    sh.chords([(a, b, up(c[1:], 1)) for (a, b, c) in lp_], 'lift strings', gain=-18, hall=0.5, xf=0.5, fc=1600, vib=7)
    g2 = T.end('L16') + 0.05
    if drain - g2 > 0.5:
        sh.melody('motif fragment 2', motif(g2, 0.35, MOTIF_A[:2], last=drain - g2 - 0.35), 'brass', -12, 0.4,
                  bright=2600)
    # energy drains into cold wind
    sh.add(drain - 0.05, 'power down', 'pad', -16, 0.4, notes=['D2', 'A2', 'D3', 'F#3'], dur=0.2, att=0.01, rel=0.9,
           glide_pts=[(0, 0), (1.1, -1400)], fc_pts=[(0, 2000), (1.1, 200)])
    sh.add(drain - 0.4, 'cold wind', 'wind', -17, 0.3, dur=3.8, att=0.9, rel=2.0)


# ----------------------------------------------------------------------------- S07
def sc07(sh, T):
    s, e = T.s('S07'), T.e('S07')
    sh.add(s, 'CH III boom', 'impact', -11, 0.2, huge=0.7, f0=65, f1=28, tau=2.4, crack=0.25, drive=1.5)
    sh.add(s + 0.3, 'enemy drone', 'pad', -19, 0.45, notes=['B1', 'C2', 'F#2', 'C3'], dur=e - s - 1.6, att=2.5,
           rel=1.2, fc_pts=[(0, 300), (4, 700), (7, 380), (11, 800), (14, 500)], q=1.6, det=25, tilt=1.0, nv=5)
    sh.add(s + 0.3, 'enemy sub', 'sub', -20, 0.0, notes=['B0', 'B1'], dur=e - s - 1.5, att=2.0, rel=1.0, breathe=0.3)
    sh.add(s + 1.8, 'steel groan', 'bell', -24, 0.5, note='F2', **dict(STEEL, dur=6))
    for k, (dt, g) in enumerate([(1.1, -15), (4.4, -17), (8.2, -14)]):
        if s + dt < e - 1.5:
            sh.add(s + dt, f'thunder {k + 1}', 'thunder', g, 0.2, huge=0.4, dur=4.5)
    hb = list(np.arange(T.cue('L17'), T.at('L18', 0.4), 1.0))
    sh.hits('dread heartbeat', hb, 'drum', -21, 0.3, amps=np.linspace(0.5, 0.9, len(hb)), f=46)
    clusters = [['B1', 'C2', 'F2', 'B2'], ['Bb1', 'B1', 'E2', 'Bb2'], ['A1', 'Bb1', 'Eb2', 'A2'],
                ['G#1', 'A1', 'D2', 'D#2', 'G#2']]
    for i, f in enumerate((0.44, 0.59, 0.73, 0.86)):  # Disease. Ignorance. Poverty. A warming planet.
        t = T.at('L18', f)
        sh.add(t, f'villain {i + 1} braam', 'braam', -12 + 0.5 * i, 0.35, huge=0.3, notes=clusters[i], dur=0.45, rel=1.6,
               bright=1500)
        sh.add(t, f'villain {i + 1} hit', 'impact', -16, 0.2, huge=0.3, f0=60, f1=30, tau=0.9, crack=0.5)
        sh.add(t, f'villain {i + 1} steel', 'bell', -25, 0.4, note=midi(clusters[i][2]) + 12, **dict(STEEL, dur=3))
    # warm lightning at the S07/S08 boundary
    sh.add(e - 1.3, 'riser > lightning', 'riser', -17, 0.2, dur=1.3, f0=400, f1=10000, shape=2.0)
    sh.add(e - 1.2, 'rev cym > lightning', 'revcym', -18, 0.0, dur=1.2)
    sh.add(e, 'LIGHTNING impact', 'impact', -8, 0.2, huge=0.5, f0=100, f1=34, tau=1.4, crack=1.6)
    sh.add(e, 'LIGHTNING crash', 'crash', -16, 0.3, dur=3.0)
    sh.add(e, 'LIGHTNING warm stab', 'brass', -12, 0.5, notes=['D3', 'A3', 'D4', 'F#4', 'A4'], dur=0.3, att=0.01, rel=2.2)
    sh.add(e, 'LIGHTNING bell', 'bell', -19, 0.6, note='D6', **WARM_BELL)


# ----------------------------------------------------------------------------- S08
def sc08(sh, T):
    s, e = T.s('S08'), T.e('S08')
    q8 = 0.3  # 100 bpm
    qz = lambda t: s + round((t - s) / q8) * q8  # noqa: E731  quantise to the pulse grid
    L = ['L19', 'L20', 'L21', 'L22']
    starts = [s] + [qz(T.cue(l) - 0.6) for l in L[1:]]
    ends = starts[1:] + [e - 0.5]
    res = [qz(T.at(l, 0.6)) for l in L]
    plan = [('Bm', 'D'), ('Em', 'G'), ('Gm', 'D'), ('Bm', 'D')]
    for k in range(4):
        a, b, r = starts[k], ends[k], res[k]
        mn, mj = plan[k]
        lvl = -20 + 1.5 * k
        if k < 3:
            prog = [(a, r, CH[mn]), (r, b, CH[mj])]
        else:  # the last battle: Bm -> G -> A -> D
            m1 = qz(T.at(L[3], 0.3))
            prog = [(a, m1, CH['Bm']), (m1, r - 1.2, CH['G']), (r - 1.2, r, CH['A']), (r, b, CH['D'])]
        sh.chords(prog, f'battle {k + 1} strings', gain=lvl, hall=0.45, xf=0.5, fc=900 + 250 * k, vib=7, tilt=1.05)
        sh.subs(prog, f'battle {k + 1} sub', gain=-21 + k)
        ostinato(sh, f'battle {k + 1} ostinato', a, b, prog, step=q8 if k < 2 else q8 / 2,
                 pattern=(0, 12, 7, 12) if k < 2 else (0, 0, 12, 0, 7, 0, 12, 7), accents=(0,) if k < 2 else (0, 3, 6),
                 gain=-19 + k, bright=1300 + 200 * k)
        beats = np.arange(a, b - 1e-3, 2 * q8)
        sh.hits(f'battle {k + 1} timp', [x for i, x in enumerate(beats) if i % (4 if k < 2 else 2) == 0], 'timp',
                -19 + k, 0.3, note='D2' if mj == 'D' else 'G1', vel=0.8)
        if k >= 1:
            sh.hits(f'battle {k + 1} drum', [x + q8 * 3 for i, x in enumerate(beats) if i % 4 == 2 and x + q8 * 3 < b],
                    'drum', -17 + k, 0.25, f=52)
        if k >= 2:
            sh.hits(f'battle {k + 1} hats', list(np.arange(a, b, q8 / 2)), 'tick', -31, 0.1, kind='hat')
        sh.add(a, f'battle {k + 1} boom', 'impact', -18 + k, 0.2, huge=0.35, f0=70, f1=32, tau=1.2, crack=0.3)
        # the hero wins: swell into the major chord
        sh.add(r - 0.9, f'battle {k + 1} win swell', 'revswell', -18 + k, 0.0, notes=up(CH[mj][1:], 1), dur=0.9)
        sh.add(r, f'battle {k + 1} win bell', 'bell', -22, 0.6, note=up(CH[mj][-1:], 2)[0], **WARM_BELL)
        # motif variations
        cl = T.cue(L[k]) + 0.2
        if k == 0:
            sh.melody('battle 1 celli minor motif', motif(cl, 0.6, MOTIF_MIN, tr=-12, last=max(0.5, r - cl - 2.4)), 'pad', -15,
                      0.4, att=0.15, rel=0.4, fc=1100, vib=12, nv=4)
            sh.melody('battle 1 horns fifth', motif(r, 0.6, MOTIF_A[:2], tr=-12, last=b - r - 0.4), 'brass', -14, 0.45,
                      bright=1600)
        elif k == 1:
            ev = motif(r, 0.45, MOTIF_A, tr=12, last=1.6)
            sh.melody('battle 2 piano motif', ev, 'piano', -15, 0.5, vel=0.55)
            sh.melody('battle 2 bell motif', ev, 'bell', -24, 0.5, **dict(GLASS, dur=1.5))
        elif k == 2:
            sh.melody('battle 3 horns minor motif', motif(cl, 0.6, MOTIF_MIN, tr=-4, last=max(0.5, r - cl - 2.4)),
                      'brass', -15, 0.4, bright=1400)  # G minor colour
            sh.melody('battle 3 horns motif', motif(r, 0.5, MOTIF_A, last=max(0.5, b - r - 2.0)), 'brass', -13, 0.45,
                      bright=2000)
            sh.melody('battle 3 choir', motif(r, 0.5, MOTIF_A, last=max(0.5, b - r - 2.0)), 'choir', -18, 0.6,
                      vowel='oo', att=0.1, rel=0.6)
        else:
            sh.melody('battle 4 horns minor motif', motif(cl, 0.55, MOTIF_MIN, last=max(0.5, r - 1.2 - cl - 2.2)),
                      'brass', -14, 0.4, bright=1500)
            ev = motif(r, 0.5, MOTIF_B, last=max(0.8, b - (r + 5 * 0.5)))
            sh.melody('battle 4 HERO horns', ev, 'brass', -9, 0.45, huge=0.1, bright=2600, nv=4, det=9, vib=8)
            sh.melody('battle 4 HERO choir', [(t, d, m + 12) for t, d, m in ev], 'choir', -12, 0.6, vowel='ah',
                      att=0.1, rel=0.8, vib=20)
            sh.melody('battle 4 HERO low', [(t, d, m - 12) for t, d, m in ev], 'brass', -13, 0.4, bright=1600)
            sh.add(r, 'battle 4 crash', 'crash', -19, 0.3, dur=3.0)
            sh.add(r, 'battle 4 high strings', 'pad', -16, 0.5, notes=['D4', 'A4', 'D5', 'F#5', 'A5'], dur=b - r, att=0.3,
                   rel=0.6, fc=3000, vib=9)
    sh.gate(e - 0.5, e, db(-26), fade=0.25)  # ease down to a breath


# ----------------------------------------------------------------------------- S09
def sc09(sh, T):
    s, e = T.s('S09'), T.e('S09')
    sw = T.cue('L23') + 0.2  # the frame opens
    pk = sw + 1.6
    c24, c25, e25 = T.cue('L24'), T.cue('L25'), T.end('L25')
    sh.add(s, 'CH IV boom', 'impact', -10, 0.2, huge=0.7, f0=70, f1=28, tau=2.5, crack=0.25, drive=1.5)
    dur = e - 0.12 - (s + 0.4)
    sh.add(s + 0.4, 'SHEPARD-RISSET', 'shepard', -13, 0.35, dur=dur, rate0=0.09, rate1=1.4,
           amp_pts=[(0, 0.35), (sw - s - 0.4, 0.6), (c24 - s - 0.4, 0.45), (e25 - s - 0.4, 0.8), (dur, 1.0)])
    # the massive swell as the letterbox opens
    swn = ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4']
    sh.add(sw, 'SWELL strings', 'pad', -3, 0.5, huge=0.2, notes=swn, dur=1.6 + 1.2, att=1.6, att_curve=2.5, rel=2.5,
           fc_pts=[(0, 400), (1.6, 3200), (5, 1400)], vib=8)
    sh.add(sw, 'SWELL brass', 'brass', -4, 0.4, notes=swn[:5], dur=1.6 + 0.8, att=1.6, rel=2.0, bright=2800)
    sh.add(sw, 'SWELL choir', 'choir', -6, 0.6, notes=['D4', 'F#4', 'A4', 'D5'], dur=1.6 + 1.5, att=1.6, att_curve=2.0,
           rel=2.5, vowel='oh', to_vowel='ah', morph=(0.1, 0.5))
    sh.add(sw, 'SWELL rev cym', 'revcym', -11, 0.0, dur=1.6)
    rt, rvel = roll(sw, pk - 0.03, 8, 24, 0.1, 1.0)
    sh.hits('SWELL timp roll', rt, 'timp', -14, 0.3, amps=rvel, note='D2', vel=0.8, dur=1.0)
    sh.add(pk, 'SWELL bloom', 'impact', -4, 0.2, huge=0.6, f0=90, f1=32, tau=2.0, crack=0.4)
    sh.add(pk, 'SWELL sub', 'sub', -12, 0.0, notes=['D1'], dur=1.5, att=0.01, rel=2.0)
    sh.add(pk, 'SWELL crash', 'crash', -17, 0.3, dur=4.0)
    # full hero theme with choir under L24 (phrase A + answer B)
    b = 0.58
    t0 = c24 - 0.2
    evA = motif(t0, b, MOTIF_A, last=3 * b)
    t1 = t0 + 7 * b
    evB = motif(t1, b, MOTIF_B, last=max(1.0, c25 - (t1 + 5 * b) + 0.3))
    ev = evA + evB
    sh.melody('THEME choir', ev, 'choir', -12, 0.6, vowel='oo', att=0.12, rel=0.8, vib=18)
    sh.melody('THEME horns', ev, 'brass', -13, 0.45, bright=1500, nv=4, det=9)
    sh.melody('THEME low horns', [(t, d, m - 12) for t, d, m in ev], 'brass', -15, 0.4, bright=1100)
    chs = [(pk, t0 + 2.5 * b, 'D'), (t0 + 2.5 * b, t0 + 4 * b, 'G'), (t0 + 4 * b, t1, 'D'), (t1, t1 + 2.5 * b, 'Bm'),
           (t1 + 2.5 * b, t1 + 3 * b, 'G'), (t1 + 3 * b, t1 + 5 * b, 'A'), (t1 + 5 * b, c25, 'D')]
    prog = [(a, bb, CH[c]) for a, bb, c in chs if bb > a]
    sh.chords(prog, 'THEME strings', gain=-15, hall=0.5, xf=0.4, fc=1100, vib=8)
    sh.subs(prog, 'THEME sub', gain=-18)
    ostinato(sh, 'THEME ostinato', pk, c25, prog, step=b / 2, pattern=(0, 12, 7, 12), accents=(0,), gain=-19,
             bright=1300)
    # accelerating in L25 ... and beyond, into the white flash
    fl = e - 0.12  # pre-flash gap (a gasp of silence)
    ts, t, st = [], c25, 0.16
    while t < fl:
        ts.append(t)
        t += st
        st = max(0.045, st * 0.975)
    ev = [(x - c25, {'note': 38 + (0, 12, 7, 12)[i % 4] + (12 if x > e25 else 0), 'vel': 0.7 + 0.3 * (i % 2 == 0),
                     'bright': 1500 + 1500 * (x - c25) / (fl - c25)}) for i, x in enumerate(ts)]
    sh.add(c25, 'ACCEL ostinato', 'seq', -15, 0.25, inner='spic', events=ev)
    dr = [x for i, x in enumerate(ts) if i % 2 == 0]
    sh.hits('ACCEL drums', dr, 'drum', -17, 0.25, amps=np.linspace(0.5, 1.0, len(dr)), f=50)
    acc = [(c25, (c25 + e25) / 2, CH['G']), ((c25 + e25) / 2, e25, CH['A']), (e25, fl, CH['A'])]
    sh.chords(acc, 'ACCEL strings', gains=[-15, -14, -12], hall=0.45, xf=0.3, fc=1800, vib=9, rel=0.1)
    sh.add(e25, 'CLIMAX brass rise', 'brass', -11, 0.4, notes=['A2', 'E3', 'A3', 'C#4', 'E4'], dur=fl - e25, att=fl - e25,
           rel=0.05, bright=3500, glide_pts=[(0, -200), (fl - e25, 0)])
    sh.add(e25 - 0.5, 'CLIMAX choir', 'choir', -12, 0.6, notes=['A4', 'C#5', 'E5'], dur=fl - e25 + 0.5, att=fl - e25,
           rel=0.05, vowel='ah')
    rd = fl - e25 + 1.0
    sh.add(fl - rd, 'FLASH riser', 'riser', -12, 0.1, dur=rd, f0=200, f1=12000, shape=2.0, pitched=['D3', 'A3'])
    sh.add(fl - min(rd, 2.5), 'FLASH rev swell', 'revswell', -10, 0.0, notes=['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4'],
           dur=min(rd, 2.5))
    sh.add(fl - 1.8, 'FLASH rev cym', 'revcym', -14, 0.0, dur=1.8)
    rt, rvel = roll(fl - 2.0, fl - 0.02, 8, 30, 0.2, 1.0)
    sh.hits('FLASH timp roll', rt, 'timp', -13, 0.3, amps=rvel, note='A1', vel=0.8, dur=0.9)
    sh.gate(fl, e, 0.0, fade=0.012)


# ----------------------------------------------------------------------------- S10
def sc10(sh, T):
    s, e = T.s('S10'), T.e('S10')
    # WHITE FLASH (exactly at the S09/S10 boundary): the biggest hit of the film
    sh.add(s, 'WHITE FLASH impact', 'impact', 0, 0.2, huge=0.8, f0=160, f1=28, tau=3.0, crack=1.3, drive=3.2)
    sh.add(s, 'WHITE FLASH braam', 'braam', -4, 0.3, huge=0.5, notes=['D1', 'A1', 'D2', 'F#2', 'A2', 'D3', 'A3'], dur=0.9,
           rel=3.0, bright=3200)
    sh.add(s, 'WHITE FLASH tutti brass', 'brass', -5, 0.4, huge=0.4, notes=['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'], dur=0.7,
           att=0.01, rel=2.2, bright=3200, drive=2.0)
    sh.add(s, 'WHITE FLASH tutti strings', 'pad', -7, 0.5, huge=0.4, notes=['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], dur=0.7,
           att=0.02, rel=2.5, fc=3500, vib=8)
    sh.add(s, 'WHITE FLASH crash', 'crash', -12, 0.3, huge=0.4, dur=5.0)
    sh.add(s, 'WHITE FLASH choir', 'choir', -11, 0.6, huge=0.4, notes=['D4', 'F#4', 'A4', 'D5'], dur=0.25, att=0.02,
           rel=2.8, vowel='ah')
    sh.add(s, 'WHITE FLASH sub', 'sub', -8, 0.0, notes=['D1'], dur=0.8, att=0.003, rel=3.0)
    sh.add(s, 'WHITE FLASH bells', 'bell', -17, 0.6, huge=0.3, note='D6', **dict(WARM_BELL, dur=6.0, tau=2.5))
    # hush: ethereal pad
    fin = T.end('L28') + 0.4  # final title chord
    c26 = T.cue('L26')
    sh.add(s + 1.2, 'ethereal strings', 'pad', -25, 0.6, notes=['D5', 'A5', 'E6', 'F#6'], dur=fin - s - 1.2, att=3.0,
           rel=1.5, fc=5000, tilt=2.0, vib=5, nv=4)
    sh.add(s + 1.5, 'ethereal choir', 'choir', -25, 0.7, notes=['D4', 'A4', 'D5'], dur=c26 + 5 - s - 1.5, att=3.0, rel=3.0)
    sh.add(s + 1.5, 'ethereal sub', 'sub', -28, 0.0, notes=['D1'], dur=fin - s - 1.5, att=4.0, rel=1.0)
    # slow noble crescendo: phrase A (L26), answer B lands its final D5 on the title chord
    b = 0.85
    m0 = c26 + 0.2
    evA = motif(m0, b, MOTIF_A, last=max(1.0, T.cue('L27') - (m0 + 4 * b)))
    cs = T.cue('L28') - 0.3  # C#5 suspended over "only just beginning"
    evB = [(cs - 4 * b, b, midi('D4')), (cs - 3 * b, 1.5 * b, midi('A4')), (cs - 1.5 * b, 0.5 * b, midi('G4')),
           (cs - b, b, midi('D5')), (cs, fin - cs, midi('C#5'))]
    if evB[0][0] < evA[-1][0] + 0.8:
        evB = [x for x in evB if x[0] >= evA[-1][0] + 0.8]
    sh.melody('FINALE horns A', evA, 'brass', -15, 0.5, amps=[0.6, 0.7, 0.75, 0.85, 0.9], bright=1500)
    sh.melody('FINALE horns B', evB, 'brass', -12, 0.5, bright=2000, nv=4, det=9, vib=8)
    sh.melody('FINALE choir B', [(t, d, m + 12) for t, d, m in evB], 'choir', -16, 0.6, vowel='oo', att=0.15, rel=0.6)
    chs = [(m0, m0 + 2.5 * b, 'D'), (m0 + 2.5 * b, m0 + 4 * b, 'G'), (m0 + 4 * b, evB[0][0], 'D/F#')]
    chs += [(evB[0][0], cs - 1.5 * b, 'Bm'), (cs - 1.5 * b, cs, 'G'), (cs, fin, 'A')]
    prog = [(a, bb, CH[c]) for a, bb, c in chs if bb > a]
    gains = list(np.linspace(-22, -13, len(prog)))
    sh.chords(prog, 'FINALE strings', gains=gains, hall=0.55, xf=0.7, fc=1300, vib=8)
    sh.subs(prog, 'FINALE sub', gain=-20)
    rt, rvel = roll(fin - 1.6, fin - 0.03, 6, 20, 0.1, 0.9)
    sh.hits('FINALE timp roll', rt, 'timp', -16, 0.3, amps=rvel, note='A1', vel=0.7, dur=1.0)
    sh.add(fin - 1.4, 'FINALE rev swell', 'revswell', -15, 0.0, notes=['D3', 'A3', 'D4', 'F#4', 'A4'], dur=1.4)
    # the final title chord, with a long, beautiful tail
    hold, tail = 3.2, 3.5
    sh.add(fin, 'TITLE CHORD impact', 'impact', -9, 0.2, huge=0.7, f0=90, f1=32, tau=2.5, crack=0.3, drive=1.8)
    sh.add(fin, 'TITLE CHORD brass', 'brass', -8, 0.5, huge=0.35, notes=['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'D5'],
           dur=hold, att=0.08, rel=tail, bright=2400, nv=4)
    sh.add(fin, 'TITLE CHORD strings', 'pad', -10, 0.55, huge=0.35, notes=['D3', 'A3', 'D4', 'F#4', 'A4', 'D5', 'F#5'],
           dur=hold, att=0.2, rel=tail + 0.5, fc=3000, vib=9)
    sh.add(fin, 'TITLE CHORD choir', 'choir', -11, 0.6, huge=0.35, notes=['D4', 'F#4', 'A4', 'D5'], dur=hold, att=0.25,
           rel=tail, vowel='ah')
    sh.add(fin, 'TITLE CHORD sub', 'sub', -11, 0.0, notes=['D1', 'D2'], dur=hold, att=0.01, rel=tail)
    sh.add(fin, 'TITLE CHORD bells', 'bell', -17, 0.6, huge=0.4, note='A5', **dict(WARM_BELL, dur=7.0, tau=2.8))
    sh.add(fin + 0.05, 'TITLE CHORD bells 2', 'bell', -19, 0.6, huge=0.4, note='D6', **dict(WARM_BELL, dur=7.0, tau=3.0))


# ----------------------------------------------------------------------------- S11
def sc11(sh, T):
    s, e = T.s('S11'), T.e('S11')
    d = T.d('S11')
    end29 = T.end('L29') - s
    prompt = max(end29 + 0.3 + 1.6 + 4.2, d - 5.2)
    typed = s + prompt + 0.9 + 1.1  # "How can I help?" finishes typing
    b = 0.8
    a0 = s + 0.6
    evA = motif(a0, b, MOTIF_A, last=2.2)
    sh.melody('piano reprise A', evA, 'piano', -7, 0.55, amps=[0.9, 1.0, 0.8, 0.9, 0.85], vel=0.45)
    lh = [(a0, 'D2'), (a0 + 0.02, 'A2'), (a0 + 2.5 * b, 'G2'), (a0 + 2.5 * b + 0.02, 'D3'), (a0 + 4 * b, 'F#2'),
          (a0 + 4 * b + 0.02, 'A2')]
    for i, (t, m) in enumerate(lh):
        sh.add(t, f'piano LH {i}', 'piano', -12, 0.55, note=m, dur=2.0 * b + 0.4, vel=0.35)
    t1 = max(a0 + 7 * b, T.end('L29') + 0.4)
    bB = 0.85
    evB = motif(t1, bB, MOTIF_B, last=2.8)
    sh.melody('piano reprise B', evB, 'piano', -8, 0.55, amps=[0.8, 0.9, 0.75, 0.95, 0.8, 0.9], vel=0.42)
    lh2 = [(t1, ['D2', 'A2']), (t1 + 2.5 * bB, ['G2', 'D3']), (t1 + 3 * bB, ['E2', 'B2']), (t1 + 4 * bB, ['A2', 'E3']),
           (t1 + 5 * bB, ['D2', 'A2', 'F#3'])]
    for i, (t, ms) in enumerate(lh2):
        for j, m in enumerate(ms):
            sh.add(t + 0.03 * j, f'piano LH2 {i}.{j}', 'piano', -13, 0.55, note=m, dur=2.2, vel=0.33)
    sh.add(s + 0.4, 'credits strings', 'pad', -25, 0.6, notes=['D3', 'A3', 'F#4', 'A4'], dur=typed - s - 1.5, att=2.5,
           rel=2.5, fc=900, tilt=1.5, vib=5, nv=4)
    # one final soft note when the prompt finishes typing (the motif's rising fifth, as a question), ring out
    sh.add(typed, 'HOW CAN I HELP note', 'piano', -10, 0.7, note='A5', dur=min(3.5, e - typed), vel=0.4)
    sh.add(typed, 'HOW CAN I HELP glass', 'bell', -22, 0.8, note='A6', **dict(GLASS, dur=min(4.0, e - typed), tau=1.2))
    sh.add(typed + 0.02, 'HOW CAN I HELP low', 'piano', -17, 0.7, note='D3', dur=min(3.5, e - typed), vel=0.3)


SCENES = [sc01, sc02, sc03, sc04, sc05, sc06, sc07, sc08, sc09, sc10, sc11]


def build_sheet(T):
    sh = Sheet(T)
    for i, fn in enumerate(SCENES):
        sh.scene = f'S{i + 1:02d}'
        fn(sh, T)
    return sh


# =============================================================================
# 3. MIXER
# =============================================================================
TRIM = {'sub': -7.0, 'piano': 3.0}  # per-instrument gain trims (dB), applied to seq cues via their inner instrument


def _render(c):
    return INSTR[c.instr](**c.kw)


def vo_activity(T, n, pre=0.12, post=0.2, smooth=0.12):
    """0..1 envelope that is 1 while a VO line plays (from timing.json)."""
    a = np.zeros(n, F32)
    for _, t0, t1 in T.lines():
        a[max(0, ns(t0 - pre)):min(n, ns(t1 + post))] = 1.0
    from scipy.ndimage import uniform_filter1d
    return uniform_filter1d(a, ns(smooth))


def automation(auto, n):
    g = np.ones(n, np.float64)
    for t0, t1, lvl, fd in auto:
        i0, i1, f = ns(t0), min(n, ns(t1)), ns(fd)
        seg = np.full(max(0, i1 - i0), lvl)
        seg[:min(f, len(seg))] = np.linspace(1.0, lvl, min(f, len(seg)))
        g[i0:i1] = np.minimum(g[i0:i1], seg)
        k = min(ns(0.006), n - i1)
        if k > 0:
            g[i1:i1 + k] = np.minimum(g[i1:i1 + k], np.linspace(lvl, 1.0, k))
    return g.astype(F32)


def mixdown(T, sh, jobs=3, log=print):
    n = ns(T.total)
    dry = np.zeros((2, n), F32)
    sends = {k: np.zeros((2, n), F32) for k in ('hall', 'plate', 'huge')}
    cues = sorted(sh.cues, key=lambda c: -len(json.dumps(c.kw, default=str)))  # big jobs first
    t0 = time.time()
    with ProcessPoolExecutor(max_workers=jobs) as ex:
        results = ex.map(_render, cues, chunksize=2)
        for c, y in zip(cues, results):
            i0 = int(round(c.t * SR))
            if i0 < 0:
                y, i0 = y[:, -i0:], 0
            m = min(y.shape[1], n - i0)
            if m <= 0:
                continue
            y = y[:, :m] * db(c.gain + TRIM.get(c.kw.get('inner', c.instr), 0.0))
            dry[:, i0:i0 + m] += y
            for k in sends:
                lv = getattr(c, k)
                if lv:
                    sends[k][:, i0:i0 + m] += lv * y
    log(f'  rendered {len(cues)} cues in {time.time() - t0:.1f}s ({jobs} workers)')
    t0 = time.time()
    irs = {'hall': make_ir(2.6, 3.6, 0.025, seed=11), 'plate': make_ir(1.3, 1.8, 0.008, seed=12, bright=1.2),
           'huge': make_ir(5.5, 7.5, 0.04, damp=(1.25, 1.0, 0.5, 0.25), seed=13)}
    ret = {'hall': 0.55, 'plate': 0.4, 'huge': 0.6}
    wet = sum(ret[k] * convolve_st(sends[k], irs[k]) for k in sends)
    log(f'  reverbs in {time.time() - t0:.1f}s')
    mix = dry + wet
    # automation (breaths, pre-flash gap) applies to everything incl. reverb tails
    mix *= automation(sh.auto, n)[None]
    # VO pocket: dip 1-4 kHz by ~5 dB while lines play (zero-phase band, so the dip is clean)
    act = vo_activity(T, n)
    mid = zbp(mix, 1000, 4000, 2)
    mix = mix - (1 - db(-5.0)) * act[None] * mid
    mix = zhp(mix, 28, 2)
    # air: a gentle harmonic exciter (saturate the 2-6 kHz band, keep only what lands above 5 kHz)
    band = zbp(mix, 2000, 6000, 2)
    env = np.sqrt(np.maximum(uniform_filter1d(np.mean(band.astype(np.float64) ** 2, axis=0), ns(0.05)), 0.0)) + 1e-5
    mix = mix + 0.12 * zhp((np.tanh(2.5 * band / env) * env).astype(F32), 5000, 2)
    # mono below 110 Hz
    low = zlp(mix, 110, 2)
    mix = mix - low + low.mean(axis=0, keepdims=True)
    # gentle fade at the very end
    mix[:, -ns(1.0):] *= np.linspace(1, 0, ns(1.0)) ** 2
    return mix


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--jobs', type=int, default=3)
    ap.add_argument('--timing', default=str(TIMING))
    ap.add_argument('--out', default=str(OUT))
    a = ap.parse_args()
    t_start = time.time()
    T = Timing(a.timing)
    print(f'timing: {T.total:.2f}s, {len(T.sc)} scenes, {len(T.ln)} lines'
          f'{" (ESTIMATED)" if T.estimated else ""}')
    sh = build_sheet(T)
    ANALYSIS.mkdir(parents=True, exist_ok=True)
    with open(ANALYSIS / 'cuesheet.txt', 'w') as f:
        f.write(f'# EXPONENTIAL cue sheet ({len(sh.cues)} cues) generated from {a.timing}\n')
        for c in sorted(sh.cues, key=lambda c: c.t):
            f.write(f'{c.t:8.3f}  {c.scene}  {c.gain:+6.1f} dB  {c.instr:8s}  {c.label}\n')
        for t0, t1, lvl, _ in sh.auto:
            f.write(f'{t0:8.3f}  AUTO  gain -> {lvl:.3f} until {t1:.3f}\n')
    print(f'cue sheet: {len(sh.cues)} cues -> {ANALYSIS / "cuesheet.txt"}')
    mix = mixdown(T, sh, a.jobs)
    # gain staging: peak-normalise with ~2 dB of limiting on the very biggest hits, then true-peak limit
    if not np.isfinite(mix).all():
        raise SystemExit('non-finite samples in the mix')
    pk = float(np.abs(mix).max())
    mix *= db(1.0) / pk
    mix, g = limiter(mix, ceiling_db=-1.0, lookahead=0.003, release=0.06)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    sf.write(a.out, mix.T, SR, subtype='PCM_24')
    print(f'music.wav: {mix.shape[1] / SR:.2f}s, {lufs_integrated(mix):.1f} LUFS, TP {true_peak_db(mix):.2f} dBTP, '
          f'max limiter GR {-20 * np.log10(g.min()):.1f} dB -> {a.out}')
    print(f'total {time.time() - t_start:.1f}s')


if __name__ == '__main__':
    main()

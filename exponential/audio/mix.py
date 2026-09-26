#!/usr/bin/env python3
"""EXPONENTIAL final mix: music.wav + voiceover -> public/audio/master.wav

    python3 audio/mix.py                # master + stems + analysis PNGs
    python3 audio/mix.py --no-analysis

VO clips (public/vo/<id>.wav) are placed at each line's globalStart/fps from
src/timing.json; missing clips are skipped (music-only master).
VO chain: resample to 48 kHz, 80 Hz high-pass, light compression, centred,
short plate send. Music is sidechain-ducked under the voice (7 dB above
150 Hz, 3.5 dB below, smooth attack/release). Master: glue compression,
loudness to -14 LUFS integrated (BS.1770-4), true-peak limiter at -1 dBTP.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import maximum_filter1d, uniform_filter1d

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dsp import (F32, SR, compressor, convolve_st, db, limiter, lufs_integrated, lufs_momentary,  # noqa: E402
                 lufs_short, make_ir, ns, onepole, to_db, true_peak_db, zhp, zlp)
from score import Timing  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUTDIR = ROOT / 'public' / 'audio'
VODIR = ROOT / 'public' / 'vo'
ANALYSIS = ROOT / 'audio' / 'analysis'
TARGET_LUFS = -14.0
CEILING = -1.0
DUCK_DB, DUCK_LOW_DB = 7.0, 3.5
VO_LUFS, MUSIC_LUFS = -16.0, -17.5  # pre-master balance (music measured before ducking)


def load_vo(T, n, vodir):
    vo = np.zeros(n, np.float64)
    placed = []
    for lid, t0, _ in T.lines():
        p = vodir / f'{lid}.wav'
        if not p.exists():
            continue
        x, sr = sf.read(p, dtype='float64')
        if x.ndim > 1:
            x = x.mean(axis=1)
        if sr != SR:
            g = np.gcd(SR, sr)
            x = signal.resample_poly(x, SR // g, sr // g)
        i0 = int(round(t0 * SR))
        m = min(len(x), n - i0)
        vo[i0:i0 + m] += x[:m]
        placed.append(lid)
    return vo, placed


def process_vo(vo):
    """80 Hz HPF, level to VO_LUFS, gentle compression, plate send -> stereo."""
    y = signal.sosfilt(signal.butter(2, 80, 'highpass', fs=SR, output='sos'), vo)
    y *= db(VO_LUFS - lufs_integrated(y[None]))
    y, _ = compressor(y[None], thresh_db=VO_LUFS - 4, ratio=2.2, knee_db=6, tau=0.015, smooth=0.03)
    y = y[0]
    y *= db(VO_LUFS - lufs_integrated(y[None]))
    ir = make_ir(0.9, 1.2, 0.012, damp=(0.9, 1.0, 0.7, 0.4), seed=21, er=True)
    wet = convolve_st(np.stack([y, y]).astype(F32), ir)
    wet = zhp(wet, 250, 2)
    return (np.stack([y, y]) + db(-17) * wet).astype(F32)


def duck_curve(vo):
    """0..1 'voice present' curve: envelope gate, 350 ms hold (bridges words), smooth ramps."""
    env = onepole(np.abs(vo), 0.01)
    on = (to_db(env) > -42).astype(np.float64)
    on = maximum_filter1d(on, ns(0.35))
    d = uniform_filter1d(uniform_filter1d(on, ns(0.2)), ns(0.2))  # ~0.2 s attack (pre-emptive), ~0.4 s release
    return d


def scene_table(T, x, music, vo):
    rows = []
    for sid in sorted(T.sc):
        a, b = ns(T.s(sid)), ns(T.e(sid))
        seg = x[:, a:b]
        rms = to_db(np.sqrt(np.mean(seg.astype(np.float64) ** 2)))
        _, st = lufs_short(seg) if seg.shape[1] > ns(3.1) else (None, np.array([-70.0]))
        mrms = to_db(np.sqrt(np.mean(music[:, a:b].astype(np.float64) ** 2)))
        rows.append((sid, T.s(sid), rms, float(st.max()), mrms))
    return rows


def key_moments(T):
    return {'TITLE SLAM': T.end('L02') + 0.7, 'warm flash': T.s('S03'), 'Transformer': T.end('L07') - 0.5,
            'HERO REVEAL': T.end('L13') - 0.45, 'lightning': T.s('S08'), 'SWELL peak': T.cue('L23') + 1.8,
            'WHITE FLASH': T.s('S10'), 'title chord': T.end('L28') + 0.4}


def analysis(T, master, music, vo, outdir):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    outdir.mkdir(parents=True, exist_ok=True)
    km = key_moments(T)
    bounds = [(sid, T.s(sid)) for sid in sorted(T.sc)]
    # --- spectrogram (log-frequency) of the full mix
    mono = master.mean(axis=0).astype(np.float64)
    f, t, S = signal.spectrogram(mono, SR, nperseg=4096, noverlap=4096 - 2400, window='hann', mode='magnitude')
    S = 20 * np.log10(S + 1e-9)
    fig, ax = plt.subplots(figsize=(22, 7), dpi=80)
    sel = f >= 25
    ax.pcolormesh(t, f[sel], S[sel], shading='auto', cmap='magma', vmin=S.max() - 95, vmax=S.max())
    ax.set_yscale('log')
    ax.set_ylim(25, 20000)
    for sid, x in bounds:
        ax.axvline(x, color='cyan', lw=0.8, alpha=0.7)
        ax.text(x + 0.3, 16000, sid, color='cyan', fontsize=10)
    for k, x in km.items():
        ax.axvline(x, color='white', lw=0.6, ls='--', alpha=0.6)
        ax.text(x + 0.2, 30, k, color='white', fontsize=8, rotation=90, va='bottom')
    ax.set_xlabel('time (s)')
    ax.set_ylabel('Hz')
    ax.set_title('EXPONENTIAL master: spectrogram (scene starts cyan, key hits dashed)')
    fig.tight_layout()
    fig.savefig(outdir / 'spectrogram.png')
    plt.close(fig)
    # --- loudness envelope
    fig, ax = plt.subplots(figsize=(22, 6), dpi=80)
    tm, lm = lufs_momentary(master)
    ts, ls = lufs_short(master)
    tmu, lmu = lufs_momentary(music)
    ax.plot(tmu, np.maximum(lmu, -60), color='#D97757', lw=0.6, alpha=0.8, label='music (ducked), momentary')
    if np.abs(vo).max() > 0:
        tv, lv = lufs_momentary(vo)
        ax.plot(tv, np.maximum(lv, -60), color='#7FD1FF', lw=0.5, alpha=0.6, label='VO, momentary')
    ax.plot(tm, np.maximum(lm, -60), color='#333', lw=0.7, label='master, momentary (400 ms)')
    ax.plot(ts, np.maximum(ls, -60), color='black', lw=2.0, label='master, short-term (3 s)')
    for lid, a, b in T.lines():
        ax.axvspan(a, b, color='#7FD1FF', alpha=0.08)
    for sid, x in bounds:
        ax.axvline(x, color='#2A3645', lw=1)
        ax.text(x + 0.3, -8.5, sid, fontsize=10)
    for k, x in km.items():
        ax.axvline(x, color='#B5553A', lw=0.7, ls='--')
        ax.text(x + 0.2, -57, k, color='#B5553A', fontsize=8, rotation=90, va='bottom')
    ax.axhline(TARGET_LUFS, color='gray', lw=0.6, ls=':')
    ax.set_ylim(-60, -6)
    ax.set_xlim(0, T.total)
    ax.set_xlabel('time (s)')
    ax.set_ylabel('LUFS')
    ax.legend(loc='upper left', fontsize=9, ncol=4)
    ax.set_title('Loudness envelope (VO lines shaded blue)')
    fig.tight_layout()
    fig.savefig(outdir / 'loudness.png')
    plt.close(fig)
    # --- numbers
    print('  key hits (master momentary max within +/-0.4 s; music-only peak dBFS):')
    for k, x in km.items():
        a, b = x - 0.4, x + 0.4
        mm = lm[(tm >= a) & (tm <= b)].max()
        pk = to_db(np.abs(music[:, ns(max(0, x - 0.05)):ns(x + 0.6)]).max())
        print(f'    {k:12s} {x:7.2f}s  {mm:6.1f} LUFS(M)  music peak {pk:6.1f} dBFS')
    # VO over music during lines
    if np.abs(vo).max() > 0:
        tv, lv = lufs_momentary(vo)
        act = lv > -40
        ratio = lv[act] - lmu[:len(lv)][act]
        print(f'  VO-to-music during speech: median {np.median(ratio):.1f} dB, 10th pct {np.percentile(ratio, 10):.1f} dB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--no-analysis', action='store_true')
    ap.add_argument('--vo-dir', default=str(VODIR))
    a = ap.parse_args()
    t_start = time.time()
    T = Timing(ROOT / 'src' / 'timing.json')
    n = ns(T.total)
    music, sr = sf.read(OUTDIR / 'music.wav', dtype='float32', always_2d=True)
    assert sr == SR, sr
    music = music.T
    if music.shape[1] < n:
        music = np.pad(music, ((0, 0), (0, n - music.shape[1])))
    music = music[:, :n]
    vo_raw, placed = load_vo(T, n, Path(a.vo_dir))
    print(f'VO: {len(placed)}/{len(T.ln)} lines placed' + ('' if placed else ' (none found: music-only master)'))
    if placed:
        vo = process_vo(vo_raw)
        d = duck_curve(vo_raw)
    else:
        vo = np.zeros((2, n), F32)
        d = np.zeros(n)
    # balance, then sidechain duck (band-split so the low end keeps its weight)
    music = music * db(MUSIC_LUFS - lufs_integrated(music))
    low = zlp(music, 150, 2)
    g_hi = db(-DUCK_DB * d)
    g_lo = db(-DUCK_LOW_DB * d)
    music_d = ((music - low) * g_hi + low * g_lo).astype(F32)
    # master bus
    mix = music_d + vo
    mix, gr = compressor(mix, thresh_db=-17.0, ratio=1.6, knee_db=8, tau=0.12, smooth=0.25)
    gain = TARGET_LUFS - lufs_integrated(mix)
    for _ in range(4):
        out, g = limiter(mix * db(gain), ceiling_db=CEILING - 0.05, lookahead=0.003, release=0.05)
        err = TARGET_LUFS - lufs_integrated(out)
        if abs(err) < 0.05:
            break
        gain += err
    master_gain = db(gain)  # stems at master gain (pre-glue, pre-limiter) for reference
    OUTDIR.mkdir(parents=True, exist_ok=True)
    (OUTDIR / 'stems').mkdir(exist_ok=True)
    sf.write(OUTDIR / 'master.wav', out.T, SR, subtype='PCM_24')
    sf.write(OUTDIR / 'stems' / 'music.wav', np.clip(music_d * master_gain, -1, 1).T, SR, subtype='PCM_24')
    sf.write(OUTDIR / 'stems' / 'vo.wav', np.clip(vo * master_gain, -1, 1).T, SR, subtype='PCM_24')
    I, tp = lufs_integrated(out), true_peak_db(out)
    print(f'master.wav: {I:.2f} LUFS integrated, true peak {tp:.2f} dBTP, glue GR max {gr.max():.1f} dB, '
          f'limiter GR max {-20 * np.log10(g.min()):.1f} dB')
    print('  scene  start   RMS dBFS  maxST LUFS  music RMS')
    for sid, s0, rms, stmax, mrms in scene_table(T, out, music_d * master_gain, vo):
        print(f'  {sid}  {s0:6.1f}   {rms:7.1f}   {stmax:8.1f}   {mrms:7.1f}')
    if not a.no_analysis:
        analysis(T, out, (music_d * master_gain).astype(F32), (vo * master_gain).astype(F32), ANALYSIS)
        print(f'  plots: {ANALYSIS / "spectrogram.png"}, {ANALYSIS / "loudness.png"}')
    print(f'total {time.time() - t_start:.1f}s')


if __name__ == '__main__':
    main()

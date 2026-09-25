"""Shared DSP for the EXPONENTIAL score and mix (numpy/scipy only).

Everything is vectorised: time-varying filters run block-wise through scipy's
lfilter with carried state, oscillators are band-limited wavetables, dynamics
use min/max filters + box smoothing (offline look-ahead), loudness is ITU-R
BS.1770-4 (K-weighting + gating).
"""
from __future__ import annotations

import functools

import numpy as np
from scipy import signal
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d

SR = 48000
F32 = np.float32


# ----------------------------------------------------------------------------
# basics
# ----------------------------------------------------------------------------
def db(x):
    return 10.0 ** (np.asarray(x) / 20.0)


def to_db(x):
    return 20.0 * np.log10(np.maximum(np.abs(x), 1e-12))


def ns(sec):
    return max(1, int(round(sec * SR)))


def tvec(n):
    return np.arange(n, dtype=np.float64) / SR


NOTE_IDX = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(name):
    """'D4' -> 62, 'F#3' -> 54, 'Bb2' -> 46; ints pass through."""
    if isinstance(name, (int, float, np.integer, np.floating)):
        return float(name)
    s = name.strip()
    v = NOTE_IDX[s[0].upper()]
    i = 1
    while i < len(s) and s[i] in '#b':
        v += 1 if s[i] == '#' else -1
        i += 1
    return float(v + 12 * (int(s[i:]) + 1))


def hz(n):
    return 440.0 * 2.0 ** ((midi(n) - 69.0) / 12.0)


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def env_ar(dur, att, rel, dec=None, sus=1.0, att_curve=1.0):
    """Attack (smoothstep), optional decay to `sus`, hold until `dur`, cos^2 release.
    Returns float32 of length (dur + rel) s."""
    n = ns(dur + rel)
    t = tvec(n)
    a = smoothstep(t / max(att, 1e-4)) ** att_curve
    if dec:
        a = a * (sus + (1.0 - sus) * np.exp(-np.maximum(t - att, 0) / dec))
    r = np.clip((t - dur) / max(rel, 1e-4), 0.0, 1.0)
    return (a * 0.5 * (1.0 + np.cos(np.pi * r))).astype(F32)


def env_pts(points, n, shape=None):
    """Piecewise-linear envelope through (t, v) points, optional power shaping."""
    ts, vs = zip(*points)
    e = np.interp(tvec(n), ts, vs)
    if shape:
        e = np.sign(e) * np.abs(e) ** shape
    return e.astype(F32)


def slow_noise(n, rate, rng, depth=1.0):
    """Smooth random control signal (~rate Hz), zero-mean, peak ~depth."""
    k = max(4, int(n / SR * rate) + 3)
    pts = rng.uniform(-1, 1, k)
    x = np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)
    return (uniform_filter1d(x, max(1, int(SR / rate / 2))) * depth)


def pan_st(x, pan=0.0):
    """Equal-power pan of a mono signal: pan -1..1 -> (2, n)."""
    th = (np.clip(pan, -1, 1) + 1.0) * np.pi / 4.0
    return np.stack([x * np.cos(th), x * np.sin(th)]).astype(F32)


def haas(x, ms=12.0, side=1):
    """Mono -> wide stereo: one side delayed by `ms` (Haas), slightly quieter."""
    d = int(ms * SR / 1000.0)
    y = np.concatenate([np.zeros(d, x.dtype), x[:len(x) - d]]) if d else x
    return (np.stack([x, 0.9 * y]) if side > 0 else np.stack([0.9 * y, x])).astype(F32)


def widen(st, amount=1.3):
    """Mid/side width (>1 widens)."""
    m = 0.5 * (st[0] + st[1])
    s = 0.5 * (st[0] - st[1]) * amount
    return np.stack([m + s, m - s]).astype(F32)


def fade(x, fin=0.005, fout=0.02):
    n = x.shape[-1]
    a, b = min(ns(fin), n), min(ns(fout), n)
    w = np.ones(n, F32)
    if a > 1:
        w[:a] = np.linspace(0, 1, a)
    if b > 1:
        w[n - b:] *= np.linspace(1, 0, b)
    return x * w


# ----------------------------------------------------------------------------
# filters
# ----------------------------------------------------------------------------
@functools.lru_cache(maxsize=256)
def _butter(kind, fc, order):
    if kind == 'bandpass' or kind == 'bandstop':
        wn = [min(fc[0], SR * 0.45), min(fc[1], SR * 0.45)]
    else:
        wn = min(fc, SR * 0.45)
    return signal.butter(order, wn, btype=kind, fs=SR, output='sos')


def lp(x, fc, order=2):
    return signal.sosfilt(_butter('lowpass', float(fc), order), x, axis=-1).astype(F32)


def hp(x, fc, order=2):
    return signal.sosfilt(_butter('highpass', float(fc), order), x, axis=-1).astype(F32)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_butter('bandpass', (float(lo), float(hi)), order), x, axis=-1).astype(F32)


def zlp(x, fc, order=2):
    return signal.sosfiltfilt(_butter('lowpass', float(fc), order), x, axis=-1).astype(F32)


def zhp(x, fc, order=2):
    return signal.sosfiltfilt(_butter('highpass', float(fc), order), x, axis=-1).astype(F32)


def zbp(x, lo, hi, order=2):
    return signal.sosfiltfilt(_butter('bandpass', (float(lo), float(hi)), order), x, axis=-1).astype(F32)


def _rbj(kind, fc, q, gain_db=0.0):
    """RBJ cookbook biquad coefficients (vectorised over fc)."""
    w = 2 * np.pi * np.clip(fc, 10.0, SR * 0.47) / SR
    cw, sw = np.cos(w), np.sin(w)
    al = sw / (2 * q)
    if kind == 'lp':
        b = np.stack([(1 - cw) / 2, 1 - cw, (1 - cw) / 2])
    elif kind == 'hp':
        b = np.stack([(1 + cw) / 2, -(1 + cw), (1 + cw) / 2])
    elif kind == 'bp':  # constant 0 dB peak gain
        b = np.stack([al, np.zeros_like(al), -al])
    elif kind == 'peak':
        A = 10 ** (gain_db / 40)
        b = np.stack([1 + al * A, -2 * cw, 1 - al * A])
        a = np.stack([1 + al / A, -2 * cw, 1 - al / A])
        return b / a[0], a / a[0]
    else:
        raise ValueError(kind)
    a = np.stack([1 + al, -2 * cw, 1 - al])
    return b / a[0], a / a[0]


def biquad(x, kind, fc, q=0.707, gain_db=0.0):
    b, a = _rbj(kind, np.float64(fc), q, gain_db)
    return signal.lfilter(b, a, x, axis=-1).astype(F32)


def tvfilt(x, kind, fc, q=0.707, block=256, stages=1):
    """Time-varying biquad (lp/hp/bp), block-wise coefficients, state carried.
    x: (..., n); fc: scalar or array of length n."""
    n = x.shape[-1]
    fc = np.broadcast_to(np.asarray(fc, np.float64), (n,))
    idx = np.arange(0, n, block)
    B, A = _rbj(kind, fc[idx], q)
    y = np.asarray(x, np.float64)
    for _ in range(stages):
        out = np.empty_like(y)
        zi = np.zeros(y.shape[:-1] + (2,))
        for j, i0 in enumerate(idx):
            sl = slice(i0, i0 + block)
            out[..., sl], zi = signal.lfilter(B[:, j], A[:, j], y[..., sl], axis=-1, zi=zi)
        y = out
    return y.astype(F32)


# ----------------------------------------------------------------------------
# oscillators
# ----------------------------------------------------------------------------
TL = 4096


@functools.lru_cache(maxsize=512)
def wtable(nh, tilt=1.0, odd=False):
    """Band-limited table with `nh` harmonics, amplitude 1/k^tilt (saw at tilt=1)."""
    k = np.arange(1, nh + 1, dtype=np.float64)
    amp = 1.0 / k ** tilt
    if odd:
        amp[1::2] = 0.0
    X = np.zeros(TL // 2 + 1, complex)
    X[1:nh + 1] = -1j * (TL / 2) * amp
    tab = np.fft.irfft(X, TL)
    tab /= np.abs(tab).max()
    return np.append(tab, tab[0]).astype(np.float64)


def nharm(fmax, limit=15000.0):
    return int(max(1, min(limit, SR * 0.46) // max(fmax, 1.0)))


def wt(phase, tab):
    p = (phase - np.floor(phase)) * TL
    i = p.astype(np.int32)
    f = p - i
    t0 = tab[i]
    return t0 + (tab[i + 1] - t0) * f


def phase_of(freq, p0=0.0):
    """Integrate an instantaneous frequency array (Hz) to phase in cycles."""
    return np.cumsum(freq) / SR + p0


# ----------------------------------------------------------------------------
# reverb
# ----------------------------------------------------------------------------
def make_ir(rt60=2.5, length=None, predelay=0.02, damp=(1.15, 1.0, 0.6, 0.32),
            seed=1, er=True, bright=1.0):
    """Synthetic stereo IR: decorrelated noise, 4 bands with their own RT60
    (HF damping), soft diffuse onset, pre-delay and a few early reflections."""
    rng = np.random.default_rng(seed)
    length = length or rt60 * 1.3
    n = ns(length)
    t = tvec(n)
    edges = [(None, 400), (400, 2500), (2500, 7000), (7000, None)]
    ir = np.zeros((2, n))
    for ch in range(2):
        w = rng.standard_normal(n)
        for (lo, hi), f in zip(edges, damp):
            if lo is None:
                band = signal.sosfiltfilt(_butter('lowpass', float(hi), 3), w)
            elif hi is None:
                band = signal.sosfiltfilt(_butter('highpass', float(lo), 3), w) * bright
            else:
                band = signal.sosfiltfilt(_butter('bandpass', (float(lo), float(hi)), 3), w)
            ir[ch] += band * np.exp(-6.91 * t / (rt60 * f))
    ir *= smoothstep(t / 0.03)  # diffuse build-up
    if er:
        for ch in range(2):
            for k in range(7):
                d = ns(0.004 + rng.uniform(0.002, 0.045))
                ir[ch, d] += rng.uniform(-1, 1) * 6.0 * (0.8 ** k)
    pd = ns(predelay)
    ir = np.concatenate([np.zeros((2, pd)), ir], axis=1)
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir.astype(F32)


def convolve_st(x, ir):
    """Stereo in (2,n) -> stereo reverb out (2, n), with a little cross-feed."""
    n = x.shape[-1]
    yl = signal.oaconvolve(x[0], ir[0])[:n]
    yr = signal.oaconvolve(x[1], ir[1])[:n]
    return (np.stack([yl + 0.25 * yr, yr + 0.25 * yl]) * 0.8).astype(F32)


# ----------------------------------------------------------------------------
# dynamics
# ----------------------------------------------------------------------------
def onepole(x, tau):
    a = np.exp(-1.0 / (tau * SR))
    return signal.lfilter([1 - a], [1, -a], x, axis=-1)


def compressor(x, thresh_db=-18.0, ratio=2.0, knee_db=6.0, tau=0.08, smooth=0.15, makeup_db=0.0,
               key=None):
    """Feed-forward RMS compressor (vectorised, symmetric smoothing). x: (2,n)."""
    k = x if key is None else key
    k = np.asarray(k, np.float64)
    pw = onepole(np.mean(k ** 2, axis=0) if k.ndim == 2 else k ** 2, tau)
    lv = 10 * np.log10(pw + 1e-12)
    over = lv - thresh_db
    gr = np.where(over <= -knee_db / 2, 0.0,
                  np.where(over >= knee_db / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    g = db(-gr + makeup_db)
    g = uniform_filter1d(g, ns(smooth))
    return (x * g).astype(F32), gr


def true_peak_env(x, os=4):
    """Per-sample max |x| across channels, including 4x-oversampled inter-sample peaks."""
    x = np.atleast_2d(x)
    up = signal.resample_poly(x, os, 1, axis=-1)
    m = np.abs(up).max(axis=0)
    n = x.shape[-1]
    m = m[:n * os].reshape(n, os).max(axis=1)
    return np.maximum(m, np.abs(x).max(axis=0))


def limiter(x, ceiling_db=-1.0, lookahead=0.004, release=0.08, true_peak=True):
    """Offline look-ahead brick-wall limiter: gain = min-filtered, box-smoothed.
    Guarantees g[n] <= ceiling/peak[n] (smoothing windows always cover n)."""
    c = db(ceiling_db)
    pk = true_peak_env(x) if true_peak else np.abs(x).max(axis=0)
    g = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    w = ns(lookahead)
    g = uniform_filter1d(minimum_filter1d(g, 2 * w + 1), w)
    # smooth recovery: a second, slower min+box stage (still <= the fast gain)
    r = ns(release)
    g = uniform_filter1d(minimum_filter1d(g, 2 * r + 1), r)
    return (x * g).astype(F32), g


def soft_clip(x, knee=0.8):
    """Transparent below `knee`, smooth tanh saturation above."""
    ax = np.abs(x)
    over = ax > knee
    y = x.copy()
    y[over] = np.sign(x[over]) * (knee + (1 - knee) * np.tanh((ax[over] - knee) / (1 - knee)))
    return y


# ----------------------------------------------------------------------------
# loudness (ITU-R BS.1770-4 / EBU R128)
# ----------------------------------------------------------------------------
def _kweight_sos():
    # pre-filter (high shelf) and RLB high-pass, 48 kHz coefficients from BS.1770
    s1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, 1.0, -1.69065929318241, 0.73248077421585]
    s2 = [1.0, -2.0, 1.0, 1.0, -1.99004745483398, 0.99007225036621]
    return np.array([s1, s2])


def kweight(x):
    return signal.sosfilt(_kweight_sos(), np.atleast_2d(x).astype(np.float64), axis=-1)


def block_power(x, win=0.4, hop=0.1):
    """Mean-square per channel summed (BS.1770 z), for sliding windows."""
    y = kweight(x)
    p = np.sum(y ** 2, axis=0)  # sum over channels (L/R weight 1)
    c = np.concatenate([[0.0], np.cumsum(p)])
    w, h = ns(win), ns(hop)
    starts = np.arange(0, len(p) - w + 1, h)
    return (c[starts + w] - c[starts]) / w, starts


def lufs_integrated(x):
    z, _ = block_power(x)
    l = -0.691 + 10 * np.log10(z + 1e-15)
    z1 = z[l > -70]
    if len(z1) == 0:
        return -70.0
    lr = -0.691 + 10 * np.log10(z1.mean()) - 10
    z2 = z1[(-0.691 + 10 * np.log10(z1 + 1e-15)) > lr]
    return float(-0.691 + 10 * np.log10(z2.mean()))


def lufs_short(x, hop=0.1):
    """Short-term loudness (3 s window) sampled every hop; returns (times, LUFS)."""
    z, st = block_power(x, 3.0, hop)
    return (st + ns(1.5)) / SR, -0.691 + 10 * np.log10(z + 1e-15)


def lufs_momentary(x, hop=0.05):
    z, st = block_power(x, 0.4, hop)
    return (st + ns(0.2)) / SR, -0.691 + 10 * np.log10(z + 1e-15)


def true_peak_db(x):
    return float(to_db(true_peak_env(x).max()))

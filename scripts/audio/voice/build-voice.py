#!/usr/bin/env python3
"""
Render the announcer (lines.json) to public/audio/voice/<line>.mp3.

    python scripts/audio/voice/build-voice.py [--only three,go] [--wav DIR] [--voice am_onyx]

Each line is spoken by Kokoro (a local neural TTS, see requirements.txt), then processed like an arena
announcer: trimmed, pitched down a touch, EQ'd (chest warmth, presence), compressed and saturated, sent
through a big synthetic hall, loudness-normalised to the same LUFS with a peak ceiling, and encoded to mono
MP3 with LAME VBR. ffmpeg must be built with librubberband and libmp3lame (the Ubuntu package is).

Pronunciation fixes go in lines.json as Kokoro phoneme links: [Bloxorz](/blˈɑksˌɔɹz/).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pyloudnorm
import soundfile
from scipy import ndimage, signal

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = ROOT / 'public' / 'audio' / 'voice'
SR = 44100
TTS_SR = 24000


@dataclass(frozen=True)
class Style:
    """How a kind of line is delivered."""

    speed: float = 1.0
    #: Seconds of reverb kept after the voice stops (the file ends there).
    tail: float = 1.2
    #: Hall level against the dry voice.
    wet: float = 0.3
    #: tanh saturation drive after the compressor; 1 is clean.
    drive: float = 1.0
    #: Integrated loudness target, LUFS.
    lufs: float = -14.0


STYLES = {
    # Countdown and "Go!": fast, hot and dense, short tails so the next number lands clean.
    'count': Style(speed=1.05, tail=0.85, wet=0.26, drive=1.8),
    'call': Style(speed=0.98, tail=1.3, wet=0.3, drive=1.4),
    'name': Style(speed=0.95, tail=1.2, wet=0.3, drive=1.4),
    'title': Style(speed=0.9, tail=1.9, wet=0.34, drive=1.4),
    # "The winner is...": slow, then the hall rings into the pause before the name.
    'build': Style(speed=0.84, tail=0.75, wet=0.32, drive=1.2),
}


@dataclass(frozen=True)
class Chain:
    """The processing shared by every line."""

    #: Rubber Band pitch ratio; formant 'shifted' lowers the vocal tract too (bigger, darker).
    pitch: float = 0.94
    formant: str = 'preserved'
    highpass: float = 75
    warmth_db: float = 3.5
    mud_db: float = -3.0
    presence_db: float = 4.0
    air_db: float = 2.0
    #: Compressor threshold (linear) and ratio.
    threshold: float = 0.1
    ratio: float = 4.0
    rt60: float = 2.6
    predelay: float = 0.035
    #: Sample-peak ceiling before encoding (LAME overshoots a little; the decoded file stays under -1 dBFS).
    ceiling_db: float = -1.8


CHAIN = Chain()


# ---------------------------------------------------------------- speech


_pipelines: dict[str, object] = {}


def tts(text: str, voice: str, speed: float) -> np.ndarray:
    """Kokoro at 24 kHz. American voices (a*) and British voices (b*) need their own pipeline."""
    from kokoro import KPipeline

    lang = voice[0]
    if lang not in _pipelines:
        _pipelines[lang] = KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M')
    parts = [a.numpy() for _, _, a in _pipelines[lang](text, voice=voice, speed=speed)]
    return np.concatenate(parts).astype(np.float64)


def trim(x: np.ndarray, sr: int, floor_db: float = -42) -> np.ndarray:
    """Cut the silence around the words, keeping 5 ms before the first and 40 ms after the last."""
    n = max(1, int(sr * 0.005))
    frames = x[: len(x) // n * n].reshape(-1, n)
    db = 20 * np.log10(np.sqrt((frames**2).mean(axis=1)) + 1e-9)
    loud = np.nonzero(db > db.max() + floor_db)[0]
    start = max(0, loud[0] * n - int(0.005 * sr))
    end = min(len(x), (loud[-1] + 1) * n + int(0.04 * sr))
    y = x[start:end].copy()
    fade = int(0.004 * sr)
    y[:fade] *= np.linspace(0, 1, fade)
    return y


# ---------------------------------------------------------------- processing


def ffmpeg_filter(x: np.ndarray, sr_in: int, chain: Chain) -> np.ndarray:
    """Resample to 44.1 kHz, pitch down, EQ and compress in one ffmpeg pass."""
    graph = ','.join(
        [
            f'aresample={SR}:resampler=soxr',
            f'rubberband=pitch={chain.pitch}:formant={chain.formant}:pitchq=quality:transients=mixed',
            f'highpass=f={chain.highpass}:p=2',
            f'equalizer=f=160:t=q:w=0.9:g={chain.warmth_db}',
            f'equalizer=f=420:t=q:w=1.4:g={chain.mud_db}',
            f'equalizer=f=3200:t=q:w=1.1:g={chain.presence_db}',
            f'highshelf=f=7500:g={chain.air_db}',
            f'acompressor=threshold={chain.threshold}:ratio={chain.ratio}:attack=3:release=90:knee=3:makeup=2',
        ]
    )
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp, 'in.wav'), Path(tmp, 'out.wav')
        soundfile.write(src, x / max(1e-9, np.abs(x).max()) * 0.7, sr_in, subtype='FLOAT')
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', graph, '-c:a', 'pcm_f32le', dst],
            check=True,
        )
        y, _ = soundfile.read(dst, dtype='float64')
    return y


def saturate(x: np.ndarray, drive: float) -> np.ndarray:
    if drive <= 1:
        return x
    x = x / max(1e-9, np.abs(x).max())
    return np.tanh(x * drive) / np.tanh(drive)


def band(x: np.ndarray, lo: float | None, hi: float | None) -> np.ndarray:
    if lo and hi:
        sos = signal.butter(2, [lo, hi], 'bandpass', fs=SR, output='sos')
    elif lo:
        sos = signal.butter(2, lo, 'highpass', fs=SR, output='sos')
    else:
        sos = signal.butter(2, hi, 'lowpass', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def hall(chain: Chain, seed: int = 0x5A5A) -> np.ndarray:
    """
    A big-hall impulse response: sparse early reflections, then dense noise that builds over ~40 ms and
    decays per band (lows ring longest, highs die fast, like air absorption in an arena). Unit energy.
    """
    rng = np.random.default_rng(seed)
    n = int(SR * chain.rt60 * 1.2)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)

    def decay(rt: float) -> np.ndarray:
        return np.exp(-6.91 * t / rt)

    tail = (
        band(noise, None, 500) * decay(chain.rt60 * 1.15)
        + band(noise, 500, 3500) * decay(chain.rt60)
        + band(noise, 3500, None) * decay(chain.rt60 * 0.45) * 0.7
    )
    tail *= 1 - np.exp(-t / 0.04)
    early = np.zeros(n)
    for _ in range(18):
        at = int(SR * rng.uniform(0.004, 0.11))
        early[at] += rng.choice([-1, 1]) * rng.uniform(0.3, 1) * np.exp(-at / SR / 0.06)
    early = band(early, None, 6000)
    ir = tail / np.sqrt((tail**2).sum()) + early / np.sqrt((early**2).sum()) * 0.35
    ir = np.concatenate([np.zeros(int(SR * chain.predelay)), ir])
    return ir / np.sqrt((ir**2).sum())


_halls: dict[Chain, np.ndarray] = {}


def reverb(x: np.ndarray, style: Style, chain: Chain) -> np.ndarray:
    """Dry voice plus the hall, cut style.tail seconds after the voice ends with a smooth fade."""
    if chain not in _halls:
        _halls[chain] = hall(chain)
    wet = signal.fftconvolve(band(x, 180, 9000), _halls[chain])
    y = wet * style.wet
    y[: len(x)] += x
    y = y[: len(x) + int(style.tail * SR)]
    fade = min(len(y) - len(x), int(SR * max(0.25, style.tail * 0.6)))
    y[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    return y


def limit(x: np.ndarray, ceiling: float, lookahead: float = 0.004) -> np.ndarray:
    """Look-ahead peak limiter: gain never lets a sample pass the ceiling and glides in over the window."""
    need = np.minimum(1, ceiling / np.maximum(np.abs(x), 1e-12))
    w = max(1, int(SR * lookahead))
    g = ndimage.minimum_filter1d(need, size=2 * w + 1)
    g = ndimage.uniform_filter1d(g, size=w)
    return x * np.minimum(g, need)


def loudness(x: np.ndarray, lufs: float, ceiling_db: float) -> np.ndarray:
    """Gain to the target loudness under the peak ceiling; repeats so limiting does not leave it quiet."""
    meter = pyloudnorm.Meter(SR)
    ceiling = 10 ** (ceiling_db / 20)
    y = x
    for _ in range(4):
        y = limit(y * 10 ** ((lufs - meter.integrated_loudness(y)) / 20), ceiling)
    return y


def render(text: str, style: Style, voice: str, chain: Chain = CHAIN) -> np.ndarray:
    x = trim(tts(text, voice, style.speed), TTS_SR)
    x = ffmpeg_filter(x, TTS_SR, chain)
    x = saturate(x, style.drive) * 0.5
    x = reverb(x, style, chain)
    return loudness(x, style.lufs, chain.ceiling_db)


def encode(x: np.ndarray, out: Path, quality: int = 5) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp, 'line.wav')
        soundfile.write(src, x, SR, subtype='PCM_16')
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-codec:a', 'libmp3lame', '-q:a', str(quality),
             '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', out],
            check=True,
        )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--only', help='comma-separated line names')
    ap.add_argument('--wav', help='also keep 16-bit WAVs in this directory')
    ap.add_argument('--voice', help='override the Kokoro voice from lines.json')
    args = ap.parse_args()
    spec = json.loads((HERE / 'lines.json').read_text())
    voice = args.voice or spec['voice']
    only = args.only.split(',') if args.only else None
    for name, line in spec['lines'].items():
        if only and name not in only:
            continue
        x = render(line['text'], STYLES[line['style']], voice)
        encode(x, OUT / f'{name}.mp3')
        if args.wav:
            Path(args.wav).mkdir(parents=True, exist_ok=True)
            soundfile.write(Path(args.wav, f'{name}.wav'), x, SR, subtype='PCM_16')
        peak = 20 * np.log10(np.abs(x).max())
        size = (OUT / f'{name}.mp3').stat().st_size
        print(f'{name:24} {len(x) / SR:5.2f}s  peak {peak:5.1f} dBFS  {size / 1024:5.1f} KiB')


if __name__ == '__main__':
    main()

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
from dataclasses import dataclass, replace
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
#: Loudest true peak a shipped (decoded) file may reach, dBFS.
PEAK_DB = -1.0


@dataclass(frozen=True)
class Style:
    """How a kind of line is delivered."""

    speed: float = 1.0
    #: Delivery, applied inside Kokoro before it renders audio: `pitch` scales the predicted pitch (a shout sits
    #: higher), `range` widens the intonation (the smoothed contour, not the frame-to-frame jitter, which would
    #: warble), `hold` stretches the stressed vowel of the last word ("Gaaame!"), and `rise` replaces the end of
    #: the intonation: over the last 40% of the voiced words (not the pause Kokoro leaves for "..." or "!") it
    #: glides to `rise` times the line's average pitch, so 1 holds a shout up instead of dropping like a statement
    #: and 1.5 leaves "The winner is..." hanging.
    pitch: float = 1.0
    range: float = 1.0
    hold: float = 1.0
    rise: float | None = None
    #: Scales Kokoro's predicted energy curve: above 1 pushes the voice harder (more vocal effort).
    effort: float = 1.0
    #: Seconds of reverb kept after the voice stops (the file ends there).
    tail: float = 1.2
    #: Hall level against the dry voice.
    wet: float = 0.3
    #: tanh saturation drive after the compressor; 1 is clean.
    drive: float = 1.0
    #: Integrated loudness target, LUFS.
    lufs: float = -14.0


STYLES = {
    # Countdown and "Go!": quick, high and hot, held up at the end, a drier hall so the next number lands clean.
    'count': Style(speed=1.08, pitch=1.25, range=1.3, hold=1.4, rise=1.0, tail=1.1, wet=0.22, drive=1.8),
    # "Gaaame!": held and shouted.
    'call': Style(speed=1.0, pitch=1.22, range=1.35, hold=1.5, rise=1.0, tail=1.6, wet=0.28, drive=1.5),
    'name': Style(speed=0.98, pitch=1.18, range=1.45, hold=1.35, rise=1.0, tail=1.5, wet=0.28, drive=1.4),
    'title': Style(speed=0.95, pitch=1.22, range=1.6, hold=1.8, rise=1.25, tail=2.4, wet=0.32, drive=1.5),
    # "The winner is...": slow, rising and suspended, then the hall rings into the pause before the name.
    'build': Style(speed=0.82, pitch=1.05, range=1.4, hold=2.2, rise=1.5, tail=1.1, wet=0.3, drive=1.2),
}


@dataclass(frozen=True)
class Chain:
    """The processing shared by every line."""

    #: Rubber Band pitch ratio (1 skips it); formant 'shifted' lowers the vocal tract too (bigger, darker).
    pitch: float = 1.0
    formant: str = 'preserved'
    highpass: float = 75
    warmth_db: float = 3.5
    mud_db: float = -3.0
    #: Broad upper-mid lift: the spectral tilt of a raised, shouting voice.
    effort_db: float = 3.0
    presence_db: float = 3.0
    air_db: float = 0.5
    #: Compressor threshold (linear) and ratio.
    threshold: float = 0.1
    ratio: float = 5.0
    #: Parallel exciter: saturated upper mids (2-4.5 kHz) mixed in at this level, for shouted grit.
    excite: float = 0.08
    #: De-esser: sibilance (4-10 kHz) louder than this fraction of the voice is turned down.
    deess: float = 0.2
    rt60: float = 2.6
    predelay: float = 0.05
    #: How far the hall is pulled down under the words (0..1), so it blooms in the gaps and the tail
    #: instead of smearing consonants and glides.
    duck_wet: float = 0.6
    #: True-peak ceiling before encoding; LAME overshoots a little, so main() re-limits any file that decodes
    #: above PEAK_DB.
    ceiling_db: float = -1.6


CHAIN = Chain()


# ---------------------------------------------------------------- speech


_pipelines: dict[str, object] = {}


VOWELS = set('aeiouæɑɐɒɔəɚɛɜɝɪʊʌAIOQWYᵊ')


def held_vowel(ps: str) -> int:
    """Index in `ps` of the vowel to hold: the last word's last stressed vowel, else its first vowel."""
    start = ps.rstrip(' !?.,…').rfind(' ') + 1
    stress = max(ps.rfind('ˈ', start), ps.rfind('ˌ', start))
    for i in range(stress if stress >= 0 else start, len(ps)):
        if ps[i] in VOWELS:
            return i
    return -1


def tts(text: str, voice: str, style: Style, lang: str | None = None) -> np.ndarray:
    """
    Kokoro at 24 kHz. `voice` is one Kokoro voice or a comma-separated blend; `lang` picks the
    pronunciation ('a' American, 'b' British), by default the first voice's. This is Kokoro's own
    KModel.forward_with_tokens with the style's delivery applied to the predicted durations and pitch.
    """
    import torch
    from kokoro import KPipeline

    torch.manual_seed(0)
    lang = lang or voice[0]
    if lang not in _pipelines:
        _pipelines[lang] = KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M')
    pipe = _pipelines[lang]
    model = pipe.model
    ps = pipe.g2p(text)[0]
    kept = [i for i, p in enumerate(ps) if model.vocab.get(p) is not None]
    ids = torch.LongTensor([[0, *(model.vocab[ps[i]] for i in kept), 0]])
    ref = pipe.load_voice(voice)[len(ps) - 1]
    s = ref[:, 128:]
    hold = held_vowel(ps)
    with torch.no_grad():
        n = ids.shape[-1]
        lengths = torch.LongTensor([n])
        mask = torch.zeros(1, n, dtype=torch.bool)
        d_en = model.bert_encoder(model.bert(ids, attention_mask=(~mask).int())).transpose(-1, -2)
        d = model.predictor.text_encoder(d_en, s, lengths, mask)
        x, _ = model.predictor.lstm(d)
        dur = torch.sigmoid(model.predictor.duration_proj(x)).sum(axis=-1) / style.speed
        if hold in kept:
            dur[0, kept.index(hold) + 1] *= style.hold
        dur = torch.round(dur).clamp(min=1).long().squeeze()
        idx = torch.repeat_interleave(torch.arange(n), dur)
        aln = torch.zeros(n, idx.shape[0])
        aln[idx, torch.arange(idx.shape[0])] = 1
        aln = aln.unsqueeze(0)
        f0, energy = model.predictor.F0Ntrain(d.transpose(-1, -2) @ aln, s)
        voiced = f0 > 40
        mean = f0[voiced].mean() if voiced.any() else torch.tensor(0.0)
        v = voiced[0].numpy()
        frames = np.arange(f0.shape[-1])
        filled = np.interp(frames, frames[v], f0[0].numpy()[v]) if v.any() else f0[0].numpy()
        contour = torch.from_numpy(ndimage.uniform_filter1d(filled, 9)).float()[None]
        jitter = f0 - contour
        if style.rise is not None:
            spoken = [kept.index(i) + 1 for i, p in enumerate(ps) if i in kept and p not in ' !?.,…']
            ends = torch.cumsum(dur, 0).numpy() * f0.shape[-1] / int(dur.sum())
            words = frames[v & (frames < ends[spoken[-1]])]
            first, last = words[0], words[-1]
            pivot = int(first + 0.6 * (last - first))
            u = torch.from_numpy(np.clip((frames - pivot) / max(1, last - pivot), 0, 1)).float()[None]
            glide = contour[0, pivot] + (mean * style.rise - contour[0, pivot]) * u
            contour = contour * (1 - u) + glide * u
        shaped = mean + (contour - mean) * style.range + jitter
        f0 = torch.where(voiced, shaped * style.pitch, f0)
        asr = model.text_encoder(ids, lengths, mask) @ aln
        audio = model.decoder(asr, f0, energy * style.effort, ref[:, :128]).squeeze().numpy().astype(np.float64)
    # End 70 ms after the last phoneme: Kokoro voices the pause it leaves for "!" or "..." with a stray "-uh".
    spoken = [kept.index(i) + 1 for i, p in enumerate(ps) if i in kept and p not in ' !?.,…']
    end = int(torch.cumsum(dur, 0)[spoken[-1]]) * len(audio) // int(dur.sum()) + int(0.07 * TTS_SR)
    audio = audio[:end]
    fade = int(0.05 * TTS_SR)
    audio[-fade:] *= np.linspace(1, 0, fade)
    return audio


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
    pitch = [f'rubberband=pitch={chain.pitch}:formant={chain.formant}:pitchq=quality:transients=mixed']
    graph = ','.join(
        [
            f'aresample={SR}:resampler=soxr',
            *(pitch if chain.pitch != 1 else []),
            f'highpass=f={chain.highpass}:p=2',
            f'equalizer=f=160:t=q:w=0.9:g={chain.warmth_db}',
            f'equalizer=f=320:t=q:w=1.2:g={chain.mud_db}',
            f'equalizer=f=1800:t=q:w=0.7:g={chain.effort_db}',
            f'equalizer=f=3500:t=q:w=1.2:g={chain.presence_db}',
            f'highshelf=f=7500:g={chain.air_db}',
            f'acompressor=threshold={chain.threshold}:ratio={chain.ratio}:attack=2:release=90:knee=3:makeup=2',
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


def saturate(x: np.ndarray, drive: float, excite: float) -> np.ndarray:
    """tanh drive on the whole voice plus a parallel exciter (hard-driven upper mids) for a shouted edge."""
    x = x / max(1e-9, np.abs(x).max())
    y = np.tanh(x * drive) / np.tanh(drive) if drive > 1 else x
    return y + excite * band(np.tanh(band(x, 2000, 4500) * 8), 1500, 4500)


def envelope(x: np.ndarray, seconds: float) -> np.ndarray:
    return ndimage.uniform_filter1d(np.abs(x), max(1, int(seconds * SR)))


def deess(x: np.ndarray, threshold: float) -> np.ndarray:
    """Turn the 4-10 kHz band down wherever it is louder than `threshold` times the whole voice."""
    s = band(x, 4000, 10000)
    ratio = envelope(s, 0.005) / np.maximum(envelope(x, 0.005), 1e-9)
    gain = np.clip(threshold / np.maximum(ratio, 1e-9), 0.25, 1)
    return x - s * (1 - ndimage.uniform_filter1d(gain, int(0.003 * SR)))


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
    A big-hall impulse response: white noise (no discrete echoes, so nothing rings metallic) shaped in the STFT
    domain to swell over ~50 ms and decay at a rate that falls smoothly with frequency, lows ringing longest and
    highs dying fast like air absorption in an arena. Unit energy.
    """
    rng = np.random.default_rng(seed)
    nfft, hop = 2048, 128
    noise = rng.standard_normal(int(SR * chain.rt60 * 1.3))
    f, t, spec = signal.stft(noise, fs=SR, nperseg=nfft, noverlap=nfft - hop, boundary=None)
    f, t = f[:, None], t[None, :]
    rt = chain.rt60 * np.interp(np.log10(np.maximum(f, 20)), np.log10([60, 250, 1000, 4000, 12000]), [1.1, 1.05, 1, 0.55, 0.3])
    spec *= np.exp(-6.91 * t / rt) * (1 - np.exp(-t / 0.05)) / (1 + (f / 6000) ** 2)
    _, ir = signal.istft(spec, fs=SR, nperseg=nfft, noverlap=nfft - hop, boundary=None)
    ir = band(ir, 120, None)
    ir = np.concatenate([np.zeros(int(SR * chain.predelay)), ir])
    return ir / np.sqrt((ir**2).sum())


_halls: dict[Chain, np.ndarray] = {}


def reverb(x: np.ndarray, style: Style, chain: Chain) -> np.ndarray:
    """
    Dry voice plus the hall. Once the voice stops the hall is pulled down exponentially, reaching -45 dB at
    style.tail seconds, where the file ends: the tail dies away instead of being cut.
    """
    if chain not in _halls:
        _halls[chain] = hall(chain)
    wet = signal.fftconvolve(deess(band(x, 250, 3500), chain.deess / 2), _halls[chain])[: len(x) + int(style.tail * SR)]
    env = ndimage.uniform_filter1d(ndimage.maximum_filter1d(np.abs(x), int(0.01 * SR)), int(0.08 * SR))
    env = np.concatenate([env / env.max(), np.zeros(len(wet) - len(x))])
    wet *= 1 - chain.duck_wet * np.clip(env * 2, 0, 1)
    after = np.maximum(0, np.arange(len(wet)) - len(x)) / SR
    wet *= np.exp(-after * np.log(10 ** (45 / 20)) / style.tail)
    y = wet * style.wet
    y[: len(x)] += x
    fade = int(0.03 * SR)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y


def true_peak(x: np.ndarray) -> np.ndarray:
    """Per-sample peak of the 4x oversampled signal, which catches the overs between samples."""
    return np.abs(signal.resample_poly(x, 4, 1)).reshape(-1, 4).max(axis=1)


def true_peak_db(x: np.ndarray) -> float:
    return float(20 * np.log10(true_peak(x).max()))


def limit(x: np.ndarray, ceiling: float, lookahead: float = 0.004) -> np.ndarray:
    """Look-ahead true-peak limiter: gain never lets the signal pass the ceiling and glides in over the window."""
    need = np.minimum(1, ceiling / np.maximum(true_peak(x), 1e-12))
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


def render(text: str, style: Style, voice: str, lang: str | None = None, chain: Chain = CHAIN) -> np.ndarray:
    x = trim(tts(text, voice, style, lang), TTS_SR)
    x = ffmpeg_filter(x, TTS_SR, chain)
    x = saturate(deess(x, chain.deess), style.drive, chain.excite) * 0.5
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


def decode(path: Path) -> np.ndarray:
    pcm = subprocess.run(
        ['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-'], check=True, capture_output=True
    ).stdout
    return np.frombuffer(pcm, dtype=np.float32).astype(np.float64)


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
        x = render(line['text'], replace(STYLES[line['style']], **line.get('delivery', {})), voice, spec.get('lang'))
        out = OUT / f'{name}.mp3'
        for _ in range(4):
            encode(x, out)
            over = true_peak_db(decode(out)) - PEAK_DB
            if over <= 0:
                break
            x = limit(x, 10 ** ((true_peak_db(x) - over - 0.1) / 20))
        if args.wav:
            Path(args.wav).mkdir(parents=True, exist_ok=True)
            soundfile.write(Path(args.wav, f'{name}.wav'), x, SR, subtype='PCM_16')
        size = out.stat().st_size
        print(f'{name:24} {len(x) / SR:5.2f}s  true peak {true_peak_db(decode(out)):5.1f} dBFS  {size / 1024:5.1f} KiB')


if __name__ == '__main__':
    main()

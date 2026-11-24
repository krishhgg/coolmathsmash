import type { AudioEngine } from './engine';
import tracks from './music.json';

/** A looping music file (rendered by scripts/audio/music/build-music.ts). */
export interface TrackInfo {
  file: string;
  title: string;
  evokes: string;
  /** The loop region in seconds: the file plays from 0, then repeats loopStart..loopEnd forever. */
  loopStart: number;
  loopEnd: number;
}

export const TRACKS: Record<string, TrackInfo> = tracks;

/** Which track each stage plays, for stages whose id is not itself a track id. */
export const STAGE_MUSIC: Record<string, string> = {};

/** The track for a music id or a stage id; null when there is none. */
export function trackFor(id: string): string | null {
  if (TRACKS[id]) return id;
  const mapped = STAGE_MUSIC[id];
  return mapped && TRACKS[mapped] ? mapped : null;
}

interface Playing {
  id: string;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * One music track at a time on the music bus, crossfading on change. Decoded music is large (about 10 MB a
 * minute), so only the playing track is kept; switching back reloads it from the HTTP cache.
 */
export class MusicPlayer {
  private playing: Playing | null = null;
  private wanted: string | null = null;
  /** Bumped by every change, so a load that finishes after a newer request is dropped. */
  private request = 0;

  constructor(private readonly engine: AudioEngine) {}

  get current(): string | null {
    return this.wanted;
  }

  /** Crossfade to `id` (a track or a stage id), or fade out with null. An unknown id keeps the current music. */
  play(id: string | null, fade = 1): void {
    const track = id === null ? null : trackFor(id);
    if (id !== null && track === null) return;
    if (track === this.wanted) return;
    this.wanted = track;
    const request = ++this.request;
    this.fadeOut(fade);
    if (!track) return;
    const info = TRACKS[track]!;
    void this.engine.decode(info.file).then((buf) => {
      if (request !== this.request) return;
      if (!buf) {
        this.wanted = null;
        return;
      }
      const ctx = this.engine.ctx;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = info.loopStart;
      src.loopEnd = info.loopEnd;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + Math.min(fade, 0.5));
      src.connect(gain);
      gain.connect(this.engine.bus('music'));
      src.start(now);
      this.playing = { id: track, src, gain };
    });
  }

  private fadeOut(fade: number): void {
    const p = this.playing;
    if (!p) return;
    this.playing = null;
    const now = this.engine.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(now);
    p.gain.gain.setValueAtTime(p.gain.gain.value, now);
    p.gain.gain.linearRampToValueAtTime(0, now + fade);
    p.src.stop(now + fade + 0.05);
    p.src.onended = () => p.gain.disconnect();
  }
}

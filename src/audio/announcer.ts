import { ANNOUNCED_FIGHTERS, ANNOUNCER_LINES, type SoundId } from './bank';
import type { AudioEngine, Voice } from './engine';

/** A line the announcer can say: a match call, or a fighter's name as `fighter:<id>`. */
export type AnnouncerLine = (typeof ANNOUNCER_LINES)[number] | `fighter:${string}`;

/** How far the music dips while the announcer speaks (linear gain, about -9 dB). */
export const ANNOUNCER_DUCK = 0.35;

const SOUND = new Map<string, SoundId>([
  ...ANNOUNCER_LINES.map((line) => [line, `voice-${line}`] as const),
  ...ANNOUNCED_FIGHTERS.map((id) => [`fighter:${id}`, `voice-fighter-${id}`] as const),
]);

/** The bank sound for a line, or null when the announcer has no such line. */
export const announcerSound = (line: string): SoundId | null => SOUND.get(line) ?? null;

/**
 * Say a line now (or at context time `at`) on the voice bus, ducking the music until it has finished.
 * Returns null and stays silent for a line the announcer does not have (or one still loading).
 */
export function announce(engine: AudioEngine, line: string, at?: number): Voice | null {
  const id = announcerSound(line);
  const voice = id ? engine.play(id, { at }) : null;
  if (!voice) return null;
  const start = Math.max(at ?? 0, engine.ctx.currentTime);
  engine.duck(ANNOUNCER_DUCK, voice.end - start, undefined, undefined, start);
  return voice;
}

/** "The winner is..." and the fighter's name the moment that line ends; silent for an unknown fighter. */
export function announceWinner(engine: AudioEngine, fighterId: string): void {
  const name = `fighter:${fighterId}`;
  if (!announcerSound(name)) return;
  const first = announce(engine, 'winner-is');
  if (first) announce(engine, name, first.end);
}

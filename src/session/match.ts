import { createCpu, type CpuPlayer } from '../ai';
import { neutralInput, type InputFrame } from '../input/types';
import { INFINITE_STOCKS } from '../sim/constants';
import type { MatchState } from '../sim/match';
import type { DeviceId } from './devices';
import type { MatchSetup, ResolvedMatch, Rules } from './setup';

/*
 * The 3-2-1-GO! timeline in frames, counted off a 60 fps capture of Ultimate's own countdown keyed onto green
 * (https://www.youtube.com/watch?v=C8SFHfhmgDk). "3", "2" and "1" come up 60 frames apart. Each one unfolds upward
 * over 6 frames, holds, fades over frames 51 to 56 and is gone for the 3 frames before the next. GO! comes up 60
 * frames after "1". It slides in from the right over 6 frames and holds fully visible through frame 49. On frame 50 it
 * bursts, and by frame 66 it has faded away.
 */

/** "3, 2, 1" lasts this many frames; GO! comes on the frame after, and only then do inputs reach the fighters. */
export const COUNTDOWN_FRAMES = 180;
export const FRAMES_PER_SECOND = 60;

const COUNTDOWN_NUMBERS = ['3', '2', '1'] as const;
/** Each number's slot; the announcer calls it on the slot's first frame. */
export const NUMBER_FRAMES = COUNTDOWN_FRAMES / COUNTDOWN_NUMBERS.length;
/** Frames a callout takes to come in: a number unfolds, GO! slides in. */
export const CALLOUT_IN_FRAMES = 6;
/** A number starts to fade on this frame of its slot and is gone from this one. */
export const NUMBER_FADE_AT = 51;
export const NUMBER_GONE_AT = 57;
/** GO! starts to burst on this frame of play, and is gone, its slot empty, from GO_FRAMES. */
export const GO_FADE_AT = 50;
export const GO_FRAMES = 66;

export type Phase = 'countdown' | 'play' | 'over';

export type CountdownLabel = (typeof COUNTDOWN_NUMBERS)[number] | 'GO!';

/** The countdown callout on one frame, for the match screen to draw. */
export interface CountdownCallout {
  label: CountdownLabel;
  /** Frames since this callout came up. */
  age: number;
  /** How far it has come in: 0 on its first frame, 1 once it is in place. */
  enter: number;
  /** How far it has gone: 0 until it starts to leave, 1 once nothing of it shows. */
  leave: number;
}

const ramp = (x: number, from: number, to: number) => Math.min(1, Math.max(0, (x - from) / (to - from)));

/** The callout up on `frame`: "3", "2" or "1" for a third of the countdown each, then GO!, then nothing. */
export function countdownCallout(frame: number): CountdownCallout | null {
  if (frame < COUNTDOWN_FRAMES) {
    const f = Math.max(0, frame);
    const slot = Math.floor(f / NUMBER_FRAMES);
    const age = f - slot * NUMBER_FRAMES;
    return {
      label: COUNTDOWN_NUMBERS[slot]!,
      age,
      enter: ramp(age, 0, CALLOUT_IN_FRAMES),
      leave: ramp(age, NUMBER_FADE_AT, NUMBER_GONE_AT),
    };
  }
  const age = frame - COUNTDOWN_FRAMES;
  if (age >= GO_FRAMES) return null;
  return {
    label: 'GO!',
    age,
    enter: ramp(age, 0, CALLOUT_IN_FRAMES),
    leave: ramp(age, GO_FADE_AT, GO_FRAMES),
  };
}

/** "3", "2", "1", then "GO!" for a moment after the countdown, then nothing. */
export function countdownLabel(frame: number): CountdownLabel | null {
  return countdownCallout(frame)?.label ?? null;
}

/** A match clock reading, Ultimate-style: "6:59" and ".50" (hundredths, drawn smaller). Rounds up, so 0:00.00 is the end. */
export function formatClock(frames: number): { main: string; hundredths: string } {
  const cs = Math.ceil((Math.max(0, frames) * 100) / FRAMES_PER_SECOND);
  const s = Math.floor(cs / 100);
  return {
    main: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
    hundredths: `.${String(cs % 100).padStart(2, '0')}`,
  };
}

export interface PlayerStats {
  kos: number;
  falls: number;
  /** Self-destructs: falls with nobody to credit. */
  sds: number;
  damageDealt: number;
  damageTaken: number;
  /** Match frame the last stock was lost, -1 while still in. */
  outFrame: number;
}

export interface PlayerResult {
  port: number;
  fighter: string;
  costume: string;
  cpu: boolean;
  /** 1 = winner; tied players share a place. */
  place: number;
  stocks: number;
  damage: number;
  stats: PlayerStats;
}

export interface MatchResult {
  reason: 'stock' | 'time';
  /** Frames played after GO!. */
  frames: number;
  players: PlayerResult[];
}

/** A finished match as the results screen needs it: what happened and who played. */
export interface FinishedMatch {
  result: MatchResult;
  setup: MatchSetup;
}

const emptyStats = (): PlayerStats => ({
  kos: 0,
  falls: 0,
  sds: 0,
  damageDealt: 0,
  damageTaken: 0,
  outFrame: -1,
});

/**
 * Everything about a match outside the simulation: who drives each port (a controller or a CPU), the countdown, the
 * time limit, the end (one player left, or time), KO credit and the stats for the results screen. It only reads the
 * match state and its events, so it never changes how the match plays out.
 */
export class MatchSession {
  phase: Phase = 'countdown';
  reason: MatchResult['reason'] = 'stock';
  /** Match frame the match ended on (-1 while running). */
  overFrame = -1;
  result: MatchResult | null = null;
  private readonly stats: PlayerStats[];
  private readonly cpus: (CpuPlayer | null)[];
  private readonly lastHitBy: number[];

  constructor(
    readonly match: ResolvedMatch,
    readonly rules: Rules,
  ) {
    const ports = match.config.ports.length;
    this.stats = Array.from({ length: ports }, emptyStats);
    this.lastHitBy = Array.from({ length: ports }, () => -1);
    this.cpus = match.controllers.map((c, port) =>
      c.kind === 'cpu'
        ? createCpu({ port, level: c.level, seed: (match.config.seed ^ ((port + 1) * 0x9e3779b1)) | 0 })
        : null,
    );
  }

  /** Frames left on the clock, or null without a time limit. */
  timeLeft(state: MatchState): number | null {
    if (this.rules.minutes <= 0) return null;
    const end = this.overFrame >= 0 ? this.overFrame : state.frame;
    return Math.max(0, this.rules.minutes * 60 * FRAMES_PER_SECOND - Math.max(0, end - COUNTDOWN_FRAMES));
  }

  /**
   * Every port's input for the frame about to be simulated: `read` for human controllers, the CPUs otherwise, and
   * neutral for everyone during the countdown and after the end.
   */
  inputs(state: MatchState, read: (device: DeviceId | null, port: number) => InputFrame): InputFrame[] {
    return this.match.controllers.map((c, port) => {
      if (this.phase !== 'play' && !(this.phase === 'countdown' && state.frame >= COUNTDOWN_FRAMES))
        return neutralInput();
      return c.kind === 'human' ? read(c.device, port) : this.cpus[port]!.input(state);
    });
  }

  /** Call after every simulated frame: reads its events and decides when the match is over. */
  observe(state: MatchState): void {
    if (this.phase === 'over') return;
    if (this.phase === 'countdown' && state.frame >= COUNTDOWN_FRAMES) this.phase = 'play';
    for (const e of state.events) {
      if (e.type === 'hit' || e.type === 'pummel') {
        this.stats[e.attacker]!.damageDealt += e.damage;
        this.stats[e.victim]!.damageTaken += e.damage;
        if (e.type === 'hit') this.lastHitBy[e.victim] = e.attacker;
      } else if (e.type === 'statusDamage') {
        this.stats[e.port]!.damageTaken += e.damage;
        if (e.source >= 0 && e.source !== e.port) this.stats[e.source]!.damageDealt += e.damage;
      } else if (e.type === 'land' || (e.type === 'action' && e.to === 'ledgeCatch')) {
        this.lastHitBy[e.port] = -1;
      } else if (e.type === 'ko') {
        const s = this.stats[e.port]!;
        const by = this.lastHitBy[e.port]!;
        s.falls++;
        if (by >= 0 && by !== e.port) this.stats[by]!.kos++;
        else s.sds++;
        if (e.stocks <= 0) s.outFrame = state.frame;
        this.lastHitBy[e.port] = -1;
      }
    }
    if (this.phase !== 'play') return;
    const alive = state.fighters.filter((f) => f.stocks > 0).length;
    if (state.fighters.length >= 2 && alive <= 1) this.end(state, 'stock');
    else if (this.timeLeft(state) === 0) this.end(state, 'time');
  }

  private end(state: MatchState, reason: MatchResult['reason']): void {
    this.phase = 'over';
    this.reason = reason;
    this.overFrame = state.frame;
    this.result = this.snapshot(state);
  }

  /**
   * Placings: players still in beat those who are out; among the out, whoever lasted longer places higher. When time
   * runs out, more stocks win, then lower damage. Under Infinite stock nobody loses a stock, so the clock ranks by
   * Ultimate's Time battle score instead: +1 per KO, -1 per fall (self-destructs included). Equal players share a place.
   */
  private snapshot(state: MatchState): MatchResult {
    const infinite = this.match.config.stocks >= INFINITE_STOCKS;
    const score = (port: number): number[] => {
      const f = state.fighters[port]!;
      const s = this.stats[port]!;
      const points = infinite ? s.kos - s.falls : f.stocks;
      return f.stocks > 0
        ? [1, this.reason === 'time' ? points : 0, this.reason === 'time' ? -f.damage : 0]
        : [0, s.outFrame, 0];
    };
    const better = (a: number[], b: number[]) => {
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! > b[i]!;
      return false;
    };
    const scores = state.fighters.map((f) => score(f.port));
    return {
      reason: this.reason,
      frames: Math.max(0, state.frame - COUNTDOWN_FRAMES),
      players: state.fighters.map((f, port) => ({
        port,
        fighter: f.fighter,
        costume: this.match.config.ports[port]?.costume ?? 'default',
        cpu: this.match.controllers[port]?.kind === 'cpu',
        place: 1 + scores.filter((s) => better(s, scores[port]!)).length,
        stocks: Math.max(0, f.stocks),
        damage: f.damage,
        stats: { ...this.stats[port]! },
      })),
    };
  }
}

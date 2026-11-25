import { createCpu, type CpuPlayer } from '../ai';
import { neutralInput, type InputFrame } from '../input/types';
import type { MatchState } from '../sim/match';
import type { DeviceId } from './devices';
import type { MatchSetup, ResolvedMatch, Rules } from './setup';

/** "3, 2, 1" lasts this many frames; GO! comes on the frame after, and only then do inputs reach the fighters. */
export const COUNTDOWN_FRAMES = 180;
export const FRAMES_PER_SECOND = 60;

/** How long GO! stays up once play starts. */
export const GO_FRAMES = 50;

export type Phase = 'countdown' | 'play' | 'over';

const COUNTDOWN_NUMBERS = ['3', '2', '1'] as const;

/** "3", "2", "1", then "GO!" for a moment after the countdown, then nothing. */
export function countdownLabel(frame: number): (typeof COUNTDOWN_NUMBERS)[number] | 'GO!' | null {
  if (frame < COUNTDOWN_FRAMES)
    return COUNTDOWN_NUMBERS[Math.floor((Math.max(0, frame) * COUNTDOWN_NUMBERS.length) / COUNTDOWN_FRAMES)]!;
  return frame < COUNTDOWN_FRAMES + GO_FRAMES ? 'GO!' : null;
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
   * runs out, more stocks win, then lower damage. Equal players share a place.
   */
  private snapshot(state: MatchState): MatchResult {
    const score = (port: number): number[] => {
      const f = state.fighters[port]!;
      const out = this.stats[port]!.outFrame;
      return f.stocks > 0
        ? [1, this.reason === 'time' ? f.stocks : 0, this.reason === 'time' ? -f.damage : 0]
        : [0, out, 0];
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

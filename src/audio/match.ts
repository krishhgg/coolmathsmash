import type { SoundId } from './bank';
import type { AudioEngine, PlayOptions, Voice } from './engine';
import { panForX } from './mix';
import { getFighter } from '../fighters/registry';
import { neutralInput } from '../input/types';
import { cameraTarget } from '../render/camera';
import type { SimEvent } from '../sim/events';
import type { FighterState } from '../sim/fighter';
import { stepMatch, type MatchState } from '../sim/match';
import { getStage } from '../stages/registry';

/** Knockback speed (units per frame) from which a launch gets the whoosh, and the strong one. */
export const LAUNCH_SPEED = 1.6;
export const LAUNCH_STRONG = 3.6;
/** Hits below this knockback never get the KO check (it costs a short simulation). */
const KO_CHECK_KB = 60;
/** Frames simulated ahead to see whether a launch ends in a KO. */
const KO_LOOKAHEAD = 150;
/** Frames between footsteps while running. */
export const STEP_FRAMES = 14;
/** The swing whoosh starts this many frames before the first hitbox, so its peak meets the hit. */
const SWING_LEAD = 3;
/** Falling faster than this (units per frame) lands heavily. */
const HEAVY_LANDING = 2.2;

/** Sounds for entering an action that has no event of its own. */
const ENTER: Record<string, SoundId> = {
  dash: 'dash',
  runBrake: 'skid',
  ledgeCatch: 'ledge-grab',
  ledgeJump: 'jump',
  spotDodge: 'dodge',
  airDodge: 'dodge',
  rollForward: 'roll',
  rollBack: 'roll',
  ledgeRoll: 'roll',
  techRoll: 'roll',
  getupRoll: 'roll',
  techInPlace: 'land',
  downBound: 'land-heavy',
};

/** Landings that go straight into a tech or a missed tech, which play their own sound (ENTER). */
const TECH_LANDINGS = new Set(['techInPlace', 'techRoll', 'downBound']);

/** Hit strength tiers, by the % a hit added or its knockback. */
export function hitSound(damage: number, kb: number, ko: boolean): SoundId {
  if (ko) return 'hit-ko';
  if (damage >= 13 || kb >= 110) return 'hit-heavy';
  if (damage >= 6 || kb >= 60) return 'hit-medium';
  return 'hit-light';
}

/**
 * Will this launch KO? Simulate a copy of the match with nobody touching the controls (no DI) until the
 * fighter is KO'd or back on its feet. This is what lets the KO hit sound play on the hit itself, like Ultimate.
 * The copy never touches the real match.
 */
export function launchKills(state: MatchState, port: number): boolean {
  const m = structuredClone(state);
  const neutral = m.players.map(() => neutralInput());
  for (let i = 0; i < KO_LOOKAHEAD; i++) {
    stepMatch(m, neutral);
    if (m.events.some((e) => e.type === 'ko' && e.port === port)) return true;
    const f = m.fighters[port]!;
    if (i > 10 && f.ground && f.hitlag === 0 && f.launch === null) return false;
  }
  return false;
}

/** What the last frame showed of a fighter, for the sounds the event stream has no event for. */
interface Seen {
  charge: number;
  charging: boolean;
  fallSpeed: number;
  fastFalling: boolean;
  launched: boolean;
}

function swingFrame(
  f: FighterState,
  move: string,
): { at: number; weight: 'light' | 'medium' | 'heavy' } | null {
  const def = getFighter(f.fighter).moves?.[move];
  const first = def?.hits[0];
  if (!def || !first || def.kind === 'projectile') return null;
  const damage = Math.max(...first.boxes.map((b) => b.damage));
  return {
    at: Math.max(1, (def.charge ?? 0) + 1, first.frames[0] - SWING_LEAD),
    weight: def.kind === 'smash' || damage >= 12 ? 'heavy' : damage >= 6 ? 'medium' : 'light',
  };
}

/**
 * Turns a running match into sound: pass `listener` to `Game.onEvents`. It plays each frame's sim events
 * (hits, shields, KOs, jumps, landings, action changes) panned to where they happen, and reads the fighters for
 * the few sounds that have no event (footsteps, smash charge, the launch whoosh, swing whooshes timed to the
 * first hitbox). A frame that does not follow the last one (a new match, a replay) starts the tracking over.
 */
export class MatchAudio {
  private frame = -1;
  private seen: Seen[] = [];
  /** Per port, a move whose swing whoosh is still to come. */
  private swings: (string | null)[] = [];
  private readonly loops = new Map<string, Voice>();

  constructor(private readonly engine: Pick<AudioEngine, 'play' | 'duck'>) {}

  readonly listener = (events: readonly SimEvent[], state: MatchState): void => this.observe(events, state);

  observe(events: readonly SimEvent[], state: MatchState): void {
    if (state.frame !== this.frame + 1) this.reset();
    this.frame = state.frame;
    let view: { x: number; zoom: number } | null = null;
    const pan = (x: number) => {
      view ??= cameraTarget(state, getStage(state.config.stage));
      return panForX(x, view.x, view.zoom);
    };
    const at = (port: number) => pan(state.fighters[port]?.pos.x ?? 0);
    const play = (id: SoundId, opts: PlayOptions) => this.engine.play(id, opts);
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const ko = e.kb >= KO_CHECK_KB && launchKills(state, e.victim);
          const strength = Math.min(1, e.damage / 20);
          const p = pan(e.x);
          play(hitSound(e.damage, e.kb, ko), {
            pan: p,
            gain: 0.8 + 0.25 * strength,
            pitch: 0.8 - 1.6 * strength,
          });
          if (e.effect === 'fire') play('hit-fire', { pan: p });
          if (e.effect === 'electric') play('hit-electric', { pan: p });
          if (ko) this.engine.duck(0.45, 0.5, 0.02, 0.8);
          break;
        }
        case 'shieldHit':
          play('shield-hit', { pan: pan(e.x), gain: 0.7 + 0.3 * Math.min(1, e.damage / 15) });
          break;
        case 'shieldBreak':
          play('shield-break', { pan: at(e.port) });
          break;
        case 'ko':
          play('ko-blast', { pan: pan(e.x) });
          this.engine.duck(0.4, 0.9, 0.02, 1);
          this.stop(`charge:${e.port}`, 0.05);
          this.stop(`dizzy:${e.port}`, 0.1);
          break;
        case 'respawn':
          play('respawn', { pan: at(e.port) });
          break;
        case 'jump':
          play(e.kind === 'air' ? 'double-jump' : 'jump', {
            pan: at(e.port),
            gain: e.kind === 'short' ? 0.8 : 1,
          });
          break;
        case 'land': {
          if (TECH_LANDINGS.has(state.fighters[e.port]?.action ?? '')) break;
          const s = this.seen[e.port];
          const heavy = s !== undefined && (s.fastFalling || s.fallSpeed > HEAVY_LANDING);
          play(heavy ? 'land-heavy' : 'land', { pan: at(e.port) });
          break;
        }
        case 'move':
          this.swings[e.port] = e.move;
          break;
        case 'transform':
          play('respawn', { pan: at(e.port), gain: 0.7, pitch: 3 });
          break;
        case 'action': {
          if (e.to === 'shield' && e.from !== 'shieldStun') play('shield-on', { pan: at(e.port) });
          if (e.to === 'dizzy') this.loop(`dizzy:${e.port}`, play('dizzy', { pan: at(e.port) }));
          if (e.from === 'dizzy') this.stop(`dizzy:${e.port}`, 0.15);
          const id = ENTER[e.to];
          if (id) play(id, { pan: at(e.port) });
          break;
        }
      }
    }
    for (const f of state.fighters) this.track(f, at(f.port));
  }

  /** Stop anything still looping (dizzy birds, a smash charge) and forget the fighters. */
  reset(): void {
    for (const v of this.loops.values()) v.stop(0.05);
    this.loops.clear();
    this.seen = [];
    this.swings = [];
  }

  private track(f: FighterState, pan: number): void {
    const s = this.seen[f.port];
    const launched = f.launch !== null;
    const charging = s !== undefined && f.charge > s.charge;
    if (s) {
      if (f.action === 'run' && f.actionFrame % STEP_FRAMES === 1) this.engine.play('step', { pan });
      if (charging && !s.charging) this.loop(`charge:${f.port}`, this.engine.play('smash-charge', { pan }));
      if (!charging && s.charging) this.stop(`charge:${f.port}`, 0.06);
      if (s.launched && !launched) {
        const speed = Math.hypot(f.kb.x, f.kb.y);
        if (speed >= LAUNCH_SPEED)
          this.engine.play(speed >= LAUNCH_STRONG ? 'launch-strong' : 'launch', {
            pan,
            gain: Math.min(1.2, 0.6 + speed / 8),
          });
      }
    }
    const move = this.swings[f.port];
    if (move) {
      const swing = f.move === move ? swingFrame(f, move) : null;
      if (!swing) this.swings[f.port] = null;
      else if (f.actionFrame >= swing.at) {
        this.engine.play(`swing-${swing.weight}`, { pan });
        this.swings[f.port] = null;
      }
    }
    this.seen[f.port] = {
      charge: f.charge,
      charging,
      fallSpeed: -(f.vel.y + f.kb.y),
      fastFalling: f.fastFalling,
      launched,
    };
  }

  private loop(key: string, voice: Voice | null): void {
    this.loops.get(key)?.stop(0.05);
    if (voice) this.loops.set(key, voice);
  }

  private stop(key: string, fade: number): void {
    this.loops.get(key)?.stop(fade);
    this.loops.delete(key);
  }
}

/**
 * Timed statuses: conditions that sit on a fighter for a number of frames, like Ultimate's flower (Lip's Stick).
 * A fighter declares the ones its moves inflict in FighterDef.statuses; a hitbox's `status` applies one when it
 * hits, and scripts call applyStatus. They tick once per frame the fighter acts, so hitlag pauses them, and a KO
 * clears them. See docs/fighters.md, "Statuses and meters".
 */

import { getFighter } from '../fighters/registry';
import { MASH_BUTTONS, mashDir } from './actions/grab';
import { addDamage } from './combat/hits';
import { justPressed } from './control';
import { emit } from './events';
import type { Ctx, FighterState } from './fighter';
import type { MatchState } from './match';

export interface StatusDef {
  /**
   * Length in frames: floor(frames + perDamage x the % the applying hit added), capped at `max`. Ultimate's flower
   * is 20 + 40 x damage, up to 3000.
   */
  frames: number;
  perDamage?: number;
  /**
   * Frames per unit of the applying hit's knockback, scaled the way its hitlag is (the box's hitlag multiplier, x0.67 on
   * a crouch cancel), added to the length before it is floored. Ultimate's paralysis is floor(1 + knockback x hitlag
   * multiplier x crouch): `frames: 1, perKnockback: 1`.
   */
  perKnockback?: number;
  max?: number;
  /** Applying it again while it lasts: `add` the new length (the flower stacks), or `refresh` to the longer one. */
  stack?: 'add' | 'refresh';
  /** Damage over time: `damage` % on every `every`th frame of the status (the flower: 1% every 21 frames). */
  tick?: { every: number; damage: number };
  /** Frames cut by each new stick direction and each button press (the flower: 16 and 28.8). */
  mash?: { stick: number; button: number };
  /** Runs on every frame of the status, after the fighter's action and before its physics. Deterministic only. */
  script?: (x: Ctx, status: StatusState) => void;
  /**
   * Freezes the fighter while it lasts, as hitlag does: no action, physics or timers, and a launch waits for it. It
   * ticks on every frame from the one after it went on, hitlag frames included, so the freeze after a hit that
   * applies it is the longer of the hit's hitlag and the status (Ultimate's paralysis takes the place of hitlag).
   */
  freeze?: boolean;
  /** A later hit on the fighter (not on a shield) takes it off, and that hit can't put it back on (Ultimate's paralysis). */
  endOnHit?: boolean;
  /** Presentation only: the colour of its badge over the fighter's head. */
  color?: string;
}

/** One status on a fighter (FighterState.statuses, oldest first). Plain data. */
export interface StatusState {
  /** "<fighter id>/<name>" of the FighterDef.statuses entry that defines it. */
  kind: string;
  /** Frames left; mashing can make it fractional. */
  frames: number;
  /** Frames it has ticked: 1 on its first. */
  age: number;
  /** Match frame it went on. It starts ticking on the fighter's next frame, however it was applied. */
  since: number;
  /** Port credited with it: the fighter whose hit applied it, or that entity's owner (-1 for nobody). */
  source: number;
}

export type StatusEndReason = 'expired' | 'ko' | 'cleared' | 'hit';

/** The StatusDef of kind "<fighter id>/<name>". */
export function statusDef(kind: string): StatusDef {
  const slash = kind.indexOf('/');
  const def = slash > 0 ? getFighter(kind.slice(0, slash)).statuses?.[kind.slice(slash + 1)] : undefined;
  if (!def) throw new Error(`unknown status "${kind}"`);
  return def;
}

export function statusOf(f: FighterState, kind: string): StatusState | undefined {
  return f.statuses.find((s) => s.kind === kind);
}

export function hasStatus(f: FighterState, kind: string): boolean {
  return statusOf(f, kind) !== undefined;
}

/**
 * Put status `kind` on `f`, or apply it again (StatusDef.stack). Its length comes from the StatusDef, `damage` (the %
 * the applying hit added) and `knockback` (the hit's knockback scaled like its hitlag, StatusDef.perKnockback) unless
 * `frames` gives one. A length under one frame applies nothing.
 */
export function applyStatus(
  m: MatchState,
  f: FighterState,
  kind: string,
  opts: { damage?: number; knockback?: number; source?: number; frames?: number } = {},
): StatusState | null {
  const def = statusDef(kind);
  const max = def.max ?? Infinity;
  const length = Math.min(
    max,
    opts.frames ??
      Math.floor(
        def.frames +
          (def.perDamage ?? 0) * (opts.damage ?? 0) +
          (def.perKnockback ?? 0) * (opts.knockback ?? 0),
      ),
  );
  if (length < 1) return null;
  const on = statusOf(f, kind);
  if (on) {
    on.frames = def.stack === 'add' ? Math.min(max, on.frames + length) : Math.max(on.frames, length);
    if (opts.source !== undefined) on.source = opts.source;
    return on;
  }
  const status: StatusState = { kind, frames: length, age: 0, since: m.frame, source: opts.source ?? -1 };
  f.statuses.push(status);
  emit(m, { type: 'statusStart', port: f.port, status: kind, frames: length, source: status.source });
  return status;
}

/** Take status `kind` off `f` early (a cure, a script ending its own status). */
export function clearStatus(m: MatchState, f: FighterState, kind: string): void {
  const s = statusOf(f, kind);
  if (s) end(m, f, s, 'cleared');
}

/**
 * A hit landed on `f`: take off its statuses that end on a hit (StatusDef.endOnHit). Ones that went on this frame stay,
 * so hits landing together end the same statuses whatever order they land in. Returns the kinds it took off.
 */
export function endStatusesOnHit(m: MatchState, f: FighterState): string[] {
  const ended = f.statuses.filter((s) => s.since !== m.frame && statusDef(s.kind).endOnHit);
  for (const s of ended) end(m, f, s, 'hit');
  return ended.map((s) => s.kind);
}

/** A KO clears every status. */
export function clearStatusesOnKo(m: MatchState, f: FighterState): void {
  for (const s of [...f.statuses]) end(m, f, s, 'ko');
}

function end(m: MatchState, f: FighterState, s: StatusState, reason: StatusEndReason): void {
  f.statuses = f.statuses.filter((o) => o !== s);
  emit(m, { type: 'statusEnd', port: f.port, status: s.kind, reason });
}

/**
 * One frame of every status on the fighter but the freezing ones, oldest first: mashing cuts it, its script runs, its
 * tick deals damage (no hitlag, no knockback, reported as `statusDamage`), then it counts down and ends at 0. Runs only
 * on frames the fighter acts, from the frame after the status went on.
 */
export function tickStatuses(x: Ctx): void {
  tick(x, false);
}

/**
 * One frame of the fighter's freezing statuses (StatusDef.freeze), ticked like any status but on every frame, hitlag
 * included. True when one was on from before this frame: the fighter is frozen and doesn't act this frame, so the
 * frame a freeze runs out is still frozen, as with hitlag.
 */
export function tickFreezes(x: Ctx): boolean {
  const { m, f } = x;
  const frozen = f.statuses.some((s) => s.since !== m.frame && statusDef(s.kind).freeze);
  if (frozen) tick(x, true);
  return frozen;
}

function tick(x: Ctx, freezing: boolean): void {
  const { m, f, c } = x;
  if (f.statuses.length === 0) return;
  const dir = mashDir(c.cur);
  const stick = dir !== 0 && dir !== mashDir(c.prev) ? 1 : 0;
  const buttons = MASH_BUTTONS.filter((b) => justPressed(c, b)).length;
  for (const s of [...f.statuses]) {
    if (!f.statuses.includes(s) || s.since === m.frame) continue;
    const def = statusDef(s.kind);
    if ((def.freeze ?? false) !== freezing) continue;
    s.age++;
    if (def.mash) s.frames -= stick * def.mash.stick + buttons * def.mash.button;
    def.script?.(x, s);
    if (!f.statuses.includes(s)) continue;
    if (def.tick && s.age % def.tick.every === 0) {
      const before = f.damage;
      addDamage(m, f, def.tick.damage);
      emit(m, {
        type: 'statusDamage',
        port: f.port,
        status: s.kind,
        damage: f.damage - before,
        source: s.source,
      });
    }
    s.frames--;
    if (s.frames <= 0) end(m, f, s, 'expired');
  }
}

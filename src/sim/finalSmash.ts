import { getFighter } from '../fighters/registry';
import type { FinalSmashDef } from '../fighters/types';
import type { FighterState } from './fighter';
import type { MatchState } from './match';

/**
 * Final Smashes, on Ultimate's rules (SmashWiki, "Final Smash" and "Smash Ball"; docs/fighters.md, "Final Smash"):
 *
 * - Activation. "The Final Smash can then be unleashed at any time by pressing the input for a neutral special move"
 *   (Smash Ball), and "the character's neutral special move is replaced with a single use of their Final Smash"
 *   (Final Smash). Neutral special with the charge (FighterState.finalReady), grounded or airborne, from any state
 *   that can start a special, plays the fighter's `finalSmash` move (or its `air` variant) and spends the charge.
 *   Side, up and down special stay specials. A fighter without a `finalSmash` move keeps the charge.
 * - The user. Final Smashes "are unblockable, make the user fully intangible" (Final Smash, "In competitive play"):
 *   every move marked `final` is intangible on all its frames, and its hits and its projectiles' hits go through
 *   shields and parries, and counters, since "unblockable attacks cannot be countered" (Counterattack).
 * - The freeze. "Most Final Smashes cause the camera to temporarily zoom in on the user when activated" (Final
 *   Smash). SmashWiki gives no length, so FINAL_SMASH.freeze is an estimate: for that many frames after activation
 *   everyone else is held still while the user's move plays, and the renderer zooms in over the same frames
 *   (src/render/zoom.ts), as the Special Zoom plays over hitlag.
 * - Cinematic Final Smashes trap: "If the hitbox created from this action makes contact with an opponent, the game
 *   effectively pauses as an unskippable scene plays out" (Final Smash), and they "quickly return to regular
 *   gameplay when finished". Here a trap is a command grab from the `finalSmash` move into a `final` cinematic move:
 *   the first fighter caught is held through it and launched by its throw, and everyone and everything else holds
 *   still until the release.
 * - Direct Final Smashes don't: past the activation freeze, the others move, dodge and act around it.
 * - A KO loses the charge (src/sim/items/spawn.ts). Ultimate's Final Smash Meter is not built.
 */
export const FINAL_SMASH = {
  /** Frames everyone else holds still after activation: two thirds of a second, an estimate (SmashWiki has none). */
  freeze: 40,
};

/** The `final` options of the move `f` is playing, when that move is part of a Final Smash. */
export function finalOf(f: Readonly<FighterState>): FinalSmashDef | undefined {
  return f.move ? getFighter(f.fighter).moves?.[f.move]?.final : undefined;
}

/** `f` is playing a Final Smash (its activation move, an air variant or a trap's cinematic). */
export const inFinalSmash = (f: Readonly<FighterState>): boolean => finalOf(f) !== undefined;

/** Fighter `fighter`'s move `move` is part of its Final Smash, so it and the projectiles it spawns can't be shielded. */
export function isFinalMove(fighter: string, move: string | null): boolean {
  return move !== null && getFighter(fighter).moves?.[move]?.final !== undefined;
}

export const freezeOf = (final: FinalSmashDef): number => final.freeze ?? FINAL_SMASH.freeze;

/** `u`'s Final Smash holds the others still on the next frame: in the activation freeze, or trapping someone. */
function holds(u: Readonly<FighterState>): boolean {
  const final = finalOf(u);
  if (!final) return false;
  if (u.action === 'grabThrow') return u.grabPartner >= 0;
  return u.actionFrame <= freezeOf(final);
}

/**
 * The Final Smash freeze, once every fighter, entity and hit of the frame is done (stepMatch): while a Final Smash
 * activates or traps someone, every other fighter and entity gains a frame of hitlag, which holds it exactly where it
 * is (actions, launches, timers, lifetimes and hitboxes all wait) for the next frame. The user plays on, and so does
 * a trapped fighter, and so do the projectiles the Final Smash itself put out. Reading only the end of the frame
 * keeps it the same whatever the port order.
 */
export function holdStill(m: MatchState): void {
  const users = m.fighters.filter(holds);
  if (users.length === 0) return;
  const plays = (f: FighterState) =>
    users.some((u) => u === f || (u.action === 'grabThrow' && u.grabPartner === f.port));
  for (const f of m.fighters) if (!plays(f)) f.hitlag++;
  for (const e of m.entities) {
    if (!users.some((u) => u.port === e.owner && isFinalMove(u.fighter, e.move))) e.hitlag++;
  }
}

/**
 * Where `fighter`'s Final Smash reaches, from its feet facing right (y up), for CPUs deciding when to use it: its
 * boxes' furthest forward edge (or `final.range`) and their lowest and highest edges. Null without a Final Smash.
 */
export function finalReach(fighter: string): { ahead: number; low: number; high: number } | null {
  const def = getFighter(fighter);
  const move = def.moves?.finalSmash;
  if (!move) return null;
  const boxes = move.hits.flatMap((w) => w.boxes);
  const h = def.stats.height;
  return {
    ahead: move.final?.range ?? Math.max(0, ...boxes.map((b) => b.x + b.radius)),
    low: boxes.length ? Math.min(...boxes.map((b) => b.y - b.radius)) : -h,
    high: boxes.length ? Math.max(...boxes.map((b) => b.y + b.radius)) : 2 * h,
  };
}

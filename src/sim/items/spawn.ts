import { nextRandom, randomInt } from '../../engine/rng';
import { spawnEntity } from '../entities/entities';
import type { MatchState } from '../match';
import { posedStage } from '../movingStage';
import { PLANET } from './planet';

/**
 * Ultimate's item timer at the default Medium frequency: the next item comes 500 to 800 frames after the last
 * (SmashWiki, Item Switch; Ultimate uses Smash 4's rates).
 */
export const ITEM_TIMER = { min: 500, max: 800 };

/**
 * Ultimate's Smash Ball spawn rule (SmashWiki, Smash Ball). Each time the item timer runs out, a Smash Ball comes
 * instead of the item with chance 10% x 1.625 (Medium's frequency compensation) x the early-game factor, which
 * rises from 0 to 1 over the 6660 frames after the 900-frame starting lockout. None comes while one is out or
 * someone holds its charge, nor for 4800 frames after one leaves play.
 */
export const SMASH_BALL = {
  chance: 0.1,
  medium: 1.625,
  startLockout: 900,
  ramp: 6660,
  lockout: 4800,
};

export interface ItemsState {
  /** Frames until the item timer runs out (0 before the first frame with items on). */
  timer: number;
  /** Frames left before a planet may spawn. */
  lockout: number;
  /** A planet was out, or its charge held, last frame. */
  planetInPlay: boolean;
}

export function createItems(): ItemsState {
  return { timer: 0, lockout: SMASH_BALL.startLockout, planetInPlay: false };
}

const drawTimer = (m: MatchState) => ITEM_TIMER.min + randomInt(m, ITEM_TIMER.max - ITEM_TIMER.min + 1);

/** The planet's chance on an item-timer expiry at match frame `frame` (0 during the starting lockout). */
export function planetChance(frame: number): number {
  const early = Math.min(1, Math.max(0, frame - SMASH_BALL.startLockout) / SMASH_BALL.ramp);
  return SMASH_BALL.chance * SMASH_BALL.medium * early;
}

/**
 * One frame of the Items rule, before entities move: a fighter KO'd with a charge loses it, the lockout runs, and
 * when the item timer runs out the planet may appear at one of the stage's respawn points (open air on every
 * stage). The Coolmath Planet is the only item so far, so an expiry that does not roll it spawns nothing. All
 * randomness comes from the match RNG; with the rule off nothing here runs and the RNG is untouched.
 */
export function stepItems(m: MatchState): void {
  if (!m.config.items) return;
  const it = m.items;
  // Ultimate: a fighter KO'd in Final Smash standby loses the Final Smash.
  for (const f of m.fighters)
    if (f.finalReady && (f.action === 'ko' || f.action === 'out')) f.finalReady = false;
  const inPlay = m.entities.some((e) => e.kind === PLANET && !e.dead) || m.fighters.some((f) => f.finalReady);
  if (it.planetInPlay && !inPlay) it.lockout = SMASH_BALL.lockout;
  else if (it.lockout > 0) it.lockout--;
  it.planetInPlay = inPlay;
  if (it.timer === 0) it.timer = drawTimer(m);
  if (--it.timer > 0) return;
  it.timer = drawTimer(m);
  if (inPlay || it.lockout > 0) return;
  if (nextRandom(m) >= planetChance(m.frame)) return;
  const spots = posedStage(m).geo.respawns;
  const [x, y] = spots[randomInt(m, spots.length)]!;
  spawnEntity(m, { kind: PLANET, owner: -1, pos: { x, y } });
  it.planetInPlay = true;
}

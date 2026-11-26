import { randomInt } from '../../engine/rng';
import { registerEntity } from '../entities/entities';
import type { EntityCtx, EntityDef } from '../entities/types';
import { emit } from '../events';
import type { FighterState } from '../fighter';
import type { MatchState } from '../match';
import { approach, clamp } from '../vec';
import * as SimMath from '../math';

/** Entity kind of the Coolmath Planet, the game's Smash Ball. */
export const PLANET = 'item/coolmath-planet';

/**
 * Smash Ball values from Ultimate (SmashWiki, Smash Ball): a fresh one has 40 HP, loses 2 HP every 60 frames on its
 * own until it is at 2.5 HP or less, and flies away 1320 frames (22 s) after it appears if nobody breaks it.
 */
export const PLANET_HP = 40;
export const PLANET_DECAY = 2;
export const PLANET_DECAY_FRAMES = 60;
export const PLANET_DECAY_FLOOR = 2.5;
export const PLANET_LIFETIME = 1320;
/** Body circle: about a third of a 15-unit fighter's height across, like the Smash Ball beside Mario. */
export const PLANET_RADIUS = 5;

/**
 * How it roams. SmashWiki says only that the Smash Ball hovers around the players who are behind and avoids the
 * leader; it gives no speed, so these are tuned by eye: a top speed about half of Mario's walk (1.155), a new spot
 * every 2 seconds, up to 40 units to either side of the trailing fighter and 24 to 40 over it.
 */
export const PLANET_SPEED = 0.6;
const PLANET_ACCEL = 0.02;
const RETARGET_FRAMES = 120;
const HOVER = { minX: -40, maxX: 40, minY: 24, maxY: 40 };
const BOB_FRAMES = 96;
const BOB_SPEED = 0.06;

const inPlay = (f: FighterState) => f.action !== 'ko' && f.action !== 'out' && f.stocks > 0;

/** The fighter furthest behind: fewest stocks, then most damage, then lowest port. Null when nobody is in play. */
export function trailingFighter(m: MatchState): FighterState | null {
  let pick: FighterState | null = null;
  for (const f of m.fighters) {
    if (!inPlay(f)) continue;
    if (!pick || f.stocks < pick.stocks || (f.stocks === pick.stocks && f.damage > pick.damage)) pick = f;
  }
  return pick;
}

const between = (m: MatchState, lo: number, hi: number) => lo + randomInt(m, hi - lo + 1);

/** A new spot to hover at over the trailing fighter (or where it is now), kept inside the camera bounds. */
function retarget({ m, e, stage }: EntityCtx): void {
  const f = trailingFighter(m);
  const cam = stage.geo.camera;
  const x = (f?.pos.x ?? e.pos.x) + between(m, HOVER.minX, HOVER.maxX);
  const y = (f?.pos.y ?? e.pos.y) + between(m, HOVER.minY, HOVER.maxY);
  e.data.tx = clamp(x, cam.left + 10, cam.right - 10);
  e.data.ty = clamp(y, cam.bottom + 10, cam.top - 10);
}

function roam(x: EntityCtx): void {
  const { e } = x;
  if (e.age % PLANET_DECAY_FRAMES === 0 && e.hp > PLANET_DECAY_FLOOR) e.hp -= PLANET_DECAY;
  if (e.age === 1 || e.age % RETARGET_FRAMES === 0) retarget(x);
  const dx = (e.data.tx as number) - e.pos.x;
  const dy = (e.data.ty as number) - e.pos.y;
  const d = SimMath.hypot(dx, dy);
  const speed = Math.min(PLANET_SPEED, d * 0.02);
  const bob = SimMath.sin((e.age / BOB_FRAMES) * 2 * Math.PI) * BOB_SPEED;
  e.vel.x = approach(e.vel.x, d > 0 ? (dx / d) * speed : 0, PLANET_ACCEL);
  e.vel.y = approach(e.vel.y, (d > 0 ? (dy / d) * speed : 0) + bob, PLANET_ACCEL);
}

/** Whoever breaks it holds a Final Smash charge (Ultimate's Final Smash standby). */
function claim(m: MatchState, e: { pos: { x: number; y: number } }, by: number): void {
  const f = m.fighters.find((g) => g.port === by);
  if (!f || !inPlay(f)) return;
  f.finalReady = true;
  emit(m, { type: 'finalReady', port: f.port, x: e.pos.x, y: e.pos.y });
}

/**
 * The Coolmath Planet: floats around the stage, takes hits from everyone (it belongs to nobody) and is knocked
 * about by them, bounces off the stage, and gives whoever lands the breaking hit a Final Smash charge.
 */
export const planet: EntityDef = {
  radius: PLANET_RADIUS,
  hp: PLANET_HP,
  // SmashWiki gives no weight; Mario's 98 rounded, so a strong hit sends it about half a stage away.
  weight: 100,
  lifetime: PLANET_LIFETIME,
  floor: 'bounce',
  bounce: 0.6,
  wall: 'bounce',
  script: roam,
  onBreak: claim,
};

registerEntity(PLANET, planet);

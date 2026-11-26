import type { HitboxDef, MoveDef } from '../types';
import { stickX } from '../../sim/control';

const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({ id, x, y, radius, ...hit });

/**
 * Baton Twirl Rush's carry hits: a flat set knockback whose launch speed matches Bob's rush, so the target is swept
 * along just ahead of him into the bonk at any %. The twirl reaches round his back too.
 */
const twirl = [
  box(0, 6, 7.5, 5, { damage: 1.5, angle: 5, kbg: 100, bkb: 0, wbkb: 65, hitlag: 0.5 }),
  box(1, -3, 7.5, 5, { damage: 1.5, angle: 5, kbg: 100, bkb: 0, wbkb: 65, hitlag: 0.5 }),
];

/** Speed of the rush: about 40 units over frames 6-27, easing off at the end. */
const RUSH_SPEED = 2.2;

/**
 * Baton Twirl Rush (side special): Bob dashes about 40 units forward twirling the baton, five 1.5% hits that carry
 * the target along, then a diagonal bonk (12.5% in all). In the air it only moves him forward, with no stall, so it
 * can't be chained to stay up.
 */
export const sideB: MoveDef = {
  kind: 'other',
  faf: 50,
  continuesOnLanding: true,
  hits: [
    ...[8, 11, 14, 17, 20].map((from) => ({
      frames: [from, from + 1] as [number, number],
      rehit: true,
      boxes: twirl,
    })),
    {
      frames: [25, 27],
      rehit: true,
      boxes: [box(0, 8, 8, 5, { damage: 5, angle: 45, kbg: 110, bkb: 55 })],
    },
  ],
  script({ f }) {
    if (f.actionFrame < 6) {
      f.vel.x *= 0.5;
      return;
    }
    if (f.actionFrame <= 27) {
      f.vel.x = f.facing * RUSH_SPEED * (f.actionFrame <= 22 ? 1 : 1 - (f.actionFrame - 22) / 6);
      return;
    }
    f.vel.x *= 0.7;
  },
};

/**
 * Lucario's Double Team in Ultimate, the counter Shadow Step copies. SmashWiki, Lucario (SSBU)/Down special
 * (oldid 2033209): the stance is intangible on 4-13, counters on 5-24 and is interruptible from 71; the attack has
 * hitboxes on 17-28, intangibility on 1-29 and is interruptible from 60, counting from the catch, because Lucario
 * "immediately transitions into the attack without undergoing any self-freeze frames" while the attacker freezes for
 * 6 to 30 frames (by the move countered) and is slowed after. The kick: 12.5% at base aura, 70 degrees, BKB 50,
 * KBG 105, hitlag x2.2, boxes of radius 3.5, 3.5 and 5. ultimateframedata.com/lucario: the stance is "Invulnerable on
 * frame 4. Counters on frame 5-24", 70 frames in all; the counterattack is "Invulnerable on frame 1-17 in addition to
 * counter freeze frames", 47 frames in all. Against SmashWiki's 1-29 and 60 those counter freeze frames are 12.
 */
export const DOUBLE_TEAM = {
  intangible: [4, 4] as [number, number],
  window: [5, 24] as [number, number],
  faf: 71,
  freeze: 12,
  attack: { hits: [17, 28] as [number, number], intangible: [1, 29] as [number, number], faf: 60 },
  kick: { damage: 12.5, angle: 70, kbg: 105, bkb: 50, hitlag: 2.2 },
};

/**
 * The engine freezes the counterer with the attacker, and the counterattack's frame 1 is the last frozen frame, so
 * Double Team's attack frames (counted from the catch) are this many frames later on the counterattack's clock.
 */
const FROZEN = DOUBLE_TEAM.freeze - 1;
const afterFreeze = ([from, to]: [number, number]): [number, number] => [
  Math.max(1, from - FROZEN),
  to - FROZEN,
];

/**
 * How far behind the attacker Bob reappears. Not in either source: an ESTIMATE that puts the middle of the baton on
 * the attacker's back and its tip past their front.
 */
export const SHADOW_STEP_BEHIND = 11;

/**
 * Shadow Step (down special): Bob ducks into the shadows. A hit that lands on frames 5-24 is caught, and he steps
 * out of the shadow behind the attacker with a baton strike (downBHit). Intangible on frame 4 only
 * (ultimateframedata's), because an intangible fighter can't counter in this engine and SmashWiki's 4-13 would
 * close the window until 14. A grab or a hit before 4 or after 24 goes through.
 */
export const downB: MoveDef = {
  kind: 'other',
  faf: DOUBLE_TEAM.faf,
  hits: [],
  intangible: DOUBLE_TEAM.intangible,
  continuesOnLanding: true,
  counter: {
    window: DOUBLE_TEAM.window,
    move: 'downBHit',
    multiplier: 0,
    freeze: DOUBLE_TEAM.freeze,
    behind: SHADOW_STEP_BEHIND,
  },
};

const strike = (id: number, x: number, y: number, radius: number) => box(id, x, y, radius, DOUBLE_TEAM.kick);

/**
 * Shadow Step's strike: Double Team's kick on the baton, a fixed 12.5% (`multiplier: 0`) whatever it caught. Its
 * frames are Double Team's moved onto the counterattack's clock: hitboxes on 6-17, intangible on 1-18 (plus the
 * freeze before it) and actionable from 49, so the strike lands 17 frames after the catch and Bob can act 60
 * frames after it, as Lucario does. In the air it carries on when he lands.
 */
export const downBHit: MoveDef = {
  kind: 'other',
  faf: DOUBLE_TEAM.attack.faf - FROZEN,
  intangible: afterFreeze(DOUBLE_TEAM.attack.intangible),
  continuesOnLanding: true,
  hits: [
    {
      frames: afterFreeze(DOUBLE_TEAM.attack.hits),
      boxes: [strike(0, 4.5, 8, 3.5), strike(1, 8.5, 7.5, 3.5), strike(2, 12, 7, 5)],
    },
  ],
};

/** Grappling Hook's zip: units per frame along the rope, from frame ZIP_FROM to ZIP_TO. */
const ZIP_SPEED = 2.8;
const ZIP_FROM = 14;
const ZIP_TO = 30;

/**
 * Grappling Hook (up special): Bob fires a burglar's grapple up and forward (a 5% hit on the hook) and zips after
 * it in a straight line, rising about 55 units. The stick picks the line when the zip starts: 70 degrees by
 * default, 55 held forward, 85 held back; air drift is off for the whole move, so the stick can't bend it after.
 * He hangs in place while the hook flies, can catch a ledge from the moment the zip starts, and ends helpless.
 */
export const upB: MoveDef = {
  kind: 'other',
  faf: 46,
  leavesGround: true,
  helpless: true,
  drift: false,
  ledgeFrom: ZIP_FROM,
  landingLag: 22,
  hits: [
    { frames: [10, 11], boxes: [box(0, 5, 15, 4, { damage: 5, angle: 80, kbg: 80, bkb: 45 })] },
    { frames: [12, 13], boxes: [box(0, 9, 24, 4, { damage: 5, angle: 80, kbg: 80, bkb: 45 })] },
  ],
  script({ f, c, s }) {
    if (f.actionFrame < ZIP_FROM) {
      f.vel.x *= 0.85;
      f.vel.y = Math.max(f.vel.y * 0.5, 0);
      return;
    }
    if (f.actionFrame === ZIP_FROM) {
      const lean = stickX(c) * f.facing;
      const rad = ((lean > 0.3 ? 55 : lean < -0.3 ? 85 : 70) * Math.PI) / 180;
      f.vel.x = f.facing * ZIP_SPEED * Math.cos(rad);
      f.vel.y = ZIP_SPEED * Math.sin(rad);
      return;
    }
    if (f.actionFrame > ZIP_TO) return;
    // Gravity is the only thing that touched the velocity since last frame: undo it and keep the line's speed.
    const vy = f.vel.y + s.gravity;
    const scale = (ZIP_SPEED * (f.actionFrame > ZIP_TO - 4 ? 0.6 : 1)) / Math.hypot(f.vel.x, vy);
    f.vel.x *= scale;
    f.vel.y = vy * scale;
  },
};

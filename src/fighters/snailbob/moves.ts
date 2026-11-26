import type { HitboxDef, MoveDef } from '../types';
import { Btn } from '../../input/types';
import { startMove } from '../../sim/actions/attack';
import { SMASH_CHARGE_FRAMES } from '../../sim/actions/charge';
import { isHeld } from '../../sim/control';

/** Shorthand for a hitbox: id, x forward, y up, radius, then the hit's numbers. */
const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({ id, x, y, radius, ...hit });

/** A grab box: catches instead of hitting, so it carries no damage or knockback. */
const grabBox = (id: number, x: number, y: number, radius: number) =>
  box(id, x, y, radius, { damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true });

/** Shell Pound: the frame the shell starts to plunge, and its speed. */
export const DAIR_PLUNGE_FROM = 13;
export const DAIR_PLUNGE_SPEED = 2.8;

/** Shell Spin: he revs on this frame while Special is held, then rolls on SPIN_ROLL's frames. */
export const SPIN_REV_FRAME = 11;
export const SPIN_ROLL: [number, number] = [12, 44];
/** Roll speed uncharged and fully revved (units/frame). */
export const SPIN_SPEED: [number, number] = [1.8, 3.2];

/**
 * Snail Bob's moves (handoffs/research/roster.md, "5. Snail Bob"): damage and first active frames are the
 * roster's; knockback growth and base are Ultimate-style values for moves like them (CREW.md, "Knockback
 * values": retuned once COOL-3's KO calibration lands). He is slow and heavy, so his endlag is long. Frame windows are
 * inclusive, faf is the first actionable frame, and move names double as animation clip names.
 */
export const moves: Record<string, MoveDef> = {
  /**
   * Snail Punches, first hit: a little jab (King K. Rool's jab 1). Attack again chains into the second punch. Like
   * K. Rool's, the fist's tip pulls back toward him (180°) so the chain still links from the jab's full reach.
   */
  jab: {
    kind: 'other',
    faf: 20,
    next: { window: [7, 19], move: 'jab2' },
    hits: [
      {
        frames: [4, 5],
        boxes: [
          box(0, 7, 6, 3, { damage: 2, angle: 361, kbg: 30, bkb: 30 }),
          box(1, 10.5, 6, 2, { damage: 2, angle: 180, kbg: 15, bkb: 20 }),
        ],
      },
    ],
  },
  /** Snail Punches, second hit: the other fist (King K. Rool's jab 2), its tip pulling in the same way. */
  jab2: {
    kind: 'other',
    faf: 21,
    next: { window: [6, 20], move: 'jab3' },
    hits: [
      {
        frames: [3, 4],
        boxes: [
          box(0, 7.5, 6, 3, { damage: 2, angle: 361, kbg: 30, bkb: 25 }),
          box(1, 11, 6, 2, { damage: 2, angle: 180, kbg: 15, bkb: 20 }),
        ],
      },
    ],
  },
  /** Snail Punches, finisher: shoves forward with the shell (R.O.B.'s jab finisher). */
  jab3: {
    kind: 'other',
    faf: 34,
    hits: [{ frames: [5, 6], boxes: [box(0, 9, 6, 4.5, { damage: 3.5, angle: 361, kbg: 120, bkb: 40 })] }],
  },
  /** Shell Bump: turns and bumps with the shell (R.O.B.'s forward tilt). */
  ftilt: {
    kind: 'other',
    faf: 34,
    hits: [
      {
        frames: [8, 10],
        boxes: [
          box(0, 10.5, 6, 5, { damage: 10, angle: 361, kbg: 77, bkb: 48 }),
          box(1, 5, 6, 4, { damage: 7, angle: 361, kbg: 77, bkb: 48 }),
        ],
      },
    ],
  },
  /** Antenna Whip: the eyestalks whip overhead, front to back; launches up for juggles (R.O.B.'s up tilt). */
  utilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [6, 11],
        boxes: [
          box(0, 2, 15, 5, { damage: 6, angle: 90, kbg: 80, bkb: 55, direction: 'away' }),
          box(1, 6, 11, 4, { damage: 6, angle: 90, kbg: 80, bkb: 55, direction: 'away' }),
        ],
      },
    ],
  },
  /** Slime Trail: a low slither along the floor (R.O.B.'s down tilt). */
  dtilt: {
    kind: 'other',
    faf: 25,
    hits: [
      {
        frames: [7, 9],
        boxes: [
          box(0, 11, 2, 4, { damage: 5, angle: 361, kbg: 100, bkb: 2 }),
          box(1, 6, 2, 3.5, { damage: 5, angle: 361, kbg: 100, bkb: 2 }),
        ],
      },
    ],
  },
  /** Shell Slide: pulls into the shell and slides along the ground; weaker late (Donkey Kong's dash attack). */
  dashAttack: {
    kind: 'other',
    faf: 44,
    hits: [
      { frames: [9, 12], boxes: [box(0, 6, 5, 6, { damage: 10, angle: 53, kbg: 46, bkb: 85 })] },
      { frames: [13, 24], boxes: [box(0, 6, 5, 5.5, { damage: 6, angle: 45, kbg: 60, bkb: 60 })] },
    ],
    script({ f }) {
      if (f.actionFrame < 9) f.vel.x *= 0.9;
      else if (f.actionFrame <= 28) f.vel.x = f.facing * Math.max(2 - (f.actionFrame - 9) * 0.085, 0.2);
    },
  },
  /** Lever Punch: yanks a construction lever and a girder swings forward. His main kill move (R.O.B.'s fsmash). */
  fsmash: {
    kind: 'smash',
    faf: 56,
    charge: 11,
    hits: [
      {
        frames: [16, 18],
        boxes: [
          box(0, 15, 7, 5.5, { damage: 15, angle: 41, kbg: 105, bkb: 32 }),
          box(1, 8, 7, 4, { damage: 11.5, angle: 41, kbg: 110, bkb: 32 }),
        ],
      },
    ],
  },
  /** Shell Pop: pops the shell straight up out of the ground (R.O.B.'s up smash). */
  usmash: {
    kind: 'smash',
    faf: 50,
    charge: 7,
    hits: [
      {
        frames: [12, 15],
        boxes: [
          box(0, 0, 15, 6.5, { damage: 14, angle: 80, kbg: 98, bkb: 40, direction: 'away' }),
          box(1, 0, 7, 6, { damage: 13, angle: 85, kbg: 98, bkb: 40, direction: 'away' }),
        ],
      },
    ],
  },
  /** Shell Spin: spins in place in the shell, front then back, at a low angle (Squirtle's down smash). */
  dsmash: {
    kind: 'smash',
    faf: 48,
    charge: 4,
    hits: [
      {
        frames: [10, 11],
        boxes: [box(0, 9, 4, 5.5, { damage: 13, angle: 28, kbg: 74, bkb: 50 })],
      },
      {
        frames: [14, 15],
        boxes: [box(0, -9, 4, 5.5, { damage: 13, angle: 28, kbg: 74, bkb: 50, direction: 'back' })],
      },
    ],
  },
  /**
   * Spins up from the floor in the shell, hitting both sides; intangible until the second hit ends (R.O.B.'s
   * floor attack).
   */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      { frames: [17, 18], boxes: [box(0, 9, 4, 5.5, { damage: 7, angle: 48, kbg: 48, bkb: 80 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -9, 4, 5.5, { damage: 7, angle: 48, kbg: 48, bkb: 80, direction: 'back' })],
      },
    ],
  },
  /** Shell Tuck: tucks into the shell and spins; strong early, weaker lingering hit (Sonic's nair). */
  nair: {
    kind: 'aerial',
    faf: 42,
    landingLag: 9,
    autoCancel: [
      [1, 3],
      [34, 42],
    ],
    hits: [
      {
        frames: [6, 9],
        boxes: [box(0, 0, 6, 7.5, { damage: 9, angle: 75, kbg: 80, bkb: 30, direction: 'away' })],
      },
      {
        frames: [10, 24],
        boxes: [box(0, 0, 6, 7, { damage: 6, angle: 75, kbg: 85, bkb: 20, direction: 'away' })],
      },
    ],
  },
  /** Shell Punch: punches forward out of the shell (Bowser's fair). */
  fair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 12,
    autoCancel: [
      [1, 2],
      [32, 40],
    ],
    hits: [
      {
        frames: [10, 12],
        boxes: [
          box(0, 10, 6, 4.5, { damage: 12, angle: 361, kbg: 80, bkb: 40 }),
          box(1, 5.5, 7, 3.5, { damage: 11, angle: 361, kbg: 80, bkb: 40 }),
        ],
      },
    ],
  },
  /** Shell Bash: bashes backward with the shell; his aerial kill move (R.O.B.'s bair). */
  bair: {
    kind: 'aerial',
    faf: 36,
    landingLag: 10,
    autoCancel: [
      [1, 3],
      [26, 36],
    ],
    hits: [
      {
        frames: [9, 11],
        boxes: [box(0, -9, 6, 6, { damage: 13, angle: 35, kbg: 83, bkb: 35, direction: 'back' })],
      },
      {
        frames: [12, 16],
        boxes: [box(0, -8, 6, 5, { damage: 7.5, angle: 35, kbg: 74, bkb: 35, direction: 'back' })],
      },
    ],
  },
  /** Eyestalk Flick: flicks the eyestalks overhead (Jigglypuff's uair). */
  uair: {
    kind: 'aerial',
    faf: 32,
    landingLag: 8,
    autoCancel: [
      [1, 2],
      [22, 32],
    ],
    hits: [
      {
        frames: [6, 10],
        boxes: [
          box(0, 1, 16, 5, { damage: 8, angle: 88, kbg: 100, bkb: 30, direction: 'away' }),
          box(1, 5, 13, 4, { damage: 8, angle: 88, kbg: 100, bkb: 30, direction: 'away' }),
        ],
      },
    ],
  },
  /**
   * Shell Pound (the video's ground pound): Bob hangs for a moment, rising a little, then drops shell-first.
   * The early drop meteors (frames 16-20), the rest of the drop hits normally, and landing always turns into the
   * shockwave and its lag (`dairLand`), so `landingLag` only mirrors that. The script owns the fall, so it marks
   * him fast-falling to keep a down flick from overriding it; if the move ends in the air he keeps falling fast.
   * Damage and knockback are Toon Link's dair, another stall-then-fall plunge.
   */
  dair: {
    kind: 'aerial',
    faf: 50,
    landingLag: 29,
    continuesOnLanding: true,
    hits: [
      {
        frames: [16, 20],
        boxes: [box(0, 0, 1, 6, { damage: 16, angle: 268, kbg: 80, bkb: 40 })],
      },
      {
        frames: [21, 45],
        boxes: [box(0, 0, 2, 5.5, { damage: 14, angle: 50, kbg: 98, bkb: 40, direction: 'away' })],
      },
    ],
    script(x) {
      const { f } = x;
      if (f.ground) {
        startMove(x, 'dairLand');
        return;
      }
      f.fastFalling = true;
      if (f.actionFrame < DAIR_PLUNGE_FROM) {
        f.vel.x *= 0.85;
        f.vel.y = 0.5 - f.actionFrame * 0.05;
      } else f.vel.y = -DAIR_PLUNGE_SPEED;
    },
  },
  /** Shell Pound landing: the shockwave on both sides, then the shell's landing lag. */
  dairLand: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [1, 3],
        boxes: [
          box(0, 8, 2, 5, { damage: 5, angle: 30, kbg: 100, bkb: 20 }),
          box(1, -8, 2, 5, { damage: 5, angle: 30, kbg: 100, bkb: 20, direction: 'back' }),
        ],
      },
    ],
  },
  /**
   * Shell Spin (side special, the video's Sonic spin): he ducks into the shell and revs while Special is held, up
   * to a second, then rolls forward. Revving speeds the roll up and raises its damage from 10% to 14% (the smash
   * charge multiplier). The roll stops at ledges on the ground, keeps rolling when it lands from the air, and
   * bounces him back off the first fighter it hits (a hit on the roll's last frame included). Starting it cancels a
   * fast fall; in the air the roll starts with a hop that spends his midair jump, so only one Shell Spin per
   * airtime gains height. Knockback is Sonic's Spin Dash ground roll.
   */
  sideB: {
    kind: 'other',
    faf: 60,
    continuesOnLanding: true,
    hits: [{ frames: SPIN_ROLL, boxes: [box(0, 0, 6, 6.5, { damage: 10, angle: 70, kbg: 70, bkb: 80 })] }],
    script({ f, c, s }) {
      const frame = f.actionFrame;
      if (frame === 1) f.fastFalling = false;
      if (frame <= SPIN_REV_FRAME) {
        f.vel.x *= 0.85;
        if (!f.ground && !f.fastFalling) f.vel.y = Math.max(f.vel.y * 0.8, -0.4);
        if (frame === SPIN_REV_FRAME && isHeld(c, Btn.Special) && f.charge < SMASH_CHARGE_FRAMES) {
          f.charge++;
          f.actionFrame--;
        }
        return;
      }
      if (frame > SPIN_ROLL[1] + 1) return;
      if (f.hitVictims.length > 0) {
        f.vel.x = -f.facing;
        if (!f.ground) {
          f.vel.y = 1.5;
          f.fastFalling = false;
        }
        f.actionFrame = SPIN_ROLL[1] + 1;
        return;
      }
      if (frame > SPIN_ROLL[1]) return;
      if (frame === SPIN_ROLL[0] && !f.ground && f.jumpsUsed < s.jumps) {
        f.vel.y = 1.2;
        f.fastFalling = false;
        f.jumpsUsed = s.jumps;
      }
      const [slow, fast] = SPIN_SPEED;
      f.vel.x = f.facing * (slow + ((fast - slow) * f.charge) / SMASH_CHARGE_FRAMES);
    },
  },
  /**
   * Crate Drop: he presses a remote button and a construction crate drops from high above, a little ahead of him,
   * landing around frame 30 (roster) on the floor he stands on. It hits whoever it lands on and then rests there
   * (entities.ts). Only one falling crate at a time.
   */
  neutralB: {
    kind: 'other',
    faf: 46,
    hits: [],
    spawn: [{ frame: 14, entity: 'snailbob/crateFall', x: 20, y: 45, vy: -1.5, max: 1 }],
  },
  /**
   * Rocket Hover (up special): a little rocket under the shell (the Snail Bob 4 kind) thrusts him up while Special
   * is held, on the fuel in FighterDef.hover. It plays like R.O.B.'s Robo Burner in Ultimate: no hitbox (the
   * exhaust deals no damage), actionable on frame 25, and letting go falls without going helpless, so he can hover
   * again on the fuel left. The tank refills only on the ground.
   */
  upB: { kind: 'other', faf: 25, action: 'hover', hits: [] },
  /** Grabs: slow, short-armed (frame 9, about 11.5 units against Mario's 12 from a wider body). */
  grab: { kind: 'other', faf: 40, hits: [{ frames: [9, 10], boxes: [grabBox(0, 7.5, 6, 4)] }] },
  dashGrab: { kind: 'other', faf: 48, hits: [{ frames: [11, 12], boxes: [grabBox(0, 8.5, 6, 4.5)] }] },
  /** Turns around out of a dash or run and grabs behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 44, hits: [{ frames: [12, 13], boxes: [grabBox(0, 9, 6, 5)] }] },
  /** Slime: a slimy squeeze. */
  pummel: { kind: 'other', faf: 7, hits: [], pummel: { frame: 1, damage: 1.2, hitlag: 2 } },
  /** Shell Shove: shoves them away with the shell (R.O.B.'s forward throw). */
  fthrow: {
    kind: 'other',
    faf: 34,
    hits: [],
    throw: { frame: 14, hit: { damage: 8, angle: 45, kbg: 65, bkb: 60 } },
  },
  /** Roll Over: rolls backward over them; his kill throw at the ledge (King K. Rool's back throw). */
  bthrow: {
    kind: 'other',
    faf: 46,
    hits: [],
    throw: { frame: 24, hit: { damage: 11, angle: 35, kbg: 56, bkb: 70, direction: 'back' } },
  },
  /** Crane Magnet: a construction magnet hauls them up and lets go (R.O.B.'s up throw). */
  uthrow: {
    kind: 'other',
    faf: 52,
    hits: [],
    throw: { frame: 30, hit: { damage: 9, angle: 80, kbg: 70, bkb: 60 } },
  },
  /** Shell Sit: sits on them shell-first; low knockback, a combo starter (Ganondorf's down throw). */
  dthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 20, hit: { damage: 6, angle: 65, kbg: 50, bkb: 70 } },
  },
};

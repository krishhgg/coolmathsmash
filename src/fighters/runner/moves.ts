import type { HitboxDef, MoveDef } from '../types';
import { addDamage } from '../../sim/combat/hits';
import { emit } from '../../sim/events';

/** Shorthand for a hitbox: id, x forward, y up, radius, then the hit's numbers. */
const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
): HitboxDef => ({ id, x, y, radius, ...hit });

/** A grab box: catches instead of hitting, so it carries no damage or knockback. */
const grabBox = (id: number, x: number, y: number, radius: number) =>
  box(id, x, y, radius, { damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true });

/** Tile Flip's air hop: the upward speed it sets and on which frame. Less than a cycle of gravity, so no stall. */
export const HOP = { frame: 3, speed: 0.8 };

/**
 * The kick flurry's timeline: a kick on each of these frames. Attack during [loop, loop + 1], after the last kick,
 * restarts it on frame 1, which kicks again, so mashing keeps a kick every other frame (presses buffer, so a press
 * anywhere in the cycle counts). Otherwise the shove comes out three frames after the window closes, on Kirby's
 * finisher timing (startup 3, 39 frames in all).
 */
export const RAPID_JAB = { kicks: [1, 3, 5, 7], loop: 9, shove: [13, 14] as [number, number], faf: 50 };

/** Down throw's treadmill steps: the frames on which each footfall lands and the % it deals. */
export const TREADMILL = { frames: [8, 12, 16, 20], damage: 1 };

/**
 * The Runner's normals: Kirby's kit shape (rapid jab, strong back air, drill down air, piledriver up throw) with
 * the damage and startup from handoffs/research/roster.md, and the rest of each move's frame data from Kirby's
 * (and for her dropkick and split kick, Sonic-speed versions of Kirby's) Ultimate numbers. Frame windows are
 * inclusive, faf is the first actionable frame, and move names double as animation clip names.
 */
export const moves: Record<string, MoveDef> = {
  /** Jog Flurry, first punch (Kirby's jab 1). Attack again from frame 4 throws the second. */
  jab: {
    kind: 'other',
    faf: 15,
    next: { window: [4, 14], move: 'jab2' },
    hits: [{ frames: [2, 3], boxes: [box(0, 6, 7, 3.5, { damage: 1.8, angle: 361, kbg: 25, bkb: 20 })] }],
  },
  /** Jog Flurry, second punch (Kirby's jab 2). Attack again from frame 5 starts the kick flurry. */
  jab2: {
    kind: 'other',
    faf: 16,
    next: { window: [5, 15], move: 'jabRapid' },
    hits: [{ frames: [3, 3], boxes: [box(0, 6.5, 7, 3.5, { damage: 1.8, angle: 361, kbg: 15, bkb: 25 })] }],
  },
  /**
   * Jog Flurry, the kick flurry (Kirby's rapid jab): running in place, a kick every other frame. Each press of
   * Attack keeps it going for another four kicks; once she stops pressing, she finishes with a two-handed shove.
   */
  jabRapid: {
    kind: 'other',
    faf: RAPID_JAB.faf,
    next: { window: [RAPID_JAB.loop, RAPID_JAB.loop + 1], move: 'jabRapid' },
    hits: [
      ...RAPID_JAB.kicks.map((frame): MoveDef['hits'][number] => ({
        frames: [frame, frame],
        rehit: true,
        boxes: [box(0, 6.5, 5, 4, { damage: 0.3, angle: 361, kbg: 35, bkb: 7 })],
      })),
      {
        frames: RAPID_JAB.shove,
        rehit: true,
        boxes: [box(0, 7, 6.5, 4, { damage: 3, angle: 361, kbg: 115, bkb: 70 })],
      },
    ],
  },
  /** Strafe Kick: a spinning roundhouse at hip height; the foot is the sweetspot. */
  ftilt: {
    kind: 'other',
    faf: 24,
    hits: [
      {
        frames: [5, 8],
        boxes: [
          box(0, 9.5, 6, 3.8, { damage: 8, angle: 361, kbg: 75, bkb: 40 }),
          box(1, 5, 6, 3, { damage: 7, angle: 361, kbg: 75, bkb: 40 }),
        ],
      },
    ],
  },
  /** Wall Flip: a backflip kick, as if flipping onto a tunnel wall. Pops up and back, so it chains at low %. */
  utilt: {
    kind: 'other',
    faf: 21,
    hits: [
      { frames: [4, 5], boxes: [box(0, 3.5, 10, 4.5, { damage: 5, angle: 100, kbg: 132, bkb: 30 })] },
      { frames: [6, 10], boxes: [box(0, -2, 13.5, 4.5, { damage: 4, angle: 88, kbg: 130, bkb: 26 })] },
    ],
  },
  /** Gap Trip: a low sliding kick at the shins. */
  dtilt: {
    kind: 'other',
    faf: 22,
    hits: [{ frames: [5, 7], boxes: [box(0, 8.5, 1.5, 3.5, { damage: 6, angle: 361, kbg: 43, bkb: 30 })] }],
  },
  /** Tile Tumble: a dive-roll across the floor; strong as she lands, weaker as she rolls out. */
  dashAttack: {
    kind: 'other',
    faf: 38,
    hits: [
      { frames: [7, 12], boxes: [box(0, 6, 5, 4.5, { damage: 9, angle: 46, kbg: 52, bkb: 70 })] },
      { frames: [13, 20], boxes: [box(0, 5, 4, 4, { damage: 6, angle: 76, kbg: 45, bkb: 60 })] },
    ],
  },
  /** Running Dropkick: a two-footed flying kick, her main horizontal finisher. Charges on frame 8. */
  fsmash: {
    kind: 'smash',
    faf: 46,
    charge: 8,
    hits: [
      {
        frames: [12, 14],
        boxes: [
          box(0, 11, 6, 4.5, { damage: 15, angle: 361, kbg: 72, bkb: 32 }),
          box(1, 6, 6, 3.5, { damage: 15, angle: 361, kbg: 72, bkb: 32 }),
        ],
      },
      { frames: [15, 18], boxes: [box(0, 10, 5, 4, { damage: 11, angle: 60, kbg: 55, bkb: 70 })] },
    ],
  },
  /** Handstand Flip: kicks straight up out of a handstand; the legs sweep from the front to overhead. */
  usmash: {
    kind: 'smash',
    faf: 44,
    charge: 6,
    hits: [
      {
        frames: [10, 12],
        boxes: [
          box(0, 0, 14, 5.5, { damage: 14, angle: 85, kbg: 95, bkb: 36, direction: 'away' }),
          box(1, 5, 6, 4, { damage: 14, angle: 85, kbg: 95, bkb: 36 }),
        ],
      },
      {
        frames: [13, 15],
        boxes: [box(0, 0, 14, 5, { damage: 10, angle: 80, kbg: 90, bkb: 20, direction: 'away' })],
      },
    ],
  },
  /** Split Kick: drops into the splits, kicking both sides at once along the floor. */
  dsmash: {
    kind: 'smash',
    faf: 44,
    charge: 3,
    hits: [
      {
        frames: [6, 8],
        boxes: [
          box(0, 8.5, 2, 4.2, { damage: 13, angle: 29, kbg: 71, bkb: 25 }),
          box(1, -8.5, 2, 4.2, { damage: 13, angle: 29, kbg: 71, bkb: 25, direction: 'back' }),
        ],
      },
      {
        frames: [9, 12],
        boxes: [
          box(0, 8, 2, 3.8, { damage: 9, angle: 29, kbg: 65, bkb: 20 }),
          box(1, -8, 2, 3.8, { damage: 9, angle: 29, kbg: 65, bkb: 20, direction: 'back' }),
        ],
      },
    ],
  },
  /** Space Tuck: tucks into a spinning ball, as she does falling through space; strong early, weaker late. */
  nair: {
    kind: 'aerial',
    faf: 44,
    landingLag: 6,
    autoCancel: [
      [1, 4],
      [38, 44],
    ],
    hits: [
      {
        frames: [6, 9],
        boxes: [box(0, 0, 6.5, 6, { damage: 9, angle: 46, kbg: 80, bkb: 35, direction: 'away' })],
      },
      {
        frames: [10, 24],
        boxes: [box(0, 0, 6.5, 5.5, { damage: 6, angle: 46, kbg: 75, bkb: 30, direction: 'away' })],
      },
    ],
  },
  /** Scissor Kick: one leg lifts the opponent, the other kicks them away. */
  fair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 9,
    autoCancel: [
      [1, 5],
      [32, 40],
    ],
    hits: [
      { frames: [7, 8], boxes: [box(0, 7, 5, 4.5, { damage: 4, angle: 70, kbg: 30, bkb: 35 })] },
      {
        frames: [13, 15],
        rehit: true,
        boxes: [box(0, 8, 5, 4.5, { damage: 5, angle: 361, kbg: 125, bkb: 30 })],
      },
    ],
  },
  /** Back Kick: Kirby's strong back air, her air finisher. */
  bair: {
    kind: 'aerial',
    faf: 38,
    landingLag: 10,
    autoCancel: [
      [1, 2],
      [30, 38],
    ],
    hits: [
      {
        frames: [6, 8],
        boxes: [box(0, -8, 6, 4.2, { damage: 13, angle: 361, kbg: 79, bkb: 15, direction: 'back' })],
      },
      {
        frames: [9, 12],
        boxes: [box(0, -7, 6, 3.5, { damage: 8, angle: 361, kbg: 90, bkb: 0, direction: 'back' })],
      },
    ],
  },
  /** Bicycle Kick: pedals upward overhead; a juggling tool. */
  uair: {
    kind: 'aerial',
    faf: 34,
    landingLag: 7,
    autoCancel: [
      [1, 6],
      [22, 34],
    ],
    hits: [
      {
        frames: [7, 11],
        boxes: [box(0, 1, 13, 5, { damage: 9, angle: 70, kbg: 108, bkb: 20, direction: 'away' })],
      },
    ],
  },
  /** Tile Stomp: five drilling stomps that drag down, then a stamp that meteors (weakly). */
  dair: {
    kind: 'aerial',
    faf: 50,
    landingLag: 16,
    autoCancel: [
      [1, 8],
      [44, 50],
    ],
    hits: [
      ...[10, 13, 16, 19, 22].map((start): MoveDef['hits'][number] => ({
        frames: [start, start + 1],
        rehit: true,
        boxes: [box(0, 0, 0.5, 4.5, { damage: 1.2, angle: 280, kbg: 100, bkb: 0, wbkb: 20 })],
      })),
      {
        frames: [26, 27],
        rehit: true,
        boxes: [box(0, 0, 0, 5, { damage: 3, angle: 270, kbg: 110, bkb: 20 })],
      },
    ],
  },
  /**
   * Tile Flip (neutral special): slaps the floor and the tile in front flips over like the tunnel rotating,
   * launching anyone standing on it straight up. In the air it is a gravity hop kick instead.
   */
  neutralB: {
    kind: 'other',
    faf: 40,
    air: 'neutralBAir',
    hits: [
      {
        frames: [14, 17],
        boxes: [
          box(0, 11, 3, 5.5, { damage: 8, angle: 90, kbg: 97, bkb: 50 }),
          box(1, 5.5, 2, 3.5, { damage: 8, angle: 90, kbg: 97, bkb: 50 }),
        ],
      },
    ],
  },
  /** Tile Flip in the air: a small hop, as if her gravity flipped for a moment, into a 4% kick. */
  neutralBAir: {
    kind: 'other',
    faf: 30,
    landingLag: 10,
    hits: [{ frames: [6, 9], boxes: [box(0, 6.5, 5, 4.5, { damage: 4, angle: 50, kbg: 50, bkb: 40 })] }],
    script(x) {
      if (x.f.actionFrame === HOP.frame) x.f.vel.y = HOP.speed;
    },
  },
  /** Grabs, on Kirby's frame data; her arms are short, so the standing grab reaches 10.5 units. */
  grab: { kind: 'other', faf: 34, hits: [{ frames: [6, 7], boxes: [grabBox(0, 6.5, 6, 4)] }] },
  dashGrab: { kind: 'other', faf: 42, hits: [{ frames: [9, 10], boxes: [grabBox(0, 7.5, 6, 4.5)] }] },
  /** Turns around out of a dash or run and grabs behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 37, hits: [{ frames: [10, 11], boxes: [grabBox(0, 8, 6, 5)] }] },
  /** Headbutt. */
  pummel: { kind: 'other', faf: 6, hits: [], pummel: { frame: 1, damage: 1.3, hitlag: 2.1 } },
  /** Tunnel Shove: a spin kick that sends them down the tunnel. */
  fthrow: {
    kind: 'other',
    faf: 34,
    hits: [],
    throw: { frame: 14, hit: { damage: 8, angle: 40, kbg: 60, bkb: 60 } },
  },
  /** Back Suplex: arches over and slams them behind her; her kill throw at the ledge. */
  bthrow: {
    kind: 'other',
    faf: 44,
    hits: [],
    throw: { frame: 30, hit: { damage: 10, angle: 45, kbg: 65, bkb: 55, direction: 'back' } },
  },
  /**
   * Gravity Piledriver: flips gravity, falls up with them, and slams them down (Kirby's up throw role): her
   * vertical kill throw.
   */
  uthrow: {
    kind: 'other',
    faf: 58,
    hits: [],
    throw: { frame: 36, hit: { damage: 10, angle: 88, kbg: 76, bkb: 70 } },
  },
  /**
   * Treadmill: runs on top of them, one footfall of 1% per step (each reported as a pummel), then hops off with a
   * small pop-up: her combo throw.
   */
  dthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    throw: { frame: 26, hit: { damage: 2, angle: 75, kbg: 40, bkb: 60 } },
    script(x) {
      const { m, f } = x;
      if (!TREADMILL.frames.includes(f.actionFrame)) return;
      const v = m.fighters[f.grabPartner];
      if (!v || v.grabPartner !== f.port || v.action !== 'grabbed') return;
      const before = v.damage;
      addDamage(m, v, TREADMILL.damage);
      emit(m, { type: 'pummel', attacker: f.port, victim: v.port, damage: v.damage - before });
    },
  },
};

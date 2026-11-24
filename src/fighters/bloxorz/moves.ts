import type { HitboxDef, MoveDef } from '../types';

/** Shorthand for a hitbox: id, x forward, y up, radius, then the hit's numbers. */
const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({
  id,
  x,
  y,
  radius,
  ...hit,
});

/** A grab box: catches instead of hitting, so it carries no damage or knockback. */
const grabBox = (id: number, x: number, y: number, radius: number) =>
  box(id, x, y, radius, { damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true });

/** One tip of the block moves its centre 18 units: half a cube plus a cube. */
export const TIP_DISTANCE = 18;

/**
 * Where a tip lands: the block's footprint, 12 units either side of its centre. The first two slams of the dash
 * attack launch forward hard enough at a set knockback that the opponent stays ahead of the next tip.
 */
const TUMBLE_CARRY = [
  box(0, 8, 6, 8, { damage: 4, angle: 25, kbg: 100, bkb: 0, wbkb: 70 }),
  box(1, -4, 6, 7, { damage: 4, angle: 25, kbg: 100, bkb: 0, wbkb: 70 }),
];

/**
 * Bloxorz block's normals: every attack is a tip, a slam or a stand-up of a 12 x 24 block, so hitboxes are big
 * and start late (Ganondorf and King Dedede timings). Damage and first active frames are the roster sheet's;
 * knockback follows Ultimate's conventions for moves like these (CREW.md "Knockback values": no retuning to
 * force the sheet's kill %, until COOL-3's engine calibration lands). Frame windows are inclusive, faf is the first actionable frame.
 */
export const moves: Record<string, MoveDef> = {
  /** Edge Rock: rocks forward onto its front edge and back. */
  jab: {
    kind: 'other',
    faf: 24,
    hits: [
      {
        frames: [5, 6],
        boxes: [
          box(0, 10, 15, 5, { damage: 3, angle: 361, kbg: 30, bkb: 25 }),
          box(1, 7, 6, 4.5, { damage: 3, angle: 361, kbg: 30, bkb: 25 }),
        ],
      },
    ],
  },
  /** Edge Rock, second rock: a harder lean that shoves them away. */
  jab2: {
    kind: 'other',
    faf: 32,
    hits: [
      {
        frames: [6, 7],
        boxes: [
          box(0, 11, 15, 5.5, { damage: 4, angle: 361, kbg: 80, bkb: 45 }),
          box(1, 8, 6, 5, { damage: 4, angle: 361, kbg: 80, bkb: 45 }),
        ],
      },
    ],
  },
  /** Tip Over: topples forward onto them like a felled tree; the far end hits hardest. */
  ftilt: {
    kind: 'other',
    faf: 44,
    hits: [
      {
        frames: [12, 14],
        boxes: [
          box(0, 24, 6, 6, { damage: 11, angle: 40, kbg: 98, bkb: 38 }),
          box(1, 14, 9, 6, { damage: 11, angle: 40, kbg: 98, bkb: 38 }),
        ],
      },
    ],
  },
  /** Stand Up: rears onto its end; the rising end swats anything above. Anti-air. */
  utilt: {
    kind: 'other',
    faf: 36,
    hits: [
      {
        frames: [9, 12],
        boxes: [
          box(0, 2, 27, 7, { damage: 9, angle: 88, kbg: 105, bkb: 42, direction: 'away' }),
          box(1, 9, 17, 6, { damage: 9, angle: 80, kbg: 105, bkb: 42 }),
        ],
      },
    ],
  },
  /** Scrape: drags its low edge along the floor; a low, sliding hit that trips. */
  dtilt: {
    kind: 'other',
    faf: 28,
    hits: [
      {
        frames: [8, 10],
        boxes: [
          box(0, 15, 2.5, 5, { damage: 7, angle: 20, kbg: 40, bkb: 50 }),
          box(1, 7, 2.5, 4.5, { damage: 7, angle: 20, kbg: 40, bkb: 50 }),
        ],
      },
    ],
  },
  /**
   * Tumble: tips end over end three times, 18 units a tip. The first two slams carry the opponent along, the
   * third launches.
   */
  dashAttack: {
    kind: 'other',
    faf: 54,
    hits: [
      { frames: [10, 12], rehit: true, boxes: TUMBLE_CARRY },
      { frames: [20, 22], rehit: true, boxes: TUMBLE_CARRY },
      {
        frames: [30, 32],
        rehit: true,
        boxes: [
          box(0, 8, 6, 8, { damage: 4, angle: 45, kbg: 95, bkb: 60 }),
          box(1, -4, 6, 7, { damage: 4, angle: 45, kbg: 95, bkb: 60 }),
        ],
      },
    ],
    script(x) {
      const { f } = x;
      const t = f.actionFrame - 1;
      if (t >= 30) return;
      const phase = (t % 10) + 0.5;
      f.vel.x =
        ((f.facing * TIP_DISTANCE * Math.PI) / 20) * Math.sin((Math.PI * phase) / 10) + f.facing * 0.11;
    },
  },
  /** Monolith Slam: rears up to its full height and falls flat forward across 30 units of floor. */
  fsmash: {
    kind: 'smash',
    faf: 66,
    charge: 12,
    hits: [
      {
        frames: [20, 22],
        boxes: [
          box(0, 24, 6, 7, { damage: 20, angle: 361, kbg: 94, bkb: 36 }),
          box(1, 12, 9, 7, { damage: 18, angle: 361, kbg: 94, bkb: 32 }),
        ],
      },
    ],
  },
  /** Uprise: springs violently onto its end and spikes upward. */
  usmash: {
    kind: 'smash',
    faf: 54,
    charge: 8,
    hits: [
      {
        frames: [14, 17],
        boxes: [
          box(0, 0, 30, 8, { damage: 17, angle: 90, kbg: 92, bkb: 36, direction: 'away' }),
          box(1, 7, 18, 7, { damage: 15, angle: 85, kbg: 92, bkb: 34, direction: 'away' }),
          box(2, 9, 5, 6, { damage: 12, angle: 80, kbg: 90, bkb: 30 }),
        ],
      },
    ],
  },
  /** Ground Shake: slams flat, shaking the screen; shockwaves run out along the floor on both sides. */
  dsmash: {
    kind: 'smash',
    faf: 56,
    charge: 7,
    hits: [
      {
        frames: [13, 15],
        boxes: [
          box(0, 13, 4, 7, { damage: 15, angle: 30, kbg: 92, bkb: 34 }),
          box(1, -13, 4, 7, { damage: 15, angle: 30, kbg: 92, bkb: 34, direction: 'back' }),
        ],
      },
      {
        frames: [16, 19],
        boxes: [
          box(0, 26, 2.5, 5, { damage: 10, angle: 35, kbg: 85, bkb: 35 }),
          box(1, -26, 2.5, 5, { damage: 10, angle: 35, kbg: 85, bkb: 35, direction: 'back' }),
        ],
      },
    ],
  },
  /** Getting up from the floor by rocking onto each end in turn; intangible until the second rock ends. */
  getupAttack: {
    kind: 'other',
    faf: 50,
    intangible: [1, 26],
    hits: [
      { frames: [17, 18], boxes: [box(0, 12, 4, 6, { damage: 7, angle: 361, kbg: 48, bkb: 80 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -12, 4, 6, { damage: 7, angle: 361, kbg: 48, bkb: 80, direction: 'back' })],
      },
    ],
  },
  /** Spin: turns a full circle end over end; its corners sweep a 13-unit circle. Weaker late. */
  nair: {
    kind: 'aerial',
    faf: 44,
    landingLag: 11,
    autoCancel: [
      [1, 5],
      [36, 44],
    ],
    hits: [
      {
        frames: [8, 12],
        boxes: [box(0, 0, 12, 13, { damage: 10, angle: 361, kbg: 100, bkb: 20, direction: 'away' })],
      },
      {
        frames: [13, 22],
        boxes: [box(0, 0, 12, 12, { damage: 7, angle: 361, kbg: 100, bkb: 10, direction: 'away' })],
      },
    ],
  },
  /** Air Tip: its top end tips forward and down. */
  fair: {
    kind: 'aerial',
    faf: 46,
    landingLag: 15,
    autoCancel: [
      [1, 6],
      [38, 46],
    ],
    hits: [
      {
        frames: [11, 13],
        boxes: [
          box(0, 16, 10, 7, { damage: 12, angle: 361, kbg: 96, bkb: 30 }),
          box(1, 8, 17, 6, { damage: 12, angle: 361, kbg: 96, bkb: 30 }),
        ],
      },
    ],
  },
  /** Back Tip: tips over backward onto whoever is behind. Its strongest aerial sideways. */
  bair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 13,
    autoCancel: [
      [1, 5],
      [30, 40],
    ],
    hits: [
      {
        frames: [10, 12],
        boxes: [
          box(0, -16, 10, 7, { damage: 13, angle: 361, kbg: 98, bkb: 30, direction: 'back' }),
          box(1, -8, 16, 6, { damage: 13, angle: 361, kbg: 98, bkb: 30, direction: 'back' }),
        ],
      },
    ],
  },
  /** Upright Thrust: rams its top end straight up. */
  uair: {
    kind: 'aerial',
    faf: 42,
    landingLag: 12,
    autoCancel: [
      [1, 4],
      [32, 42],
    ],
    hits: [
      {
        frames: [9, 12],
        boxes: [box(0, 0, 30, 8, { damage: 11, angle: 80, kbg: 100, bkb: 32, direction: 'away' })],
      },
    ],
  },
  /** Pillar Drop: drops end-first like a toppled pillar; the bottom end meteors early, then hits up and out. */
  dair: {
    kind: 'aerial',
    faf: 58,
    landingLag: 24,
    autoCancel: [
      [1, 4],
      [50, 58],
    ],
    hits: [
      {
        frames: [16, 18],
        boxes: [box(0, 0, -3, 7.5, { damage: 16, angle: 270, kbg: 90, bkb: 30 })],
      },
      {
        frames: [19, 26],
        boxes: [box(0, 0, -1, 6.5, { damage: 12, angle: 361, kbg: 90, bkb: 25, direction: 'away' })],
      },
    ],
  },
  /** Pin: no hands, so it tips onto them. Slow, but 15 units of reach. */
  grab: { kind: 'other', faf: 40, hits: [{ frames: [9, 10], boxes: [grabBox(0, 9, 10, 6)] }] },
  dashGrab: { kind: 'other', faf: 48, hits: [{ frames: [11, 12], boxes: [grabBox(0, 10.5, 9, 6.5)] }] },
  /** Turns round out of a dash or run and tips onto them behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 44, hits: [{ frames: [12, 13], boxes: [grabBox(0, 11, 9, 7)] }] },
  /** Rock: rocks its weight onto the pinned opponent. */
  pummel: { kind: 'other', faf: 9, hits: [], pummel: { frame: 1, damage: 1.5, hitlag: 2 } },
  /** Roll Off: tips forward off them, rolling them away. */
  fthrow: {
    kind: 'other',
    faf: 36,
    hits: [],
    throw: { frame: 16, hit: { damage: 9, angle: 40, kbg: 60, bkb: 62 } },
  },
  /** Flip Over: flips end over end over them and flings them behind. Its kill throw. */
  bthrow: {
    kind: 'other',
    faf: 52,
    hits: [],
    throw: { frame: 30, hit: { damage: 11, angle: 42, kbg: 70, bkb: 60, direction: 'back' } },
  },
  /** Stand Launch: stands up under them and pops them straight up. */
  uthrow: {
    kind: 'other',
    faf: 44,
    hits: [],
    throw: { frame: 20, hit: { damage: 10, angle: 90, kbg: 75, bkb: 65 } },
  },
  /** Crush: drops its full weight on them; low knockback for follow-ups. */
  dthrow: {
    kind: 'other',
    faf: 44,
    hits: [],
    throw: { frame: 22, hit: { damage: 7, angle: 75, kbg: 45, bkb: 60 } },
  },
};

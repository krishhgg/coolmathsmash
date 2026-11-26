import { HELPLESS_LANDING_LAG, TETHER } from '../../sim/constants';
import type { HitboxDef, MoveDef } from '../types';
import { CANDY_SPEED } from './entities';
import { stats } from './stats';

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

type Hit = Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>;

/** Quick Grapple's last airborne stall frame: the shot on 8 plus its 10 travel frames, when the line has landed or missed. */
const QUICK_GRAPPLE_STALL = 18;

/** Sky anchors per airtime, shared by Point Grapple and Quick Grapple (roster sheet 8). */
export const SKY_ANCHORS = 3;

/**
 * Point Grapple's fly-in when the line reaches a fighter: the roster's 10%, with the knockback of Corrin's Dragon
 * Lunge kick (55 degrees, 98 growth, 70 base; SSBU-Calculator's hitbox data, the kick's first hit), where Corrin,
 * stuck to a foe or a wall by the spear, flies forward into a kick. It launches away from Fluffy, whichever way he
 * came in. The box sits on his hand, where the line pulls him, 7 units round: the reel arrives with the hand within 5
 * units (half his width) of the anchor on the target's body, so on a level approach it still reaches a target that
 * steps up to 2 units away on the arrival frame.
 */
export const GRAPPLE_KICK: HitboxDef = box(0, 0, stats.height * TETHER.handHeight, 7, {
  damage: 10,
  angle: 55,
  kbg: 98,
  bkb: 70,
  direction: 'away',
});

/**
 * The grabber line: count boxes evenly spaced from the tip at to back to from (forward units) at height y. The tip
 * gets id 0, so it wins over the line behind it, and each box's size and hit are functions of its index from the tip.
 */
function line(
  from: number,
  to: number,
  y: number,
  count: number,
  radius: (i: number) => number,
  hit: (i: number) => Hit,
): HitboxDef[] {
  return Array.from({ length: count }, (_, i) =>
    box(i, to - ((to - from) * i) / (count - 1), y, radius(i), hit(i)),
  );
}

/** The tether grab's line at full length: 70 units, like the roster's Grabber Grab. */
const tether = (near: number) => [
  grabBox(0, near, 6, 5),
  grabBox(1, 22, 6, 4.5),
  grabBox(2, 36, 6, 4.5),
  grabBox(3, 51, 6, 4.5),
  grabBox(4, 65.5, 6, 4.5),
];

/**
 * Fluffy's normals (roster sheet 8). His game is a grabber fired across the screen, so his tilts, smashes and grab
 * reach far (forward tilt 45 units, forward smash and grab 70, Min Min range) and recover slowly, while the
 * close-range moves use his fuzzy body. Damage and first active frames are the roster's, except that the kill moves
 * take their analogue's damage: forward smash 16% and back air 10.5%, and the neutral, forward, up and down airs,
 * which KOd more than 5 points off their analogue at the roster's damage (fluffy.test.ts). Angle, growth and base
 * knockback come from each move's Ultimate analogue (CREW.md, "Knockback values and kill percents"), named on each
 * move: Min Min's moves for his grabber, Jigglypuff's for his body, and Mario's where the damage matches better (back
 * air, forward, back and up throw). The values are from SSBU-Calculator's hitbox data. Frame windows are inclusive;
 * faf is the first actionable frame.
 */
export const moves: Record<string, MoveDef> = {
  /**
   * Fuzz Bump: a quick shove with the fur. Attack again to bump twice and finish with the Tail Slap. Knockback: Min
   * Min's jab 1, 2 and 3.
   */
  jab: {
    kind: 'other',
    faf: 20,
    next: { window: [6, 19], move: 'jab2' },
    hits: [
      {
        frames: [3, 4],
        boxes: [
          box(0, 6, 5.5, 3.5, { damage: 2, angle: 361, kbg: 25, bkb: 25 }),
          box(1, 3, 5.5, 4, { damage: 2, angle: 361, kbg: 25, bkb: 25 }),
        ],
      },
    ],
  },
  /** Second Fuzz Bump. */
  jab2: {
    kind: 'other',
    faf: 21,
    next: { window: [6, 20], move: 'jab3' },
    hits: [
      {
        frames: [3, 4],
        boxes: [
          box(0, 6.5, 5, 3.5, { damage: 2, angle: 80, kbg: 20, bkb: 30 }),
          box(1, 3, 5, 4, { damage: 2, angle: 80, kbg: 20, bkb: 30 }),
        ],
      },
    ],
  },
  /** Tail Slap: the grabber's tail cracks forward to finish the jab. */
  jab3: {
    kind: 'other',
    faf: 33,
    hits: [
      {
        frames: [5, 6],
        boxes: [
          box(0, 10, 5, 4, { damage: 3, angle: 361, kbg: 90, bkb: 60 }),
          box(1, 4, 5, 4, { damage: 3, angle: 361, kbg: 90, bkb: 60 }),
        ],
      },
    ],
  },
  /** Grabber Whip: the grabber cracks out 45 units in front; the tip hits hardest. Knockback: Min Min's ftilt (Dragon). */
  ftilt: {
    kind: 'other',
    faf: 36,
    hits: [
      {
        frames: [7, 9],
        boxes: line(
          9,
          40.5,
          6,
          4,
          (i) => (i === 0 ? 4.5 : 3.5),
          (i) => ({ damage: i === 0 ? 8 : 6, angle: 361, kbg: 87, bkb: 50 }),
        ),
      },
    ],
  },
  /** Grabber Flick: the grabber flicks up in an arc over his head; a juggling launcher. Knockback: Min Min's utilt. */
  utilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [6, 7],
        boxes: [
          box(0, 7, 13, 4.5, { damage: 6, angle: 96, kbg: 100, bkb: 75, direction: 'away' }),
          box(1, 3, 8, 4, { damage: 6, angle: 96, kbg: 100, bkb: 75, direction: 'away' }),
        ],
      },
      {
        frames: [8, 10],
        boxes: [
          box(0, 0, 19, 5, { damage: 6, angle: 96, kbg: 100, bkb: 75, direction: 'away' }),
          box(1, 0, 12, 4, { damage: 6, angle: 96, kbg: 100, bkb: 75, direction: 'away' }),
        ],
      },
      {
        frames: [11, 12],
        boxes: [box(0, -7, 14, 4.5, { damage: 6, angle: 96, kbg: 100, bkb: 75, direction: 'away' })],
      },
    ],
  },
  /** Low Lash: the grabber skims the floor 30 units ahead and pops them up. Knockback: Min Min's dtilt. */
  dtilt: {
    kind: 'other',
    faf: 27,
    hits: [
      {
        frames: [6, 8],
        boxes: line(
          8,
          26,
          1.5,
          3,
          (i) => (i === 0 ? 4 : 3.5),
          () => ({ damage: 6, angle: 73, kbg: 70, bkb: 70 }),
        ),
      },
    ],
  },
  /** Fuzz Roll: rolls into them as a ball; weaker once the roll slows. Knockback: Jigglypuff's dash attack. */
  dashAttack: {
    kind: 'other',
    faf: 42,
    hits: [
      { frames: [8, 12], boxes: [box(0, 4, 5.5, 6.5, { damage: 9, angle: 43, kbg: 83, bkb: 57 })] },
      { frames: [13, 22], boxes: [box(0, 3, 5.5, 6, { damage: 6, angle: 43, kbg: 83, bkb: 8 })] },
    ],
  },
  /**
   * Spiked Ball: IQ Ball's spiked grabber thrust out to 70 units; the ball at the end is the kill hit. Knockback: Min
   * Min's fsmash (Dragon), the far hit for the ball and the near hit for the line.
   */
  fsmash: {
    kind: 'smash',
    faf: 62,
    charge: 13,
    hits: [
      {
        frames: [16, 18],
        boxes: line(
          12,
          64,
          6.5,
          5,
          (i) => (i === 0 ? 6 : 3.5),
          (i): Hit =>
            i === 0
              ? { damage: 16, angle: 361, kbg: 78, bkb: 40 }
              : { damage: 11, angle: 361, kbg: 87, bkb: 40 },
        ),
      },
    ],
  },
  /** Spike Arc: the spiked ball swung overhead from front to back. Knockback: Min Min's usmash. */
  usmash: {
    kind: 'smash',
    faf: 50,
    charge: 8,
    hits: [
      {
        frames: [13, 14],
        boxes: [
          box(0, 14, 16, 6, { damage: 14, angle: 75, kbg: 80, bkb: 48, direction: 'away' }),
          box(1, 6, 11, 4.5, { damage: 14, angle: 75, kbg: 80, bkb: 48, direction: 'away' }),
        ],
      },
      {
        frames: [15, 16],
        boxes: [
          box(0, 0, 23, 6.5, { damage: 14, angle: 82, kbg: 76, bkb: 48, direction: 'away' }),
          box(1, 0, 13, 4.5, { damage: 14, angle: 82, kbg: 76, bkb: 48, direction: 'away' }),
        ],
      },
      {
        frames: [17, 18],
        boxes: [box(0, -14, 16, 6, { damage: 11, angle: 82, kbg: 80, bkb: 48, direction: 'away' })],
      },
    ],
  },
  /**
   * Tail Twister: the grabber spun round him at floor level, in front first, then behind. Knockback: Min Min's
   * dsmash.
   */
  dsmash: {
    kind: 'smash',
    faf: 52,
    charge: 6,
    hits: [
      {
        frames: [10, 11],
        boxes: line(
          7,
          24,
          2,
          3,
          (i) => (i === 0 ? 5 : 4),
          () => ({ damage: 12, angle: 361, kbg: 72, bkb: 50 }),
        ),
      },
      {
        frames: [15, 16],
        boxes: line(
          -7,
          -24,
          2,
          3,
          (i) => (i === 0 ? 5 : 4),
          () => ({ damage: 12, angle: 30, kbg: 70, bkb: 50, direction: 'back' }),
        ),
      },
    ],
  },
  /** Getting up with the grabber spinning to both sides; intangible until the second swing ends. Ultimate's knockback. */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      { frames: [17, 18], boxes: [box(0, 9, 3, 5, { damage: 7, angle: 48, kbg: 48, bkb: 80 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -9, 3, 5, { damage: 7, angle: 48, kbg: 48, bkb: 80, direction: 'back' })],
      },
    ],
  },
  /** Bristle: every hair stands on end; strong at first, then a lingering prickle. Jigglypuff's nair, 11% then 6%. */
  nair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 8,
    autoCancel: [
      [1, 4],
      [30, 40],
    ],
    hits: [
      {
        frames: [5, 7],
        boxes: [box(0, 0, 5.5, 8, { damage: 11, angle: 361, kbg: 100, bkb: 30, direction: 'away' })],
      },
      {
        frames: [8, 24],
        boxes: [box(0, 0, 5.5, 7, { damage: 6, angle: 361, kbg: 70, bkb: 50, direction: 'away' })],
      },
    ],
  },
  /** Lash: the grabber whips forward 25 units. Min Min's fair (Dragon), 8% along the whole arm. */
  fair: {
    kind: 'aerial',
    faf: 42,
    landingLag: 11,
    autoCancel: [
      [1, 6],
      [30, 42],
    ],
    hits: [
      {
        frames: [9, 11],
        boxes: line(
          9,
          21,
          5,
          2,
          (i) => (i === 0 ? 4.5 : 4),
          () => ({ damage: 8, angle: 361, kbg: 90, bkb: 50 }),
        ),
      },
    ],
  },
  /** Back Lash: the grabber cracks behind him; his aerial kill move. Knockback: Mario's bair. */
  bair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 11,
    autoCancel: [
      [1, 6],
      [28, 40],
    ],
    hits: [
      {
        frames: [9, 11],
        boxes: line(
          -9,
          -21,
          5,
          2,
          (i) => (i === 0 ? 5 : 4.5),
          (i) => ({ damage: i === 0 ? 10.5 : 9, angle: 361, kbg: 106, bkb: 12, direction: 'back' }),
        ),
      },
    ],
  },
  /** Whirl: the grabber twirls over his head. Min Min's uair, her 6.5% boxes. */
  uair: {
    kind: 'aerial',
    faf: 34,
    landingLag: 8,
    autoCancel: [
      [1, 4],
      [22, 34],
    ],
    hits: [
      {
        frames: [6, 10],
        boxes: [
          box(0, 0, 17, 6, { damage: 6.5, angle: 70, kbg: 130, bkb: 40, direction: 'away' }),
          box(1, 0, 11, 5, { damage: 6.5, angle: 70, kbg: 130, bkb: 40, direction: 'away' }),
        ],
      },
    ],
  },
  /** Candy Drop: a hard candy slammed down beneath him; it spikes at first. Min Min's dair, 11% then 9%. */
  dair: {
    kind: 'aerial',
    faf: 48,
    landingLag: 17,
    autoCancel: [
      [1, 8],
      [38, 48],
    ],
    hits: [
      { frames: [12, 14], boxes: [box(0, 0, -2, 5.5, { damage: 11, angle: 285, kbg: 90, bkb: 30 })] },
      { frames: [15, 24], boxes: [box(0, 0, -1, 5, { damage: 9, angle: 55, kbg: 60, bkb: 80 })] },
    ],
  },
  /**
   * Grabber Grab: a tether grab on frame 12 whose line flies out to 70 units over three frames, with the long
   * recovery every tether grab pays for its range.
   */
  grab: {
    kind: 'other',
    faf: 58,
    hits: [
      { frames: [12, 12], boxes: [grabBox(0, 8, 6, 5), grabBox(1, 20, 6, 4.5)] },
      { frames: [13, 13], boxes: [grabBox(0, 8, 6, 5), grabBox(1, 22, 6, 4.5), grabBox(2, 38, 6, 4.5)] },
      { frames: [14, 17], boxes: tether(8) },
    ],
  },
  dashGrab: {
    kind: 'other',
    faf: 64,
    hits: [
      { frames: [14, 14], boxes: [grabBox(0, 9, 6, 5), grabBox(1, 22, 6, 4.5)] },
      { frames: [15, 19], boxes: tether(9) },
    ],
  },
  /** Turns round out of a dash or run and fires the tether behind; the slide keeps going the old way. */
  pivotGrab: {
    kind: 'other',
    faf: 66,
    hits: [
      { frames: [15, 15], boxes: [grabBox(0, 9, 6, 5), grabBox(1, 22, 6, 4.5)] },
      { frames: [16, 20], boxes: tether(9) },
    ],
  },
  /** Squeeze: the grabber tightens. */
  pummel: { kind: 'other', faf: 6, hits: [], pummel: { frame: 1, damage: 1.3, hitlag: 2.1 } },
  /** Fling: whips them away in front. Knockback: Mario's fthrow. */
  fthrow: {
    kind: 'other',
    faf: 34,
    hits: [],
    throw: { frame: 14, hit: { damage: 8, angle: 45, kbg: 65, bkb: 60 } },
  },
  /**
   * Swing-Around: swings them round on the grabber and lets go behind him; his kill throw. Knockback: Mario's
   * bthrow.
   */
  bthrow: {
    kind: 'other',
    faf: 56,
    hits: [],
    throw: { frame: 32, hit: { damage: 11, angle: 45, kbg: 66, bkb: 70, direction: 'back' } },
  },
  /** Upward Whip: cracks them straight up. Knockback: Mario's uthrow. */
  uthrow: {
    kind: 'other',
    faf: 42,
    hits: [],
    throw: { frame: 18, hit: { damage: 9, angle: 90, kbg: 72, bkb: 70 } },
  },
  /** Bounce: hops onto them and bounces off; low knockback for follow-ups. Knockback: Jigglypuff's dthrow. */
  dthrow: {
    kind: 'other',
    faf: 44,
    hits: [],
    throw: { frame: 22, hit: { damage: 6, angle: 75, kbg: 45, bkb: 90 } },
  },
  /**
   * Stick Tight (down special): he drives the grabber into the ground and holds on. Heavy armor on frames 4-60, so
   * hits add damage but no knockback (the video's "he wouldn't have knock back", time-limited by the roster), then
   * 40 frames of end lag. In the air he braces the same way and keeps holding on when he lands.
   */
  downB: {
    kind: 'other',
    faf: 101,
    armor: { frames: [4, 60] },
    continuesOnLanding: true,
    hits: [],
  },
  /**
   * Candy Frisbee (side special): flings the candy forward on frame 14; it boomerangs back to him (entities.ts). One
   * candy at a time: while it is out, the throw comes out empty.
   */
  sideB: {
    kind: 'other',
    faf: 46,
    hits: [],
    spawn: [{ frame: 14, entity: 'candy', x: 8.5, y: 5.5, vx: CANDY_SPEED, max: 1 }],
  },
  /**
   * Point Grapple (neutral special, roster sheet 8): holding special walks IQ Ball's reticle out from him with the
   * stick at 6 units a frame, up to 160, while he keeps drifting; releasing it fires the grabber at the reticle on
   * frame 12, and the line reaches it 12 frames later (the clip's timing). A quick tap with a direction fires the full
   * 160 that way. A ledge, floor, wall or platform reels him in at 4 units a frame, and holding Jump there hangs from
   * the line. Empty air at the reticle anchors too, using one of his SKY_ANCHORS. A fighter in the way stops the line
   * and he flies into them for GRAPPLE_KICK, which a shield blocks. Not helpless: letting go ends in a fall.
   */
  neutralB: {
    kind: 'other',
    faf: 51,
    hits: [],
    tether: {
      frame: 12,
      range: 160,
      travel: 12,
      angle: 0,
      aimed: { speed: 6, quick: { frames: 6 } },
      latch: ['ledge', 'surface', 'sky'],
      skyAnchors: SKY_ANCHORS,
      pullSpeed: 4,
      hang: 'jump',
      targetsFighters: true,
      // Reel in to whoever the line stops at; the kick on arrival is arriveHit, landed in the frame's hit pass.
      onFighter: (_x, _target, event) => (event.phase === 'hit' ? 'pullSelf' : undefined),
      arriveHit: GRAPPLE_KICK,
    },
    // He turns to the side the reticle is on, so the drawn grabber points the way the line goes.
    script({ f }) {
      if (!f.tether && f.aim && Math.abs(f.aim.x) >= 1) f.facing = f.aim.x > 0 ? 1 : -1;
    },
  },
  /**
   * Quick Grapple (up special, roster sheet 8): the grabber fires straight up on frame 8 and reaches 120 units in 10
   * frames, bent up to 30 degrees by the stick. A ledge it passes reels him into a ledge grab; a floor, wall or
   * platform reels him to it, and holding Jump there hangs from the line. Empty air at full range anchors too, using
   * one of Point Grapple's SKY_ANCHORS. It is his recovery, so letting go of the line or a shot that finds nothing
   * ends in helpless fall, as an up special does in Ultimate. In the air he stops falling while the grabber flies
   * (QUICK_GRAPPLE_STALL), so a shot from below the ledge still reaches it.
   */
  upB: {
    kind: 'other',
    faf: 41,
    helpless: true,
    // Touching down before frame 41 (a missed shot just above the floor) still costs the helpless landing lag.
    landingLag: HELPLESS_LANDING_LAG,
    hits: [],
    tether: {
      frame: 8,
      range: 120,
      travel: 10,
      angle: 90,
      stickAdjust: 30,
      latch: ['ledge', 'surface', 'sky'],
      skyAnchors: SKY_ANCHORS,
      pullSpeed: 4,
      hang: 'jump',
    },
    script({ f }) {
      if (!f.ground && f.actionFrame <= QUICK_GRAPPLE_STALL) f.vel.y = Math.max(f.vel.y * 0.5, 0);
    },
  },
};

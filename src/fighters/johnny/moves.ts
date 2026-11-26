import { Btn } from '../../input/types';
import { startMove } from '../../sim/actions/attack';
import { hitlagFrames } from '../../sim/combat/formulas';
import { addDamage } from '../../sim/combat/hits';
import { consume, isHeld, justPressed, stickDir, stickX } from '../../sim/control';
import { emit } from '../../sim/events';
import type { Ctx } from '../../sim/fighter';
import type { HitboxDef, MoveDef } from '../types';
import { LASER, MUZZLE } from './entities';
import { upgradable, upgradeMoves } from './upgrade';

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

/**
 * A throw's first hit, on the held fighter just before the release. Ultimate's throws (Falcon's among them) split
 * their damage this way, and only the release's own damage feeds the launch. It lands like a pummel: damage and
 * hitlag for both.
 */
const throwHit =
  (frame: number, damage: number) =>
  ({ m, f }: Ctx): void => {
    const v = m.fighters[f.grabPartner];
    if (f.actionFrame !== frame || !v || v.grabPartner !== f.port || v.action !== 'grabbed') return;
    const before = v.damage;
    addDamage(m, v, damage);
    f.hitlag = v.hitlag = hitlagFrames(damage);
    emit(m, { type: 'pummel', attacker: f.port, victim: v.port, damage: v.damage - before });
  };

/**
 * Laser Gun's repeat timing (Falco's Blaster, SmashWiki's timing tables): a press of Special inside `window` loops
 * the move from frame `loop` back to frame 3, so the next laser leaves `loop - 3` frames after the last (26
 * grounded, 23 in the air).
 */
export const LASER_GUN = {
  ground: { window: [2, 17], loop: 29 },
  air: { window: [2, 15], loop: 26 },
} as const;
const LOOP_TO = 3;

/**
 * Laser Gun's repeat fire. `f.charge` (0 outside smash charges, and reset by every move) remembers a press in the
 * window until the loop frame, as Red Ball's and Snail Bob's specials use it for their own state.
 */
function laserRepeat(timing: { window: readonly [number, number]; loop: number }): MoveDef['script'] {
  return ({ f, c }) => {
    const [from, to] = timing.window;
    if (f.actionFrame >= from && f.actionFrame <= to && justPressed(c, Btn.Special)) {
      consume(c, Btn.Special);
      f.charge = 1;
    }
    if (f.actionFrame === timing.loop && f.charge) {
      f.charge = 0;
      f.actionFrame = LOOP_TO;
    }
  };
}

/**
 * Johnny Upgrade's normals: the roster's damage and startup (handoffs/research/roster.md, fighter 12) on Captain
 * Falcon's shape, with Falcon's Ultimate frame data (ultimateframedata.com) for the active frames, totals, landing
 * lag and auto-cancel windows, and the launch angle, base knockback and knockback growth of Falcon's matching hit
 * (SmashWiki's SSBU hitbox tables) on each of Johnny's hits. The neutral, forward and up airs and the up smash
 * take Falcon's damage too, where the roster's put their kill percents well off Falcon's (Captain's call). Frame
 * windows are inclusive; faf is the first actionable frame.
 */
export const moves: Record<string, MoveDef> = {
  /** One-Two, first punch: a quick left jab. Attack again from frame 5 throws the second punch. */
  jab: {
    kind: 'other',
    faf: 18,
    next: { window: [5, 17], move: 'jab2' },
    hits: [{ frames: [3, 4], boxes: [box(0, 7, 10, 3.5, { damage: 1.5, angle: 361, kbg: 25, bkb: 25 })] }],
  },
  /** One-Two, second punch: a straight right. Attack again from frame 7 starts the Rush. */
  jab2: {
    kind: 'other',
    faf: 20,
    next: { window: [7, 19], move: 'jab3' },
    hits: [{ frames: [4, 5], boxes: [box(0, 8, 10, 3.5, { damage: 1, angle: 361, kbg: 25, bkb: 25 })] }],
  },
  /**
   * Rush: a flurry of four 0.5% punches that hold the opponent in place, then a 2% finishing punch that sends
   * them away. Pressing Attack during the last punches of the flurry restarts it, and so does still holding Attack
   * as the fourth punch lands, so it runs as long as you mash or hold.
   */
  jab3: {
    kind: 'other',
    faf: 45,
    next: { window: [11, 14], move: 'jab3' },
    script(x) {
      const { f, c } = x;
      if (f.actionFrame === 14 && isHeld(c, Btn.Attack) && stickDir(c, f.facing) === 'neutral')
        startMove(x, 'jab3');
    },
    hits: [
      ...[3, 6, 9, 12].map((f) => ({
        frames: [f, f] as [number, number],
        rehit: true,
        boxes: [box(0, 8.5, 10, 4.5, { damage: 0.5, angle: 361, kbg: 10, bkb: 8, hitlag: 0.5 })],
      })),
      {
        frames: [19, 20],
        rehit: true,
        boxes: [box(0, 9, 10, 5, { damage: 2, angle: 361, kbg: 130, bkb: 55 })],
      },
    ],
  },
  /** Hero Kick: a straight kick at chest height. */
  ftilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [7, 10],
        boxes: [
          box(0, 11, 8, 4, { damage: 9, angle: 361, kbg: 58, bkb: 60 }),
          box(1, 5.5, 8, 3.5, { damage: 8, angle: 361, kbg: 58, bkb: 60 }),
        ],
      },
    ],
  },
  /** Axe Kick: the leg swings up over his head and chops down in front; pops opponents up for juggles. */
  utilt: {
    kind: 'other',
    faf: 37,
    hits: [
      {
        frames: [14, 17],
        boxes: [
          box(0, 6, 17, 5.5, { damage: 11, angle: 285, kbg: 100, bkb: 35 }),
          box(1, 9, 10, 4.5, { damage: 11, angle: 285, kbg: 100, bkb: 35 }),
        ],
      },
    ],
  },
  /** Low Kick: a sprawled shin kick along the floor. */
  dtilt: {
    kind: 'other',
    faf: 34,
    hits: [{ frames: [10, 11], boxes: [box(0, 11, 2.5, 4.5, { damage: 10, angle: 25, kbg: 86, bkb: 38 })] }],
  },
  /** Speed-Upgrade Shoulder: a running shoulder charge, weaker once it lingers. */
  dashAttack: {
    kind: 'other',
    faf: 35,
    hits: [
      { frames: [7, 9], boxes: [box(0, 6, 9, 5.5, { damage: 10, angle: 65, kbg: 67, bkb: 90 })] },
      { frames: [10, 16], boxes: [box(0, 6, 9, 4.5, { damage: 6, angle: 65, kbg: 67, bkb: 90 })] },
    ],
  },
  /** Power Punch: the attack-power upgrade wound up into one huge straight punch. His best grounded kill move. */
  fsmash: {
    kind: 'smash',
    faf: 60,
    charge: 10,
    hits: [
      {
        frames: [18, 21],
        boxes: [
          box(0, 13, 10, 5, { damage: 19, angle: 43, kbg: 94, bkb: 36 }),
          box(1, 7, 10, 3.5, { damage: 17, angle: 43, kbg: 94, bkb: 36 }),
        ],
      },
    ],
  },
  /** Double Uppercut: a rising left that lifts into a right uppercut overhead. */
  usmash: {
    kind: 'smash',
    faf: 46,
    charge: 8,
    hits: [
      {
        frames: [14, 15],
        boxes: [box(0, 6, 10, 5.5, { damage: 7, angle: 96, kbg: 90, bkb: 0, wbkb: 80 })],
      },
      {
        frames: [20, 22],
        rehit: true,
        boxes: [box(0, 3, 18, 6.5, { damage: 14, angle: 83, kbg: 80, bkb: 70, direction: 'away' })],
      },
    ],
  },
  /** Sweep Kicks: a low kick in front, then one behind. */
  dsmash: {
    kind: 'smash',
    faf: 49,
    charge: 9,
    hits: [
      { frames: [16, 17], boxes: [box(0, 11, 3, 5, { damage: 15, angle: 28, kbg: 90, bkb: 30 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -11, 3, 5, { damage: 15, angle: 28, kbg: 84, bkb: 20, direction: 'back' })],
      },
    ],
  },
  /** Getting up from the floor with a kick to both sides; intangible until the second kick ends. */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      { frames: [17, 18], boxes: [box(0, 9, 3, 5, { damage: 7, angle: 361, kbg: 48, bkb: 80 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -9, 3, 5, { damage: 7, angle: 361, kbg: 48, bkb: 80, direction: 'back' })],
      },
    ],
  },
  /** Double Kick: one foot then the other, the second sending the opponent away. */
  nair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 7,
    autoCancel: [
      [1, 3],
      [32, 40],
    ],
    hits: [
      {
        frames: [7, 8],
        boxes: [box(0, 5, 8, 5, { damage: 4, angle: 74, kbg: 25, bkb: 50, direction: 'away' })],
      },
      {
        frames: [13, 15],
        rehit: true,
        boxes: [box(0, 6, 8, 5.5, { damage: 6, angle: 361, kbg: 120, bkb: 45, direction: 'away' })],
      },
    ],
  },
  /**
   * The Knee: Falcon-style knee smash. Its first active frame has a small sweetspot on the kneecap with heavy
   * hitlag that kills; the thigh (6%) and the lingering knee (3%) are weak.
   */
  fair: {
    kind: 'aerial',
    faf: 46,
    landingLag: 18,
    autoCancel: [
      [1, 4],
      [42, 46],
    ],
    hits: [
      {
        frames: [14, 14],
        boxes: [
          box(0, 8, 7, 3, { damage: 22, angle: 32, kbg: 81, bkb: 30, hitlag: 1.5 }),
          box(1, 3.5, 8, 3.5, { damage: 6, angle: 361, kbg: 80, bkb: 35 }),
        ],
      },
      { frames: [15, 30], boxes: [box(0, 6.5, 7.5, 4, { damage: 3, angle: 361, kbg: 80, bkb: 35 })] },
    ],
  },
  /** Backhand: a turning back fist. */
  bair: {
    kind: 'aerial',
    faf: 36,
    landingLag: 10,
    autoCancel: [
      [1, 4],
      [19, 36],
    ],
    hits: [
      {
        frames: [10, 11],
        boxes: [box(0, -10, 9, 4.5, { damage: 13, angle: 361, kbg: 97, bkb: 27, direction: 'back' })],
      },
      {
        frames: [12, 15],
        boxes: [box(0, -9, 9, 4, { damage: 8, angle: 361, kbg: 97, bkb: 27, direction: 'back' })],
      },
    ],
  },
  /** Flip Kick: a quick overhead bicycle kick. */
  uair: {
    kind: 'aerial',
    faf: 32,
    landingLag: 8,
    autoCancel: [
      [1, 3],
      [24, 32],
    ],
    hits: [
      {
        frames: [6, 10],
        boxes: [box(0, 2, 18, 5.5, { damage: 10, angle: 66, kbg: 96, bkb: 20, direction: 'away' })],
      },
      {
        frames: [11, 12],
        boxes: [box(0, 2, 17, 5, { damage: 9, angle: 30, kbg: 80, bkb: 12, direction: 'away' })],
      },
    ],
  },
  /** Stomp: both boots driven straight down; the soles meteor. */
  dair: {
    kind: 'aerial',
    faf: 45,
    landingLag: 12,
    autoCancel: [
      [1, 3],
      [39, 45],
    ],
    hits: [
      {
        frames: [16, 18],
        boxes: [
          box(0, 1, 0, 4.5, { damage: 14, angle: 270, kbg: 100, bkb: 10 }),
          box(1, 1, 5, 4.5, { damage: 14, angle: 361, kbg: 100, bkb: 40 }),
        ],
      },
      { frames: [19, 22], boxes: [box(0, 1, 1, 4.5, { damage: 10, angle: 361, kbg: 100, bkb: 40 })] },
    ],
  },
  /** Grabs, on Captain Falcon's frame data (UFD) with the roster's frame-7 standing grab. */
  grab: { kind: 'other', faf: 36, hits: [{ frames: [7, 8], boxes: [grabBox(0, 7.5, 8, 4.5)] }] },
  dashGrab: { kind: 'other', faf: 44, hits: [{ frames: [10, 11], boxes: [grabBox(0, 8.5, 8, 5)] }] },
  /** Turns around out of a dash or run and grabs behind; the slide keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 39, hits: [{ frames: [11, 12], boxes: [grabBox(0, 9, 8, 5.5)] }] },
  /** Knee to the gut. Falcon's 1.3% with about 13 frames of hitlag. */
  pummel: { kind: 'other', faf: 7, hits: [], pummel: { frame: 1, damage: 1.3, hitlag: 2 } },
  /**
   * Throws: the roster's total damage, split like Falcon's into a hit on the held opponent on Falcon's hit frames
   * and a release with Falcon's throw damage, angle, BKB and KBG.
   */
  /** Punch Toss: a straight punch (4%, frame 11) that knocks the opponent away (4%). */
  fthrow: {
    kind: 'other',
    faf: 33,
    hits: [],
    script: throwHit(11, 4),
    throw: { frame: 13, hit: { damage: 4, angle: 45, kbg: 120, bkb: 55 } },
  },
  /**
   * Spin Throw: swings the opponent round once (6%, frame 12) and lets go behind him (4%). His kill throw near the
   * ledge.
   */
  bthrow: {
    kind: 'other',
    faf: 46,
    hits: [],
    script: throwHit(12, 6),
    throw: { frame: 13, hit: { damage: 4, angle: 45, kbg: 130, bkb: 60, direction: 'back' } },
  },
  /**
   * Palm Lift: a shove (2%, frame 12) into a one-handed heave straight up (5%); at low percent he lands under them
   * in time to follow up.
   */
  uthrow: {
    kind: 'other',
    faf: 38,
    hits: [],
    script: throwHit(12, 2),
    throw: { frame: 14, hit: { damage: 5, angle: 84, kbg: 100, bkb: 68 } },
  },
  /** Slam: drives the opponent into the floor (1%, frame 20) so they bounce up in front of him (6%). */
  dthrow: {
    kind: 'other',
    faf: 40,
    hits: [],
    script: throwHit(20, 1),
    throw: { frame: 21, hit: { damage: 6, angle: 68, kbg: 70, bkb: 65 } },
  },
  /**
   * Laser Gun (neutral special): Falco's Blaster in Ultimate (SmashWiki, Falco (SSBU)/Neutral special). Falco's over
   * Fox's because Fox's laser is flinchless and fires a held stream, a poke for a light, fast fighter; Falco's is one
   * aimed shot that makes the opponent flinch, which fits a sidearm drawn and fired once and gives a heavy rushdown
   * fighter a hit to dash in behind. The laser (entities.ts) leaves the muzzle on frame 8 and he can act on frame
   * 42; pressing Special again on frames 2-17 fires again 26 frames later (laserRepeat). With a full upgrade meter
   * it plays Upgraded Laser instead (upgrade.ts).
   */
  neutralB: {
    kind: 'other',
    faf: 42,
    air: 'neutralBAir',
    hits: [],
    spawn: [{ frame: 8, entity: 'laser', x: MUZZLE.x, y: MUZZLE.y, vx: LASER.speed }],
    script: upgradable('neutralBUpgraded', laserRepeat(LASER_GUN.ground)),
  },
  /** Laser Gun in the air: Falco's aerial Blaster, frame 7 and FAF 39, 6 frames of landing lag, a shot per 23. */
  neutralBAir: {
    kind: 'other',
    faf: 39,
    landingLag: 6,
    hits: [],
    spawn: [{ frame: 7, entity: 'laser', x: MUZZLE.x, y: MUZZLE.airY, vx: LASER.speed }],
    script: upgradable('neutralBUpgraded', laserRepeat(LASER_GUN.air)),
  },
  /**
   * Upgrade Dash (side special, Raptor Boost's role): a wind-up, a burst dash of about 40 units and a punch at the
   * end of it that pops the opponent up. In the air he flies level through the dash and ends helpless.
   */
  sideB: {
    kind: 'other',
    faf: 50,
    helpless: true,
    ledgeFrom: 20,
    landingLag: 20,
    hits: [{ frames: [16, 19], boxes: [box(0, 8, 9, 5.5, { damage: 10, angle: 75, kbg: 60, bkb: 70 })] }],
    script(x) {
      const { f } = x;
      if (f.actionFrame <= 5) {
        f.vel.x *= 0.6;
        if (!f.ground) f.vel.y = Math.max(f.vel.y * 0.5, -0.3);
        return;
      }
      if (f.actionFrame <= 18) {
        f.vel.x = 3 * f.facing;
        if (!f.ground) f.vel.y = 0;
        return;
      }
      f.vel.x *= 0.85;
    },
  },
  /**
   * Double-Jump Boots (up special): his game's double-jump upgrade as a rising boot uppercut. The take-off kick
   * lifts the opponent at his own climbing speed so the uppercut on frame 14 connects, then he shoots up for
   * about 95 units in all, steered with the stick, and falls helpless. Grabs ledges on the way up.
   */
  upB: {
    kind: 'other',
    faf: 46,
    leavesGround: true,
    helpless: true,
    ledgeFrom: 12,
    landingLag: 24,
    hits: [
      {
        frames: [8, 10],
        boxes: [box(0, 4, 7, 5.5, { damage: 4, angle: 88, kbg: 100, bkb: 0, wbkb: 90 })],
      },
      {
        frames: [14, 17],
        rehit: true,
        boxes: [box(0, 3, 15, 7, { damage: 8, angle: 80, kbg: 90, bkb: 50, direction: 'away' })],
      },
    ],
    script(x) {
      const { f, c } = x;
      if (f.actionFrame < 8) {
        f.vel.x *= 0.8;
        f.vel.y = Math.max(f.vel.y, 0);
        return;
      }
      if (f.actionFrame > 42) return;
      f.vel.x = stickX(c);
      f.vel.y = f.actionFrame <= 17 ? 2.4 : 3.85 - (f.actionFrame - 18) * 0.11;
    },
  },
  /** Coin Magnet (down special) and Upgraded Laser: the upgrade meter's moves, in upgrade.ts. */
  ...upgradeMoves,
};

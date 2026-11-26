import type { HitboxDef, MoveDef } from '../types';
import { chargeLerp } from '../../sim/actions/charge';
import { stickX } from '../../sim/control';
import type { Ctx } from '../../sim/fighter';
import { REV_UP } from './revUp';

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

/** Rev Up's drive: brake into the rev, floor it at a speed set by the revs, then skid to a stop. */
function revUpDrive(x: Ctx): void {
  const { f } = x;
  const [from, to] = REV_UP.drive;
  if (f.actionFrame < from) {
    if (f.ground) f.vel.x *= 0.8;
  } else if (f.actionFrame <= to) {
    f.vel.x = f.facing * chargeLerp(f, ...REV_UP.speed);
  } else {
    f.vel.x *= 0.85;
  }
}

/**
 * Rev Up, grounded or aerial: Giant Punch's input model and hit (`damage` uncharged, `chargeDamage` up to full, BKB
 * and KBG of the fully charged punch). Both boxes are the car: the front bumper (Giant Punch's 5.5 fist) and the cab
 * (its 4.0 arm).
 */
function revUp(damage: number, chargeDamage: number, bkb: number, kbg: number): MoveDef {
  const hit = { damage, angle: 361, kbg, bkb };
  return {
    kind: 'other',
    faf: REV_UP.faf,
    charge: REV_UP.charge,
    chargeFrames: REV_UP.chargeFrames,
    chargeDamage,
    storeCharge: { tap: true, storeAtFull: true },
    hits: [{ frames: REV_UP.hit, boxes: [box(0, 8, 5, 5.5, hit), box(1, 2, 5.5, 4, hit)] }],
    script: revUpDrive,
  };
}

/**
 * Wheely's normals: a car with no fists, so every hit is the bumper, the wheels, the hood, the horn or the exhaust.
 * Damage and first active frames are the roster sheet's (handoffs/research/roster.md, "13. Wheely"), except for the
 * aerials and Charge Through, which take their analogue's damage because the roster's kept them more than 5 points
 * off its kill percent (wheely.test.ts). Angle, BKB and KBG
 * come from each move's Ultimate analogue (13.0.x, SmashWiki hitbox tables): Luigi's jab, Captain Falcon's ftilt,
 * Incineroar's utilt and uair, Donkey Kong's dtilt and uthrow, Falco's dash attack, Mario's fsmash and usmash, Little
 * Mac's dsmash, Wario's getup attack, bair and Wario Bike, Kirby's nair, Bowser's fair, King K. Rool's dair and bthrow,
 * Ridley's fthrow, Ganondorf's dthrow and Steve's Elytra. wheely.test.ts checks the kill moves against them.
 * His body runs from x = -9 (rear bumper) to x = 9 (front bumper) and up to y = 11 (roof).
 */
export const moves: Record<string, MoveDef> = {
  /** Beep: a horn blast, a ring of sound just past the front bumper. Attack again for the second beep. */
  jab: {
    kind: 'other',
    faf: 18,
    next: { window: [6, 17], move: 'jab2' },
    hits: [
      {
        frames: [3, 4],
        boxes: [box(0, 11, 5.5, 3.5, { damage: 2, angle: 361, kbg: 25, bkb: 25, hitlag: 0.5 })],
      },
    ],
  },
  /** Beep: the second, slightly bigger ring. */
  jab2: {
    kind: 'other',
    faf: 20,
    next: { window: [6, 19], move: 'jab3' },
    hits: [
      {
        frames: [3, 4],
        boxes: [box(0, 11.5, 5.5, 4, { damage: 2, angle: 361, kbg: 20, bkb: 25, hitlag: 0.5 })],
      },
    ],
  },
  /** HONK: a long blast on the horn whose big sound wave blows them away. */
  jab3: {
    kind: 'other',
    faf: 32,
    hits: [
      {
        frames: [4, 6],
        boxes: [
          box(0, 12, 5.5, 5, { damage: 4, angle: 361, kbg: 80, bkb: 60 }),
          box(1, 6, 5.5, 4, { damage: 4, angle: 361, kbg: 80, bkb: 60 }),
        ],
      },
    ],
  },
  /** Bumper Bump: lurches forward bumper-first. */
  ftilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [7, 9],
        boxes: [
          box(0, 11, 4, 4, { damage: 9, angle: 361, kbg: 58, bkb: 60 }),
          box(1, 5, 5, 4, { damage: 8, angle: 361, kbg: 58, bkb: 60 }),
        ],
      },
    ],
    script(x) {
      const { f } = x;
      if (f.actionFrame >= 5 && f.actionFrame <= 8) f.vel.x = f.facing * 0.9;
    },
  },
  /** Wheelie: rears up on the back wheels and the front bumper swings up through the target. */
  utilt: {
    kind: 'other',
    faf: 30,
    hits: [
      {
        frames: [6, 10],
        boxes: [
          box(0, 6, 13, 4.5, { damage: 8, angle: 86, kbg: 90, bkb: 50 }),
          box(1, 9, 7, 4, { damage: 7, angle: 86, kbg: 90, bkb: 50 }),
        ],
      },
    ],
  },
  /** Gravel Spray: spins the front tyre and sprays gravel along the ground; trips at low %. */
  dtilt: {
    kind: 'other',
    faf: 22,
    hits: [
      {
        frames: [5, 7],
        boxes: [
          box(0, 11, 1.5, 3.5, { damage: 6, angle: 361, kbg: 80, bkb: 10 }),
          box(1, 16, 1.5, 3, { damage: 4, angle: 361, kbg: 80, bkb: 10 }),
        ],
      },
    ],
  },
  /** Handbrake Drift: yanks the handbrake out of a run and skids broadside into them; weaker as the skid dies. */
  dashAttack: {
    kind: 'other',
    faf: 42,
    hits: [
      {
        frames: [8, 12],
        boxes: [box(0, 5, 5, 7, { damage: 11, angle: 65, kbg: 63, bkb: 80 })],
      },
      {
        frames: [13, 22],
        boxes: [box(0, 5, 5, 6, { damage: 7, angle: 40, kbg: 61, bkb: 70 })],
      },
    ],
  },
  /** Rev Ram: revs in place (charges on frame 10), then lunges bumper-first. His forward kill move. */
  fsmash: {
    kind: 'smash',
    faf: 52,
    charge: 10,
    hits: [
      {
        frames: [16, 18],
        boxes: [
          box(0, 12, 5, 5.5, { damage: 17, angle: 361, kbg: 99, bkb: 25 }),
          box(1, 5, 5, 5, { damage: 15, angle: 361, kbg: 105, bkb: 25 }),
        ],
      },
    ],
    script(x) {
      const { f } = x;
      if (f.actionFrame >= 13 && f.actionFrame <= 17) f.vel.x = f.facing * 2;
    },
  },
  /** Hood Pop: the hood springs open straight up. */
  usmash: {
    kind: 'smash',
    faf: 48,
    charge: 6,
    hits: [
      {
        frames: [12, 15],
        boxes: [
          box(0, 3, 14, 6, { damage: 14, angle: 83, kbg: 94, bkb: 32 }),
          box(1, 7, 9, 4.5, { damage: 12, angle: 83, kbg: 94, bkb: 32 }),
        ],
      },
    ],
  },
  /** Donut: spins out on the spot; the front bumper sweeps first, then the rear swings round behind. */
  dsmash: {
    kind: 'smash',
    faf: 50,
    charge: 4,
    hits: [
      {
        frames: [11, 12],
        boxes: [box(0, 10, 3, 5, { damage: 13, angle: 30, kbg: 94, bkb: 25 })],
      },
      {
        frames: [15, 16],
        boxes: [box(0, -10, 3, 5, { damage: 13, angle: 30, kbg: 94, bkb: 25, direction: 'back' })],
      },
    ],
  },
  /** Rolling back onto his wheels from lying down, bumping both sides; intangible until the second bump ends. */
  getupAttack: {
    kind: 'other',
    faf: 46,
    intangible: [1, 26],
    hits: [
      { frames: [17, 18], boxes: [box(0, 10, 3, 5, { damage: 7, angle: 48, kbg: 48, bkb: 80 })] },
      {
        frames: [25, 26],
        boxes: [box(0, -10, 3, 5, { damage: 7, angle: 48, kbg: 48, bkb: 80, direction: 'back' })],
      },
    ],
  },
  /** Barrel Roll: rolls over in the air, the whole car a hitbox; strong early, weak late. Kirby's nair, 10% clean. */
  nair: {
    kind: 'aerial',
    faf: 40,
    landingLag: 9,
    autoCancel: [
      [1, 4],
      [33, 40],
    ],
    hits: [
      {
        frames: [6, 9],
        boxes: [box(0, 0, 5.5, 7.5, { damage: 10, angle: 46, kbg: 117, bkb: 35, direction: 'away' })],
      },
      {
        frames: [10, 20],
        boxes: [box(0, 0, 5.5, 7, { damage: 6, angle: 46, kbg: 90, bkb: 30, direction: 'away' })],
      },
    ],
  },
  /** Front Flip: flips forward and slams the front bumper down in front of him. Bowser's fair, 13% and 12%. */
  fair: {
    kind: 'aerial',
    faf: 44,
    landingLag: 14,
    autoCancel: [
      [1, 3],
      [37, 44],
    ],
    hits: [
      {
        frames: [10, 13],
        boxes: [
          box(0, 10, 3, 5, { damage: 13, angle: 361, kbg: 80, bkb: 40 }),
          box(1, 6, 9, 4.5, { damage: 12, angle: 361, kbg: 80, bkb: 40 }),
        ],
      },
    ],
  },
  /** Backfire: the exhaust pipe bangs out a burst of flame behind him. His aerial kill move: Wario's bair, 12%. */
  bair: {
    kind: 'aerial',
    faf: 36,
    landingLag: 10,
    autoCancel: [
      [1, 4],
      [28, 36],
    ],
    hits: [
      {
        frames: [9, 11],
        boxes: [
          box(0, -12, 4, 5, { damage: 12, angle: 361, kbg: 106, bkb: 21, effect: 'fire', direction: 'back' }),
        ],
      },
      {
        frames: [12, 15],
        boxes: [
          box(0, -11, 4, 4, { damage: 8, angle: 361, kbg: 106, bkb: 21, effect: 'fire', direction: 'back' }),
        ],
      },
    ],
  },
  /** Roof Flip: flips wheels-up and the tyres run over whoever is above. */
  uair: {
    kind: 'aerial',
    faf: 35,
    landingLag: 8,
    autoCancel: [
      [1, 3],
      [27, 35],
    ],
    hits: [
      {
        frames: [7, 11],
        boxes: [box(0, 0, 14, 6.5, { damage: 9, angle: 85, kbg: 79, bkb: 66, direction: 'away' })],
      },
    ],
  },
  /**
   * Wheel Stomp: drops wheels-first; the tyres meteor on the first frames, then a weaker landing hit. King K. Rool's
   * dair: the 12% meteor, then the 9% hit.
   */
  dair: {
    kind: 'aerial',
    faf: 50,
    landingLag: 22,
    autoCancel: [
      [1, 3],
      [41, 50],
    ],
    hits: [
      { frames: [13, 16], boxes: [box(0, 0, -1, 6.5, { damage: 12, angle: 270, kbg: 90, bkb: 10 })] },
      { frames: [17, 24], boxes: [box(0, 0, 0, 6, { damage: 9, angle: 361, kbg: 100, bkb: 20 })] },
    ],
  },
  /** Door Scoop: swings the passenger door open and scoops them in; slow but long, like the heavies' grabs. */
  grab: { kind: 'other', faf: 40, hits: [{ frames: [9, 10], boxes: [grabBox(0, 8.5, 5.5, 5)] }] },
  dashGrab: { kind: 'other', faf: 46, hits: [{ frames: [11, 12], boxes: [grabBox(0, 9.5, 5.5, 5.5)] }] },
  /** Turns round out of a dash or run and scoops behind; the skid keeps going the old way. */
  pivotGrab: { kind: 'other', faf: 42, hits: [{ frames: [12, 13], boxes: [grabBox(0, 10, 5.5, 6)] }] },
  /** Door Slam: slams the door on them. */
  pummel: { kind: 'other', faf: 8, hits: [], pummel: { frame: 1, damage: 1.5, hitlag: 2 } },
  /** Eject: pops the door and fires them out forward. */
  fthrow: {
    kind: 'other',
    faf: 32,
    hits: [],
    throw: { frame: 14, hit: { damage: 9, angle: 42, kbg: 56, bkb: 60 } },
  },
  /** Reverse Bump: throws it in reverse and rams them out of the back. His kill throw at the ledge. */
  bthrow: {
    kind: 'other',
    faf: 44,
    hits: [],
    throw: { frame: 22, hit: { damage: 11, angle: 35, kbg: 56, bkb: 70, direction: 'back' } },
  },
  /** Wheelie Flip: pops a wheelie and flips them off the hood, straight up. */
  uthrow: {
    kind: 'other',
    faf: 42,
    hits: [],
    throw: { frame: 20, hit: { damage: 9, angle: 90, kbg: 50, bkb: 70 } },
  },
  /** Run Over: drops them and drives over them, leaving tyre tracks; pops them up for a follow-up. */
  dthrow: {
    kind: 'other',
    faf: 44,
    hits: [],
    throw: { frame: 24, hit: { damage: 7, angle: 65, kbg: 50, bkb: 70 } },
  },
  /**
   * Charge Through (side special): spins the tyres for a moment, then floors it straight through whoever is in
   * the way. In the air he drives level and ends helpless; landing mid-dash keeps the dash going on the ground.
   * Wario Bike's 7% drive into someone.
   */
  sideB: {
    kind: 'other',
    faf: 52,
    helpless: true,
    continuesOnLanding: true,
    landingLag: 20,
    hits: [
      {
        frames: [14, 28],
        boxes: [box(0, 3, 5, 7, { damage: 7, angle: 361, kbg: 70, bkb: 60 })],
      },
    ],
    script(x) {
      const { f } = x;
      if (f.actionFrame < 14) {
        f.vel.x *= 0.8;
        if (!f.ground) f.vel.y = Math.max(f.vel.y * 0.8, -0.4);
      } else if (f.actionFrame <= 29) {
        f.vel.x = f.facing * 3.2;
        if (!f.ground) f.vel.y = 0;
      } else {
        f.vel.x *= 0.85;
      }
    },
  },
  /**
   * Ramp Jump (up special): a little wooden ramp from his puzzle levels drops in front of him; he drives up it
   * and launches on a long diagonal, about 90 units, steerable a little with the stick. Ends helpless.
   */
  upB: {
    kind: 'other',
    faf: 40,
    leavesGround: true,
    helpless: true,
    ledgeFrom: 16,
    landingLag: 24,
    hits: [
      { frames: [10, 14], boxes: [box(0, 4, 5, 6.5, { damage: 6, angle: 70, kbg: 100, bkb: 30 })] },
      { frames: [15, 24], boxes: [box(0, 3, 5, 5.5, { damage: 3, angle: 70, kbg: 100, bkb: 30 })] },
    ],
    script(x) {
      const { f, c } = x;
      if (f.actionFrame < 4) {
        f.vel.x *= 0.7;
        f.vel.y = Math.max(f.vel.y, 0);
      } else if (f.actionFrame < 10) {
        f.vel.x = f.facing * 0.9;
        f.vel.y = 0.6;
      } else if (f.actionFrame === 10) {
        const lean = stickX(c) * f.facing;
        f.vel.x = f.facing * (2 + 0.5 * lean);
        f.vel.y = 3.9 - 0.4 * Math.max(0, lean);
      }
    },
  },
  /**
   * Rev Up (neutral special): parks and revs the engine, then pops the clutch and blasts forward bumper first.
   * Giant Punch's input model (`{ tap: true, storeAtFull: true }`): tap Special and he revs by himself; Special or
   * Attack again lets go. Shield, a roll or spot dodge out of it, an air dodge or a jump keeps the revs for next time,
   * and at full revs he keeps them and stops revving. A full charge kept that way blasts off at once next time. Like
   * any stored charge it is lost on a KO. SmashWiki's "Charge" page lists only Oil Panic and Wario Waft as kept
   * after a KO.
   *
   * Grounded Giant Punch: 10% uncharged to 28% at full ("base damage + 18 * (charge frames / 110)"), Sakurai angle,
   * BKB 35 and KBG 73 (the full punch's; uncharged it is 45 and 70, and the engine scales only the damage).
   */
  neutralB: { ...revUp(10, 2.8, 35, 73), air: 'neutralBAir' },
  /**
   * Rev Up in the air: aerial Giant Punch, 6% to 25% with the full punch's BKB 40 and KBG 72. It shares the stored
   * revs with the grounded one (as Samus's Charge Shot does) and carries on when it lands.
   */
  neutralBAir: { ...revUp(6, 25 / 6, 40, 72), continuesOnLanding: true },
};

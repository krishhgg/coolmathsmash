import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { defineFighter, type HitboxDef } from '../../fighters/types';
import { koPercent, kos, type KoHit, type KoSetup } from './ko';
import { marioReference } from './reference';

/**
 * Reference KO percents: SSBU-Calculator's KO calculator (rubendal/SSBU-Calculator commit 233590e, js/knockback.js
 * Distance) run headless on Mario's 13.0.1 hitboxes (rubendal/ssbu data viewer, commit 2e8f0d2) against Mario at
 * Battlefield: fresh (1.05), no rage, no DI, target at the ledge (x 79.9) or centre. SmashWiki's Mario (SSBU)/Forward
 * smash: the sweetspot "is capable of KOing most characters reliably at 70% near the ledge".
 */
const mario: Record<string, KoHit & { ledge: number; centre: number; air?: boolean; tolerance: number }> = {
  fsmash: { damage: 17.8, angle: 361, kbg: 99, bkb: 25, ledge: 64.8, centre: 90.4, tolerance: 1.5 },
  bthrow: {
    damage: 11,
    angle: 45,
    kbg: 66,
    bkb: 70,
    direction: 'back',
    ledge: 130.5,
    centre: 192.5,
    tolerance: 2.5,
  },
  usmash: { damage: 14, angle: 83, kbg: 94, bkb: 32, ledge: 124.5, centre: 124.5, tolerance: 2 },
  uair: { damage: 7, angle: 75, kbg: 135, bkb: 10, ledge: 186.2, centre: 186.2, air: true, tolerance: 2 },
  uthrow: { damage: 7, angle: 90, kbg: 72, bkb: 70, ledge: 240.6, centre: 240.6, tolerance: 3.5 },
};

describe('koPercent reproduces Ultimate kill percents (Mario on Mario, Battlefield, no DI)', () => {
  for (const [name, { ledge, centre, air, tolerance, ...hit }] of Object.entries(mario)) {
    it(`${name}: ledge ${ledge}%, centre ${centre}%`, () => {
      expect(Math.abs(koPercent({ hit, air })! - ledge)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(koPercent({ hit, air, from: 'centre' })! - centre)).toBeLessThanOrEqual(tolerance);
    });
  }

  it('survival DI (stick at 170 degrees) holds on to about 70% against the fsmash at the ledge', () => {
    const { ledge, centre, air, tolerance, ...hit } = mario.fsmash!;
    void [ledge, centre, air, tolerance];
    const di = {
      x: Math.round(100 * Math.cos((170 * Math.PI) / 180)),
      y: Math.round(100 * Math.sin((170 * Math.PI) / 180)),
    };
    expect(Math.abs(koPercent({ hit, di })! - 70.2)).toBeLessThanOrEqual(2);
  });

  it('kos() agrees with the threshold, and a move is as strong as its strongest box', () => {
    const hit = { damage: 12, angle: 45, kbg: 100, bkb: 30 };
    const p = koPercent({ hit })!;
    expect(kos({ hit }, p)).toBe(true);
    expect(kos({ hit }, p - 0.1)).toBe(false);
    expect(koPercent({ hit: { fighter: 'reference-mario', move: 'probe' } })).toBe(p);
  });

  it("a move's hit windows land once: a long nair through the fighter path matches its box passed raw", () => {
    const nair = { damage: 8, angle: 361, kbg: 100, bkb: 10 };
    expect(koPercent({ hit: { fighter: 'reference-mario', move: 'nair' }, air: true })).toBe(
      koPercent({ hit: nair, air: true }),
    );
  });
});

const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  rest: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({
  id,
  x,
  y,
  radius,
  ...rest,
});

/**
 * Captain Falcon's Ultimate up smash, forward air and up air (SmashWiki's 13.0.1 hitbox tables). A box on a leg bone
 * sits where that leg is on its active frame. LR_CHECK_POS boxes launch away from his centre; LR_CHECK_F ones forward.
 */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'reference-falcon',
    name: 'Reference (Captain Falcon)',
    moves: {
      usmash: {
        kind: 'smash',
        faf: 46,
        hits: [
          {
            frames: [22, 23],
            boxes: [
              box(0, 10, 7.5, 5.7, { damage: 7, angle: 110, kbg: 90, bkb: 0, wbkb: 150, direction: 'away' }),
              box(1, 5, 17, 6, { damage: 7, angle: 96, kbg: 90, bkb: 0, wbkb: 80, direction: 'away' }),
              box(2, 5, 28, 4.8, { damage: 12, angle: 80, kbg: 90, bkb: 0, direction: 'away' }),
              box(3, 1.5, 21, 4.8, { damage: 12, angle: 80, kbg: 90, bkb: 5, wbkb: 10 }),
            ],
          },
          {
            frames: [28, 29],
            rehit: true,
            boxes: [
              box(0, 5.5, 29, 6, { damage: 14, angle: 83, kbg: 80, bkb: 70 }),
              box(1, 2.5, 21, 5.5, { damage: 14, angle: 85, kbg: 81, bkb: 70 }),
              box(2, 0.5, 16, 5, { damage: 13, angle: 70, kbg: 88, bkb: 70 }),
            ],
          },
        ],
      },
      fair: {
        kind: 'aerial',
        faf: 37,
        hits: [
          {
            frames: [14, 14],
            boxes: [
              box(0, 9, 9, 3.75, {
                damage: 22,
                angle: 32,
                kbg: 81,
                bkb: 30,
                effect: 'electric',
                hitlag: 1.2,
              }),
              box(1, 0, 6, 3, { damage: 6, angle: 361, kbg: 80, bkb: 35, hitlag: 1.2 }),
            ],
          },
          {
            frames: [15, 30],
            boxes: [
              box(0, 9, 9, 4.7, { damage: 3, angle: 361, kbg: 80, bkb: 35 }),
              box(1, 0, 6, 3, { damage: 3, angle: 361, kbg: 80, bkb: 35 }),
            ],
          },
        ],
      },
      uair: {
        kind: 'aerial',
        faf: 26,
        hits: [
          {
            frames: [7, 10],
            boxes: [
              box(0, 2, 22, 4.5, { damage: 10, angle: 66, kbg: 96, bkb: 20, direction: 'away' }),
              box(1, 6, 17, 5, { damage: 9, angle: 66, kbg: 96, bkb: 20, direction: 'away' }),
            ],
          },
          {
            frames: [11, 12],
            boxes: [
              box(0, 2, 22, 4.5, { damage: 9, angle: 30, kbg: 80, bkb: 12, direction: 'away' }),
              box(1, 6, 17, 5, { damage: 8, angle: 30, kbg: 80, bkb: 12, direction: 'away' }),
            ],
          },
        ],
      },
    },
  }),
);

const strong = { damage: 20, angle: 45, kbg: 100, bkb: 60 };
const weak = { damage: 6, angle: 45, kbg: 60, bkb: 30 };

/** Move shapes that koPercent has to land the way a real hit does. */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'ko-shapes',
    moves: {
      twoHit: {
        kind: 'other',
        faf: 30,
        hits: [
          { frames: [5, 6], boxes: [box(0, 8, 8, 6, strong)] },
          { frames: [10, 11], rehit: true, boxes: [box(0, 8, 8, 6, weak)] },
        ],
      },
      ahead: {
        kind: 'other',
        faf: 30,
        hits: [{ frames: [5, 6], boxes: [box(0, 8, 8, 6, { ...weak, direction: 'away' })] }],
      },
      behind: {
        kind: 'other',
        faf: 30,
        hits: [{ frames: [5, 6], boxes: [box(0, -8, 8, 6, { ...weak, direction: 'away' })] }],
      },
      fthrow: {
        kind: 'other',
        faf: 40,
        hits: [{ frames: [8, 9], boxes: [box(0, 8, 8, 6, strong)] }],
        throw: { frame: 12, hit: weak },
      },
    },
  }),
);

describe("koPercent lands a move's launching hit where it connects", () => {
  it("Captain Falcon's up smash, forward air and up air reproduce the calculator from the same contact point", () => {
    // SSBU-Calculator (233590e) on Mario at the Battlefield ledge with the target where each move's strongest box
    // meets it. Up smash hit 2 (14%, 83 deg, 80/70) at y 29 lifts Mario to 21.5, airborne; the knee (22%, 32 deg,
    // 81/30) meets him standing; the up air's clean box (10%, 66 deg, 96/20) at y 22 lifts him to 14.5. The up air
    // dies off the top late in its hitstun, where the calculator's top-zone check reads a stale launch speed (see
    // "with its KO check reading each frame's launch speed" below), so it gets a 5-point tolerance here.
    const falcon = (move: string) => koPercent({ hit: { fighter: 'reference-falcon', move } })!;
    expect(Math.abs(falcon('usmash') - 100.1)).toBeLessThanOrEqual(2.5);
    expect(Math.abs(falcon('fair') - 56.0)).toBeLessThanOrEqual(2);
    expect(Math.abs(falcon('uair') - 180.8)).toBeLessThanOrEqual(5);
    expect(falcon('usmash')).toBe(
      koPercent({ hit: { damage: 14, angle: 83, kbg: 80, bkb: 70 }, air: true, from: { x: 79.9, y: 21.5 } }),
    );
  });

  it('a multi-hit move launches with its final hit and a throw with its release, whatever came before', () => {
    expect(koPercent({ hit: { fighter: 'ko-shapes', move: 'twoHit' } })).toBe(koPercent({ hit: weak }));
    expect(koPercent({ hit: { fighter: 'ko-shapes', move: 'fthrow' } })).toBe(koPercent({ hit: weak }));
    expect(koPercent({ hit: weak })).toBeGreaterThan(koPercent({ hit: strong })! + 50);
  });

  it('the attacker stays out of the way after the hit, even standing right on a grounded target', () => {
    const nair = { damage: 8, angle: 361, kbg: 100, bkb: 10 };
    expect(koPercent({ hit: { fighter: 'reference-mario', move: 'nair' }, from: 'centre' })).toBe(
      koPercent({ hit: nair, from: 'centre' }),
    );
  });

  it('a box that launches away from the attacker sends the target toward the near edge from either side of him', () => {
    const ahead = koPercent({ hit: { fighter: 'ko-shapes', move: 'ahead' } });
    expect(koPercent({ hit: { fighter: 'ko-shapes', move: 'behind' } })).toBe(ahead);
    expect(koPercent({ hit: { fighter: 'ko-shapes', move: 'behind' }, from: { x: -79.9, y: 0 } })).toBe(
      ahead,
    );
  });
});

/**
 * SSBU-Calculator's KO check (233590e, js/knockback.js Distance) indexes its vertical launch speeds by simulation step
 * but its positions by displayed frame. Under balloon speed-up the two drift apart, so the top zone's 2.4 rule and the
 * meteor blast line read a speed from up to 30 steps earlier than the position they check. That KOs late-hitstun top
 * kills 1.5 to 6 points early, and meteors 6 to 8, against the calculator's own trajectory. These are the calculator's
 * numbers with that one read fixed, run headless as in the table at the top: the speed is the launch speed recorded
 * with each position. Meteors are offstage: Mario airborne 10 units past the ledge, where a downward hit can KO. The
 * engine follows the same trajectory, so it lands within a point of each.
 */
describe("koPercent against SSBU-Calculator with its KO check reading each frame's launch speed", () => {
  const cases: {
    name: string;
    hit: KoHit;
    setup: Omit<KoSetup, 'hit'>;
    calculator: number;
    shipped: number;
  }[] = [
    {
      name: "Mario's usmash",
      hit: { damage: 14, angle: 83, kbg: 94, bkb: 32 },
      setup: {},
      calculator: 126.0,
      shipped: 124.5,
    },
    {
      name: "Mario's uair",
      hit: { damage: 7, angle: 75, kbg: 135, bkb: 10 },
      setup: { air: true },
      calculator: 187.9,
      shipped: 186.2,
    },
    {
      name: "Mario's uthrow",
      hit: { damage: 7, angle: 90, kbg: 72, bkb: 70 },
      setup: {},
      calculator: 243.8,
      shipped: 240.6,
    },
    {
      name: "Falcon's uair, lifted to y 14.5",
      hit: { damage: 10, angle: 66, kbg: 96, bkb: 20 },
      setup: { air: true, from: { x: 79.9, y: 14.5 } },
      calculator: 185.0,
      shipped: 180.8,
    },
    {
      name: "Ridley's up Wing Blitz, at y 18.5",
      hit: { damage: 18, angle: 64, kbg: 46, bkb: 85 },
      setup: { air: true, from: { x: 79.9, y: 18.5 } },
      calculator: 141.7,
      shipped: 135.6,
    },
    {
      name: "Mario's fair meteor, offstage",
      hit: { damage: 14, angle: 280, kbg: 78, bkb: 32 },
      setup: { air: true, from: { x: 90, y: 0 } },
      calculator: 52.8,
      shipped: 46.1,
    },
    {
      name: "Min Min's dair meteor, offstage",
      hit: { damage: 11, angle: 285, kbg: 90, bkb: 30 },
      setup: { air: true, from: { x: 90, y: 0 } },
      calculator: 62.1,
      shipped: 54.6,
    },
    {
      name: "K. Rool's dair meteor, offstage",
      hit: { damage: 12, angle: 270, kbg: 90, bkb: 10 },
      setup: { air: true, from: { x: 90, y: 0 } },
      calculator: 74.9,
      shipped: 69.2,
    },
  ];

  it.each(cases)('$name: within a point of $calculator% (the shipped check says $shipped%)', (c) => {
    expect(Math.abs(koPercent({ hit: c.hit, ...c.setup })! - c.calculator)).toBeLessThanOrEqual(1);
  });
});

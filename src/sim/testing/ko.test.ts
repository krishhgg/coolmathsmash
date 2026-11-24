import { describe, expect, it } from 'vitest';
import { koPercent, kos, type KoHit } from './ko';

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

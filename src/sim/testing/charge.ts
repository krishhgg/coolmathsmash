import { defineFighter, type HitboxDef } from '../../fighters/types';
import { chargeLerp } from '../actions/charge';
import type { Ctx } from '../fighter';
import { marioReference } from './reference';

const hit = (damage: number, radius: number): HitboxDef => ({
  id: 0,
  x: 7,
  y: 7,
  radius,
  damage,
  angle: 40,
  kbg: 80,
  bkb: 40,
});

/** Rush forward on frames `from`-`to`, faster the more the move charged. */
const rush =
  (from: number, to: number, uncharged: number, full: number) =>
  (x: Ctx): void => {
    const { f } = x;
    if (f.actionFrame >= from && f.actionFrame <= to) f.vel.x = f.facing * chargeLerp(f, uncharged, full);
  };

/**
 * A test fighter for charging (src/sim/actions/charge.ts) on the Mario reference body: a smash attack on the
 * defaults and one roster special of each charge kind. Tests register it, and so does the harness (`?harness`),
 * so captures can show it; normal play never sees it.
 */
export const testCharger = defineFighter({
  id: 'test-charger',
  name: 'Test: charge',
  series: 'test',
  selectable: false,
  stats: marioReference.stats,
  moves: {
    /** A smash attack on the defaults: 60 frames of charge for 1.4x damage. */
    fsmash: { kind: 'smash', faf: 40, charge: 6, hits: [{ frames: [10, 12], boxes: [hit(10, 6)] }] },
    /**
     * Held charge, the shape planned for the Duck's Running Ram (Pikachu's Skull Bash role): hold Special to charge,
     * then a headfirst dash, 10% to 22%.
     */
    sideB: {
      kind: 'other',
      faf: 50,
      charge: 8,
      chargeDamage: 2.2,
      hits: [{ frames: [12, 28], boxes: [hit(10, 5)] }],
      script: rush(12, 28, 1.2, 2.6),
    },
    /**
     * Held stored charge: hold Special to charge for up to 90 frames, release to rush forward, 8% to 24%; shield keeps
     * the charge for next time. Ultimate's stored charges are all tap moves (downB below, and Wheely's Rev Up); this is
     * Skull Bash's hold with storage added.
     */
    neutralB: {
      kind: 'other',
      faf: 50,
      charge: 8,
      chargeFrames: 90,
      chargeDamage: 3,
      storeCharge: {},
      hits: [{ frames: [12, 26], boxes: [hit(8, 6)] }],
      script: rush(12, 26, 1.4, 3.2),
    },
    /**
     * Tap stored charge (Samus's Charge Shot role): charges by itself for up to 120 frames and fires on the next
     * Special or Attack press, 5% to 26%; at full charge it is stored and the move ends.
     */
    downB: {
      kind: 'other',
      faf: 45,
      charge: 10,
      chargeFrames: 120,
      chargeDamage: 5.2,
      storeCharge: { tap: true, storeAtFull: true },
      hits: [{ frames: [14, 17], boxes: [{ ...hit(5, 8), x: 12 }] }],
    },
  },
});

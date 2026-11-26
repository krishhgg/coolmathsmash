import { describe, expect, it } from 'vitest';
import type { HitboxDef } from '../fighters/types';
import { neutralInput } from '../input/types';
import { hashState } from '../engine/hash';
import { applyHit } from '../sim/combat/hits';
import type { FighterState } from '../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../sim/match';
import { marioReference } from '../sim/testing/reference';
import '../sim/testing/sim';
import { predictKo } from './koPredict';

type Hit = Pick<HitboxDef, 'damage' | 'angle' | 'kbg' | 'bkb'>;

/**
 * Mario's Ultimate 13.0.1 hitboxes and SSBU-Calculator's kill percents for them on Mario at Battlefield (fresh, no
 * rage, no DI), the same reference src/sim/testing/ko.test.ts holds the sim to.
 */
const MARIO: Record<string, Hit & { ledge?: number; centre: number; tolerance: number }> = {
  fsmash: { damage: 17.8, angle: 361, kbg: 99, bkb: 25, ledge: 64.8, centre: 90.4, tolerance: 1.5 },
  usmash: { damage: 14, angle: 83, kbg: 94, bkb: 32, centre: 124.5, tolerance: 2 },
};

const LEDGE = { x: 79.9, y: 0 };
const CENTRE = { x: 0, y: 0 };

interface Setup {
  hit: Hit;
  at: { x: number; y: number };
  air?: boolean;
  target?: string;
}

/** Land `hit` on the target at `percent` from 10 units inward (as ko.ts does); the attacker then stays frozen. */
function struck({ hit, at, air, target }: Setup, percent: number): { m: MatchState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: marioReference.id }, { fighter: target ?? marioReference.id }],
  });
  for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  Object.assign(a, {
    pos: { x: at.x - 10, y: at.y },
    facing: 1,
    move: 'probe',
    staleQueue: [],
    moveStale: 0,
  });
  Object.assign(v, { pos: { ...at }, prevPos: { ...at }, facing: -1, damage: percent, vel: { x: 0, y: 0 } });
  if (air) Object.assign(v, { ground: null, action: 'fall', actionFrame: 1 });
  applyHit(m, a, v, { id: 0, x: 0, y: 0, radius: 0, hitlag: 1, ...hit });
  Object.assign(a, { move: null, hitlag: 10_000 });
  return { m, v };
}

/**
 * The real outcome: step the sim with both sticks neutral until the target KOs or its hitstun runs out. Returns the
 * frames from its launch to the KO and the blast zone it crossed, or null.
 */
function simKo(m: MatchState, v: FighterState): { frames: number; side: string } | null {
  let launched = 0;
  for (let i = 0; i < 2000; i++) {
    if (v.hitlag <= 0 && v.launch === null && v.hitstun <= 0) return null;
    if (v.hitlag <= 0) launched++;
    stepMatch(m, [neutralInput(), neutralInput()]);
    const ko = m.events.find((e) => e.type === 'ko');
    if (ko) return { frames: launched, side: ko.side };
  }
  throw new Error('the target never settled');
}

const predicted = (s: Setup, percent: number) => {
  const { m } = struck(s, percent);
  return predictKo(m, 1);
};
const real = (s: Setup, percent: number) => {
  const { m, v } = struck(s, percent);
  return simKo(m, v);
};

/** The lowest percent (to 0.1) at which `kos` holds, by bisection. */
function threshold(kos: (percent: number) => boolean): number {
  let lo = 0;
  let hi = 9990;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (kos(mid / 10)) hi = mid;
    else lo = mid;
  }
  return hi / 10;
}

const CASES: Record<string, Setup> = {
  'Mario fsmash at the ledge (side zone)': { hit: MARIO.fsmash!, at: LEDGE },
  'Mario fsmash at centre (side zone)': { hit: MARIO.fsmash!, at: CENTRE },
  'Mario usmash at centre (vertical launch, top zone)': { hit: MARIO.usmash!, at: CENTRE },
  'a 45-degree hit on airborne Fireboy, a lighter floatier fighter': {
    hit: { damage: 12, angle: 45, kbg: 100, bkb: 30 },
    at: { x: 40, y: 30 },
    air: true,
    target: 'fireboy',
  },
  'a 270-degree spike offstage (bottom zone)': {
    hit: { damage: 10, angle: 270, kbg: 80, bkb: 20 },
    at: { x: 110, y: 10 },
    air: true,
  },
};

describe('predictKo agrees with the sim, neutral sticks, across a sweep of percents', () => {
  for (const [name, setup] of Object.entries(CASES)) {
    it(name, () => {
      const sweep = Array.from({ length: 101 }, (_, i) => i * 2.5);
      const rows = sweep.map((percent) => ({
        percent,
        predicted: predicted(setup, percent),
        real: real(setup, percent),
      }));
      const wrong = rows.filter(
        (r) =>
          (r.predicted === null) !== (r.real === null) ||
          (r.predicted && (r.predicted.frames !== r.real!.frames || r.predicted.side !== r.real!.side)),
      );
      expect(wrong.map((r) => r.percent)).toEqual([]);
      expect(rows.some((r) => r.real)).toBe(true);
      expect(rows.some((r) => !r.real)).toBe(true);
      const kill = threshold((p) => predicted(setup, p) !== null);
      expect(threshold((p) => real(setup, p) !== null)).toBe(kill);
    });
  }
});

describe('predicted kill percents match SSBU-Calculator', () => {
  for (const [name, { ledge, centre, tolerance, ...hit }] of Object.entries(MARIO)) {
    it(`Mario ${name}: ${ledge === undefined ? '' : `ledge ${ledge}%, `}centre ${centre}%`, () => {
      const at = (where: { x: number; y: number }) =>
        threshold((p) => predicted({ hit, at: where }, p) !== null);
      if (ledge !== undefined) expect(Math.abs(at(LEDGE) - ledge)).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(at(CENTRE) - centre)).toBeLessThanOrEqual(tolerance);
    });
  }
});

describe('predictKo', () => {
  it('reads the state and never writes it', () => {
    const { m } = struck(CASES['Mario fsmash at the ledge (side zone)']!, 120);
    const before = hashState(m);
    expect(predictKo(m, 1)).not.toBeNull();
    expect(hashState(m)).toBe(before);
  });

  it('is null with no launch pending, and ignores DI as Ultimate does', () => {
    const setup = CASES['Mario fsmash at the ledge (side zone)']!;
    const { m } = struck(setup, 120);
    expect(predictKo(m, 0)).toBeNull();
    m.players[1]!.control.cur = { ...m.players[1]!.control.cur, x: -100, y: 100 };
    expect(predictKo(m, 1)).toEqual(predicted(setup, 120));
  });
});

import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { knockback } from '../combat/formulas';
import type { FighterState } from '../fighter';
import type { MatchState } from '../match';
import { beastChew, beastLunge, lungeTester } from '../testing/beast';
import { runPorts, testMatch, type Hold } from '../testing/sim';

const [FROM, TO] = beastLunge.hits[0]!.frames;
const THROW = beastChew.throw!;

/** The same lunge with a plain grab box, to compare against. */
const plainTester = {
  ...lungeTester,
  id: 'test-lunge-plain',
  moves: { ...lungeTester.moves, sideB: { ...beastLunge, commandGrab: undefined } },
};
registerFighter(plainTester);

function place(f: FighterState, x: number, y: number, facing: 1 | -1): void {
  Object.assign(f, { pos: { x, y }, prevPos: { x, y }, vel: { x: 0, y: 0 }, ground: null });
  Object.assign(f, { action: 'fall', actionFrame: 1, jumpsUsed: 1, facing, intangible: 0 });
}

/** P1 at -10 facing right and P2 `gap` in front facing him, both standing on Battlefield's main stage. */
function duel(gap: number, fighter = lungeTester.id): { m: MatchState; a: FighterState; v: FighterState } {
  const m = testMatch({ fighter, players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  place(a, -10, 1, 1);
  place(v, -10 + gap, 1, -1);
  runPorts(m, 20, []);
  expect([a.action, v.action]).toEqual(['idle', 'idle']);
  return { m, a, v };
}

/** P1 side-specials; P2 holds `p2`. Returns the lunge frame that caught P2, or 0 when the lunge missed. */
function lunge(m: MatchState, a: FighterState, v: FighterState, p2: Hold = {}): number {
  runPorts(m, 1, [{ x: 100, buttons: ['special'] }, p2]);
  expect(a.move).toBe('sideB');
  for (let i = 0; i <= TO && a.actionFrame < TO; i++) {
    const frame = a.actionFrame + 1;
    runPorts(m, 1, [{}, p2]);
    if (v.action === 'grabbed') return frame;
  }
  return 0;
}

describe('command grabs', () => {
  it('catch through a shield and play their throw at once: chews, then the release, with no mashing out', () => {
    const { m, a, v } = duel(14);
    const shield: Hold = { buttons: ['shield'] };
    runPorts(m, 5, [{}, shield]);
    expect(v.action).toBe('shield');
    expect(lunge(m, a, v, shield)).toBe(FROM);
    expect([a.action, a.move, a.actionFrame]).toEqual(['grabThrow', 'beastChew', 0]);

    const damage: number[] = [];
    for (let i = 0; i < 200 && v.action === 'grabbed'; i++) {
      const mash: Hold =
        i % 2 ? { x: 100, buttons: ['attack', 'jump', 'shield', 'grab', 'special'] } : { x: -100 };
      const before = v.damage;
      runPorts(m, 1, [{}, mash]);
      if (v.damage === before) continue;
      damage.push(v.damage);
      if (v.action === 'grabbed')
        expect([a.actionFrame, v.hitlag > 0, v.launch]).toEqual([expect.any(Number), true, null]);
    }
    expect(damage).toEqual([3 * 1.2, 6 * 1.2, expect.closeTo(6 * 1.2 + 6 * 1.05 * 1.2, 6)]);
    expect(a.actionFrame).toBe(THROW.frame);
    const kb = knockback({
      percent: 6 * 1.2,
      damage: THROW.hit.damage,
      kbg: THROW.hit.kbg,
      bkb: THROW.hit.bkb,
      weight: lungeTester.stats.weight,
      stale: 1.05,
      rage: 1,
    });
    expect(v.launch).toEqual({ kb, angle: THROW.hit.angle, dir: a.facing, setKnockback: false });
    runPorts(m, beastChew.faf - THROW.frame, []);
    expect(a.action).toBe('idle');
  });

  it('catch airborne fighters at full box size, where a plain grab box is halved', () => {
    for (const [fighter, caught] of [
      [lungeTester.id, true],
      [plainTester.id, false],
    ] as const) {
      const { m, a, v } = duel(40, fighter);
      runPorts(m, 1, [{ x: 100, buttons: ['special'] }, {}]);
      runPorts(m, FROM - 2, []);
      const box = beastLunge.hits[0]!.boxes[0]!;
      place(v, a.pos.x + box.x + 8, a.pos.y + 1.5, -1);
      expect(a.actionFrame).toBe(FROM - 1);
      runPorts(m, 1, []);
      expect(v.action === 'grabbed').toBe(caught);
      if (!caught) expect([v.ground, v.action]).toEqual([null, 'fall']);
    }
  });

  /** P1 side-specials in the air from (-10, y) and catches P2, placed in front of him just before the grab box. */
  function airCatch(y: number, fighter = lungeTester.id) {
    const d = duel(40, fighter);
    place(d.a, -10, y, 1);
    runPorts(d.m, 1, [{ x: 100, buttons: ['special'] }, {}]);
    expect([d.a.move, d.a.ground]).toEqual(['sideB', null]);
    runPorts(d.m, FROM - 2, []);
    place(d.v, d.a.pos.x + 14, d.a.pos.y, -1);
    runPorts(d.m, 1, []);
    expect([d.v.action, d.a.action, d.a.ground]).toEqual(['grabbed', 'grabThrow', null]);
    return d;
  }

  it('caught in the air, the throw plays on through the landing', () => {
    const { m, a, v } = airCatch(30);
    let landed = false;
    for (let i = 0; i < 200 && v.action === 'grabbed'; i++) {
      runPorts(m, 1, []);
      landed ||= a.ground !== null;
      expect(a.action).toBe('grabThrow');
    }
    expect(landed).toBe(true);
    expect(a.actionFrame).toBe(THROW.frame);
    expect(v.launch).not.toBeNull();
    runPorts(m, beastChew.faf - THROW.frame, []);
    expect(a.action).toBe('idle');
  });

  it('a throw that ends in the air ends in a fall', () => {
    const { m, a } = airCatch(150);
    for (let i = 0; i < 120 && a.action === 'grabThrow'; i++) runPorts(m, 1, []);
    expect([a.action, a.ground]).toEqual(['fall', null]);
  });

  it('an airborne throw drifts with the stick unless its move sets drift: false', () => {
    const still = {
      ...lungeTester,
      id: 'test-lunge-still',
      moves: { ...lungeTester.moves, beastChew: { ...beastChew, drift: false } },
    } satisfies typeof lungeTester;
    registerFighter(still);
    const xAfter = (fighter: string, stick: number): number => {
      const { m, a } = airCatch(150, fighter);
      runPorts(m, 20, [{ x: stick }, {}]);
      expect([a.action, a.ground]).toEqual(['grabThrow', null]);
      return a.pos.x;
    };
    expect(xAfter(lungeTester.id, 100)).toBeGreaterThan(xAfter(lungeTester.id, 0) + 1);
    expect(xAfter(still.id, 100)).toBe(xAfter(still.id, 0));
  });

  it('a lunge that hits before it catches still lands every chew, and its throw enters the stale queue itself', () => {
    const hitter = {
      ...lungeTester,
      id: 'test-lunge-hitter',
      moves: {
        ...lungeTester.moves,
        sideB: {
          ...beastLunge,
          hits: [
            {
              frames: [12, 12],
              boxes: [{ id: 0, x: 10, y: 7, radius: 5, damage: 2, angle: 0, kbg: 0, bkb: 0 }],
            },
            ...beastLunge.hits,
          ],
        },
      },
    } satisfies typeof lungeTester;
    registerFighter(hitter);
    const { m, a, v } = duel(14, hitter.id);
    runPorts(m, 1, [{ x: 100, buttons: ['special'] }, {}]);
    for (let i = 0; i < 40 && v.action !== 'grabbed'; i++) runPorts(m, 1, []);
    expect(v.action).toBe('grabbed');
    expect(v.damage).toBeCloseTo(2 * 1.05 * 1.2, 6);
    const caught = v.damage;
    for (let i = 0; i < 200 && v.action === 'grabbed'; i++) runPorts(m, 1, []);
    expect(v.damage).toBeCloseTo(caught + 2 * 3 * 1.2 + THROW.hit.damage * 1.05 * 1.2, 6);
    expect(a.staleQueue.slice(0, 2)).toEqual(['beastChew', 'sideB']);
  });
});

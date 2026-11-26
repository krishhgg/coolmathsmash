import { describe, expect, it } from 'vitest';
import { allFighters, getFighter, registerFighter } from '../fighters/registry';
import { defineFighter } from '../fighters/types';
import { getStage } from '../stages/registry';
import { FRESHNESS_BONUS, knockback, ONE_V_ONE_DAMAGE } from './combat/formulas';
import { LEDGE_ATTACK } from './constants';
import type { SimEvent } from './events';
import type { FighterState } from './fighter';
import { createMatch } from './match';
import { moveDef, SHARED_MOVES } from './sharedMoves';
import { marioReference } from './testing/reference';
import { runPorts } from './testing/sim';

/** A heavy with its own ledge attack, as Bowser's (SmashWiki "Bowser (SSBU)/Edge attack": 10% on frames 22-24). */
const heavy = defineFighter({
  ...marioReference,
  id: 'test-heavy-ledge-attack',
  selectable: false,
  moves: {
    ...marioReference.moves,
    ledgeAttack: {
      kind: 'other',
      faf: LEDGE_ATTACK.faf,
      hits: [
        {
          frames: [22, 24],
          boxes: [{ id: 0, x: 7, y: 5, radius: 5.5, damage: 10, angle: 45, kbg: 20, bkb: 90 }],
        },
      ],
    },
  },
});
registerFighter(heavy);

const LEDGE = getStage('battlefield').ledges.find((l) => l.side === -1)!;

/**
 * `fighter` (port 0) hangs from Battlefield's left ledge and presses Attack; reference Mario (port 1) stands on the
 * stage 7 units in front of where the getup ends. Returns the getup frame of each frame stepped and the hits port 0
 * landed on it, until the first hit or the getup's FAF.
 */
function ledgeAttack(fighter: string) {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter }, { fighter: marioReference.id }],
  });
  runPorts(m, 10, []);
  const [a, v] = m.fighters as [FighterState, FighterState];
  const w = getFighter(fighter).stats.width;
  const from = { x: LEDGE.x - w / 2 - 3, y: LEDGE.y + 4 };
  Object.assign(a, { pos: { ...from }, prevPos: { ...from }, vel: { x: 0, y: 0 }, ground: null });
  Object.assign(a, { action: 'fall', actionFrame: 1, jumpsUsed: 1, facing: 1 });
  const vx = LEDGE.x + w / 2 + 2 + 7;
  Object.assign(v, { pos: { x: vx, y: v.pos.y }, prevPos: { x: vx, y: v.pos.y }, facing: -1 });
  for (let i = 0; i < 120 && a.action !== 'ledgeHang'; i++) runPorts(m, 1, []);
  expect(a.action, fighter).toBe('ledgeHang');
  runPorts(m, 30, []);
  runPorts(m, 1, [{ buttons: ['attack'] }]);
  expect(a.action).toBe('ledgeAttack');
  const frames: { frame: number; hits: Extract<SimEvent, { type: 'hit' }>[] }[] = [];
  while (a.action === 'ledgeAttack') {
    runPorts(m, 1, []);
    const hits = m.events.filter(
      (e): e is Extract<SimEvent, { type: 'hit' }> => e.type === 'hit' && e.attacker === 0,
    );
    frames.push({ frame: a.actionFrame, hits });
    if (hits.length) break;
  }
  return { frames, victim: v };
}

describe('the ledge attack', () => {
  it("is Ultimate's: 9%, angle 45, BKB 90, KBG 20 on frames 24-26, the last of its intangibility, FAF 56", () => {
    const move = SHARED_MOVES.ledgeAttack!;
    expect(move.faf).toBe(LEDGE_ATTACK.faf);
    expect(move.faf).toBe(56);
    expect(move.hits).toHaveLength(1);
    expect(move.hits[0]!.frames).toEqual([24, 26]);
    expect(move.hits[0]!.frames[1]).toBe(LEDGE_ATTACK.intangible[1]);
    expect(move.hits[0]!.boxes.map((b) => [b.x, b.y, b.radius])).toEqual([
      [2, 5, 5],
      [7, 5, 5],
      [12, 5, 5],
    ]);
    for (const b of move.hits[0]!.boxes) expect(b).toMatchObject({ damage: 9, angle: 45, bkb: 90, kbg: 20 });
  });

  it('hits a fighter standing by the ledge on frame 24 of the getup and not before', () => {
    const { frames, victim } = ledgeAttack(marioReference.id);
    const hit = frames.at(-1)!;
    expect(hit.frame).toBe(24);
    expect(frames.slice(0, -1).every((f) => f.hits.length === 0)).toBe(true);
    expect(hit.hits).toHaveLength(1);
    const e = hit.hits[0]!;
    expect(e.move).toBe('ledgeAttack');
    expect(e.damage).toBeCloseTo(9 * FRESHNESS_BONUS * ONE_V_ONE_DAMAGE, 9);
    expect(victim.damage).toBeCloseTo(9 * FRESHNESS_BONUS * ONE_V_ONE_DAMAGE, 9);
    const kb = knockback({
      percent: 0,
      damage: 9,
      kbg: 20,
      bkb: 90,
      weight: marioReference.stats.weight,
      stale: FRESHNESS_BONUS,
      rage: 1,
    });
    expect(e.kb).toBeCloseTo(kb, 9);
  });

  const shared = Object.keys(allFighters())
    .filter((id) => !allFighters()[id]!.moves?.ledgeAttack)
    .sort();

  it.each(shared)('lands for %s on frame 24 with the shared hit', (id) => {
    const hit = ledgeAttack(id).frames.at(-1)!;
    expect(hit.frame).toBe(24);
    expect(hit.hits.map((e) => e.move)).toEqual(['ledgeAttack']);
    expect(hit.hits[0]!.damage).toBeCloseTo(9 * FRESHNESS_BONUS * ONE_V_ONE_DAMAGE, 9);
  });

  it("plays a fighter's own ledgeAttack move instead of the shared one", () => {
    expect(moveDef(heavy, 'ledgeAttack')).toBe(heavy.moves.ledgeAttack);
    expect(moveDef(marioReference, 'ledgeAttack')).toBe(SHARED_MOVES.ledgeAttack);
    const hit = ledgeAttack(heavy.id).frames.at(-1)!;
    expect(hit.frame).toBe(22);
    expect(hit.hits[0]!.damage).toBeCloseTo(10 * FRESHNESS_BONUS * ONE_V_ONE_DAMAGE, 9);
  });
});

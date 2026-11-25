import { describe, expect, it } from 'vitest';
import { PARRY, SHIELD_REGEN } from '../constants';
import type { SimEvent } from '../events';
import type { FighterState } from '../fighter';
import { createMatch, type MatchState } from '../match';
import { attack, runPorts, testMatch } from '../testing/sim';
import { hitlagFrames } from './formulas';

/** `probe` (12% fresh, x1.05) freezes both fighters this long on a normal hit or shield hit. */
const LAG = hitlagFrames(12 * 1.05);

function of<T extends SimEvent['type']>(m: MatchState, type: T): Extract<SimEvent, { type: T }>[] {
  return m.events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}

/** Two reference fighters standing on Battlefield's main stage, P1 at -10 facing P2 at -3. */
function duel(): { m: MatchState; a: FighterState; v: FighterState } {
  const m = testMatch({ players: 2 });
  const [a, v] = m.fighters as [FighterState, FighterState];
  for (const [f, x, facing] of [
    [a, -10, 1],
    [v, -3, -1],
  ] as const) {
    Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, vel: { x: 0, y: 0 }, kb: { x: 0, y: 0 } });
    Object.assign(f, { facing, action: 'idle', actionFrame: 1 });
  }
  return { m, a, v };
}

/** P2 holds shield for 5 frames, lets go, and P1's probe connects on frame `k` of the shield drop. */
function hitOnDropFrame(k: number): { m: MatchState; a: FighterState; v: FighterState; hp: number } {
  const { m, a, v } = duel();
  runPorts(m, 5, [{}, { buttons: ['shield'] }]);
  expect(v.action).toBe('shield');
  for (let i = 1; i < k; i++) runPorts(m, 1, [{}, {}]);
  if (k > 1) expect([v.action, v.actionFrame]).toEqual(['shieldDrop', k - 1]);
  const hp = v.shieldHp;
  attack(m, 0, 'probe');
  runPorts(m, 1, [{}, {}]);
  return { m, a, v, hp };
}

describe('parry (perfect shield)', () => {
  it(`parries a hit on drop frame 1 and on the last parry frame, ${PARRY.window}`, () => {
    for (const k of [1, PARRY.window]) {
      const { m, a, v, hp } = hitOnDropFrame(k);
      expect(of(m, 'parry')).toEqual([
        { type: 'parry', attacker: 0, victim: 1, move: 'probe', x: a.pos.x + 8, y: 8 },
      ]);
      expect(of(m, 'shieldHit')).toEqual([]);
      expect(of(m, 'hit')).toEqual([]);
      expect(v.damage).toBe(0);
      expect(v.shieldHp).toBeCloseTo(hp + SHIELD_REGEN, 9);
      expect(v.hitstun).toBe(0);
      expect(v.launch).toBeNull();
      expect(a.hitlag).toBe(LAG + 14);
      expect(v.hitlag).toBe(LAG + 11);
      expect(v.action).toBe('idle');
    }
  });

  it(`drop frame ${PARRY.window + 1}, the first frame after the window, takes the hit`, () => {
    const { m, a, v } = hitOnDropFrame(PARRY.window + 1);
    expect(of(m, 'parry')).toEqual([]);
    expect(of(m, 'hit')).toHaveLength(1);
    expect(v.damage).toBeGreaterThan(0);
    expect(v.launch).not.toBeNull();
    expect(a.hitlag).toBe(LAG);
    expect(v.hitlag).toBe(LAG);
  });

  it('leaves the defender free to act 3 frames before the attacker', () => {
    const { m, a, v } = hitOnDropFrame(1);
    runPorts(m, v.hitlag, [{}, {}]);
    expect([v.hitlag, a.hitlag]).toEqual([0, 3]);
    runPorts(m, 1, [{}, { buttons: ['jump'] }]);
    expect(v.action).toBe('jumpSquat');
    expect(a.hitlag).toBe(2);
  });

  it('caps both freezes at 30 frames', () => {
    const { m, a, v } = duel();
    runPorts(m, 5, [{}, { buttons: ['shield'] }]);
    attack(m, 0, 'probe');
    a.moveStale = 2; // a 24% probe: 21 frames of hitlag, +14 and +11 would both pass 30
    expect(hitlagFrames(24)).toBe(21);
    runPorts(m, 1, [{}, {}]);
    expect(of(m, 'parry')).toHaveLength(1);
    expect(a.hitlag).toBe(30);
    expect(v.hitlag).toBe(30);
  });

  /**
   * P2 shields P1's probe and keeps holding through shieldstun, holds the shield `hold` frames, then lets go as a
   * second probe arrives on drop frame 1. Returns whether that second probe was parried.
   */
  function parriesAfterShieldstun(hold: number): boolean {
    const { m, a, v } = duel();
    runPorts(m, 5, [{}, { buttons: ['shield'] }]);
    attack(m, 0, 'probe');
    runPorts(m, 1, [{}, { buttons: ['shield'] }]);
    expect(v.action).toBe('shieldStun');
    while (v.action === 'shieldStun') runPorts(m, 1, [{}, { buttons: ['shield'] }]);
    expect([v.action, v.actionFrame]).toEqual(['shield', 1]);
    runPorts(m, hold - 2, [{}, { buttons: ['shield'] }]);
    for (const [f, x] of [
      [a, -10],
      [v, -3],
    ] as const)
      Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, kb: { x: 0, y: 0 }, hitlag: 0 });
    attack(m, 0, 'probe');
    runPorts(m, 1, [{}, {}]);
    expect(of(m, 'parry').length + of(m, 'hit').length).toBe(1);
    return of(m, 'parry').length === 1;
  }

  it(`can't parry with a drop starting less than ${PARRY.lockout} frames after shieldstun ends`, () => {
    // The shield comes back on the frame shieldstun ends; held 3 frames (the minimum), its drop starts 2 frames later.
    expect(parriesAfterShieldstun(3)).toBe(false);
    expect(parriesAfterShieldstun(4)).toBe(true);
  });

  it("parries an entity's hit: the owner doesn't freeze and the defender freezes 1 frame less", () => {
    /** Fireboy's fireball flies at P2, who is on shield drop frame 1 whenever it arrives (or standing, if not `drop`). */
    const fireball = (drop: boolean) => {
      const m = createMatch({
        seed: 1,
        stage: 'battlefield',
        stocks: 3,
        ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }],
      });
      m.fighters.forEach((f, i) => {
        const x = i === 0 ? -30 : 0;
        Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, facing: i === 0 ? 1 : -1, intangible: 0 });
      });
      runPorts(m, 20, [{}, {}]);
      const [a, v] = m.fighters as [FighterState, FighterState];
      runPorts(m, 1, [{ buttons: ['special'] }, {}]);
      for (let i = 0; i < 90 && m.events.every((e) => e.type !== 'hit' && e.type !== 'parry'); i++) {
        if (drop) Object.assign(v, { action: 'shieldDrop', actionFrame: 0 });
        runPorts(m, 1, [{}, {}]);
      }
      return { m, a, v };
    };
    const normal = fireball(false);
    const [hit] = of(normal.m, 'hit');
    expect(hit).toBeDefined();
    const parried = fireball(true);
    expect(of(parried.m, 'parry')).toMatchObject([{ attacker: 0, entity: 1, victim: 1, move: 'neutralB' }]);
    expect(of(parried.m, 'entityDestroy')).toMatchObject([{ id: 1, reason: 'hit' }]);
    expect(parried.v.damage).toBe(0);
    expect(parried.a.hitlag).toBe(0);
    expect(parried.v.hitlag).toBe(hit!.hitlag - 1);
  });
});

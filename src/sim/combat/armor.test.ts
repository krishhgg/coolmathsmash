import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { defineFighter } from '../../fighters/types';
import type { FighterState } from '../fighter';
import { createMatch, type MatchState } from '../match';
import { marioReference } from '../testing/reference';
import { attack, runPorts } from '../testing/sim';
import { knockback } from './formulas';

/**
 * The Mario reference with armored moves (heavy armor on frames 1-30, armor that holds below 100 knockback, and armor
 * that holds against hits under 12%, plus copies of the last two whose breaking hit deals half damage), its 2.5% jab
 * and a standing grab.
 */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'test-armor',
    name: 'Test armor',
    moves: {
      brace: { kind: 'other', faf: 50, hits: [], armor: { frames: [1, 30] } },
      tough: { kind: 'other', faf: 50, hits: [], armor: { frames: [1, 30], threshold: 100 } },
      stone: { kind: 'other', faf: 50, hits: [], armor: { frames: [1, 30], damageThreshold: 12 } },
      toughHalf: {
        kind: 'other',
        faf: 50,
        hits: [],
        armor: { frames: [1, 30], threshold: 100, breakDamageMul: 0.5 },
      },
      stoneHalf: {
        kind: 'other',
        faf: 50,
        hits: [],
        armor: { frames: [1, 30], damageThreshold: 12, breakDamageMul: 0.5 },
      },
      jab: marioReference.moves.jab,
      grab: {
        kind: 'other',
        faf: 35,
        hits: [
          {
            frames: [6, 7],
            boxes: [{ id: 0, x: 7.5, y: 7, radius: 4.5, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true }],
          },
        ],
      },
    },
  }),
);

/** The probe hit: the Mario reference's 12% move (angle 45, kbg 100, bkb 30). */
const probe = marioReference.moves.probe.hits[0]!.boxes[0]!;

/** The attacker (P1, Mario by default) facing the armored fighter (P2) 8 units in front, both standing; P2 at percent. */
function duel(
  percent: number,
  attacker = marioReference.id,
): { m: MatchState; a: FighterState; v: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: attacker }, { fighter: 'test-armor' }],
  });
  runPorts(m, 10, [{}, {}]);
  const [a, v] = m.fighters as [FighterState, FighterState];
  for (const [f, x, facing] of [
    [a, -10, 1],
    [v, -2, -1],
  ] as const)
    Object.assign(f, {
      pos: { x, y: 0 },
      prevPos: { x, y: 0 },
      vel: { x: 0, y: 0 },
      facing,
      ground: a.ground,
    });
  v.damage = percent;
  return { m, a, v };
}

/** P2 starts move, P1 probes on P2's frame at; returns both after the hit's frame. */
function probed(move: string, percent: number, at = 1) {
  const d = duel(percent);
  attack(d.m, 1, move);
  runPorts(d.m, at - 1, [{}, {}]);
  attack(d.m, 0, 'probe');
  runPorts(d.m, 1, [{}, {}]);
  return d;
}

describe('armor (MoveDef.armor)', () => {
  it('heavy armor takes the damage and the hitlag but is not launched and keeps playing its move', () => {
    const { m, v } = probed('brace', 100);
    expect(v.damage).toBeCloseTo(100 + probe.damage * 1.05 * 1.2, 6);
    expect(v.hitlag).toBeGreaterThan(0);
    expect(v.launch).toBeNull();
    expect(v.hitstun).toBe(0);
    expect([v.action, v.move]).toEqual(['attack', 'brace']);
    const x = v.pos.x;
    for (let i = 0; i < 80 && v.action === 'attack'; i++) runPorts(m, 1, [{}, {}]);
    expect(v.action).toBe('idle');
    expect(v.pos.x).toBeCloseTo(x, 6);
  });

  it('a hit after the armor frames launches as usual', () => {
    const { v } = probed('brace', 100, 31);
    expect(v.launch).not.toBeNull();
    expect(v.action).toBe('tumble');
  });

  it('threshold armor holds below its knockback threshold and breaks above it', () => {
    const kbAt = (percent: number) =>
      knockback({ percent, damage: probe.damage, kbg: probe.kbg, bkb: probe.bkb, weight: 98, stale: 1.05 });
    expect(kbAt(20)).toBeLessThan(100);
    expect(kbAt(120)).toBeGreaterThan(100);
    const low = probed('tough', 20).v;
    expect([low.action, low.launch]).toEqual(['attack', null]);
    const high = probed('tough', 120).v;
    expect(high.action).toBe('tumble');
  });

  it('damage-threshold armor holds against weaker hits and breaks on one that deals the threshold', () => {
    const weak = duel(0, 'test-armor');
    const before = weak.v.damage;
    attack(weak.m, 1, 'stone');
    attack(weak.m, 0, 'jab');
    runPorts(weak.m, 3, [{}, {}]);
    expect(weak.v.damage).toBeGreaterThan(before);
    expect([weak.v.action, weak.v.launch]).toEqual(['attack', null]);
    const strong = probed('stone', 0).v;
    expect(probe.damage * 1.05).toBeGreaterThanOrEqual(12);
    expect(strong.launch).not.toBeNull();
  });

  it("a breaking hit adds breakDamageMul of its damage, at full knockback and hitlag (Kirby's Stone: 0.5)", () => {
    const full = probed('stone', 0);
    const half = probed('stoneHalf', 0);
    expect(full.v.damage).toBeCloseTo(probe.damage * 1.05 * 1.2, 6);
    expect(half.v.damage).toBeCloseTo(probe.damage * 1.05 * 0.5 * 1.2, 6);
    expect(half.v.launch).not.toBeNull();
    expect(half.v.launch).toEqual(full.v.launch);
    expect(half.v.hitlag).toBe(full.v.hitlag);
    expect(half.v.action).toBe(full.v.action);
    const added = half.m.events.find((e) => e.type === 'hit')!;
    expect(added).toMatchObject({ damage: half.v.damage, kb: full.v.launch!.kb });
  });

  it('hits the armor holds add their full damage with breakDamageMul set', () => {
    const jabbed = (move: string) => {
      const { m, v } = duel(0, 'test-armor');
      attack(m, 1, move);
      attack(m, 0, 'jab');
      runPorts(m, 3, [{}, {}]);
      expect([v.action, v.move, v.launch]).toEqual(['attack', move, null]);
      return v.damage;
    };
    const jab = marioReference.moves.jab.hits[0]!.boxes[0]!;
    expect(jabbed('stoneHalf')).toBeCloseTo(jab.damage * 1.05 * 1.2, 6);
    expect(jabbed('stoneHalf')).toBe(jabbed('stone'));
  });

  it('breakDamageMul also halves a hit that breaks knockback-threshold armor', () => {
    const { v } = probed('toughHalf', 120);
    expect(v.action).toBe('tumble');
    expect(v.damage).toBeCloseTo(120 + probe.damage * 1.05 * 0.5 * 1.2, 6);
    const low = probed('toughHalf', 20).v;
    expect([low.action, low.launch]).toEqual(['attack', null]);
    expect(low.damage).toBeCloseTo(20 + probe.damage * 1.05 * 1.2, 6);
  });

  it('does not stop a grab', () => {
    const { m, a, v } = duel(0, 'test-armor');
    attack(m, 1, 'brace');
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    runPorts(m, 8, [{}, {}]);
    expect(a.action).toBe('grabHold');
    expect(v.action).toBe('grabbed');
  });
});

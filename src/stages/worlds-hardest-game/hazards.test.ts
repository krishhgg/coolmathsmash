import { describe, expect, it } from 'vitest';
import { stageHitboxesAt } from '../../sim/hazards';
import { createMatch } from '../../sim/match';
import { marioReference } from '../../sim/testing/reference';
import { placeInAir, run, until } from '../../sim/testing/sim';
import { DECK, stage } from './geometry';
import { PATROLS } from './hazards';

function match(hazards: boolean) {
  return createMatch({
    seed: 1,
    stage: stage.id,
    stocks: 3,
    hazards,
    ports: [{ fighter: marioReference.id }],
  });
}

describe("World's Hardest Stage patrols", () => {
  it('keeps the two lanes and two opposing orbits inside the checkerboard ends', () => {
    expect(stage.hitboxes).toHaveLength(4);
    const limits = [Infinity, Infinity, -Infinity, -Infinity];
    for (let frame = 0; frame < 230; frame++) {
      const [low, high, a, b] = PATROLS.map((p) => stageHitboxesAt(p, frame)[0]!);
      expect(low!.y).toBe(10);
      expect(high!.y).toBe(40);
      expect(Math.hypot(a!.x, a!.y - 35)).toBeCloseTo(30);
      expect(a!.x + b!.x).toBeCloseTo(0);
      expect(a!.y + b!.y).toBeCloseTo(70);
      for (const p of [low!, high!, a!, b!])
        expect(Math.abs(p.x) + p.box.radius).toBeLessThan(DECK.right - DECK.safeWidth);
      limits[0] = Math.min(limits[0]!, low!.x);
      limits[1] = Math.min(limits[1]!, high!.x);
      limits[2] = Math.max(limits[2]!, low!.x);
      limits[3] = Math.max(limits[3]!, high!.x);
    }
    expect(limits).toEqual([-48, -48, 48, 48]);
  });

  it('leaves all four green spawns safe even with the widest fighter on every port', () => {
    const m = createMatch({
      seed: 1,
      stage: stage.id,
      stocks: 3,
      hazards: true,
      ports: stage.spawns.map(() => ({ fighter: 'wheely' })),
    });
    run(m, 230);
    expect(m.fighters.map((f) => [f.pos.x, f.damage, f.stocks])).toEqual(
      stage.spawns.map(([x]) => [x, 0, 3]),
    );
  });

  it.each(PATROLS.map((p, i) => [i, p] as const))(
    'patrol %i hits for 7%% with the same launch at 0%% and 120%%',
    (index, patrol) => {
      const [at] = stageHitboxesAt(patrol, 1);
      const knockbacks = [0, 120].map((damage) => {
        const m = match(true);
        const f = placeInAir(m, at!.x, at!.y - 7);
        f.damage = damage;
        run(m, 1);
        expect(m.events).toContainEqual(
          expect.objectContaining({ type: 'stageHit', victim: 0, index, damage: 7 }),
        );
        expect(f.damage).toBe(damage + 7);
        expect(f.launch?.setKnockback).toBe(true);
        return f.launch!.kb;
      });
      expect(knockbacks[0]).toBeGreaterThan(0);
      expect(knockbacks[0]).toBeCloseTo(knockbacks[1]!);
    },
  );

  it('disables contact damage and restores the two platforms with hazards off', () => {
    const m = match(false);
    const [at] = stageHitboxesAt(PATROLS[0]!, 1);
    const f = placeInAir(m, at!.x, at!.y - 7);
    run(m, 1);
    expect(m.events.some((e) => e.type === 'stageHit')).toBe(false);
    expect(f.damage).toBe(0);
    expect(m.stage.platforms.map((p) => p.on)).toEqual([true, true]);
  });

  it('falls to the deck in the hazards-on form instead of landing on a hidden platform', () => {
    const m = match(true);
    const f = placeInAir(m, 42, 30);
    f.stageHitLock = 60;
    expect(m.stage.platforms.map((p) => p.on)).toEqual([false, false]);
    until(m, (g) => g.ground !== null, {}, 60);
    expect(f.ground).toEqual({ kind: 'solid', index: 0 });
    expect(f.pos.y).toBe(DECK.top);
  });
});

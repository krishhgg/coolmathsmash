import { describe, expect, it } from 'vitest';
import { hashState } from '../../engine/hash';
import { createMatch } from '../../sim/match';
import { motionOffset, scheduledOn } from '../../sim/movingStage';
import { marioReference } from '../../sim/testing/reference';
import { run } from '../../sim/testing/sim';
import { stage } from './geometry';
import { BELT_SPEED, ONION_ENTRY, ONION_PERIOD, rollingOnion } from './hazards';

function match(hazards: boolean) {
  return createMatch({
    seed: 1,
    stage: stage.id,
    stocks: 3,
    hazards,
    ports: [{ fighter: marioReference.id }],
  });
}

describe("Papa's Pizzeria hazards", () => {
  it('drifts riders right by 0.35 units per frame only with hazards on', () => {
    for (const hazards of [true, false]) {
      const m = match(hazards);
      run(m, 10);
      const f = m.fighters[0]!;
      const { x } = f.pos;
      expect(f.ground?.kind).toBe('solid');
      run(m, 20);
      expect(f.pos.x - x).toBeCloseTo(hazards ? 20 * BELT_SPEED : 0);
    }
  });

  it('brings the onion onto the belt every 22 seconds after the initial 20-second wait', () => {
    expect(scheduledOn(rollingOnion.schedule, ONION_ENTRY - 1)).toBe(false);
    expect(scheduledOn(rollingOnion.schedule, ONION_ENTRY)).toBe(true);
    expect(scheduledOn(rollingOnion.schedule, ONION_PERIOD - 1)).toBe(true);
    expect(scheduledOn(rollingOnion.schedule, ONION_PERIOD)).toBe(false);
    const [dx, dy] = motionOffset(rollingOnion.motion, ONION_PERIOD - 1);
    expect(rollingOnion.x + dx).toBeGreaterThan(stage.ledges[1]!.x);
    expect(rollingOnion.y + dy).toBeLessThan(0);
    expect(motionOffset(rollingOnion.motion, ONION_ENTRY + 45 + ONION_PERIOD)).toEqual(
      motionOffset(rollingOnion.motion, ONION_ENTRY + 45),
    );
  });

  it('lands one repeatable 8% hit per pass and never hits with hazards off', () => {
    const play = (hazards: boolean) => {
      const m = match(hazards);
      run(m, 10);
      m.frame = ONION_ENTRY;
      let hits = 0;
      for (let i = 0; i < 66; i++) {
        run(m, 1);
        hits += m.events.filter((e) => e.type === 'stageHit').length;
      }
      return { hits, damage: m.fighters[0]!.damage, hash: hashState(m) };
    };
    const first = play(true);
    expect(first).toMatchObject({ hits: 1, damage: 8 });
    expect(play(true)).toEqual(first);
    expect(play(false)).toMatchObject({ hits: 0, damage: 0 });
  });
});

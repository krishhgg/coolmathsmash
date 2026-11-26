import { describe, expect, it } from 'vitest';
import { clipFor } from '../../../render/fighterView';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { activeHitboxes } from '../../../sim/combat/hits';
import type { FighterState } from '../../../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../../../sim/match';
import { marioReference } from '../../../sim/testing/reference';
import { input, type Hold } from '../../../sim/testing/sim';
import { registerFighter } from '../../registry';
import { fighter } from '..';
import { FULL_THROTTLE, THROTTLE_BOXES } from '../finalSmashData';
import { art } from '.';

registerFighter(marioReference);

/** The art with only the bow wave's slot, to measure its drawing. */
const waveOnly = { ...art, rig: { ...art.rig, slots: art.rig.slots.filter((s) => s.name === 'fx2') } };

function step(m: MatchState, holds: Hold[] = []): void {
  stepMatch(
    m,
    m.players.map((p) => input(holds[p.port])),
  );
}

/** Wheely facing `facing`, on the floor or 40 up, with the Mario reference far behind him; fires Full Throttle. */
function fire(facing: 1 | -1, air: boolean): { m: MatchState; a: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: 'wheely' }, { fighter: marioReference.id }],
  });
  const [a, v] = m.fighters as [FighterState, FighterState];
  for (const [f, x] of [
    [a, -60 * facing],
    [v, 78 * facing * -1],
  ] as const)
    Object.assign(f, {
      pos: { x, y: 1 },
      prevPos: { x, y: 1 },
      vel: { x: 0, y: 0 },
      ground: null,
      action: 'fall',
    });
  for (let i = 0; i < 30; i++) step(m);
  Object.assign(a, { facing, finalReady: true });
  if (air) Object.assign(a, { pos: { x: a.pos.x, y: 40 }, prevPos: { x: a.pos.x, y: 40 }, ground: null });
  step(m, [{ buttons: ['special'] }]);
  return { m, a };
}

describe('Full Throttle art', () => {
  it.each([
    [1, false],
    [-1, false],
    [1, true],
    [-1, true],
  ] as const)(
    'draws the bow wave out to the front edge of the box on each frame it is out (facing %s, in the air: %s)',
    (facing, air) => {
      const { m, a } = fire(facing, air);
      expect(a.move).toBe(air ? 'finalSmashAir' : 'finalSmash');
      const seen: number[] = [];
      while (a.actionFrame < FULL_THROTTLE.hit[1]) {
        step(m);
        const box = THROTTLE_BOXES.find((b) => b.frame === a.actionFrame);
        const [h] = activeHitboxes(a);
        if (!box) {
          expect(h, `frame ${a.actionFrame}`).toBeUndefined();
          continue;
        }
        expect(h!.box.radius).toBe(box.radius);
        const boxFront = h!.x + facing * h!.box.radius;
        const [clip, frame] = clipFor(fighter, art, a);
        const pose = samplePose(art, clip, frame, m.frame);
        expect([clip, pose.symbols.fx2]).toEqual([a.move, 'fxBoom']);
        const waveFront = a.pos.x + facing * poseBounds(waveOnly, pose)[2];
        expect(Math.abs(waveFront - boxFront), `frame ${a.actionFrame}`).toBeLessThanOrEqual(1.5);
        seen.push(a.actionFrame);
      }
      expect(seen).toEqual(THROTTLE_BOXES.map((b) => b.frame));
    },
  );
});

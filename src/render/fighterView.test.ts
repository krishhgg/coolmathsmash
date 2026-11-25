import { describe, expect, it } from 'vitest';
import { FIGHTERS, getFighter } from '../fighters/registry';
import { GETUP_ROLL, SHIELD_MAX, TECH_ROLL } from '../sim/constants';
import { createFighter } from '../sim/fighter';
import { clipFor, fighterArt, shieldRadius } from './fighterView';

describe('shieldRadius', () => {
  const fireboy = getFighter('fireboy');

  it('shrinks from full size to 15% as the shield empties', () => {
    expect(shieldRadius(fireboy, SHIELD_MAX)).toBeCloseTo(fireboy.stats.shieldSize);
    expect(shieldRadius(fireboy, 0)).toBeCloseTo(fireboy.stats.shieldSize * 0.15);
  });

  it('never goes negative when shield HP overshoots below zero during hitlag', () => {
    expect(shieldRadius(fireboy, -SHIELD_MAX)).toBe(0);
  });
});

describe('clipFor on tech and getup rolls', () => {
  /** Tech roll is entered on the touchdown frame (0), getup roll on frame 1; both end on FAF - 1. */
  const ROLLS = [
    ['techRoll', TECH_ROLL, 0],
    ['getupRoll', GETUP_ROLL, 1],
  ] as const;
  const rolling = Object.values(FIGHTERS).filter((def) => fighterArt(def)?.clips.techRoll);

  /** The clip and clip frames that draw `action` from its first frame to its last, rolling `dir` times the facing. */
  function drawn(id: string, action: string, first: number, faf: number, facing: 1 | -1, dir: 1 | -1) {
    const def = FIGHTERS[id]!;
    const f = createFighter(0, id, [0, 0, facing], 3);
    Object.assign(f, { action, move: null, dodgeDir: { x: dir * facing, y: 0 } });
    const names = new Set<string>();
    const frames: number[] = [];
    for (let n = first; n < faf; n++) {
      f.actionFrame = n;
      const [name, frame] = clipFor(def, fighterArt(def)!, f);
      names.add(name);
      frames.push(frame);
    }
    expect(names.size, `${id} ${action}`).toBe(1);
    return { name: [...names][0]!, frames };
  }

  it('covers every fighter with art except those with no roll clips', () => {
    const without = Object.values(FIGHTERS).filter((def) => fighterArt(def) && !rolling.includes(def));
    for (const def of without) expect(fighterArt(def)!.clips.rollBack, def.id).toBeUndefined();
    expect(rolling.length).toBeGreaterThanOrEqual(9);
  });

  for (const def of rolling) {
    const clips = fighterArt(def)!.clips;
    for (const [action, timing, first] of ROLLS) {
      it(`${def.id} draws a backward ${action} with a back roll`, () => {
        for (const facing of [1, -1] as const) {
          const back = drawn(def.id, action, first, timing.faf, facing, -1).name;
          const forward = drawn(def.id, action, first, timing.faf, facing, 1).name;
          expect([`${action}Back`, 'rollBack'], `${def.id} facing ${facing}`).toContain(back);
          expect([action, 'techRoll'], `${def.id} facing ${facing}`).toContain(forward);
        }
      });

      it(`${def.id} plays each ${action} clip to its end on the action's last frame`, () => {
        for (const dir of [1, -1] as const) {
          const { name, frames } = drawn(def.id, action, first, timing.faf, 1, dir);
          const length = clips[name]!.length;
          const label = `${def.id} ${action} -> ${name}`;
          expect(frames.at(-1), label).toBe(length);
          expect(frames.at(-2)!, label).toBeLessThan(length);
          expect(frames[0]!, label).toBeGreaterThanOrEqual(0);
          frames.forEach(
            (fr, i) => i && expect(fr, `${label} @${i + first}`).toBeGreaterThanOrEqual(frames[i - 1]!),
          );
        }
      });
    }
  }
});

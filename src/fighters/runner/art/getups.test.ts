import { describe, expect, it } from 'vitest';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { art } from '.';

/** How far a drawn part may reach below the floor (rig y 0), as in her getup attack test and Fireboy's rolls. */
const SINK = 0.2;

/** How far her lowest drawn part may rise off the floor, as in Johnny's tech and getup test. */
const LIFT = 0.35;

/**
 * The rolls, with the way each one turns: the tech and getup rolls, their back rolls (drawn when the roll goes
 * away from her facing, built from `rollBack`), and the two dodge rolls they share the ball with.
 */
const ROLLS: [string, 1 | -1][] = [
  ['techRoll', 1],
  ['getupRoll', 1],
  ['techRollBack', -1],
  ['getupRollBack', -1],
  ['rollForward', 1],
  ['rollBack', -1],
];

describe("runner's lying down, techs and getups", () => {
  it('keeps her on the floor in every frame, never sinking into it or lifting off', () => {
    const off: string[] = [];
    for (const name of ['down', 'getupStand', 'techInPlace', ...ROLLS.map(([name]) => name)])
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const bottom = poseBounds(art, samplePose(art, name, f, f))[3];
        if (bottom > SINK || bottom < -LIFT) off.push(`${name}@${f} ${bottom.toFixed(2)}`);
      }
    expect(off).toEqual([]);
  });

  it('lies with her body resting on the floor, breathing included', () => {
    for (let f = 0; f <= art.clips.down!.length; f++)
      expect(Math.abs(poseBounds(art, samplePose(art, 'down', f, f))[3]), `down@${f}`).toBeLessThan(0.05);
  });

  it('turns each roll one way from the ball to her stance, never spinning back', () => {
    // Settling into her stance's 6 degree lean may turn her back a degree or two a frame; a spin back is far more.
    for (const [name, dir] of ROLLS) {
      const turned = (f: number) => samplePose(art, name, f, f).local.body!.rot;
      for (let f = 5; f <= art.clips[name]!.length; f++)
        expect(dir * (turned(f) - turned(f - 1)), `${name}@${f}`).toBeGreaterThan(-10);
    }
  });
});

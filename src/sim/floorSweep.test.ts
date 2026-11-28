import { describe, expect, it } from 'vitest';
import { createMatch, type MatchState } from './match';
import { marioReference } from './testing/reference';
import { placeInAir, run } from './testing/sim';

function on(stage: string, fighter: string): MatchState {
  const m = createMatch({ seed: 1, stage, stocks: 3, hazards: false, ports: [{ fighter }] });
  run(m, 10);
  return m;
}

/** Forest Temple's slopes, from the dip's floor (y -6) at x 5 up to the main floor (y 0) at x 12, and mirrored. */
const slopeY = (x: number) => -6 + ((Math.abs(x) - 5) * 6) / 7;

describe('falling past the top of a slope, where it meets the main floor', () => {
  // In Wheely's level 9 match against Red Ball (seed 4), a falling neutral air took him in one frame from just above
  // the dip's left slope, near its top, to under the main floor past it: (-11.49, -0.40) to (-12.32, -1.85). Neither
  // floor held that step's end above and below it, so he went on down inside the stage and out of its bottom.
  it.each([
    ['wheely', -1],
    ['wheely', 1],
    [marioReference.id, -1],
    [marioReference.id, 1],
  ] as const)('lands %s on the slope, not inside the ground (side %d)', (fighter, side) => {
    const m = on('forest-temple', fighter);
    const f = placeInAir(m, side * 11.49, -0.4, side === -1 ? -1 : 1);
    f.vel = { x: side * 0.83, y: -1.44 };
    run(m, 1);
    expect(f.ground?.kind).toBe('solid');
    expect(Math.abs(f.pos.x)).toBeGreaterThan(5);
    expect(Math.abs(f.pos.x)).toBeLessThanOrEqual(12);
    expect(f.pos.y).toBeCloseTo(slopeY(f.pos.x), 6);
    run(m, 30);
    expect(f.stocks).toBe(3);
    expect(f.pos.y).toBeGreaterThanOrEqual(slopeY(Math.min(Math.abs(f.pos.x), 12)) - 1e-6);
  });

  it('still lets a straight fall past a ledge corner go straight down', () => {
    // Battlefield's right ledge is at x 80. Falling at 0.5 past it, the fighter's x stays outside the floor.
    const m = on('battlefield', marioReference.id);
    const f = placeInAir(m, 80.5, 3);
    f.vel = { x: 0, y: -1.5 };
    run(m, 10);
    expect(f.ground).toBeNull();
    expect(f.pos.x).toBeGreaterThanOrEqual(80.5 - 1e-6);
    expect(f.pos.y).toBeLessThan(-5);
  });

  it("still drops a fall past the top of Johnny's Upgrade Boss step onto the lower floor", () => {
    // The main floor runs at y 0 to x 28.33, then a wall drops to the lower floor at y -6.
    const m = on('johnny-upgrade-boss', marioReference.id);
    const f = placeInAir(m, 27.8, 1);
    f.vel = { x: 1, y: -1.5 };
    run(m, 10);
    expect(f.ground?.kind).toBe('solid');
    expect(f.pos.x).toBeGreaterThan(28.33);
    expect(f.pos.y).toBeCloseTo(-6, 6);
  });

  it.each(['wheely', marioReference.id])(
    "doesn't put %s back on the upper floor of Johnny's Upgrade Boss step when its path dips below it just inside its end",
    (fighter) => {
      // The upper and lower floors are one solid, but a wall joins them: they don't meet at the same height. This frame
      // is one sub-step from (27.8, 0.2) to about (28.8, -1.3), crossing the upper floor's line at x 27.93, inside its
      // end at x 28.33. As on main, the fighter isn't landed there but goes on down to the lower floor.
      const m = on('johnny-upgrade-boss', fighter);
      const f = placeInAir(m, 27.8, 0.2);
      f.vel = { x: 1, y: -1.5 };
      run(m, 1);
      expect(f.ground).toBeNull();
      expect(f.pos.x).toBeGreaterThan(28.33);
      run(m, 10);
      expect(f.ground?.kind).toBe('solid');
      expect(f.pos.y).toBeCloseTo(-6, 6);
    },
  );
});

import { describe, expect, it } from 'vitest';
import { neutralInput, type InputFrame } from '../input/types';
import type { FighterState } from './fighter';
import { createMatch, stepMatch, type MatchState } from './match';

/**
 * A fall past a ledge corner. The corner pushes the collision box's slanted lower side out from the wall
 * (pushOffCorner in movement.ts). It used to take off only the part of the speed along that side's normal, which
 * turned a straight fall into speed away from the stage. A fall the fighter keeps re-setting built it up frame after
 * frame: Snail Bob's down air from over Battlefield's left ledge (#328's bench, seed 17 against Bloxorz) left at 2.7
 * units a frame and was KO'd, and a fast-falling Wheely left at 3.5. Now the push stops sideways speed into the corner,
 * as a wall does, and leaves the rest, so the fighter falls straight down beside the wall.
 */

/** Battlefield's ledges are at x -80 and 80, y 0. */
const LEDGE = 80;

/** `fighter` in the air at (side * x, y) on Battlefield, moving `vx` across (out from the stage when positive). */
function inAir(fighter: string, side: 1 | -1, x: number, y: number, vx: number, fastFalling = false) {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter }, { fighter: 'fireboy' }],
  });
  for (let i = 0; i < 10; i++) stepMatch(m, [neutralInput(), neutralInput()]);
  Object.assign(m.fighters[1]!, { pos: { x: -side * 60, y: 0 }, prevPos: { x: -side * 60, y: 0 } });
  const f = m.fighters[0]!;
  Object.assign(f, {
    pos: { x: side * x, y },
    prevPos: { x: side * x, y },
    vel: { x: side * vx, y: 0 },
    ground: null,
    action: 'fall',
    actionFrame: 1,
    facing: side,
    jumpsUsed: 2,
    airDodgeUsed: true,
    fastFalling,
    // No ledge grab, so the fall goes on past the corner.
    ledgeLock: 999,
  });
  return { m, f };
}

/** Step `frames` frames with `input` for port 0 on the first, nothing after; the fastest sideways speed seen. */
function fall(m: MatchState, f: FighterState, frames: number, first: Partial<InputFrame> = {}): number {
  let fastest = 0;
  for (let t = 0; t < frames && f.stocks === 3; t++) {
    stepMatch(m, [{ ...neutralInput(), ...(t === 0 ? first : {}) }, neutralInput()]);
    fastest = Math.max(fastest, Math.abs(f.vel.x));
  }
  return fastest;
}

describe('a fall past a ledge corner', () => {
  it.each([1, -1] as const)(
    "Snail Bob's down air just past the %d ledge plunges straight down beside the wall instead of off the stage",
    (side) => {
      // Shell Plunge stops his air speed on its first frame and the stick can't drift him (Toon Link's down air), so
      // it is started over the gap, just past the corner, and the plunge, which re-sets his fall speed every frame,
      // goes straight down past it.
      for (const dx of [1.1, 2, 4]) {
        const { m, f } = inAir('snailbob', side, LEDGE + dx, 23.4, 0);
        const fastest = fall(m, f, 40, { cy: -100 });
        const at = `${dx} out`;
        expect(f.move, at).toBe('dair');
        expect(fastest, at).toBe(0);
        expect(side * f.pos.x, at).toBeLessThan(LEDGE + 8);
        expect(f.pos.y, at).toBeLessThan(-40);
      }
    },
  );

  it.each(['snailbob', 'wheely', 'fireboy'])(
    '%s falling or fast falling straight down just outside either ledge keeps falling straight',
    (fighter) => {
      for (const side of [1, -1] as const) {
        for (const fastFalling of [false, true]) {
          for (const dx of [1, 2, 4]) {
            const { m, f } = inAir(fighter, side, LEDGE + dx, 25, 0, fastFalling);
            const at = `side ${side}, ${fastFalling ? 'fast fall' : 'fall'}, ${dx} out`;
            expect(fall(m, f, 60), at).toBe(0);
            expect(side * f.pos.x, at).toBeLessThan(LEDGE + 10);
            expect(f.pos.y, at).toBeLessThan(-30);
          }
        }
      }
    },
  );

  it('drifting into the wall just under a ledge stops against it, its sideways speed gone', () => {
    const { m, f } = inAir('fireboy', 1, LEDGE + 8, -2, -1.2);
    fall(m, f, 20);
    expect(f.pos.x).toBeGreaterThan(LEDGE);
    expect(f.vel.x).toBe(0);
  });
});

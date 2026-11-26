import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { defineFighter, type MoveDef } from '../../fighters/types';
import { SPECIAL_REVERSE } from '../constants';
import type { MatchState } from '../match';
import { marioReference } from '../testing/reference';
import { placeInAir, run, testMatch, type Hold } from '../testing/sim';

const special = (extra: Partial<MoveDef> = {}): MoveDef => ({ kind: 'other', faf: 40, hits: [], ...extra });

/** Specials in all four directions, plus the reference nair. */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'test-b-reverse',
    moves: {
      ...marioReference.moves,
      neutralB: special(),
      sideB: special(),
      upB: special(),
      downB: special(),
    },
  }),
);
/**
 * Air drift off, so horizontal speed only changes when the move is B-reversed; the up special opts in to the
 * B-reverse.
 */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'test-b-reverse-still',
    moves: { neutralB: special({ drift: false }), upB: special({ drift: false, bReverse: true }) },
  }),
);
/** A neutral special that opts out of the B-reverse, as Falcon Punch does in Ultimate. */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'test-no-b-reverse',
    moves: { neutralB: special({ drift: false, bReverse: false }) },
  }),
);

/** Press Special with `stick` on frame 1 of the special. */
const press = (m: MatchState, stick: Hold = {}) => run(m, 1, { ...stick, buttons: ['special'] });

/** Frame 1 is the press; frames 2.. hold the stick neutral except `stick` on frame `frame`. */
function flickOn(m: MatchState, frame: number, stick: Hold) {
  press(m);
  for (let k = 2; k <= frame; k++) run(m, 1, k === frame ? stick : {});
}

describe('turnaround special (Ultimate: the stick behind the fighter on the press turns it first)', () => {
  const cases = [
    { stick: { x: -40 }, move: 'neutralB' },
    { stick: { x: -100 }, move: 'sideB' },
    { stick: { x: -60, y: 100 }, move: 'upB' },
    { stick: { x: -60, y: -100 }, move: 'downB' },
  ];

  it.each(cases)('on the ground, $move with the stick behind turns around', ({ stick, move }) => {
    const m = testMatch({ fighter: 'test-b-reverse' });
    const f = m.fighters[0]!;
    expect(f.facing).toBe(1);
    press(m, stick);
    expect(f.move).toBe(move);
    expect(f.actionFrame).toBe(1);
    expect(f.facing).toBe(-1);
  });

  it.each(cases)('in the air, $move with the stick behind turns around', ({ stick, move }) => {
    const m = testMatch({ fighter: 'test-b-reverse' });
    const f = placeInAir(m, 0, 60, 1);
    press(m, stick);
    expect(f.move).toBe(move);
    expect(f.facing).toBe(-1);
  });

  it('in the air the turnaround keeps the momentum', () => {
    const m = testMatch({ fighter: 'test-b-reverse-still' });
    const f = placeInAir(m, 0, 60, 1);
    f.vel.x = 1;
    press(m, { x: -40 });
    expect(f.facing).toBe(-1);
    expect(f.vel.x).toBe(1);
  });

  it('the stick has to be at least 0.25 behind', () => {
    for (const [x, facing] of [
      [-24, 1],
      [-25, -1],
    ] as const) {
      const m = testMatch({ fighter: 'test-b-reverse' });
      const f = placeInAir(m, 0, 60, 1);
      press(m, { x });
      expect(f.move).toBe('neutralB');
      expect(f.facing).toBe(facing);
    }
  });

  it.each([
    { stick: { x: 40 }, move: 'neutralB' },
    { stick: { x: 100 }, move: 'sideB' },
    { stick: { x: 60, y: 100 }, move: 'upB' },
    { stick: { x: 60, y: -100 }, move: 'downB' },
  ])('held forward, $move does not turn, on the press or after', ({ stick, move }) => {
    for (const air of [false, true]) {
      const m = testMatch({ fighter: 'test-b-reverse' });
      const f = air ? placeInAir(m, 0, 60, 1) : m.fighters[0]!;
      press(m, stick);
      expect(f.move).toBe(move);
      expect(f.facing).toBe(1);
      run(m, 8, stick);
      expect(f.move).toBe(move);
      expect(f.facing).toBe(1);
    }
  });
});

describe('B-reverse (Ultimate: the stick behind within 4 frames of the special input)', () => {
  it('reads Ultimate window: 1 to 4 frames after the press, frames 2-5 of the special', () => {
    expect(SPECIAL_REVERSE.window).toEqual([2, 5]);
  });

  it.each([2, 3, 4, 5])('the stick behind on frame %i turns the fighter around', (frame) => {
    const m = testMatch({ fighter: 'test-b-reverse' });
    const f = placeInAir(m, 0, 60, 1);
    flickOn(m, frame, { x: -100 });
    expect(f.move).toBe('neutralB');
    expect(f.actionFrame).toBe(frame);
    expect(f.facing).toBe(-1);
  });

  it('on frame 6 it is too late', () => {
    for (const air of [false, true]) {
      const m = testMatch({ fighter: 'test-b-reverse' });
      const f = air ? placeInAir(m, 0, 60, 1) : m.fighters[0]!;
      flickOn(m, 6, { x: -100 });
      expect(f.move).toBe('neutralB');
      expect(f.facing).toBe(1);
    }
  });

  it('in the air it reverses the horizontal momentum', () => {
    const m = testMatch({ fighter: 'test-b-reverse-still' });
    const f = placeInAir(m, 0, 60, 1);
    f.vel.x = 1.2;
    press(m);
    run(m, 1);
    expect(f.vel.x).toBe(1.2);
    run(m, 1, { x: -100 });
    expect(f.actionFrame).toBe(3);
    expect(f.facing).toBe(-1);
    expect(f.vel.x).toBe(-1.2);
    run(m, 5, { x: -100 });
    expect(f.vel.x).toBe(-1.2);
  });

  it('in the air the momentum stays when the stick comes back on frame 6', () => {
    const m = testMatch({ fighter: 'test-b-reverse-still' });
    const f = placeInAir(m, 0, 60, 1);
    f.vel.x = 1.2;
    flickOn(m, 6, { x: -100 });
    expect(f.facing).toBe(1);
    expect(f.vel.x).toBe(1.2);
  });

  it('on the ground it turns around and reverses the slide', () => {
    const m = testMatch({ fighter: 'test-b-reverse' });
    const f = m.fighters[0]!;
    f.vel.x = 1.5;
    press(m);
    run(m, 1);
    const before = f.vel.x;
    expect(before).toBeGreaterThan(0);
    run(m, 1, { x: -100 });
    expect(f.ground).not.toBeNull();
    expect(f.facing).toBe(-1);
    // Reversed, then one frame of traction (Mario's 0.102) towards zero.
    expect(f.vel.x).toBeCloseTo(-before + marioReference.stats.groundFriction, 9);
  });

  it('works once per special: swinging the stick back again does not turn it a second time', () => {
    const m = testMatch({ fighter: 'test-b-reverse' });
    const f = placeInAir(m, 0, 60, 1);
    flickOn(m, 3, { x: -100 });
    expect(f.facing).toBe(-1);
    run(m, 1, { x: 100 });
    expect(f.actionFrame).toBe(4);
    expect(f.facing).toBe(-1);
  });

  it('wavebounce: a turnaround then a B-reverse keeps the facing and reverses the momentum', () => {
    const m = testMatch({ fighter: 'test-b-reverse-still' });
    const f = placeInAir(m, 0, 60, 1);
    f.vel.x = 1;
    press(m, { x: -40 });
    expect(f.facing).toBe(-1);
    expect(f.vel.x).toBe(1);
    run(m, 1, { x: 100 });
    expect(f.facing).toBe(1);
    expect(f.vel.x).toBe(-1);
  });

  it.each([
    { stick: { x: 100 }, move: 'sideB' },
    { stick: { y: -100 }, move: 'downB' },
  ])('$move can be B-reversed', ({ stick, move }) => {
    const m = testMatch({ fighter: 'test-b-reverse' });
    const f = placeInAir(m, 0, 60, 1);
    press(m, stick);
    expect(f.move).toBe(move);
    run(m, 1, { x: -100 });
    expect(f.facing).toBe(-1);
  });

  it('an up special is not B-reversed by default, so the stick can steer it after the press', () => {
    const m = testMatch({ fighter: 'test-b-reverse' });
    const f = placeInAir(m, 0, 60, 1);
    press(m, { y: 100 });
    expect(f.move).toBe('upB');
    run(m, 4, { x: -100 });
    expect(f.facing).toBe(1);
  });

  it('an up special with bReverse: true is', () => {
    const m = testMatch({ fighter: 'test-b-reverse-still' });
    const f = placeInAir(m, 0, 60, 1);
    f.vel.x = 1;
    press(m, { y: 100 });
    expect(f.move).toBe('upB');
    run(m, 1, { x: -100 });
    expect(f.facing).toBe(-1);
    expect(f.vel.x).toBe(-1);
  });

  it('a move with bReverse: false is not B-reversed, but still turns around on the press', () => {
    const m = testMatch({ fighter: 'test-no-b-reverse' });
    const f = placeInAir(m, 0, 60, 1);
    f.vel.x = 1;
    flickOn(m, 3, { x: -100 });
    expect(f.facing).toBe(1);
    expect(f.vel.x).toBe(1);

    const t = testMatch({ fighter: 'test-no-b-reverse' });
    const g = placeInAir(t, 0, 60, 1);
    press(t, { x: -40 });
    expect(g.facing).toBe(-1);
  });

  it('aerials from Attack are not B-reversed', () => {
    const m = testMatch({ fighter: 'test-b-reverse' });
    const f = placeInAir(m, 0, 60, 1);
    run(m, 1, { buttons: ['attack'] });
    expect(f.move).toBe('nair');
    run(m, 1);
    run(m, 1, { x: -100 });
    expect(f.actionFrame).toBe(3);
    expect(f.facing).toBe(1);
  });
});

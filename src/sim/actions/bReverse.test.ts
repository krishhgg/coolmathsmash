import { describe, expect, it } from 'vitest';
import { registerFighter } from '../../fighters/registry';
import { defineFighter, type MoveDef } from '../../fighters/types';
import { SPECIAL_REVERSE } from '../constants';
import type { SimEvent } from '../events';
import type { MatchState } from '../match';
import ref from '../reference/physics-constants.json';
import { testCharger } from '../testing/charge';
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

/** A held-charge neutral special whose charge frame is inside the B-reverse window, so a charge holds it there. */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'test-b-reverse-early-charge',
    moves: { neutralB: special({ charge: 3, chargeFrames: 60 }) },
  }),
);

/**
 * A neutral special whose script rewinds to frame 3 on frame 10, as Johnny's Laser Gun repeat does (laserRepeat), so
 * the move's frames pass through the B-reverse window again long after the press.
 */
registerFighter(
  defineFighter({
    ...marioReference,
    id: 'test-b-reverse-loop',
    moves: {
      neutralB: special({
        drift: false,
        script: ({ f }) => {
          if (f.actionFrame === 10) f.actionFrame = 3;
        },
      }),
    },
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
  it('the window is 1 to 4 frames after the press: frames 2-5 of the special', () => {
    expect(SPECIAL_REVERSE.window).toEqual([2, 1 + ref.movement.b_reverse_window_frames_after_press]);
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

/**
 * Charged specials (src/sim/actions/charge.ts). SmashWiki "B-reversing" lists "Samus's Charge Shot (prior to
 * Ultimate)" among the moves that can't be B-reversed, so in Ultimate a charging special can be. The test charger's
 * downB is the Charge Shot role (tap stored charge) and its sideB the Skull Bash role (held charge).
 */
describe('B-reverse and turnaround on charged specials', () => {
  const chargeShot: Hold = { y: -100, buttons: ['special'] };

  it("Charge Shot's role: B-reversed on frame 3, it turns, reverses the drift and keeps charging", () => {
    const m = testMatch({ fighter: testCharger.id });
    const f = placeInAir(m, 0, 150, 1);
    f.vel.x = 1;
    run(m, 1, chargeShot);
    expect(f.move).toBe('downB');
    run(m, 1);
    const before = f.vel.x;
    expect(before).toBeGreaterThan(0);
    run(m, 1, { x: -100 });
    expect(f.facing).toBe(-1);
    expect(f.vel.x).toBeLessThan(0);
    run(m, 20);
    expect(f).toMatchObject({ move: 'downB', facing: -1 });
    expect(f.charge).toBeGreaterThan(0);
    const seen: SimEvent[] = [];
    run(m, 1, { buttons: ['special'] });
    seen.push(...m.events);
    run(m, 1);
    seen.push(...m.events);
    expect(seen).toContainEqual(expect.objectContaining({ type: 'charge', phase: 'fire' }));
    expect(f.facing).toBe(-1);
  });

  it("Skull Bash's role: a side special B-reversed while it charges rushes the other way", () => {
    const m = testMatch({ fighter: testCharger.id });
    const f = m.fighters[0]!;
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f).toMatchObject({ move: 'sideB', facing: 1 });
    run(m, 1, { buttons: ['special'] });
    run(m, 1, { x: -100, buttons: ['special'] });
    expect(f.facing).toBe(-1);
    run(m, 20, { buttons: ['special'] });
    expect(f.charge).toBeGreaterThan(0);
    run(m, 1);
    run(m, 6);
    expect(f.move).toBe('sideB');
    expect(f.actionFrame).toBeGreaterThanOrEqual(12);
    expect(f.vel.x).toBeLessThan(0);
  });

  it('a full stored Charge Shot fires at once and can still be turned around or B-reversed', () => {
    const store = () => {
      const m = testMatch({ fighter: testCharger.id });
      const f = m.fighters[0]!;
      run(m, 1, chargeShot);
      for (let i = 0; i < 200 && !f.storedCharge; i++) run(m, 1);
      expect(f.storedCharge).toMatchObject({ move: 'downB', frames: 120 });
      run(m, 5);
      expect(f.action).toBe('idle');
      return { m, f };
    };

    const a = store();
    run(a.m, 1, { x: -60, y: -100, buttons: ['special'] });
    expect(a.f).toMatchObject({ move: 'downB', facing: -1 });

    const b = store();
    run(b.m, 1, chargeShot);
    run(b.m, 1);
    run(b.m, 1, { x: -100 });
    expect(b.f.facing).toBe(-1);
    for (let i = 0; i < 10 && b.f.actionFrame <= 10; i++) run(b.m, 1);
    expect(b.f).toMatchObject({ move: 'downB', charge: 120, storedCharge: null, facing: -1 });
  });

  it('a script that rewinds the move into the window does not reopen it (Johnny repeating Laser Gun)', () => {
    const m = testMatch({ fighter: 'test-b-reverse-loop' });
    const f = placeInAir(m, 0, 150, 1);
    press(m);
    run(m, 10);
    expect(f.move).toBe('neutralB');
    expect(f.actionFrame).toBeGreaterThanOrEqual(SPECIAL_REVERSE.window[0]);
    expect(f.actionFrame).toBeLessThanOrEqual(SPECIAL_REVERSE.window[1]);
    run(m, 1, { x: -100 });
    expect(f.facing).toBe(1);
  });

  it('the window counts frames since the press, not the move frame a charge holds still', () => {
    const late = testMatch({ fighter: 'test-b-reverse-early-charge' });
    const f = placeInAir(late, 0, 150, 1);
    run(late, 1, { buttons: ['special'] });
    run(late, 15, { buttons: ['special'] });
    expect(f.move).toBe('neutralB');
    expect(f.charge).toBeGreaterThan(5);
    expect(f.actionFrame).toBeGreaterThanOrEqual(SPECIAL_REVERSE.window[0]);
    expect(f.actionFrame).toBeLessThanOrEqual(SPECIAL_REVERSE.window[1]);
    run(late, 1, { x: -100, buttons: ['special'] });
    expect(f.facing).toBe(1);

    const early = testMatch({ fighter: 'test-b-reverse-early-charge' });
    const g = placeInAir(early, 0, 150, 1);
    run(early, 1, { buttons: ['special'] });
    run(early, 1, { buttons: ['special'] });
    run(early, 1, { x: -100, buttons: ['special'] });
    expect(g.facing).toBe(-1);
  });
});

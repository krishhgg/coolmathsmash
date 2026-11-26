import { describe, expect, it } from 'vitest';
import type { MatchState } from './match';
import ref from './reference/physics-constants.json';
import { placeInAir, run, testMatch, type Hold } from './testing/sim';

/**
 * Ultimate's stick thresholds, flick windows and input buffer (docs/physics-reference.md sections 7, 9, 10 and 13),
 * read from physics-constants.json and driven through the sim with reference Mario on Battlefield. Sticks are the
 * input's whole -100..100 units, so `at(v)` is the smallest stick that reaches `v` and `at(v) - 1` falls short.
 */

const P = (m: MatchState) => m.fighters[0]!;
const at = (v: number) => Math.ceil(Math.round(Math.abs(v) * 10000) / 100);

/** n frames from neutral to past a threshold: n - 1 frames of a partial tilt (`from` up), then full tilt. */
const flick = (n: number, from: number) => (i: number) => (i < n - 1 ? from + 5 * i : 100);

function shielding(): MatchState {
  const m = testMatch({ x: 0 });
  run(m, 5, { buttons: ['shield'] });
  expect(P(m).action).toBe('shield');
  return m;
}

/** Standing on Battlefield's left platform. */
function onPlatform(): MatchState {
  const m = testMatch();
  placeInAir(m, -42, 30);
  run(m, 40);
  expect([P(m).action, P(m).ground?.kind]).toEqual(['idle', 'platform']);
  return m;
}

describe('stick thresholds', () => {
  it('a sideways flick dashes from dash_stick_x 0.85 and walks under it', () => {
    const dash = at(ref.movement.dash_stick_x);
    for (const [x, action] of [
      [dash, 'dash'],
      [dash - 1, 'walk'],
    ] as const) {
      const m = testMatch({ x: 0 });
      run(m, 1, { x });
      expect(P(m).action, `stick ${x}`).toBe(action);
    }
  });

  it('a run brake runs again from run_stick_x 0.75 and turns around from turn_run_stick_x -0.6', () => {
    const again = at(ref.movement.run_stick_x);
    const turn = at(ref.movement.turn_run_stick_x);
    for (const [x, action] of [
      [again, 'run'],
      [again - 1, 'runBrake'],
      [-turn, 'turn'],
      [-(turn - 1), 'runBrake'],
    ] as const) {
      const m = testMatch({ x: -40 });
      run(m, 20, { x: 100 });
      run(m, 1);
      expect(P(m).action).toBe('runBrake');
      run(m, 1, { x });
      expect(P(m).action, `stick ${x}`).toBe(action);
    }
  });

  it('falling, a down flick to dive_cont_value -0.66 fast falls and -0.65 does not', () => {
    const ff = at(ref.jump.fast_fall.stick_threshold);
    for (const [y, fast] of [
      [-ff, true],
      [-(ff - 1), false],
    ] as const) {
      const m = testMatch();
      placeInAir(m, 0, 100);
      run(m, 1);
      run(m, 1, { y });
      expect(P(m).fastFalling, `stick ${y}`).toBe(fast);
    }
  });

  it('on a platform, a down flick to pass_stick_y -0.6875 drops through and -0.68 crouches', () => {
    const drop = at(ref.platforms.drop_stick_y);
    for (const [y, action] of [
      [-drop, 'fall'],
      [-(drop - 1), 'crouch'],
    ] as const) {
      const m = onPlatform();
      run(m, 1, { y });
      expect([P(m).action, P(m).ground?.kind ?? null], `stick ${y}`).toEqual([
        action,
        action === 'fall' ? null : 'platform',
      ]);
    }
  });

  it('falling with the stick held down to -0.6875 passes through a platform; -0.68 lands on it', () => {
    const drop = at(ref.platforms.drop_stick_y);
    for (const [y, lands] of [
      [-drop, 'solid'],
      [-(drop - 1), 'platform'],
    ] as const) {
      const m = testMatch();
      placeInAir(m, -42, 30);
      run(m, 40, { y });
      expect(P(m).ground?.kind, `stick ${y}`).toBe(lands);
    }
  });

  it('out of shield, a flick to escape_fb_stick_x 0.7 rolls and escape_stick_y -0.7 spot dodges', () => {
    const t = ref.dodges.input_thresholds;
    const roll = at(t.roll_stick_x);
    const spot = at(t.spot_dodge_stick_y);
    const cases: [Hold, string][] = [
      [{ x: roll }, 'rollForward'],
      [{ x: roll - 1 }, 'shield'],
      [{ y: -spot }, 'spotDodge'],
      [{ y: -(spot - 1) }, 'shield'],
    ];
    for (const [h, action] of cases) {
      const m = shielding();
      run(m, 1, { ...h, buttons: ['shield'] });
      expect(P(m).action, JSON.stringify(h)).toBe(action);
    }
  });

  it('an air dodge is directional from a stick length of escape_air_slide_stick 0.66 and neutral under it', () => {
    const s = at(ref.dodges.air_dodge_directional.stick_threshold);
    const d = Math.ceil(s / Math.SQRT2);
    const cases: [Hold, boolean][] = [
      [{ x: s }, true],
      [{ x: s - 1 }, false],
      [{ x: d, y: -d }, true],
      [{ x: d - 1, y: -(d - 1) }, false],
    ];
    for (const [h, directional] of cases) {
      const m = testMatch();
      placeInAir(m, 0, 100);
      run(m, 1, h);
      run(m, 1, { ...h, buttons: ['shield'] });
      expect(P(m).action).toBe('airDodge');
      expect(P(m).dodgeDir.x !== 0, JSON.stringify(h)).toBe(directional);
    }
  });
});

describe('flick windows (frames from the last neutral frame to the threshold)', () => {
  it('a fast fall flick may take dive_flick_frame_value 4 frames, not 5', () => {
    const n = ref.jump.fast_fall.input_flick_frames;
    for (const [frames, fast] of [
      [n, true],
      [n + 1, false],
    ] as const) {
      const m = testMatch();
      placeInAir(m, 0, 100);
      run(m, 1);
      const y = flick(frames, 35);
      run(m, frames, (i) => ({ y: -y(i) }));
      expect(P(m).fastFalling, `${frames} frames`).toBe(fast);
    }
  });

  it('a platform drop flick may take pass_flick_y 6 frames, not 7', () => {
    const n = ref.platforms.drop_flick_window_frames;
    for (const [frames, action] of [
      [n, 'fall'],
      [n + 1, 'crouch'],
    ] as const) {
      const m = onPlatform();
      const y = flick(frames, 35);
      run(m, frames, (i) => ({ y: -y(i) }));
      expect(P(m).action, `${frames} frames`).toBe(action);
    }
  });

  it('a roll or spot dodge flick may take escape_fb_flick_x and escape_flick_y 4 frames, not 5', () => {
    const t = ref.dodges.input_thresholds;
    const cases: [string, number, number, string][] = [
      ['x', 1, t.roll_flick_frames, 'rollForward'],
      ['y', -1, t.spot_dodge_flick_frames, 'spotDodge'],
    ];
    for (const [axis, sign, n, dodge] of cases) {
      for (const [frames, action] of [
        [n, dodge],
        [n + 1, 'shield'],
      ] as const) {
        const m = shielding();
        const v = flick(frames, 35);
        run(m, frames, (i) => ({ [axis]: sign * v(i), buttons: ['shield'] }));
        expect(P(m).action, `${axis} in ${frames} frames`).toBe(action);
      }
    }
  });
});

describe('input buffer (SmashWiki: Buffer)', () => {
  const faf = ref.dodges.spot_dodge.total + 1;
  const window = ref.movement.buffer_window_frames;

  /** On a spot dodge's first frame, with every button let go after it. */
  function spotDodging(): MatchState {
    const m = shielding();
    run(m, 1, { y: -100, buttons: ['shield'] });
    expect([P(m).action, P(m).actionFrame]).toEqual(['spotDodge', 1]);
    return m;
  }

  it(`a jump tapped up to ${window - 1} frames before the first actionable frame comes out on it`, () => {
    for (const [early, action] of [
      [window - 1, 'jumpSquat'],
      [window, 'idle'],
    ] as const) {
      const m = spotDodging();
      const press = faf - early;
      run(m, press - 2);
      run(m, 1, { buttons: ['jump'] });
      run(m, faf - 1 - press);
      expect(P(m).action).toBe('spotDodge');
      run(m, 1);
      expect(P(m).action, `tapped ${early} frames early`).toBe(action);
    }
  });

  it('a jump pressed early and held until the window opens comes out, though it is let go in the window', () => {
    const opens = faf - window + 1;
    for (const [heldTo, action] of [
      [opens, 'jumpSquat'],
      [opens - 1, 'idle'],
    ] as const) {
      const m = spotDodging();
      run(m, heldTo - 1, { buttons: ['jump'] });
      run(m, faf - 1 - heldTo);
      expect(P(m).action).toBe('spotDodge');
      run(m, 1);
      expect(P(m).action, `held to frame ${heldTo}`).toBe(action);
    }
  });
});

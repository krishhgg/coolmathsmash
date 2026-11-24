import { describe, expect, it } from 'vitest';
import { run, testMatch } from '../sim/testing/sim';
import { getStage } from '../stages/registry';
import type { SimEvent } from '../sim/events';
import { Camera, cameraTarget, SHAKE, shakeOffset, shakesFrom, SMOOTHING, type CameraView } from './camera';

describe('camera', () => {
  const stage = getStage('battlefield');

  it('draws the target before it has been stepped', () => {
    const m = testMatch();
    expect(new Camera().viewFor(m, stage)).toEqual(cameraTarget(m, stage));
  });

  it("eases toward each simulated frame's own target, however rarely it is drawn", () => {
    const m = testMatch();
    const camera = new Camera();
    let expected: CameraView | null = null;
    for (let i = 0; i < 45; i++) {
      run(m, 1, { x: 100 });
      camera.step(m, stage);
      const t = cameraTarget(m, stage);
      expected = expected
        ? {
            x: expected.x + (t.x - expected.x) * SMOOTHING,
            y: expected.y + (t.y - expected.y) * SMOOTHING,
            zoom: expected.zoom + (t.zoom - expected.zoom) * SMOOTHING,
          }
        : t;
      if (i % 11 === 0) expect(camera.viewFor(m, stage)).toEqual(expected);
    }
    expect(camera.viewFor(m, stage)).toEqual(expected);
    expect(expected!.x).toBeLessThan(cameraTarget(m, stage).x);
  });
});

describe('screen shake', () => {
  const stage = getStage('battlefield');
  const hit = (kb: number, hitlag = 10): SimEvent => ({
    type: 'hit',
    attacker: 0,
    victim: 1,
    move: 'fsmash',
    damage: 18,
    kb,
    tumble: true,
    hitlag,
    effect: 'normal',
    x: 0,
    y: 10,
  });

  /** Steps two cameras through the same frames, feeding `events` at frame 1 to only the first. */
  function shaken(events: SimEvent[], frames = 60) {
    const m = testMatch();
    const a = new Camera();
    const b = new Camera();
    const offsets: number[] = [];
    for (let f = 0; f < frames; f++) {
      m.frame = f;
      m.events = f === 1 ? events : [];
      a.step(m, stage);
      m.events = [];
      b.step(m, stage);
      const va = a.viewFor(m, stage);
      const vb = b.viewFor(m, stage);
      expect(va.zoom).toBe(vb.zoom);
      offsets.push(Math.hypot(va.x - vb.x, va.y - vb.y) * va.zoom);
    }
    return offsets;
  }

  it('leaves light hits alone', () => {
    expect(Math.max(...shaken([hit(SHAKE.heavy.kb - 1)]))).toBe(0);
  });

  it('shakes on a heavy hit through its hitlag and a little after, then settles exactly', () => {
    const offsets = shaken([hit(120, 10)]);
    const live = 10 + SHAKE.heavy.after;
    expect(Math.max(...offsets.slice(1, 1 + live))).toBeGreaterThan(1);
    expect(Math.max(...offsets.slice(1, 1 + live))).toBeLessThanOrEqual(SHAKE.heavy.amplitude * 1.2);
    expect(offsets.slice(1 + live)).toEqual(offsets.slice(1 + live).map(() => 0));
  });

  it('shakes harder for severe hits and hardest for KOs', () => {
    const peak = (events: SimEvent[]) => Math.max(...shaken(events));
    const heavy = peak([hit(120)]);
    const severe = peak([hit(180)]);
    const ko = peak([{ type: 'ko', port: 1, stocks: 2, side: 'right', x: 240, y: 30 }]);
    expect(severe).toBeGreaterThan(heavy * 1.5);
    expect(ko).toBeGreaterThan(severe * 1.5);
    expect(ko).toBeLessThanOrEqual(SHAKE.ko.amplitude * 1.2);
  });

  it("shakes by a move's own shake event, in screen pixels", () => {
    const event = { type: 'shake', port: 0, amplitude: 4, frames: 12 } as unknown as SimEvent;
    const offsets = shaken([event]);
    expect(Math.max(...offsets.slice(1, 13))).toBeGreaterThan(2);
    expect(Math.max(...offsets.slice(1, 13))).toBeLessThanOrEqual(4 * 1.2);
    expect(Math.max(...offsets.slice(13))).toBe(0);
  });

  it('is a pure function of the frame, so shakes start and end on the same frames however they are drawn', () => {
    const shakes = shakesFrom([hit(180, 12)], 30);
    expect(shakes).toEqual([
      { start: 30, amplitude: SHAKE.severe.amplitude, frames: 12 + SHAKE.severe.after },
    ]);
    expect(shakeOffset(shakes, 29)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(shakes, 35)).toEqual(shakeOffset(shakes, 35));
    expect(shakeOffset(shakes, 30 + 12 + SHAKE.severe.after)).toEqual({ x: 0, y: 0 });
  });
});

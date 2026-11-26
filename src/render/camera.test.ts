import { describe, expect, it } from 'vitest';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { getFighter } from '../fighters/registry';
import { inputsAt, type ScriptStep } from '../harness/script';
import { createMatch, DEFAULT_MATCH, stepMatch, type MatchState } from '../sim/match';
import { run, testMatch } from '../sim/testing/sim';
import { getStage } from '../stages/registry';
import type { SimEvent } from '../sim/events';
import {
  Camera,
  cameraTarget,
  LAUNCH_SMOOTHING,
  SHAKE,
  shakeOffset,
  shakesFrom,
  SMOOTHING,
  smoothingFor,
  type CameraView,
} from './camera';

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

describe('framing a 1v1 on Battlefield', () => {
  const stage = getStage('battlefield');
  /** Pixels a lip must stay inside its screen edge to count as in frame: its ledge guard and some air past it. */
  const LIP_ROOM = 40;
  const screenX = (v: CameraView, x: number) => VIEW_WIDTH / 2 + (x - v.x) * v.zoom;
  const screenY = (v: CameraView, y: number) => VIEW_HEIGHT / 2 - (y - v.y) * v.zoom;
  /** The smaller gap between a lip (x = -80 or 80) and its screen edge, in pixels; negative when a lip is cut off. */
  const lipRoom = (v: CameraView) => Math.min(screenX(v, -80), VIEW_WIDTH - screenX(v, 80));

  /**
   * Plays the default Fireboy match from frame 0 with `script` as input (after `setup`), stepping a camera like the
   * renderer does. `each` sees every frame's state and view; returning true stops.
   */
  function play(
    script: ScriptStep[],
    each: (m: MatchState, view: CameraView) => boolean | void,
    setup?: (m: MatchState) => void,
  ) {
    const m = createMatch(DEFAULT_MATCH);
    setup?.(m);
    const camera = new Camera();
    for (let i = 0; i < 600; i++) {
      stepMatch(m, inputsAt(script, m.frame, m.players.length));
      camera.step(m, stage);
      if (each(m, camera.viewFor(m, stage))) return;
    }
    throw new Error('the scenario never finished');
  }

  it('shows the deck across about two thirds of the screen at the spawns, both lips in view', () => {
    play([], (m, view) => {
      if (m.frame < 60) return;
      const deck = (160 * view.zoom) / VIEW_WIDTH;
      // Ultimate: about 60%. The old camera spanned 94% and kept the lips 38 px from the edges.
      expect(deck).toBeGreaterThanOrEqual(0.6);
      expect(deck).toBeLessThanOrEqual(0.7);
      expect(lipRoom(view)).toBeGreaterThan(150);
      return true;
    });
  });

  it.each([
    { to: 'its own ledge', x: -100, done: (x: number) => x <= -78 },
    { to: 'the other fighter', x: 100, done: (x: number) => x >= 30 },
  ])('keeps both lips in frame while P1 dashes and runs from its spawn to $to', ({ x, done }) => {
    let least = Infinity;
    play([{ port: 0, from: 10, to: 600, x }], (m, view) => {
      least = Math.min(least, lipRoom(view));
      return done(m.fighters[0]!.pos.x);
    });
    expect(least).toBeGreaterThanOrEqual(LIP_ROOM);
  });

  it.each([
    { move: 'forward smash', damage: 100, p2: 6, cx: 100, cy: 0 },
    { move: 'forward smash', damage: 150, p2: 6, cx: 100, cy: 0 },
    { move: 'forward smash', damage: 200, p2: 6, cx: 100, cy: 0 },
    { move: 'up smash', damage: 150, p2: -8, cx: 0, cy: 100 },
  ])(
    'keeps P2 on screen after a $damage% $move until it passes the camera bounds',
    ({ damage, p2, cx, cy }) => {
      const b = stage.camera;
      const { width, height } = getFighter(DEFAULT_MATCH.ports[1]!.fighter).stats;
      let launched = false;
      play(
        [{ port: 0, from: 10, to: 12, cx, cy }],
        (m, view) => {
          const f = m.fighters[1]!;
          if (f.action !== 'tumble' || f.hitlag > 0) return;
          launched = true;
          const { x, y } = f.pos;
          if (x < b.left || x > b.right || y < b.bottom || y > b.top) return true;
          expect(screenX(view, x + width / 2), `frame ${m.frame}`).toBeGreaterThan(0);
          expect(screenX(view, x - width / 2), `frame ${m.frame}`).toBeLessThan(VIEW_WIDTH);
          expect(screenY(view, y), `frame ${m.frame}`).toBeGreaterThan(0);
          expect(screenY(view, y + height), `frame ${m.frame}`).toBeLessThan(VIEW_HEIGHT);
        },
        (m) => {
          Object.assign(m.fighters[0]!, { pos: { x: -12, y: 0 }, facing: 1 });
          Object.assign(m.fighters[1]!, { pos: { x: p2, y: 0 }, facing: -1, damage });
        },
      );
      expect(launched).toBe(true);
    },
  );

  it('widens fast only while a fighter flies from a launch, and always narrows slowly', () => {
    const m = testMatch({ players: 2 });
    const view = { x: 0, y: 20, zoom: 5 };
    const wider = { ...view, zoom: 4 };
    const closer = { ...view, zoom: 5.3 };
    expect(smoothingFor(m, view, wider)).toBe(SMOOTHING);
    Object.assign(m.fighters[1]!, { action: 'tumble', hitstun: 30, hitlag: 0 });
    expect(smoothingFor(m, view, wider)).toBe(LAUNCH_SMOOTHING);
    expect(smoothingFor(m, view, closer)).toBe(SMOOTHING);
    m.fighters[1]!.hitlag = 12;
    expect(smoothingFor(m, view, wider)).toBe(SMOOTHING);
    Object.assign(m.fighters[1]!, { hitlag: 0, hitstun: 0 });
    expect(smoothingFor(m, view, wider)).toBe(SMOOTHING);
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

import { describe, expect, it } from 'vitest';
import { run, testMatch } from '../sim/testing/sim';
import { getStage } from '../stages/registry';
import { Camera, cameraTarget, SMOOTHING, type CameraView } from './camera';

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

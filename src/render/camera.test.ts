import { describe, expect, it } from 'vitest';
import { run, testMatch } from '../sim/testing/sim';
import { getStage } from '../stages/registry';
import { Camera, cameraTarget } from './camera';

describe('camera', () => {
  const stage = getStage('battlefield');

  it('draws the target before it has been stepped', () => {
    const m = testMatch();
    expect(new Camera().viewFor(m, stage)).toEqual(cameraTarget(m, stage));
  });

  it('eases once per simulated frame, so the view never depends on which frames were drawn', () => {
    const m = testMatch();
    const everyFrame = new Camera();
    const onceAtEnd = new Camera();
    for (let i = 0; i < 45; i++) {
      run(m, 1, { x: 100 });
      everyFrame.step(m, stage);
      onceAtEnd.step(m, stage);
      everyFrame.viewFor(m, stage);
    }
    const view = onceAtEnd.viewFor(m, stage);
    expect(everyFrame.viewFor(m, stage)).toEqual(view);
    expect(view.x).toBeLessThan(cameraTarget(m, stage).x);
  });
});

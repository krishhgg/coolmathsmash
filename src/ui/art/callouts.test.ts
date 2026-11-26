import { describe, expect, it } from 'vitest';
import { COUNTDOWN_FRAMES, countdownCallout } from '../../session/match';
import { GO_SLIDE_PX, calloutPose } from './callouts';

const pose = (frame: number) => calloutPose(countdownCallout(frame)!);
const GO = COUNTDOWN_FRAMES;

describe('countdown callout pose', () => {
  it('unfolds a number from a sliver on its baseline, holds it, then fades it out', () => {
    expect(pose(0)).toEqual({ transform: 'scaleY(0.1)', opacity: 1 });
    expect(Number(/scaleY\(([\d.]+)\)/.exec(pose(3).transform)![1])).toBeCloseTo(0.68, 2);
    expect(pose(6)).toEqual({ transform: 'none', opacity: 1 });
    expect(pose(60 + 54).opacity).toBeCloseTo(0.5);
    expect(pose(120 + 57)).toEqual({ transform: 'none', opacity: 0 });
  });

  it('slides GO! in from the right at a steady speed, then holds it still and opaque from frame 6 to 49', () => {
    expect(pose(GO).transform).toBe(`translateX(${GO_SLIDE_PX}px)`);
    expect(pose(GO).opacity).toBe(1);
    const xs = [1, 2, 3, 4, 5].map((age) =>
      Number(/translateX\(([\d.]+)px\)/.exec(pose(GO + age).transform)![1]),
    );
    for (const [i, x] of xs.entries()) expect(x).toBeCloseTo((GO_SLIDE_PX * (5 - i)) / 6);
    for (let age = 6; age < 50; age++) expect(pose(GO + age)).toEqual({ transform: 'none', opacity: 1 });
  });

  it('grows GO! and fades it out over frames 50 to 65', () => {
    expect(pose(GO + 50)).toEqual({ transform: 'none', opacity: 1 });
    expect(pose(GO + 58).transform).toMatch(/^scale\(1\.1/);
    expect(pose(GO + 58).opacity).toBe(0.5);
    expect(pose(GO + 65).opacity).toBeLessThan(0.1);
  });
});

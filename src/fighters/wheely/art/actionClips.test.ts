import { describe, expect, it } from 'vitest';
import { clipFor } from '../../../render/fighterView';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { GETUP_STAND, GRAB } from '../../../sim/constants';
import { run, testMatch, until } from '../../../sim/testing/sim';
import { fighter } from '..';
import { REV_UP } from '../revUp';
import { stats } from '../stats';
import { art } from '.';

describe('Wheely playtest poses', () => {
  it('shows the roof pose when down and flips back onto the tyres on a standing getup', () => {
    const m = testMatch({ fighter: 'wheely' });
    const f = m.fighters[0]!;
    Object.assign(f, { action: 'down', actionFrame: 1 });
    const [downClip, downFrame] = clipFor(fighter, art, f);
    expect(downClip).toBe('down');
    expect(samplePose(art, downClip, downFrame, m.frame).local.body!.rot).toBeCloseTo(180, 0);

    run(m, 1, { buttons: ['jump'] });
    expect(f.action).toBe('getupStand');
    const [getupClip, getupFrame] = clipFor(fighter, art, f);
    expect(getupClip).toBe('getupStand');
    expect(samplePose(art, getupClip, getupFrame, m.frame).local.body!.rot).toBeCloseTo(180, 0);
    run(m, GETUP_STAND.faf - f.actionFrame - 1);
    expect(f.action).toBe('getupStand');
    expect(samplePose(art, getupClip, f.actionFrame, m.frame).local.body!.rot).toBe(360);
    run(m, 1);
    expect(f.action).toBe('idle');
  });

  it('reaches the held fighter with the door through the idle hold and on pummel impact', () => {
    const door = { ...art, rig: { ...art.rig, slots: art.rig.slots.filter((s) => s.name === 'door') } };
    const nearEdge = stats.width / 2 + GRAB.holdGap;
    for (const [clip, frame] of [
      ['grabHold', 0],
      ['grabHold', 15],
      ['pummel', fighter.moves.pummel!.pummel!.frame],
    ] as const) {
      expect(poseBounds(door, samplePose(art, clip, frame, frame))[2], clip).toBeGreaterThanOrEqual(nearEdge);
    }
  });

  it('revs on the charge clip at the revs so far, and plays the blast clip once he lets go', () => {
    const m = testMatch({ fighter: 'wheely' });
    const f = m.fighters[0]!;
    run(m, 1, { buttons: ['special'] });
    run(m, 3);
    expect(clipFor(fighter, art, f)).toEqual(['neutralB', 4]);
    until(m, (g) => g.charge === 40);
    expect(clipFor(fighter, art, f)).toEqual(['neutralBCharge', 40]);
    run(m, 1, { buttons: ['special'] });
    expect(clipFor(fighter, art, f)).toEqual(['neutralB', REV_UP.charge]);
  });

  it('draws the rev for every charge frame, with the flash only as the revs top out', () => {
    for (const name of ['neutralBCharge', 'neutralBAirCharge']) {
      expect(art.clips[name]!.length).toBe(REV_UP.chargeFrames);
      const flash = (revs: number) => samplePose(art, name, revs, revs).symbols.prop;
      expect(flash(REV_UP.chargeFrames - 8)).toBeNull();
      expect(flash(REV_UP.chargeFrames)).toBe('fxFlash');
    }
  });
});

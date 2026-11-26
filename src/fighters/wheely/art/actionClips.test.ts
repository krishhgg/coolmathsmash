import { describe, expect, it } from 'vitest';
import { clipFor } from '../../../render/fighterView';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { GETUP_ROLL, GETUP_STAND, GRAB } from '../../../sim/constants';
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

  it('flips backwards off the roof on a getup roll away from his facing', () => {
    const m = testMatch({ fighter: 'wheely' });
    const f = m.fighters[0]!;
    Object.assign(f, { action: 'down', actionFrame: 1, facing: 1 });
    run(m, 1, { x: -100 });
    expect(f.action).toBe('getupRoll');
    expect(f.dodgeDir.x).toBe(-1);
    const rot: number[] = [];
    while (f.action === 'getupRoll') {
      const [clip, frame] = clipFor(fighter, art, f);
      expect(clip).toBe('getupRollBack');
      rot.push(samplePose(art, clip, frame, m.frame).local.body!.rot);
      run(m, 1);
    }
    expect(rot.length).toBe(GETUP_ROLL.faf - 1);
    expect(Math.cos((rot[0]! * Math.PI) / 180)).toBeCloseTo(-1, 2);
    expect(rot.at(-1)).toBe(-360);
    const flip = rot.slice(rot.indexOf(Math.max(...rot)));
    expect(flip.every((r, i) => i === 0 || r <= flip[i - 1]!)).toBe(true);
    expect(flip[0]! - flip.at(-1)!).toBeGreaterThanOrEqual(180);
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

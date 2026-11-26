import { describe, expect, it } from 'vitest';
import { clipFor } from '../../../render/fighterView';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { placeInAir, run, testMatch, until } from '../../../sim/testing/sim';
import { fighter } from '..';
import { AIMED_SHOT } from '../aimedShot';
import { firingMuzzle } from './aimedShot';
import { art } from '.';

const POWER = ['fxPowerA', 'fxPowerB', 'fxPowerC'];
/** The launcher's world angle in degrees (rig space, negative is up). */
const gunAngle = (m: { a: number; b: number }) => (Math.atan2(m.b, m.a) * 180) / Math.PI;

describe('raft wars art: Aimed Shot', () => {
  it('keeps the standing clip on the floor and the air clip above it', () => {
    for (const [name, air] of [
      ['neutralB', false],
      ['neutralBAir', true],
    ] as const)
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const [, , , bottom] = poseBounds(art, samplePose(art, name, f, f));
        expect(bottom, `${name}@${f} sinks`).toBeLessThan(air ? 0.1 : 0.35);
        if (!air) expect(bottom, `${name}@${f} floats`).toBeGreaterThan(-0.6);
      }
  });

  it('puts the ball 1.5 units out of the drawn muzzle, along the barrel, on the firing frame', () => {
    const t = (AIMED_SHOT.elevation * Math.PI) / 180;
    for (const [legs, at] of [
      ['ground', AIMED_SHOT.muzzle],
      ['air', AIMED_SHOT.airMuzzle],
    ] as const) {
      const [x, y] = firingMuzzle(legs);
      expect(at.x, legs).toBeCloseTo(x + 1.5 * Math.cos(t), 1);
      expect(at.y, legs).toBeCloseTo(y + 1.5 * Math.sin(t), 1);
    }
  });

  it('draws the aimed charge pose, twinkling, on the frame the move rests on while Special is held', () => {
    for (const air of [false, true]) {
      const m = testMatch({ fighter: 'raftwars' });
      const kids = air ? placeInAir(m, 0, 60) : m.fighters[0]!;
      run(m, 1, { buttons: ['special'] });
      until(m, (f) => f.charge >= 20, { buttons: ['special'] });
      const [clip, frame] = clipFor(fighter, art, kids);
      expect(clip).toBe(air ? 'neutralBAir' : 'neutralB');
      expect(frame).toBe(AIMED_SHOT.charge - 1);
      const twinkle = new Set([0, 4, 8].map((g) => samplePose(art, clip, frame, g).symbols.fx1));
      expect([...twinkle].sort()).toEqual(POWER);
      const gun = samplePose(art, clip, frame, 0).world.gun!;
      expect(gunAngle(gun)).toBeCloseTo(-AIMED_SHOT.elevation, 6);
    }
  });

  it('fires in a muzzle puff with the launcher at the shot elevation, then kicks it up', () => {
    for (const clip of ['neutralB', 'neutralBAir']) {
      const fire = samplePose(art, clip, AIMED_SHOT.fire, 0);
      expect(fire.symbols.fx1).toBe('fxPuff');
      expect(gunAngle(fire.world.gun!)).toBeCloseTo(-AIMED_SHOT.elevation, 6);
      expect(gunAngle(samplePose(art, clip, 19, 0).world.gun!)).toBeLessThan(-30);
    }
  });

  it('has the ball in flight for the lab, spinning, previewed from the firing frame of both clips', () => {
    const prop = art.projectiles!.aimedShot!;
    expect(prop.symbols[prop.symbol]).toEqual({ loop: ['shotBallA', 'shotBallB'], fps: 20 });
    expect(prop.preview!.neutralB).toMatchObject({ frame: AIMED_SHOT.fire, ...AIMED_SHOT.muzzle });
    expect(prop.preview!.neutralBAir).toMatchObject({ frame: AIMED_SHOT.fire, ...AIMED_SHOT.airMuzzle });
  });
});

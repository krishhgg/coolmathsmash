import { describe, expect, it } from 'vitest';
import { shapesBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import type { PathShape } from '../../../render/rig/types';
import { DUCK_RAFT } from '../duckRaftData';
import { LINE } from './parts';
import { RIM } from './raft';
import { art } from '.';

const raft = art.rig.symbols.duckRaft as PathShape[];

describe('raft wars art: Duck Raft', () => {
  it('is FAF - 1 long and keyed on the frame the raft appears', () => {
    const clip = art.clips.downB!;
    expect(clip.length).toBe(DUCK_RAFT.faf - 1);
    expect(clip.active).toEqual([[DUCK_RAFT.place, DUCK_RAFT.place]]);
  });

  it('holds the folded raft until the frame the raft appears, then lets go in a puff', () => {
    for (let f = 2; f < DUCK_RAFT.place; f++)
      expect(samplePose(art, 'downB', f, f).symbols.held, `downB@${f}`).toBe('raftBundle');
    const out = samplePose(art, 'downB', DUCK_RAFT.place, DUCK_RAFT.place);
    expect(out.symbols.held).toBeNull();
    expect([out.symbols.fx1, out.symbols.fx2]).toEqual(['fxPuff', 'fxPuff']);
    const end = samplePose(art, 'downB', DUCK_RAFT.faf - 1, DUCK_RAFT.faf - 1);
    expect([end.symbols.held, end.symbols.fx1, end.symbols.fx2]).toEqual([null, null, null]);
  });

  it('puts the puff ahead of them above the rim of the raft the ground throw sets down', () => {
    const rim = -(DUCK_RAFT.ground.y - RIM);
    const pose = samplePose(art, 'downB', DUCK_RAFT.place, DUCK_RAFT.place);
    const { tx, ty } = pose.world.fx1!;
    expect(Math.abs(tx - DUCK_RAFT.ground.x)).toBeLessThan(DUCK_RAFT.width / 2);
    expect(ty).toBeLessThan(rim);
  });

  it('draws the hull on the floor under the entity and its rim just above the deck fighters stand on', () => {
    const [x0, , x1, y1] = shapesBounds(raft);
    expect(y1).toBeCloseTo(DUCK_RAFT.bottom + LINE, 1);
    expect(-RIM - DUCK_RAFT.deck).toBeCloseTo(0.95, 6);
    expect(x0).toBeLessThan(-DUCK_RAFT.width / 2);
    expect(x1).toBeGreaterThan(DUCK_RAFT.width / 2);
  });

  it('previews the raft in the lab where the ground throw puts it, from the frame it appears', () => {
    const prop = art.projectiles!.duckRaft!;
    expect(prop.symbol).toBe('duckRaft');
    expect(prop.preview!.downB).toEqual({ frame: DUCK_RAFT.place, ...DUCK_RAFT.ground });
  });
});

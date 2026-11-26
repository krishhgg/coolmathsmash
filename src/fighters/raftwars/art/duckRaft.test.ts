import { describe, expect, it } from 'vitest';
import { shapesBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import type { PathShape } from '../../../render/rig/types';
import { DUCK_RAFT } from '../duckRaftData';
import { LINE } from './parts';
import { RIM, RIM_BAND, popDrawings } from './raft';
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

  it('draws the raft behind fighters and only its rim band over them: the hull top down to just under the deck', () => {
    const prop = art.projectiles!.duckRaft!;
    expect([prop.symbol, prop.front]).toEqual(['duckRaft', 'duckRaftRim']);
    const rim = shapesBounds(art.rig.symbols.duckRaftRim as PathShape[]);
    const hull = shapesBounds(raft);
    // Down to RIM_BAND, past the deck, so the soles of whoever stands on it are behind it.
    expect(rim[3]).toBeCloseTo(RIM_BAND, 6);
    expect(RIM_BAND).toBeGreaterThan(-DUCK_RAFT.deck);
    expect(RIM_BAND - -DUCK_RAFT.deck).toBeLessThan(0.5);
    // The same top edge as the hull (rim, ink included), and as wide as the deck and more.
    expect(rim[1]).toBeCloseTo(RIM - 0.45 - LINE, 0);
    expect(rim[0]).toBeLessThan(-DUCK_RAFT.width / 2 - 1);
    expect(rim[2]).toBeGreaterThan(DUCK_RAFT.width / 2 + 1);
    expect(rim[1]).toBeGreaterThan(hull[1]);
  });

  it('pops in four drawings, three frames each, that stay above the floor the ground raft sat on', () => {
    expect(art.rig.symbols.duckRaftPop).toEqual({ loop: Object.keys(popDrawings), fps: 20 });
    expect(Object.keys(popDrawings)).toHaveLength(4);
    expect(4 * 3 - 1).toBe(DUCK_RAFT.popFrames);
    for (const [name, shapes] of Object.entries(popDrawings))
      expect(shapesBounds(shapes)[3], name).toBeLessThanOrEqual(DUCK_RAFT.bottom + 0.05);
    expect(art.projectiles!.duckRaftPop!.symbol).toBe('duckRaftPop');
  });

  it('previews the raft in the lab where the ground throw puts it, from the frame it appears', () => {
    const prop = art.projectiles!.duckRaft!;
    expect(prop.symbol).toBe('duckRaft');
    expect(prop.preview!.downB).toEqual({ frame: DUCK_RAFT.place, ...DUCK_RAFT.ground });
  });
});

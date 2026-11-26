import { describe, expect, it } from 'vitest';
import { poseBounds } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import { SHIP, finalSmash, finalSmashCinematic } from '../finalSmash';
import { art } from '.';

const sym = (clip: string, f: number) => samplePose(art, clip, f, f).symbols;
/** Where the ship (fx4) is drawn on clip frame `f`, in rig space. */
const shipAt = (clip: string, f: number) => {
  const m = samplePose(art, clip, f, f).world.fx4!;
  return { x: m.tx, y: m.ty };
};

describe('snail bob art: Shell Ship (Final Smash)', () => {
  it("keys each clip to its move: FAF - 1 frames long, active on the swoop's catch and on the launch", () => {
    expect(art.clips.finalSmash!.length).toBe(finalSmash.faf - 1);
    expect(art.clips.finalSmash!.active).toEqual([SHIP.catch]);
    expect(art.clips.finalSmashCinematic!.length).toBe(finalSmashCinematic.faf - 1);
    expect(art.clips.finalSmashCinematic!.active).toEqual([[SHIP.launch, SHIP.launch]]);
    for (const [name, move] of [
      ['finalSmash', finalSmash],
      ['finalSmashCinematic', finalSmashCinematic],
    ] as const)
      for (const f of [1, 28, 52, 84, move.faf - 1])
        expect(moveClipFrame(art.clips[name]!, f, move), `${name}@${f}`).toBe(Math.min(f, move.faf - 1));
  });

  it('presses the remote during the freeze and calls the ship, which swoops through in front of him on the catch', () => {
    expect([sym('finalSmash', 12).fx1, sym('finalSmash', 12).fx3]).toEqual(['remotePressed', 'pow']);
    expect(sym('finalSmash', 14).fx2).toMatch(/^signal\d$/);
    expect(sym('finalSmash', 10).fxBack).toBeNull();
    expect(sym('finalSmash', 16).fxBack).toMatch(/^ship\d$/);
    // Diving in from behind him, then streaking through the boxes ahead of him at their height.
    expect(shipAt('finalSmash', 16).x).toBeLessThan(-40);
    for (let f = SHIP.catch[0]; f <= SHIP.catch[1]; f++) {
      expect(sym('finalSmash', f).fxBack, `${f}`).toBe('shipSwoop');
      expect(shipAt('finalSmash', f).x).toBeGreaterThan(SHIP.boxes[0].x);
      expect(Math.abs(shipAt('finalSmash', f).y + SHIP.boxes[0].y)).toBeLessThan(2);
    }
    // A whiff: the ship has gone, the remote is put away and he stands as he started.
    expect(sym('finalSmash', 45).fxBack).toBeNull();
    const end = sym('finalSmash', art.clips.finalSmash!.length);
    expect([end.fx1, end.fxBack, end.head]).toEqual([null, null, 'head']);
  });

  it('carries the swoop on into the cinematic, lasers the victim on the laser hit and blasts them on the launch', () => {
    for (let f = 0; f <= 3; f++)
      expect(shipAt('finalSmashCinematic', f)).toEqual(shipAt('finalSmash', SHIP.catch[0] + f));
    expect(sym('finalSmashCinematic', 0).fx3).toBe('pow');
    expect(sym('finalSmashCinematic', SHIP.laser - 1).fx3).toBe('charge');
    const laser = sym('finalSmashCinematic', SHIP.laser);
    expect([laser.fx2, laser.fx3, laser.fxBack]).toEqual(['laser', 'zap', expect.stringMatching(/^ship\d$/)]);
    expect(sym('finalSmashCinematic', SHIP.laser + 11).fx2).toBeNull();
    // The beam leaves the muzzle and ends on the victim, a hold's reach in front of him.
    const pose = samplePose(art, 'finalSmashCinematic', SHIP.laser, SHIP.laser);
    const m = pose.world.fx2!;
    const tip = { x: m.a * 10 + m.tx, y: m.b * 10 + m.ty };
    expect(tip.x).toBeCloseTo(11, 1);
    expect(tip.y).toBeCloseTo(-7, 1);
    expect(sym('finalSmashCinematic', SHIP.launch).fx3).toBe('shipBlast');
    const end = sym('finalSmashCinematic', art.clips.finalSmashCinematic!.length);
    expect([end.fx1, end.fx2, end.fx3, end.fxBack, end.head]).toEqual([null, null, null, null, 'head']);
  });

  it('keeps his foot on the floor through both clips, the ship and its effects aside', () => {
    const bodyOnly = {
      ...art,
      rig: { ...art.rig, slots: art.rig.slots.filter((s) => !/^fx|smear/.test(s.name)) },
    };
    const off: string[] = [];
    for (const name of ['finalSmash', 'finalSmashCinematic'])
      for (let f = 0; f <= art.clips[name]!.length; f++) {
        const bottom = poseBounds(bodyOnly, samplePose(art, name, f, f))[3];
        if (Math.abs(bottom) > 0.3) off.push(`${name}@${f}: ${bottom.toFixed(2)}`);
      }
    expect(off).toEqual([]);
  });
});

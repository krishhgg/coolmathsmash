import { describe, expect, it } from 'vitest';
import { attack, placeInAir, run, testMatch, type Hold } from '../../../sim/testing/sim';
import { flattenPath, poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import type { FighterArt } from '../../../render/rig/types';
import type { FighterState } from '../../../sim/fighter';
import type { MatchState } from '../../../sim/match';
import { getFighter } from '../../registry';
import { LYING, RUN, STANDING, WALK } from '../tip';
import { art, lyingArt } from '.';
import { DEPTH } from './symbols';

const FORMS: [string, FighterArt][] = [
  [STANDING, art],
  [LYING, lyingArt],
];
const artOf = (f: FighterState) => (f.fighter === LYING ? lyingArt : art);

/** Canonical clip lengths (loops: any length). */
const LENGTHS: Record<string, number | 'loop' | 'hold'> = {
  idle: 'loop',
  walk: 'loop',
  dash: 12,
  run: 'loop',
  runBrake: 14,
  turn: 8,
  crouch: 'hold',
  jumpSquat: 3,
  jump: 40,
  doubleJump: 30,
  fall: 'loop',
  helpless: 'loop',
  land: 'hold',
  shield: 'hold',
  shieldDrop: 11,
  shieldBreak: 40,
  dizzy: 'loop',
  spotDodge: 27,
  rollForward: 31,
  rollBack: 31,
  airDodge: 49,
  ledgeCatch: 8,
  ledgeHang: 'loop',
  ledgeClimb: 34,
  ledgeRoll: 50,
  ledgeJump: 20,
  ledgeAttack: 55,
  hitstun: 20,
  tumble: 'loop',
  knockdown: 'loop',
  down: 'loop',
  getUp: 30,
  getupStand: 30,
  tech: 26,
  techInPlace: 26,
  techRoll: 40,
  respawn: 'loop',
  grabHold: 'loop',
  grabbed: 'loop',
  taunt: 60,
};

/** A block settled on Battlefield in `form`, facing right; airborne high above the stage for aerials. */
function block(form: string, air = false): MatchState {
  const m = testMatch({ fighter: STANDING });
  const f = m.fighters[0]!;
  f.fighter = form;
  f.facing = 1;
  if (air) placeInAir(m, 0, 140);
  return m;
}

/** Steps the simulation `frames` times, calling `each` with the fighter after every frame. */
function step(
  m: MatchState,
  frames: number,
  each: (f: FighterState) => void,
  hold: Hold | ((i: number) => Hold) = {},
) {
  const f = m.fighters[0]!;
  for (let i = 0; i < frames; i++) {
    run(m, 1, typeof hold === 'function' ? hold(i) : hold);
    each(f);
  }
}

describe('bloxorz block art', () => {
  it('has every canonical clip with its length, and a clip for every move lasting FAF - 1, in both forms', () => {
    for (const [form, a] of FORMS) {
      for (const [name, len] of Object.entries(LENGTHS)) {
        const clip = a.clips[name];
        expect(clip, `${form} ${name}`).toBeDefined();
        if (len === 'loop') expect(clip!.loop, `${form} ${name}`).toBe(true);
        else if (typeof len === 'number') expect(clip!.length, `${form} ${name}`).toBe(len);
        else expect(clip!.loop, `${form} ${name}`).toBeFalsy();
      }
      for (const [name, move] of Object.entries(getFighter(form).moves ?? {}))
        expect(a.clips[name]?.length, `${form} ${name}`).toBe(move.faf - 1);
    }
    expect(art.clips.walk!.length).toBe(WALK.period);
    expect(art.clips.run!.length).toBe(RUN.period);
  });

  it('only references bones, slots and symbols that exist, with keys in order inside the clip', () => {
    const bones = new Set(art.rig.bones.map((b) => b.name));
    const slots = new Set(art.rig.slots.map((s) => s.name));
    for (const [form, a] of FORMS)
      for (const [name, clip] of Object.entries(a.clips)) {
        let last = -Infinity;
        for (const key of clip.keys) {
          expect(key.frame, `${form} ${name}`).toBeGreaterThanOrEqual(last);
          expect(key.frame, `${form} ${name}`).toBeLessThanOrEqual(clip.length);
          last = key.frame;
          for (const bone of Object.keys(key.pose ?? {}))
            expect(bones.has(bone), `${name}: bone ${bone}`).toBe(true);
          for (const [slot, sym] of Object.entries({ ...clip.swaps, ...key.swaps })) {
            expect(slots.has(slot), `${name}: slot ${slot}`).toBe(true);
            if (sym !== null) expect(a.rig.symbols[sym], `${name}: symbol ${sym}`).toBeDefined();
          }
        }
        for (let f = 0; f <= clip.length; f++)
          expect(() => samplePose(a, name, f, f), `${name}@${f}`).not.toThrow();
      }
  });

  it('covers every hitbox centre with the block (or the dust it throws up) on every active frame, in the form the simulation is in', () => {
    const misses: string[] = [];
    for (const [start] of FORMS)
      for (const [name, move] of Object.entries(getFighter(start).moves ?? {})) {
        if (!move.hits.length) continue;
        const aerial = move.kind === 'aerial';
        const m = block(start, aerial);
        const f = attack(m, 0, name);
        const last = Math.max(...move.hits.map((h) => h.frames[1]));
        step(m, last, (f) => {
          if (f.move !== name) return;
          const def = getFighter(f.fighter).moves![name]!;
          const a = artOf(f);
          const pose = samplePose(a, name, f.actionFrame, f.actionFrame);
          for (const { frames, boxes } of def.hits) {
            if (f.actionFrame < frames[0] - 1 || f.actionFrame > frames[1]) continue;
            for (const { x, y } of boxes)
              if (!slotsCovering(a, pose, x, -y).length)
                misses.push(`${start}>${f.fighter} ${name}@${f.actionFrame} (${x}, ${y})`);
          }
        });
        expect(f.move === name || f.move === null, name).toBe(true);
      }
    expect(misses).toEqual([]);
  });

  it('tips about the leading bottom edge with the block centred on the simulated position, whichever form draws it', () => {
    const errors: string[] = [];
    const corners = (pose: ReturnType<typeof samplePose>) => {
      const w = pose.world.block!;
      return [
        [-6, -12],
        [6, -12],
        [6, 12],
        [-6, 12],
      ].map(([x, y]) => [w.a * x! + w.c * y! + w.tx, w.b * x! + w.d * y! + w.ty]);
    };
    /** `tipping`: the simulation is tipping the block on this frame (it slides on a few others). */
    const check = (
      label: string,
      m: MatchState,
      frames: number,
      clip: (f: FighterState) => string,
      hold: (i: number) => Hold,
      tipping: (f: FighterState) => boolean = (f) => f.pos.x !== f.prevPos.x,
    ) => {
      let pivotX: number | null = null;
      let turn = 0;
      let tipped = 0;
      step(
        m,
        frames,
        (f) => {
          const name = clip(f);
          const pose = samplePose(artOf(f), name, f.actionFrame, f.actionFrame);
          const centre = pose.world.block!;
          const tag = `${label} ${f.fighter} ${name}@${f.actionFrame}`;
          if (Math.abs(centre.tx) > 0.5) errors.push(`${tag}: centre ${centre.tx.toFixed(2)} off the origin`);
          if (!tipping(f)) {
            pivotX = null;
            return;
          }
          const pivot = pose.world.pivot!;
          tipped++;
          if (pose.local.pivot!.rot < turn - 45) pivotX = null;
          turn = pose.local.pivot!.rot;
          if (Math.abs(pivot.ty) > 0.01) errors.push(`${tag}: pivot ${pivot.ty.toFixed(2)} off the floor`);
          const near = Math.min(...corners(pose).map(([x, y]) => Math.hypot(x! - pivot.tx, y! - pivot.ty)));
          if (near > 0.01) errors.push(`${tag}: pivot not on a corner (${near.toFixed(2)})`);
          const worldX = f.pos.x + pivot.tx * f.facing;
          if (pivotX !== null && Math.abs(worldX - pivotX) > 0.5)
            errors.push(`${tag}: pivot slid ${(worldX - pivotX).toFixed(2)}`);
          pivotX = worldX;
        },
        hold,
      );
      expect(tipped, label).toBeGreaterThan(20);
    };
    for (const [form] of FORMS) {
      check(
        'walk',
        block(form),
        70,
        (f) => f.action,
        () => ({ x: 50 }),
      );
      check(
        'run',
        block(form),
        60,
        (f) => f.action,
        () => ({ x: 100 }),
      );
      const tips = { dashAttack: [1, 30], sideB: [3, 42] } as const;
      for (const [move, [from, to]] of Object.entries(tips)) {
        const m = block(form);
        attack(m, 0, move);
        const tipping = (f: FighterState) => f.move === move && f.actionFrame >= from && f.actionFrame <= to;
        check(
          move,
          m,
          45,
          (f) => f.move ?? f.action,
          () => ({}),
          tipping,
        );
      }
    }
    expect(errors).toEqual([]);
  });

  it('stands 24 units tall and 12 wide on its front face (the bevel adds the 3/4 depth), lying 24 by 12, feet on the ground', () => {
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    const [dx, dy] = [DEPTH[0], -DEPTH[1]];
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(24 + dy - 0.1);
    expect(-y0).toBeLessThan(24 + dy + 0.6);
    expect(x0).toBeCloseTo(-6, 1);
    expect(x1 - x0).toBeGreaterThan(12 + dx - 0.1);
    expect(x1 - x0).toBeLessThan(12 + dx + 0.6);
    const [lx0, ly0, lx1, ly1] = poseBounds(lyingArt, samplePose(lyingArt, 'idle', 0, 0));
    expect(ly1).toBeCloseTo(0, 1);
    expect(-ly0).toBeGreaterThan(12 + dy - 0.1);
    expect(-ly0).toBeLessThan(12 + dy + 0.6);
    expect(lx0).toBeCloseTo(-12, 1);
    expect(lx1 - lx0).toBeLessThan(24 + dx + 0.6);
  });

  it('hangs from the ledge where the engine puts the block, in both forms', () => {
    for (const [form, a] of FORMS) {
      const { width, height } = getFighter(form).stats;
      expect(a.ledgeGrip, form).toEqual([width / 2 + 0.5, -0.85 * height]);
    }
  });

  it('plants Lying forward smash on the same toe through the rising slam and return', () => {
    for (let f = 1; f <= 53; f++) {
      const pose = samplePose(lyingArt, 'fsmash', f, f);
      const [, , , bottom] = poseBounds(lyingArt, pose);
      expect(bottom, `fsmash@${f}`).toBeCloseTo(0, 1);
      expect(pose.world.pivot!.tx, `fsmash@${f}`).toBeCloseTo(12, 1);
    }
  });

  it('has four costumes with the same colour keys, palette colours only, and an icon', () => {
    expect(Object.keys(art.palettes).sort()).toEqual(['default', 'fragile', 'monolith', 'stone']);
    const keys = Object.keys(art.palettes.default).sort();
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
    }
    for (const [name, sym] of Object.entries(art.rig.symbols)) {
      if (!Array.isArray(sym)) continue;
      for (const shape of sym) {
        expect(flattenPath(shape.d).length, name).toBeGreaterThan(0);
        for (const c of [shape.fill, shape.stroke?.color])
          if (typeof c === 'string') expect(keys, `${name}: ${c}`).toContain(c);
      }
    }
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon).not.toContain('#00000000');
    expect(art.icon.length).toBeGreaterThan(1000);
    expect(lyingArt.icon).toBe(art.icon);
  });
});

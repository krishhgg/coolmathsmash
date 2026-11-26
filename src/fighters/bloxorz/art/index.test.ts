import { describe, expect, it } from 'vitest';
import { attack, placeInAir, run, testMatch, type Hold } from '../../../sim/testing/sim';
import { clipFor } from '../../../render/fighterView';
import { flattenPath, poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import { moveClipFrame } from '../../../render/rig/timing';
import type { FighterArt } from '../../../render/rig/types';
import {
  AIR_DODGE_NEUTRAL,
  DOUBLE_JUMP_FRAMES,
  GETUP_ROLL,
  GETUP_STAND,
  GRAB,
  LEDGE_ATTACK,
  LEDGE_CATCH_FRAMES,
  LEDGE_CLIMB,
  LEDGE_ROLL,
  ROLL_BACK,
  ROLL_FORWARD,
  RUN_BRAKE_FRAMES,
  RUN_TURN_FRAMES,
  SHIELD_DROP_FRAMES,
  SPOT_DODGE,
  TECH_IN_PLACE,
  TECH_ROLL,
} from '../../../sim/constants';
import type { FighterState } from '../../../sim/fighter';
import type { MatchState } from '../../../sim/match';
import { getFighter } from '../../registry';
import { stats } from '../stats';
import { DASH, LYING, RUN, STANDING, WALK } from '../tip';
import { art, lyingArt } from '.';
import { DEPTH } from './symbols';

const FORMS: [string, FighterArt][] = [
  [STANDING, art],
  [LYING, lyingArt],
];
const artOf = (f: FighterState) => (f.fighter === LYING ? lyingArt : art);

/** The tests that sample every frame of every clip, or step the simulation through every move, take a while. */
const SLOW = 60_000;

/**
 * Canonical clip lengths (loops: any length; hold: not looping). A clip for a timed engine action lasts until the
 * last frame before the action ends, so these follow the sim's constants and the block's stats and tip timing.
 */
const LENGTHS: Record<string, number | 'loop' | 'hold'> = {
  idle: 'loop',
  walk: 'loop',
  dash: DASH.period,
  run: 'loop',
  runBrake: RUN_BRAKE_FRAMES,
  turn: RUN_TURN_FRAMES,
  crouch: 'hold',
  jumpSquat: stats.jumpSquat,
  jump: 40,
  doubleJump: DOUBLE_JUMP_FRAMES,
  fall: 'loop',
  helpless: 'loop',
  land: 'hold',
  shield: 'hold',
  shieldDrop: SHIELD_DROP_FRAMES,
  shieldBreak: 40,
  dizzy: 'loop',
  spotDodge: SPOT_DODGE.faf - 1,
  rollForward: ROLL_FORWARD.faf - 1,
  rollBack: ROLL_BACK.faf - 1,
  airDodge: AIR_DODGE_NEUTRAL.faf - 1,
  ledgeCatch: LEDGE_CATCH_FRAMES,
  ledgeHang: 'loop',
  ledgeClimb: LEDGE_CLIMB.faf - 1,
  ledgeRoll: LEDGE_ROLL.faf - 1,
  ledgeJump: 20,
  ledgeAttack: LEDGE_ATTACK.faf - 1,
  hitstun: 20,
  tumble: 'loop',
  down: 'loop',
  getupStand: GETUP_STAND.faf - 1,
  getupRoll: GETUP_ROLL.faf - 1,
  getupRollBack: GETUP_ROLL.faf - 1,
  techInPlace: TECH_IN_PLACE.faf - 1,
  techRoll: TECH_ROLL.faf - 1,
  techRollBack: TECH_ROLL.faf - 1,
  respawn: 'loop',
  grabHold: 'loop',
  grabbed: 'loop',
  grabRelease: GRAB.releaseLag,
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

/** The clip and clip frame the renderer draws `f` with. */
const drawn = (f: FighterState): [string, number] => clipFor(getFighter(f.fighter), artOf(f), f);

describe('bloxorz block art', () => {
  it('has every canonical clip with its length in both forms, and tips in step with the simulation', () => {
    for (const [form, a] of FORMS)
      for (const [name, len] of Object.entries(LENGTHS)) {
        const clip = a.clips[name];
        expect(clip, `${form} ${name}`).toBeDefined();
        if (len === 'loop') expect(clip!.loop, `${form} ${name}`).toBe(true);
        else if (typeof len === 'number') {
          expect(clip!.length, `${form} ${name}`).toBe(len);
          expect(clip!.keys[clip!.keys.length - 1]!.frame, `${form} ${name}`).toBe(len);
        } else expect(clip!.loop, `${form} ${name}`).toBeFalsy();
      }
    expect(art.clips.walk!.length).toBe(WALK.period);
    expect(art.clips.run!.length).toBe(RUN.period);
  });

  it(
    "keys every move's strikes on its own hit windows and lasts FAF - 1, so the clip plays frame for frame",
    () => {
      for (const [form, a] of FORMS)
        for (const [name, move] of Object.entries(getFighter(form).moves ?? {})) {
          const clip = a.clips[name];
          expect(clip, `${form} ${name}`).toBeDefined();
          expect(clip!.length, `${form} ${name}`).toBe(move.faf - 1);
          const impact = move.throw?.frame ?? move.pummel?.frame;
          const windows = move.hits.length ? move.hits.map((h) => h.frames) : [[impact, impact]];
          expect(clip!.active, `${form} ${name}`).toEqual(windows);
          for (let f = 0; f < move.faf; f++)
            expect(moveClipFrame(clip!, f, move), `${form} ${name}@${f}`).toBe(f);
        }
    },
    SLOW,
  );

  it(
    'only references bones, slots and symbols that exist, with keys in order inside the clip',
    () => {
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
    },
    SLOW,
  );

  it(
    'covers every hitbox centre with the block (or the dust it throws up) from the frame before each hit window, in the form the simulation is in',
    () => {
      const misses: string[] = [];
      for (const [start] of FORMS)
        for (const [name, move] of Object.entries(getFighter(start).moves ?? {})) {
          if (!move.hits.length) continue;
          const m = block(start, move.kind === 'aerial');
          const f = attack(m, 0, name);
          const last = Math.max(...move.hits.map((h) => h.frames[1]));
          step(m, last, (f) => {
            if (f.move !== name) return;
            const def = getFighter(f.fighter).moves![name]!;
            const a = artOf(f);
            const [clip, frame] = drawn(f);
            const pose = samplePose(a, clip, frame, f.actionFrame);
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
    },
    SLOW,
  );

  it(
    'tips about the leading bottom edge with the block centred on the simulated position, whichever form draws it',
    () => {
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
            const [name, frame] = drawn(f);
            const pose = samplePose(artOf(f), name, frame, f.actionFrame);
            const centre = pose.world.block!;
            const tag = `${label} ${f.fighter} ${name}@${f.actionFrame}`;
            if (Math.abs(centre.tx) > 0.5)
              errors.push(`${tag}: centre ${centre.tx.toFixed(2)} off the origin`);
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
        check('walk', block(form), 70, () => ({ x: 50 }));
        check('run', block(form), 60, () => ({ x: 100 }));
        const tips = { dashAttack: [1, 30], sideB: [3, 42] } as const;
        for (const [move, [from, to]] of Object.entries(tips)) {
          const m = block(form);
          attack(m, 0, move);
          const tipping = (f: FighterState) =>
            f.move === move && f.actionFrame >= from && f.actionFrame <= to;
          check(move, m, 45, () => ({}), tipping);
        }
      }
      expect(errors).toEqual([]);
    },
    SLOW,
  );

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

  it('rolls out of a tech or knockdown away from the facing by turning the other way from the same pose', () => {
    for (const [form, a] of FORMS)
      for (const roll of ['techRoll', 'getupRoll']) {
        const turn = (clip: string, f: number) => samplePose(a, clip, f, f).local.pivot!.rot;
        const end = a.clips[roll]!.length;
        const back = `${roll}Back`;
        expect(a.clips[back]!.length, `${form} ${back}`).toBe(end);
        expect(turn(back, 0), `${form} ${back}`).toBeCloseTo(turn(roll, 0), 5);
        expect(turn(back, end) - turn(back, 0), `${form} ${back}`).toBeCloseTo(
          -(turn(roll, end) - turn(roll, 0)),
          5,
        );
      }
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

  it('has four costumes with the same colour keys, palette colours only', () => {
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
  });

  it('draws one icon for both forms in viewBox coordinates, centred in a square with room for the outline', () => {
    expect(lyingArt.icon).toBe(art.icon);
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon).not.toContain('transform');
    expect(art.icon).not.toContain('#00000000');
    expect(art.icon.length).toBeGreaterThan(1000);
    const [vx, vy, w, h] = /viewBox="([^"]+)"/.exec(art.icon)![1]!.split(' ').map(Number) as [
      number,
      number,
      number,
      number,
    ];
    expect(w).toBeCloseTo(h, 2);
    const points = [...art.icon.matchAll(/ d="([^"]+)"/g)].flatMap((m) => flattenPath(m[1]!).flat());
    const xs = points.filter((_, i) => i % 2 === 0);
    const ys = points.filter((_, i) => i % 2 === 1);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    expect(x0).toBeGreaterThan(vx + 0.5);
    expect(y0).toBeGreaterThan(vy + 0.5);
    expect(x1).toBeLessThan(vx + w - 0.5);
    expect(y1).toBeLessThan(vy + h - 0.5);
    expect(Math.abs((x0 + x1) / 2 - (vx + w / 2))).toBeLessThan(w * 0.02);
    expect(Math.abs((y0 + y1) / 2 - (vy + h / 2))).toBeLessThan(h * 0.02);
  });
});

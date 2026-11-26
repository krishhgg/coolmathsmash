import { describe, expect, it } from 'vitest';
import { flattenPath, poseBounds, slotsCovering } from '../../../render/rig/geometry';
import { samplePose } from '../../../render/rig/sample';
import type { PathShape, SymbolLoop } from '../../../render/rig/types';
import {
  AIR_DODGE_NEUTRAL,
  GETUP_ROLL,
  GETUP_STAND,
  ROLL_BACK,
  ROLL_FORWARD,
  SPOT_DODGE,
  TECH_IN_PLACE,
  TECH_ROLL,
} from '../../../sim/constants';
import { placeInAir, run, testMatch, until } from '../../../sim/testing/sim';
import { entities } from '../entities';
import { moves } from '../moves';
import { stats } from '../stats';
import { art } from '.';

/** Canonical clip lengths (loops: any length). */
const LENGTHS: Record<string, number | 'loop' | 'hold'> = {
  idle: 'loop',
  walk: 'loop',
  dash: 10,
  run: 'loop',
  runBrake: 14,
  turn: 8,
  crouch: 'hold',
  jumpSquat: 3,
  jump: 40,
  doubleJump: 30,
  fall: 'loop',
  land: 4,
  shield: 'hold',
  shieldDrop: 11,
  shieldBreak: 40,
  spotDodge: SPOT_DODGE.faf - 1,
  rollForward: ROLL_FORWARD.faf - 1,
  rollBack: ROLL_BACK.faf - 1,
  airDodge: AIR_DODGE_NEUTRAL.faf - 1,
  ledgeCatch: 19,
  ledgeHang: 'loop',
  ledgeClimb: 34,
  ledgeRoll: 45,
  ledgeJump: 20,
  ledgeAttack: 55,
  hitstun: 20,
  tumble: 'loop',
  helpless: 'loop',
  down: 'loop',
  getupStand: GETUP_STAND.faf - 1,
  getupRoll: GETUP_ROLL.faf - 1,
  techInPlace: TECH_IN_PLACE.faf - 1,
  techRoll: TECH_ROLL.faf - 1,
  dizzy: 'loop',
  grabHold: 'loop',
  grabbed: 'loop',
  taunt: 60,
  respawn: 60,
};

describe('duck art', () => {
  it('has every canonical clip with its length, and a clip for every move ending at its FAF', () => {
    for (const [name, len] of Object.entries(LENGTHS)) {
      const clip = art.clips[name];
      expect(clip, name).toBeDefined();
      if (len === 'loop') expect(clip!.loop, name).toBe(true);
      else if (typeof len === 'number') expect(clip!.length, name).toBe(len);
      else expect(clip!.loop, name).toBeFalsy();
    }
    for (const [name, move] of Object.entries(moves))
      expect(art.clips[name]?.length, name).toBe(move.faf - 1);
  });

  it("draws Running Ram's charge with a clip one frame per charge frame, up to a full charge", () => {
    expect(art.clips.sideBCharge!.length).toBe(moves.sideB!.chargeFrames);
    expect(art.clips.sideBCharge!.loop).toBeFalsy();
  });

  it('only references bones, slots and symbols that exist, with keys in order inside the clip', () => {
    const bones = new Set(art.rig.bones.map((b) => b.name));
    const slots = new Set(art.rig.slots.map((s) => s.name));
    for (const [name, clip] of Object.entries(art.clips)) {
      let last = -Infinity;
      for (const key of clip.keys) {
        expect(key.frame, name).toBeGreaterThanOrEqual(last);
        expect(key.frame, name).toBeLessThanOrEqual(clip.length);
        last = key.frame;
        for (const bone of Object.keys(key.pose ?? {}))
          expect(bones.has(bone), `${name}: bone ${bone}`).toBe(true);
        for (const [slot, sym] of Object.entries({ ...clip.swaps, ...key.swaps })) {
          expect(slots.has(slot), `${name}: slot ${slot}`).toBe(true);
          if (sym !== null) expect(art.rig.symbols[sym], `${name}: symbol ${sym}`).toBeDefined();
        }
        for (const slot of Object.keys(key.z ?? {})) expect(slots.has(slot), `${name}: z ${slot}`).toBe(true);
      }
      for (let f = 0; f <= clip.length; f++)
        expect(() => samplePose(art, name, f, f), `${name}@${f}`).not.toThrow();
    }
  });

  it("covers every hitbox centre in moves.ts with a drawn part through the hit's active frames", () => {
    const misses: string[] = [];
    for (const [name, move] of Object.entries(moves))
      for (const { frames, boxes } of move.hits)
        for (let f = frames[0] - 1; f <= frames[1]; f++) {
          const pose = samplePose(art, name, f, f);
          for (const { x, y } of boxes)
            if (!slotsCovering(art, pose, x, -y).length) misses.push(`${name}@${f} (${x}, ${y})`);
        }
    expect(misses).toEqual([]);
  });

  it("draws Evolved Stomp's burst and shockwave inside their hitboxes, so nobody sees them reach before they hit", () => {
    const misses: string[] = [];
    for (const [entity, prop] of [
      ['stomp', 'stomp'],
      ['wave', 'wave'],
      ['waveAir', 'waveAir'],
    ] as const) {
      const boxes = entities[entity]!.hits!.flatMap((w) => w.boxes);
      const loop = art.rig.symbols[art.projectiles![prop]!.symbol] as SymbolLoop;
      for (const name of new Set(loop.loop))
        for (const shape of art.rig.symbols[name] as PathShape[]) {
          // A prop is drawn around its entity's centre, y down; the boxes sit round the same centre, y up. A stroke
          // reaches half its width past the path.
          const ink = (shape.stroke?.width ?? 0) / 2;
          for (const p of flattenPath(shape.d))
            for (let i = 0; i < p.length; i += 2) {
              const [x, y] = [p[i]!, p[i + 1]!];
              const out = Math.min(...boxes.map((b) => Math.hypot(x - b.x, y + b.y) - b.radius)) + ink;
              if (out > 1e-6) misses.push(`${name} (${x.toFixed(1)}, ${y.toFixed(1)}) by ${out.toFixed(2)}`);
            }
        }
    }
    expect(misses).toEqual([]);
    const xs = (name: string, keep: (s: PathShape) => boolean) =>
      (art.rig.symbols[name] as PathShape[])
        .filter(keep)
        .flatMap((s) => flattenPath(s.d).flatMap((p) => p.filter((_, i) => i % 2 === 0)));
    // The shockwave's yellow front follows the 45% box's own edge: it reaches to within a unit of it, 12 above the
    // floor.
    const waveFront = Math.max(...entities.wave!.hits![0]!.boxes.map((b) => b.x + b.radius));
    expect(waveFront - Math.max(...xs('fxWave0', (s) => s.fill === 'star'))).toBeLessThan(1);
    // The burst's dome spans its circles: its rim reaches to within 2.5 units of their back and front edges on its
    // first frames, and within a unit once it has spread.
    const slam = entities.stomp!.hits![0]!.boxes;
    const [back, front] = [
      Math.min(...slam.map((b) => b.x - b.radius)),
      Math.max(...slam.map((b) => b.x + b.radius)),
    ];
    for (const [name, near] of [
      ['fxBurst0', 2.5],
      ['fxBurst2', 1],
    ] as const) {
      const rim = xs(name, (s) => s.stroke !== undefined && s.fill === undefined);
      expect(Math.min(...rim) - back, name).toBeLessThan(near);
      expect(front - Math.max(...rim), name).toBeLessThan(near);
    }
  });

  it("stands as tall and wide as the Duck's stats, feet on the ground", () => {
    expect(art.height).toBe(stats.height);
    const [x0, y0, x1, y1] = poseBounds(art, samplePose(art, 'idle', 0, 0));
    expect(y1).toBeCloseTo(0, 1);
    expect(-y0).toBeGreaterThan(stats.height - 0.3);
    expect(-y0).toBeLessThan(stats.height + 0.3);
    expect(x1 - x0).toBeGreaterThan(stats.width - 0.5);
    expect(x1 - x0).toBeLessThan(stats.width + 0.5);
  });

  it('rolls across the stage lip without the rig sinking under the floor', () => {
    const match = testMatch({ fighter: 'duck' });
    const duck = placeInAir(match, -86, 6);
    until(match, (f) => f.action === 'ledgeHang');
    run(match, 1, { buttons: ['shield'] });
    for (const frame of [10, 18, 26]) {
      until(match, (f) => f.action === 'ledgeRoll' && f.actionFrame === frame);
      const [, , , bottom] = poseBounds(art, samplePose(art, 'ledgeRoll', frame, match.frame));
      expect(bottom - duck.pos.y, `ledgeRoll@${frame}`).toBeLessThan(3);
    }
  });

  it('has the crown, evil and paint costumes with the same colour keys, and an icon', () => {
    const keys = Object.keys(art.palettes.default).sort();
    expect(Object.keys(art.palettes)).toEqual(expect.arrayContaining(['default', 'crown', 'evil']));
    expect(Object.keys(art.palettes).length).toBeGreaterThanOrEqual(5);
    for (const palette of Object.values(art.palettes)) {
      expect(Object.keys(palette).sort()).toEqual(keys);
      for (const c of Object.values(palette)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    const bodies = Object.entries(art.palettes)
      .filter(([name]) => name !== 'crown')
      .map(([, p]) => p.body);
    expect(new Set(bodies).size).toBe(bodies.length);
    expect(art.rig.symbols.crown).toBeDefined();
    expect(art.icon).toMatch(/^<svg [^>]*viewBox="[-\d. ]+"/);
    expect(art.icon.length).toBeGreaterThan(1000);
  });
});

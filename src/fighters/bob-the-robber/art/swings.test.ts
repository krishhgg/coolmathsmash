import { describe, expect, it } from 'vitest';
import { flattenPath, poseBounds, shapesContain } from '../../../render/rig/geometry';
import { samplePose, toLocal, type RigPose } from '../../../render/rig/sample';
import type { PathShape } from '../../../render/rig/types';
import { art } from '.';

/** Swings checked frame by frame. Bob's other grounded clips still dip into the floor, so they join once fixed. */
const SWINGS = [
  'jab',
  'jab2',
  'jab3',
  'ftilt',
  'utilt',
  'dtilt',
  'dashAttack',
  'fsmash',
  'dsmash',
  'getupAttack',
  'dashGrab',
  'dthrow',
  'ledgeAttack',
  'usmash',
  'grab',
  'pivotGrab',
  'fthrow',
  'bthrow',
  'uthrow',
];

/**
 * The frame each swing's checks start from. The ledge attack opens with the ledge climb, drawn frame by frame and
 * shared with ledgeClimb and ledgeRoll, so its checks start on frame 12, where the climb leaves him standing.
 */
const FROM: Record<string, number> = { ledgeAttack: 12 };
const from = (name: string) => FROM[name] ?? 0;

/** How far a drawn part may reach below the floor (rig y 0), as in Fireboy's rolls and Runner's getup attack. */
const SINK = 0.2;

/**
 * The most a drawn part may turn from one frame to the next, in degrees. The forward smash's fastest real frame
 * turns the baton and back arm 56 degrees into the hit. A tween that goes the long way round from one key's angle
 * to the next peaked at 109 to 252 degrees a frame in it before the fix, and past 180 the eye reads a turn as
 * going backwards.
 */
const TURN = 60;

/**
 * The most a part may turn per frame while a swing strikes, from two frames before a hit window opens until it
 * closes. Jabs and tilts reach their hit two frames after the wind-up, so the forward tilt turns its baton 118
 * degrees into the hit and the up tilt twirls it 90 a frame. Anything under half a turn still reads the right way.
 */
const STRIKE = 120;

const striking = (name: string, f: number) =>
  (art.clips[name]!.active ?? []).some(([from, to]) => f >= from - 2 && f <= to);

/** Where the baton's tip sits along its bone (as `tipOf` in poses.ts). */
const TIP = 7.5;

const parents = Object.fromEntries(art.rig.bones.map((b) => [b.name, b.parent]));

/** A bone's rotation in rig space, unwrapped (its own turn plus its parents'), so a full spin counts 360. */
function turn(pose: RigPose, bone: string): number {
  let deg = 0;
  for (let b: string | undefined = bone; b; b = parents[b]) deg += pose.local[b]!.rot;
  return deg;
}

/** Props held in a hand. */
const PROPS = ['baton', 'sack', 'gun'];

/**
 * How much of a part a held prop may overlap, in square units, on both sides of a change in their draw order. The
 * ready stance's baton crosses 0.06 of his cheek and a swing's prop can pass the edge of his head at a key, but a
 * sack that moves from over his belly to behind it covers 15 and is seen to jump.
 */
const OVERLAP = 0.25;

/** Grid spacing for measuring overlaps. */
const CELL = 0.1;

const slots = Object.fromEntries(art.rig.slots.map((s) => [s.name, s]));

/** The drawing in `slot` in `pose`, if it has one. */
function drawing(pose: RigPose, slot: string): PathShape[] | undefined {
  const name = pose.symbols[slot];
  const sym = name ? art.rig.symbols[name] : undefined;
  return Array.isArray(sym) ? sym : undefined;
}

/** Rig-space [minX, minY, maxX, maxY] of `slot`'s drawing in `pose`. */
function bounds(pose: RigPose, slot: string): [number, number, number, number] {
  const m = pose.world[slots[slot]!.bone]!;
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const shape of drawing(pose, slot) ?? [])
    for (const p of flattenPath(shape.d))
      for (let i = 0; i < p.length; i += 2) {
        const x = m.a * p[i]! + m.c * p[i + 1]! + m.tx;
        const y = m.b * p[i]! + m.d * p[i + 1]! + m.ty;
        b[0] = Math.min(b[0], x);
        b[1] = Math.min(b[1], y);
        b[2] = Math.max(b[2], x);
        b[3] = Math.max(b[3], y);
      }
  return b;
}

/** Whether `slot`'s drawing covers rig point (x, y) in `pose`. */
const covers = (pose: RigPose, slot: string, x: number, y: number) =>
  shapesContain(drawing(pose, slot)!, ...toLocal(pose.world[slots[slot]!.bone]!, x, y));

/**
 * Whether `slot`'s drawing covers more than OVERLAP of the rig points inside `box` that pass `inside`, in `pose`,
 * measured on a CELL grid.
 */
function overlapsRegion(
  pose: RigPose,
  slot: string,
  box: [number, number, number, number],
  inside: (x: number, y: number) => boolean,
): boolean {
  const [a0, a1, a2, a3] = bounds(pose, slot);
  let cells = 0;
  for (let x = Math.max(a0, box[0]) + CELL / 2; x < Math.min(a2, box[2]); x += CELL)
    for (let y = Math.max(a1, box[1]) + CELL / 2; y < Math.min(a3, box[3]); y += CELL)
      if (covers(pose, slot, x, y) && inside(x, y) && ++cells * CELL * CELL > OVERLAP) return true;
  return false;
}

/** Whether the drawings in slots `a` and `b` overlap by more than OVERLAP in `pose`. */
const overlaps = (pose: RigPose, a: string, b: string) =>
  overlapsRegion(pose, a, bounds(pose, b), (x, y) => covers(pose, b, x, y));

/** Each slot's place in the draw order, back to front. */
function layers(pose: RigPose): Record<string, number> {
  const order = art.rig.slots
    .map((s, i) => ({ name: s.name, z: pose.z[s.name] ?? i, i }))
    .sort((a, b) => a.z - b.z || a.i - b.i);
  return Object.fromEntries(order.map((s, k) => [s.name, k]));
}

/** Bones that carry a drawing in `pose`. */
const drawn = (pose: RigPose) =>
  new Set(art.rig.slots.filter((s) => pose.symbols[s.name] !== null).map((s) => s.bone));

describe("bob's baton swings", () => {
  it('keeps every drawn part, the baton tip included, above the floor on every frame', () => {
    const sunk: string[] = [];
    for (const name of SWINGS)
      for (let f = from(name); f <= art.clips[name]!.length; f++) {
        const pose = samplePose(art, name, f, f);
        const bottom = poseBounds(art, pose)[3];
        const m = pose.world.baton!;
        const tip = pose.symbols.baton ? m.b * TIP + m.ty : -Infinity;
        if (bottom > SINK || tip > SINK)
          sunk.push(`${name}@${f} ${bottom.toFixed(2)}${tip > SINK ? ` (tip ${tip.toFixed(2)})` : ''}`);
      }
    expect(sunk).toEqual([]);
  });

  it(`turns no drawn part more than ${TURN} degrees between frames, or ${STRIKE} as it strikes`, () => {
    const spun: string[] = [];
    for (const name of SWINGS) {
      let prev = samplePose(art, name, from(name), from(name));
      for (let f = from(name) + 1; f <= art.clips[name]!.length; f++) {
        const pose = samplePose(art, name, f, f);
        const before = drawn(prev);
        const limit = striking(name, f) ? STRIKE : TURN;
        for (const bone of drawn(pose)) {
          const deg = turn(pose, bone) - turn(prev, bone);
          if (before.has(bone) && Math.abs(deg) > limit) spun.push(`${name}@${f} ${bone} ${deg.toFixed(0)}`);
        }
        prev = pose;
      }
    }
    expect(spun).toEqual([]);
  });

  it('never moves a held prop in front of or behind a part it covers from one frame to the next', () => {
    const popped: string[] = [];
    for (const name of SWINGS) {
      let prev = samplePose(art, name, from(name), from(name));
      for (let f = from(name) + 1; f <= art.clips[name]!.length; f++) {
        const pose = samplePose(art, name, f, f);
        const [was, now] = [layers(prev), layers(pose)];
        for (const prop of PROPS.filter((p) => drawing(prev, p) && drawing(pose, p)))
          for (const { name: part, decor } of art.rig.slots) {
            if (part === prop || decor || !drawing(prev, part) || !drawing(pose, part)) continue;
            const over = now[prop]! > now[part]!;
            if (over === was[prop]! > was[part]!) continue;
            if (overlaps(prev, prop, part) && overlaps(pose, prop, part))
              popped.push(`${name}@${f} ${prop} ${over ? 'over' : 'under'} ${part}`);
          }
        prev = pose;
      }
    }
    expect(popped).toEqual([]);
  });

  it("keeps the dash attack's sack off his face", () => {
    const covered: string[] = [];
    for (let f = 0; f <= art.clips.dashAttack!.length; f++) {
      const pose = samplePose(art, 'dashAttack', f, f);
      const order = layers(pose);
      if (!drawing(pose, 'sack') || order.sack! < order.head!) continue;
      // His face: his head as drawn, below the bottom of his hat.
      const [x0, , x1, y1] = bounds(pose, 'head');
      const face = (x: number, y: number) => covers(pose, 'head', x, y) || covers(pose, 'face', x, y);
      if (overlapsRegion(pose, 'sack', [x0, bounds(pose, 'hat')[3], x1, y1], face))
        covered.push(`dashAttack@${f}`);
    }
    expect(covered).toEqual([]);
  });
});

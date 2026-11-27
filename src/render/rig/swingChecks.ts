import { flattenPath, poseBounds, shapesContain } from './geometry';
import { samplePose, toLocal, type RigPose } from './sample';
import type { FighterArt, PathShape } from './types';

/**
 * Frame-by-frame checks on a fighter's clips, as Bob's swing checks first ran them (#287, #315, #325): nothing
 * drawn sinks into the floor, no part turns too far between frames, no held prop jumps in front of or behind a
 * part it covers, and a prop drawn over the head stays off the face. Tests and the survey script share them.
 */

/** How far a drawn part may reach below the floor (rig y 0), as in Fireboy's rolls and Runner's getup attack. */
export const SINK = 0.2;

/**
 * The most a drawn part may turn from one frame to the next, in degrees. Past 180 the eye reads a turn as going
 * backwards; a tween that goes the long way round between keys peaks well above this.
 */
export const TURN = 60;

/**
 * The most a part may turn per frame while a move strikes, from two frames before a hit window opens until it
 * closes. Anything under half a turn still reads the right way.
 */
export const STRIKE = 120;

/**
 * How much of a part a held prop may overlap, in square units, on both sides of a change in their draw order. A
 * prop can pass the edge of a part at a key, but one that moves from over a body to behind it is seen to jump.
 */
export const OVERLAP = 0.25;

/** Grid spacing for measuring overlaps. */
const CELL = 0.1;

/** The face check: `prop` drawn over the head may not cover more than OVERLAP of the face below the hat. */
export interface FaceCheck {
  prop: string;
  clips: string[];
  /** Slots: the head, the features drawn on it and the hat whose bottom edge the face starts below. */
  head: string;
  features: string;
  hat: string;
}

/**
 * A bone meant to spin (a wheel, a shell, a rolling block, a spin effect), which the turn check leaves out. The
 * other checks still apply to it.
 */
export interface Spin {
  bone: string;
  /** Why it spins, in a line. */
  why: string;
  /** The clips it spins in; every clip when not given. */
  clips?: string[];
}

/**
 * A frame on which a clip cuts to a new shot, such as the lights going out or a spotlight coming on. The turn and
 * draw-order checks skip the step into that frame and check every other step as usual.
 */
export interface Cut {
  clip: string;
  frame: number;
  /** What the new shot is, in a line. */
  why: string;
}

/**
 * A part drawn over the fighter on some of a clip's frames, such as a fight cloud. On those frames the turn check
 * leaves out a part the cover hides. To be hidden, the part lies inside the cover's drawn bounds, the cover's
 * opaque fills cover every point of its bounds, and the cover is drawn over it. A part the cover doesn't hide on
 * the frame is still checked, so a part coming out from under the cover at a new angle fails.
 */
export interface Cover {
  clip: string;
  /** The covering slot. */
  slot: string;
  /** The first and last frames on which it may hide a part. */
  from: number;
  to: number;
  /** What covers the fighter, in a line. */
  why: string;
}

/** Which of a fighter's clips the checks run on, and its allowances. */
export interface SwingChecks {
  /** Clips on the ground: every check. */
  ground: string[];
  /** Clips in the air: every check but the floor. */
  air: string[];
  /** The frame a clip's checks start from (0 when not listed). */
  from?: Record<string, number>;
  /**
   * Clips in the air that end standing on the floor, with the frame the floor check runs on them from: a ledge getup
   * once the engine has it on the stage.
   */
  groundFrom?: Record<string, number>;
  /** Held props, whose draw order against the parts they cover is checked. Found from the rig when not given. */
  props?: string[];
  /** Points along a prop's bone (distance from its origin) that must stay above the floor while it is drawn. */
  tips?: Record<string, number>;
  /** Symbol name prefixes of drawings that lie on the floor in perspective, left out of the floor check. */
  decals?: string[];
  /** Bones meant to spin, left out of the turn check. */
  spins?: Spin[];
  /** Frames where a clip cuts to a new shot, whose step in the turn and draw-order checks skip. */
  cuts?: Cut[];
  /** Parts drawn over the fighter, which leave the parts they hide out of the turn check. */
  covered?: Cover[];
  face?: FaceCheck;
}

export type Check = 'floor' | 'turn' | 'order' | 'face';

/** One failing frame. `value` is how far it fails: depth under the floor, degrees turned, or 1 for a jump. */
export interface Finding {
  clip: string;
  frame: number;
  check: Check;
  part: string;
  value: number;
  /** The frame as Bob's checks print it. */
  text: string;
}

/**
 * Slots carried by a forearm or a hand (or a bone hanging from one) that aren't part of the arm itself: a baton,
 * a sack, a paddle, a cane.
 */
export function heldProps(art: FighterArt): string[] {
  const parent = Object.fromEntries(art.rig.bones.map((b) => [b.name, b.parent]));
  const carried = (bone: string | undefined): boolean =>
    !!bone && (/^(fore|hand)/.test(bone) || carried(parent[bone]));
  return art.rig.slots
    .filter((s) => !s.decor && carried(s.bone) && !/^(arm|fore|hand)/.test(s.name) && !/Line$/.test(s.name))
    .map((s) => s.name);
}

/** Everything one fighter's checks need, worked out once from its rig. */
function context(art: FighterArt) {
  const parents = Object.fromEntries(art.rig.bones.map((b) => [b.name, b.parent]));
  const slots = Object.fromEntries(art.rig.slots.map((s) => [s.name, s]));

  /**
   * Whether `bone`'s parent is drawn mirrored in `pose` (flipped, such as a body with sx -1): an odd number of its
   * ancestors, the parent included, have a negative sx * sy. A scale passing through 0 counts as unmirrored for
   * every part under it alike.
   */
  const mirrored = (pose: RigPose, bone: string): boolean => {
    let odd = false;
    for (let b = parents[bone]; b; b = parents[b]) if (pose.local[b]!.sx * pose.local[b]!.sy < 0) odd = !odd;
    return odd;
  };

  /**
   * A bone's turn on screen, unwrapped so a full spin counts 360: its parent's, plus its own rotation, which turns
   * the other way on screen under a mirrored parent.
   */
  const turn = (pose: RigPose, bone: string): number => {
    const parent = parents[bone];
    const own = pose.local[bone]!.rot;
    return parent ? turn(pose, parent) + (mirrored(pose, bone) ? -own : own) : own;
  };

  /** A bone's turn in its own rig, mirror or not: its own rotation plus its parents'. */
  const facingTurn = (pose: RigPose, bone: string): number => {
    let deg = 0;
    for (let b: string | undefined = bone; b; b = parents[b]) deg += pose.local[b]!.rot;
    return deg;
  };

  /**
   * How far `bone` turns from `prev` to `pose`. Across a frame where its parent flips to face the other way, the part
   * reads right either keeping its angle on screen (Snail Bob's stalks as he whirls round) or flipping with its
   * parent (a roll's legs as the body turns round through a squash), so it counts the smaller of the two, each the
   * short way round.
   */
  const turned = (prev: RigPose, pose: RigPose, bone: string): number => {
    const deg = turn(pose, bone) - turn(prev, bone);
    if (mirrored(pose, bone) === mirrored(prev, bone)) return deg;
    const short = (d: number) => d - 360 * Math.round(d / 360);
    const [kept, flipped] = [short(deg), short(facingTurn(pose, bone) - facingTurn(prev, bone))];
    return Math.abs(kept) <= Math.abs(flipped) ? kept : flipped;
  };

  /** The drawing in `slot` in `pose`, if it has one. */
  const drawing = (pose: RigPose, slot: string): PathShape[] | undefined => {
    const name = pose.symbols[slot];
    const sym = name ? art.rig.symbols[name] : undefined;
    return Array.isArray(sym) ? sym : undefined;
  };

  /** Rig-space [minX, minY, maxX, maxY] of `slot`'s drawing in `pose`. */
  const bounds = (pose: RigPose, slot: string): [number, number, number, number] => {
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
  };

  /** Whether `slot`'s drawing covers rig point (x, y) in `pose`. */
  const covers = (pose: RigPose, slot: string, x: number, y: number) =>
    shapesContain(drawing(pose, slot)!, ...toLocal(pose.world[slots[slot]!.bone]!, x, y));

  /**
   * Whether `slot`'s drawing covers more than OVERLAP of the rig points inside `box` that pass `inside`, in
   * `pose`, measured on a CELL grid.
   */
  const overlapsRegion = (
    pose: RigPose,
    slot: string,
    box: [number, number, number, number],
    inside: (x: number, y: number) => boolean,
  ): boolean => {
    const [a0, a1, a2, a3] = bounds(pose, slot);
    let cells = 0;
    for (let x = Math.max(a0, box[0]) + CELL / 2; x < Math.min(a2, box[2]); x += CELL)
      for (let y = Math.max(a1, box[1]) + CELL / 2; y < Math.min(a3, box[3]); y += CELL)
        if (covers(pose, slot, x, y) && inside(x, y) && ++cells * CELL * CELL > OVERLAP) return true;
    return false;
  };

  /** Whether the drawings in slots `a` and `b` overlap by more than OVERLAP in `pose`. */
  const overlaps = (pose: RigPose, a: string, b: string) =>
    overlapsRegion(pose, a, bounds(pose, b), (x, y) => covers(pose, b, x, y));

  /** Each slot's place in the draw order, back to front. */
  const layers = (pose: RigPose): Record<string, number> => {
    const order = art.rig.slots
      .map((s, i) => ({ name: s.name, z: pose.z[s.name] ?? i, i }))
      .sort((a, b) => a.z - b.z || a.i - b.i);
    return Object.fromEntries(order.map((s, k) => [s.name, k]));
  };

  /** Bones that carry a drawing in `pose`. */
  const drawn = (pose: RigPose) =>
    new Set(art.rig.slots.filter((s) => pose.symbols[s.name] !== null).map((s) => s.bone));

  const flat = new Map<string, number[][]>();
  /** Whether rig point (x, y) lies in one of `shapes`, drawn on a bone at `m` (even-odd, like shapesContain). */
  const within = (shapes: PathShape[], m: RigPose['world'][string], x: number, y: number) => {
    const [lx, ly] = toLocal(m, x, y);
    return shapes.some(({ d }) => {
      if (!flat.has(d)) flat.set(d, flattenPath(d));
      let inside = false;
      for (const p of flat.get(d)!)
        for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2)
          if (
            p[i + 1]! > ly !== p[j + 1]! > ly &&
            lx < ((p[j]! - p[i]!) * (ly - p[i + 1]!)) / (p[j + 1]! - p[i + 1]!) + p[i]!
          )
            inside = !inside;
      return inside;
    });
  };

  /** The art with each loop drawing nothing, so a pose sampled from it names the loop a slot is keyed to. */
  const unlooped: FighterArt = {
    ...art,
    rig: {
      ...art.rig,
      symbols: Object.fromEntries(
        Object.entries(art.rig.symbols).map(([name, sym]) => [name, Array.isArray(sym) ? sym : []]),
      ),
    },
  };

  /** Each drawing symbol `name` can show: itself, or every frame of its loop (and of loops inside that). */
  const drawings = (name: string | null | undefined, depth = 0): PathShape[][] => {
    const sym = name ? art.rig.symbols[name] : undefined;
    if (Array.isArray(sym)) return [sym];
    return sym && depth < 8 ? sym.loop.flatMap((n) => drawings(n, depth + 1)) : [];
  };

  /**
   * Whether `cover` hides every drawing on `bone` on frame `f` of `clip`, posed as `pose`. Each one lies inside the
   * cover's bounds, is drawn under it, and has every point of its bounds, on a CELL grid, under the cover's opaque
   * fills (flat colours, or gradients whose stops are all opaque). A cover keyed to a loop runs on the match clock,
   * so any frame of the loop can be up: it must hide the part in each of them.
   */
  const hides = (clip: string, f: number, pose: RigPose, cover: string, bone: string): boolean => {
    const keyed = samplePose(unlooped, clip, f, f).symbols[cover];
    const solid = drawings(keyed).map((shapes) =>
      shapes.filter(
        ({ fill }) =>
          fill !== undefined && (typeof fill === 'string' || fill.stops.every((s) => (s.alpha ?? 1) >= 1)),
      ),
    );
    if (!solid.length || solid.some((shapes) => !shapes.length)) return false;
    const order = layers(pose);
    const [c0, c1, c2, c3] = bounds(pose, cover);
    const m = pose.world[slots[cover]!.bone]!;
    return art.rig.slots
      .filter((s) => s.bone === bone && drawing(pose, s.name))
      .every(({ name }) => {
        if (order[name]! >= order[cover]!) return false;
        const [x0, y0, x1, y1] = bounds(pose, name);
        if (x0 < c0 || y0 < c1 || x1 > c2 || y1 > c3) return false;
        for (let x = x0; x < x1 + CELL; x += CELL)
          for (let y = y0; y < y1 + CELL; y += CELL)
            if (!solid.every((shapes) => within(shapes, m, Math.min(x, x1), Math.min(y, y1)))) return false;
        return true;
      });
  };

  return { slots, turned, drawing, bounds, covers, overlapsRegion, overlaps, layers, drawn, hides };
}

const sample = (art: FighterArt, clip: string, f: number) => samplePose(art, clip, f, f);

/** Each clip's frames from its first checked frame to its last, as [clip, from, length]. */
function frames(art: FighterArt, clips: string[], from: Record<string, number> = {}) {
  return clips
    .filter((name) => art.clips[name])
    .map((name) => [name, from[name] ?? 0, art.clips[name]!.length] as const);
}

/** Frames where a drawn part, or a prop's tip while the prop is drawn, reaches more than SINK below the floor. */
export function floorFindings(art: FighterArt, checks: SwingChecks): Finding[] {
  const { slots, bounds, drawing } = context(art);
  const decal = (name: string | null | undefined) =>
    !!name && (checks.decals ?? []).some((d) => name.startsWith(d));
  const out: Finding[] = [];
  const landing = Object.keys(checks.groundFrom ?? {}).filter((clip) => checks.air.includes(clip));
  const from = { ...checks.from, ...checks.groundFrom };
  for (const [clip, start, length] of frames(art, [...checks.ground, ...landing], from))
    for (let f = start; f <= length; f++) {
      const pose = sample(art, clip, f);
      const shown = art.rig.slots.filter((s) => !decal(pose.symbols[s.name]));
      const bottom = poseBounds({ ...art, rig: { ...art.rig, slots: shown } }, pose)[3];
      let tip = -Infinity;
      let tipSlot = '';
      for (const [slot, along] of Object.entries(checks.tips ?? {})) {
        if (!pose.symbols[slot]) continue;
        const m = pose.world[slots[slot]!.bone]!;
        if (m.b * along + m.ty > tip) [tip, tipSlot] = [m.b * along + m.ty, slot];
      }
      if (bottom <= SINK && tip <= SINK) continue;
      const deepest = shown
        .filter((s) => drawing(pose, s.name))
        .reduce((a, s) => (bounds(pose, s.name)[3] > bounds(pose, a)[3] ? s.name : a), shown[0]!.name);
      out.push({
        clip,
        frame: f,
        check: 'floor',
        part: tip > bottom ? `${tipSlot} tip` : deepest,
        value: Math.max(bottom, tip),
        text: `${clip}@${f} ${bottom.toFixed(2)}${tip > SINK ? ` (tip ${tip.toFixed(2)})` : ''}`,
      });
    }
  return out;
}

/** The bones `spins` lets turn freely in `clip`. Throws on a bone or clip the art doesn't have. */
function spinning(art: FighterArt, spins: Spin[], clip: string): Set<string> {
  for (const spin of spins) {
    if (!art.rig.bones.some((b) => b.name === spin.bone)) throw new Error(`spin: no bone ${spin.bone}`);
    for (const name of spin.clips ?? [])
      if (!art.clips[name]) throw new Error(`spin: ${spin.bone} lists a clip the art doesn't have, ${name}`);
  }
  return new Set(spins.filter((s) => !s.clips || s.clips.includes(clip)).map((s) => s.bone));
}

/** The frames `cuts` cuts to in `clip`. Throws on a clip the art doesn't have or a frame outside its clip. */
function cutTo(art: FighterArt, cuts: Cut[], clip: string): Set<number> {
  for (const cut of cuts) {
    const { length } = art.clips[cut.clip] ?? {};
    if (length === undefined) throw new Error(`cut: no clip ${cut.clip}`);
    if (!Number.isInteger(cut.frame) || cut.frame < 1 || cut.frame > length)
      throw new Error(`cut: ${cut.clip} has no frame ${cut.frame} to cut to`);
  }
  return new Set(cuts.filter((c) => c.clip === clip).map((c) => c.frame));
}

/** The covers in `clip`. Throws on a clip or slot the art doesn't have, or frames outside the clip. */
function coversIn(art: FighterArt, covered: Cover[], clip: string): Cover[] {
  for (const cover of covered) {
    const { length } = art.clips[cover.clip] ?? {};
    if (length === undefined) throw new Error(`cover: no clip ${cover.clip}`);
    if (!art.rig.slots.some((s) => s.name === cover.slot)) throw new Error(`cover: no slot ${cover.slot}`);
    if (!(cover.from >= 1 && cover.from <= cover.to && cover.to <= length))
      throw new Error(`cover: ${cover.clip} has no frames ${cover.from} to ${cover.to}`);
  }
  return covered.filter((c) => c.clip === clip);
}

/**
 * Frames where a drawn part turns more than TURN degrees from the frame before, or STRIKE from two frames before a
 * hit window opens until it closes. A loop's last frame draws its first again, a whole number of turns round from
 * where it started, so that frame's turn is taken the short way. Bones in `spins` are left out in their clips, the
 * step into a frame in `cuts` is skipped, and a part a cover in `covered` hides on the frame is left out.
 */
export function turnFindings(art: FighterArt, checks: SwingChecks): Finding[] {
  const { turned, drawn, hides } = context(art);
  const out: Finding[] = [];
  for (const [clip, start, length] of frames(art, [...checks.ground, ...checks.air], checks.from)) {
    const free = spinning(art, checks.spins ?? [], clip);
    const cuts = cutTo(art, checks.cuts ?? [], clip);
    const covers = coversIn(art, checks.covered ?? [], clip);
    const { active = [], loop } = art.clips[clip]!;
    const striking = (f: number) => active.some(([a, b]) => f >= a - 2 && f <= b);
    let prev = sample(art, clip, start);
    for (let f = start + 1; f <= length; f++) {
      const pose = sample(art, clip, f);
      const before = drawn(prev);
      const limit = striking(f) ? STRIKE : TURN;
      const hidden = (bone: string) =>
        covers.some((c) => f >= c.from && f <= c.to && hides(clip, f, pose, c.slot, bone));
      for (const bone of cuts.has(f) ? [] : drawn(pose)) {
        if (free.has(bone)) continue;
        let deg = turned(prev, pose, bone);
        if (loop && f === length) deg -= 360 * Math.round(deg / 360);
        if (before.has(bone) && Math.abs(deg) > limit && !hidden(bone))
          out.push({
            clip,
            frame: f,
            check: 'turn',
            part: bone,
            value: Math.abs(deg),
            text: `${clip}@${f} ${bone} ${deg.toFixed(0)}`,
          });
      }
      prev = pose;
    }
  }
  return out;
}

/**
 * Frames where a held prop moves in front of or behind a part it covers by more than OVERLAP on both frames. The
 * step into a frame in `cuts` is skipped.
 */
export function orderFindings(art: FighterArt, checks: SwingChecks): Finding[] {
  const { drawing, layers, overlaps } = context(art);
  const props = checks.props ?? heldProps(art);
  const out: Finding[] = [];
  for (const [clip, start, length] of frames(art, [...checks.ground, ...checks.air], checks.from)) {
    const cuts = cutTo(art, checks.cuts ?? [], clip);
    let prev = sample(art, clip, start);
    for (let f = start + 1; f <= length; f++) {
      const pose = sample(art, clip, f);
      const [was, now] = [layers(prev), layers(pose)];
      const shown = cuts.has(f) ? [] : props;
      for (const prop of shown.filter((p) => drawing(prev, p) && drawing(pose, p)))
        for (const { name: part, decor } of art.rig.slots) {
          if (part === prop || decor || !drawing(prev, part) || !drawing(pose, part)) continue;
          const over = now[prop]! > now[part]!;
          if (over === was[prop]! > was[part]!) continue;
          if (overlaps(prev, prop, part) && overlaps(pose, prop, part))
            out.push({
              clip,
              frame: f,
              check: 'order',
              part: `${prop} ${over ? 'over' : 'under'} ${part}`,
              value: 1,
              text: `${clip}@${f} ${prop} ${over ? 'over' : 'under'} ${part}`,
            });
        }
      prev = pose;
    }
  }
  return out;
}

/** Frames where the face check's prop, drawn over the head, covers more than OVERLAP of the face below the hat. */
export function faceFindings(art: FighterArt, checks: SwingChecks): Finding[] {
  const { face } = checks;
  if (!face) return [];
  const { drawing, layers, bounds, covers, overlapsRegion } = context(art);
  const out: Finding[] = [];
  for (const clip of face.clips.filter((c) => art.clips[c]))
    for (let f = 0; f <= art.clips[clip]!.length; f++) {
      const pose = sample(art, clip, f);
      const order = layers(pose);
      if (!drawing(pose, face.prop) || order[face.prop]! < order[face.head]!) continue;
      const [x0, , x1, y1] = bounds(pose, face.head);
      const onFace = (x: number, y: number) =>
        covers(pose, face.head, x, y) || covers(pose, face.features, x, y);
      if (overlapsRegion(pose, face.prop, [x0, bounds(pose, face.hat)[3], x1, y1], onFace))
        out.push({
          clip,
          frame: f,
          check: 'face',
          part: `${face.prop} over face`,
          value: 1,
          text: `${clip}@${f}`,
        });
    }
  return out;
}

/** Every check's findings for one fighter. */
export const allFindings = (art: FighterArt, checks: SwingChecks): Finding[] => [
  ...floorFindings(art, checks),
  ...turnFindings(art, checks),
  ...orderFindings(art, checks),
  ...faceFindings(art, checks),
];

/**
 * Each failing clip's worst finding per check (the deepest frame, the biggest turn, the first jump), with how many
 * frames fail that check.
 */
export function worstByClip(found: Finding[]): Map<string, Map<Check, Finding & { frames: number }>> {
  const out = new Map<string, Map<Check, Finding & { frames: number }>>();
  const seen = new Set<string>();
  for (const f of found) {
    const clip = out.get(f.clip) ?? new Map<Check, Finding & { frames: number }>();
    const had = clip.get(f.check);
    const frame = `${f.clip} ${f.check} ${f.frame}`;
    const frames = (had?.frames ?? 0) + (seen.has(frame) ? 0 : 1);
    seen.add(frame);
    clip.set(f.check, had && had.value >= f.value ? { ...had, frames } : { ...f, frames });
    out.set(f.clip, clip);
  }
  return out;
}

import type { ArtSymbol, Paint, PathShape } from '../../../render/rig/types';
import { CONVEYOR } from '../finalSmash';
import { ellipse, inked, moved, resize, rrect } from './parts';

/**
 * Conveyor Oven's props (../finalSmash.ts), drawn from scratch in the same Flipline Flash style as Papa: flat colours,
 * one shade tone, a dark ink outline under every fill. The belt and the flour cloud are rig symbols on his effect
 * bones; the brick oven is the `papa-louie/oven` entity's flipbook, drawn over the fighters so it hides its catch.
 */

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const line = (d: string, color: string, width: number): PathShape => ({ d, stroke: { color, width } });

/** A fill fading by `alpha` stops from the top (`y0`) to the bottom (`y1`). */
const fade = (color: string, y0: number, y1: number, top: number, bottom: number): Paint => ({
  type: 'linear',
  x0: 0,
  y0,
  x1: 0,
  y1,
  stops: [
    { offset: 0, color, alpha: top },
    { offset: 1, color, alpha: bottom },
  ],
});

// --- The belt -------------------------------------------------------------------------------------------

/** Belt length: from its near end, 4 units in front of Papa, past the catch's far edge 60 units out. */
export const BELT = { x: 4, length: 58, top: -1.0, bottom: 2.6 };
const R = (BELT.bottom - BELT.top) / 2;
/** Tread spacing on the belt's top run. */
const TREAD = 1.6;

/**
 * The pizza conveyor seen from the side, its near end at the origin and running down +x, the top of the belt just
 * above the floor line and its frame sunk into the floor: a black rubber belt round two steel end rollers, a red
 * side panel with bolts and a cream trim. `shift` moves the treads along the top run (the rolling loop).
 */
function beltDrawing(shift: number): PathShape[] {
  const L = BELT.length;
  const mid = (BELT.top + BELT.bottom) / 2;
  const treads: PathShape[] = [];
  for (let x = 2.2 + (((shift % TREAD) + TREAD) % TREAD); x < L - 2.2; x += TREAD)
    treads.push(line(`M${n(x)} ${n(BELT.top + 0.12)}L${n(x + 0.55)} ${n(BELT.top + 0.5)}`, 'beltHi', 0.16));
  const rollers = [R, L - R].flatMap((x) => [
    {
      d: ellipse(x, mid, R - 0.38, R - 0.38),
      fill: 'steel' as Paint,
      stroke: { color: 'line', width: 0.14 },
    },
    { d: ellipse(x - 0.25, mid - 0.25, R - 0.95, R - 0.95), fill: 'steelHi' as Paint },
    { d: ellipse(x, mid, 0.5, 0.5), fill: 'steelLo' as Paint },
  ]);
  const bolts = [];
  for (let x = 6.5; x < L - 5; x += 6.4)
    bolts.push({ d: ellipse(x, mid + 0.35, 0.24, 0.24), fill: 'steelLo' });
  return inked(
    [[rrect(0, BELT.top, L, BELT.bottom, R), 'belt']],
    [
      { d: rrect(R + 0.6, BELT.top + 0.62, L - R - 0.6, BELT.bottom - 0.5, 0.35), fill: 'beltFrame' },
      { d: rrect(R + 0.6, mid + 0.65, L - R - 0.6, BELT.bottom - 0.5, 0.3), fill: 'beltFrameLo' },
      line(`M${n(R + 1)} ${n(BELT.top + 0.9)}L${n(L - R - 1)} ${n(BELT.top + 0.9)}`, 'trim', 0.12),
      ...bolts,
      ...treads,
      ...rollers,
    ],
  );
}

/** The belt standing still, and three drawings a third of a tread apart for the rolling loops. */
export const beltStill = beltDrawing(0);
const beltSteps = [0, 1, 2].map((i) => beltDrawing((i * TREAD) / 3));

// --- The flour cloud ------------------------------------------------------------------------------------

/** Where the flour cloud's bone sits, from Papa's feet: just in front of the belt's near end. */
export const FLOUR_X = 6;

/**
 * A cloud from x0 to x1 standing on `bottom`: its top edge rises from `low` at the ends to `high` in the middle in
 * billows `step` apart (shifted by `phase` of a step) puffing out by `amp`. One silhouette, so its translucent fill
 * never doubles up where billows overlap.
 */
function cloud(
  x0: number,
  x1: number,
  low: number,
  high: number,
  bottom: number,
  step: number,
  amp: number,
  phase: number,
): string {
  const top = (x: number) =>
    low + (high - low) * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))) ** 0.6;
  const xs: number[] = [x0];
  for (let x = x0 + step * (0.4 + phase * 0.6); x < x1 - step * 0.5; x += step) xs.push(x);
  xs.push(x1);
  let d = `M${n(x0)} ${n(bottom)}C${n(x0 - 1.6)} ${n(bottom)} ${n(x0 - 1.8)} ${n(top(x0))} ${n(x0)} ${n(top(x0))}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i]!;
    const b = xs[i + 1]!;
    const bump = amp * (0.7 + 0.3 * Math.sin(i * 2.3 + phase * 6.3)) * Math.min(1, (b - a) / step);
    d += `C${n(a)} ${n(top(a) - bump * 1.3)} ${n(b)} ${n(top(b) - bump * 1.3)} ${n(b)} ${n(top(b))}`;
  }
  d += `C${n(x1 + 1.8)} ${n(top(x1))} ${n(x1 + 1.6)} ${n(bottom)} ${n(x1)} ${n(bottom)}Z`;
  return d;
}

/**
 * The cloud of flour the belt throws up as it lurches into motion, from its bone (on the floor, FLOUR_X in front of
 * Papa) down +x along the belt, rising over House of Boom's box line, 11 up from 16 to 47 forward (moves are y up, the
 * rig y down). Translucent, so the foes on the belt show through it. `k` (0-2) picks the billow drawing.
 */
function flourDrawing(k: number): PathShape[] {
  const phase = k / 3;
  return [
    { d: cloud(0, 52, -6.5, -14.2, -0.2, 6.5, 2.6, phase), fill: fade('flour', -17, 0, 0.66, 0.22) },
    { d: cloud(3, 49, -4.5, -8.5, -0.2, 5.5, 1.6, 1 - phase), fill: fade('flourHi', -10, 0, 0.5, 0.05) },
  ];
}

const flourSteps = [0, 1, 2].map(flourDrawing);

// --- The brick oven -------------------------------------------------------------------------------------

/** The oven's size, about its floor centre: wide and tall enough to hide a held foe from Papa's hands outwards. */
export const OVEN = { half: 8.5, wall: -10.5, top: -19.5, mouth: 4.4, mouthTop: -8.8 };

/** An arch from x0 to x1 standing on `base`, its crown at `top`. */
function arch(x0: number, x1: number, base: number, top: number): string {
  const r = (x1 - x0) / 2;
  const c = x0 + r;
  const spring = top + r * 0.85;
  return `M${n(x0)} ${n(base)}L${n(x0)} ${n(spring)}C${n(x0)} ${n(spring - r * 0.9)} ${n(c - r * 0.55)} ${n(top)} ${n(c)} ${n(top)}C${n(c + r * 0.55)} ${n(top)} ${n(x1)} ${n(spring - r * 0.9)} ${n(x1)} ${n(spring)}L${n(x1)} ${n(base)}Z`;
}

/** A flame tongue standing on (x, y), `h` tall and `w` wide, its tip leaning by `lean`. */
function tongue(x: number, y: number, w: number, h: number, lean = 0): string {
  return `M${n(x - w / 2)} ${n(y)}C${n(x - w / 2)} ${n(y - h * 0.5)} ${n(x - w * 0.1 + lean * 0.5)} ${n(y - h * 0.7)} ${n(x + lean)} ${n(y - h)}C${n(x + w * 0.15 + lean * 0.4)} ${n(y - h * 0.6)} ${n(x + w / 2)} ${n(y - h * 0.45)} ${n(x + w / 2)} ${n(y)}Z`;
}

const HEARTH = -1.4;
const dome = `M${-OVEN.half} ${HEARTH}L${-OVEN.half} ${OVEN.wall}C${-OVEN.half} -15.4 -4.7 ${OVEN.top} 0 ${OVEN.top}C4.7 ${OVEN.top} ${OVEN.half} -15.4 ${OVEN.half} ${OVEN.wall}L${OVEN.half} ${HEARTH}Z`;
const chimney = rrect(2.7, -23.2, 5.7, -15, 0.3);
const chimneyCap = rrect(2.2, -24.1, 6.2, -22.7, 0.35);
const hearth = rrect(-9.8, HEARTH - 0.3, 9.8, 0.35, 0.45);
const rim = arch(-OVEN.mouth - 1.3, OVEN.mouth + 1.3, HEARTH, OVEN.mouthTop - 1.3);
const mouth = arch(-OVEN.mouth, OVEN.mouth, HEARTH, OVEN.mouthTop);

/** Mortar lines: courses round the dome, with staggered joints. */
const mortar: PathShape[] = (() => {
  const out: PathShape[] = [];
  const courses = [-4.2, -7.2, -10.4, -13.4, -16.2, -18.3];
  courses.forEach((y, i) => {
    const half =
      y > OVEN.wall
        ? OVEN.half
        : OVEN.half * Math.sqrt(Math.max(0, 1 - ((y - OVEN.wall) / (OVEN.top - OVEN.wall)) ** 2));
    const inner = y > OVEN.mouthTop - 1.6 ? OVEN.mouth + 1.5 : 0;
    const segs = inner
      ? [
          [-half + 0.3, -inner],
          [inner, half - 0.3],
        ]
      : [[-half + 0.3, half - 0.3]];
    for (const [a, b] of segs) out.push(line(`M${n(a!)} ${n(y)}L${n(b!)} ${n(y)}`, 'brickLo', 0.13));
    const below = i ? courses[i - 1]! : HEARTH;
    for (let x = -half + 1.6 + (i % 2) * 1.6; x < half - 0.8; x += 3.2) {
      if (inner && Math.abs(x) < inner) continue;
      out.push(line(`M${n(x)} ${n(below - 0.1)}L${n(x)} ${n(y + 0.1)}`, 'brickLo', 0.12));
    }
  });
  return out;
})();

/** The fire inside the open mouth, two drawings for the flicker. */
const fire = (k: number): PathShape[] => [
  { d: mouth, fill: 'ovenDark' },
  {
    d: ellipse(0, HEARTH - 1.2, OVEN.mouth - 0.4, 3.2),
    fill: {
      type: 'radial',
      cx: 0,
      cy: HEARTH - 0.8,
      r: 4.4,
      stops: [
        { offset: 0, color: 'flame', alpha: 0.75 },
        { offset: 1, color: 'flame', alpha: 0 },
      ],
    },
  },
  ...inked(
    [
      [tongue(-2.2, HEARTH, 2.2, 3.4 + k * 0.6, -0.4), 'flame'],
      [tongue(0.1, HEARTH, 2.6, 4.6 - k * 0.7, 0.3), 'flame'],
      [tongue(2.3, HEARTH, 2.0, 3.0 + k * 0.5, 0.5), 'flame'],
      [tongue(-1.0, HEARTH, 1.4, 2.0 + k * 0.4, 0.2), 'flameHi'],
      [tongue(1.1, HEARTH, 1.4, 2.6 - k * 0.4, -0.2), 'flameHi'],
    ],
    [],
    0.08,
  ),
];

/** The iron door over the mouth, with its handle and a round window glowing with the fire, `glow` (1-2) as hot. */
function door(glow: number): PathShape[] {
  const d = arch(-OVEN.mouth - 0.3, OVEN.mouth + 0.3, HEARTH, OVEN.mouthTop - 0.3);
  const w = 1.5;
  return [
    ...inked(
      [[d, 'iron']],
      [
        { d: arch(1.2, OVEN.mouth + 0.3, HEARTH, OVEN.mouthTop + 1.4), fill: 'ironLo' },
        { d: ellipse(0, -5.4, w + 0.45, w + 0.45), fill: 'ironHi' },
        { d: ellipse(0, -5.4, w, w), fill: 'ovenDark' },
        { d: ellipse(0, -5.1, w * 0.85, w * 0.7 * glow), fill: 'flame' },
        { d: ellipse(0, -4.9, w * 0.45, w * 0.35 * glow), fill: 'flameHi' },
        line(`M${-OVEN.mouth + 0.8} -2.6L${-OVEN.mouth + 2.6} -2.6`, 'ironHi', 0.32),
        ...[-3.4, 3.4].flatMap((x) =>
          [-3, -6.4].map((y) => ({ d: ellipse(x, y, 0.22, 0.22), fill: 'ironHi' })),
        ),
      ],
      0.16,
    ),
    ...(glow > 1
      ? [
          {
            d: ellipse(0, -5.2, 3.6 * glow, 3.2 * glow),
            fill: {
              type: 'radial' as const,
              cx: 0,
              cy: -5.2,
              r: 3.6 * glow,
              stops: [
                { offset: 0, color: 'flameHi', alpha: 0.5 },
                { offset: 1, color: 'flame', alpha: 0 },
              ],
            },
          },
        ]
      : []),
  ];
}

/** Smoke puffs over the chimney, `k` steps into their rise; `tint` colours them (pepper red, cheese yellow). */
function smoke(k: number, tint = 'smoke', s = 1): PathShape[] {
  const at: [number, number, number][] = [
    [4.2, -25.6, 1.2],
    [5.1, -27.6, 1.5],
    [4.0, -29.9, 1.8],
  ];
  return inked(
    at.map(
      ([x, y, r], i) =>
        [ellipse(x + ((k + i) % 2) * 0.4, y - k * 0.7, r * s, r * s * 0.9), tint] as [string, Paint],
    ),
    [],
    0.1,
  );
}

/** The oven itself: hearth, dome, mortar, chimney and the stone rim round the mouth. */
const body: PathShape[] = inked(
  [
    [hearth, 'stone'],
    [chimney, 'brick'],
    [chimneyCap, 'stone'],
    [dome, 'brick'],
  ],
  [
    {
      d: `M${OVEN.half - 2.1} ${HEARTH}L${OVEN.half - 2.1} ${OVEN.wall}C${OVEN.half - 2.1} -13.6 ${OVEN.half - 3.4} -16.6 3.2 -18.5C5.7 -17.5 ${OVEN.half} -14.8 ${OVEN.half} ${OVEN.wall}L${OVEN.half} ${HEARTH}Z`,
      fill: 'brickLo',
    },
    { d: rrect(-9.8, -0.25, 9.8, 0.35, 0.3), fill: 'stoneLo' },
    { d: rrect(4.6, -23.2, 5.7, -15.2, 0.2), fill: 'brickLo' },
    ...mortar,
    { d: ellipse(-4.2, -15.2, 1.6, 0.9), fill: 'brickHi' },
  ],
);
const rimShapes: PathShape[] = inked(
  [[rim, 'stone']],
  [{ d: arch(OVEN.mouth - 0.2, OVEN.mouth + 1.3, HEARTH, OVEN.mouthTop + 0.3), fill: 'stoneLo' }],
  0.14,
);

/** The oven open, its fire burning in the mouth. */
const open = (k: number): PathShape[] => [...body, ...rimShapes, ...fire(k)];
/** The oven shut, baking. */
const shut = (glow: number): PathShape[] => [...body, ...rimShapes, ...door(glow)];

/**
 * The blast: the door flung open against the oven's front, and a fireball bursting out of the mouth forwards with
 * flame tongues licking out of it. `k` (0-1) grows it.
 */
function blast(k: number): PathShape[] {
  const s = 1 + k * 0.25;
  const ball = `M3 ${HEARTH}C3 -7 6 -12.5 ${n(11 * s)} -12.5C${n(16 * s)} -12.5 ${n(19 * s)} -8.5 ${n(19 * s)} -5.5C${n(19 * s)} -2.4 ${n(16 * s)} ${HEARTH} ${n(11 * s)} ${HEARTH}Z`;
  const core = `M3.5 ${HEARTH}C3.5 -5.6 6.4 -9.4 ${n(10 * s)} -9.4C${n(13.6 * s)} -9.4 ${n(15.6 * s)} -7 ${n(15.6 * s)} -4.8C${n(15.6 * s)} -2.6 ${n(13.4 * s)} ${HEARTH} ${n(10 * s)} ${HEARTH}Z`;
  const flung = rrect(OVEN.mouth + 1.2, OVEN.mouthTop - 0.3, OVEN.mouth + 2.4, HEARTH - 0.1, 0.4);
  return [
    ...body,
    ...rimShapes,
    { d: mouth, fill: 'ovenDark' },
    ...inked(
      [[flung, 'iron']],
      [
        {
          d: rrect(OVEN.mouth + 1.75, OVEN.mouthTop + 0.6, OVEN.mouth + 2.4, HEARTH - 0.4, 0.3),
          fill: 'ironLo',
        },
      ],
      0.14,
    ),
    ...inked(
      [
        [ball, 'flame'],
        [tongue(12 * s, -11.5, 3.2, 4 + k * 2, 1.8), 'flame'],
        [tongue(7 * s, -11, 2.6, 3 + k, -1), 'flame'],
        [tongue(17 * s, -8, 2.4, 3.4 + k, 2.4), 'flame'],
      ],
      [
        { d: core, fill: 'flameHi' },
        { d: ellipse(9.5 * s, -5.4, 2.4, 1.8), fill: 'cheese' },
      ],
    ),
  ];
}

/** Rising out of the floor and sinking back: the oven squashed or stretched about its floor centre. */
const squash = (shapes: PathShape[], sx: number, sy: number): PathShape[] => resize(shapes, sx, sy);
/** A rumble: the oven nudged sideways and squeezed a little. */
const rumble = (shapes: PathShape[], dx: number, s: number): PathShape[] =>
  moved(resize(shapes, 1 + s, 1 - s), dx, 0);

const drawings: Record<string, PathShape[]> = {
  ovenRise0: squash(open(0), 1.3, 0.22),
  ovenRise1: squash(open(1), 0.88, 1.14),
  ovenRise2: squash(open(0), 1.04, 0.96),
  ovenOpen0: open(0),
  ovenOpen1: open(1),
  ovenSlam: squash(shut(1), 1.06, 0.93),
  ovenShut: shut(1),
  ovenPepper: [...shut(1.2), ...smoke(0, 'flakes', 0.9)],
  ovenCheese: [...shut(1.2), ...smoke(1, 'cheese', 0.9)],
  ovenBake0: [...rumble(shut(1.3), -0.15, 0.01), ...smoke(0)],
  ovenBake1: [...rumble(shut(1.5), 0.15, -0.01), ...smoke(1)],
  ovenBake2: [...shut(1.4), ...smoke(2)],
  ovenShake0: [...rumble(shut(1.8), -0.45, 0.025), ...smoke(1, 'smoke', 1.2)],
  ovenShake1: [...rumble(shut(2), 0.45, -0.02), ...smoke(2, 'smoke', 1.3)],
  ovenBlast0: blast(0),
  ovenBlast1: blast(1),
  ovenSmoky: [...open(1), ...smoke(2, 'smoke', 1.4)],
  ovenSink0: squash(open(0), 1.1, 0.6),
  ovenSink1: squash(open(0), 1.3, 0.22),
  ovenGone: [],
};

/**
 * The oven's timeline over its age, which is the cinematic's frame (it is put out on frame 1): it bursts up, burns
 * open while the belt brings the catch in, slams shut on CONVEYOR.inOven, puffs Papa's pepper and Parmesan out of the
 * chimney, bakes and rumbles harder and harder, bursts open on CONVEYOR.blast, smokes and sinks away.
 */
function timeline(): string[] {
  const out: string[] = [];
  const put = (to: number, name: string | ((age: number) => string)) => {
    for (let age = out.length; age <= to; age++) out.push(typeof name === 'string' ? name : name(age));
  };
  const { inOven, blast: boom } = CONVEYOR;
  put(2, 'ovenRise0');
  put(4, 'ovenRise1');
  put(6, 'ovenRise2');
  put(inOven - 1, (a) => (Math.floor(a / 4) % 2 ? 'ovenOpen1' : 'ovenOpen0'));
  put(inOven + 1, 'ovenSlam');
  put(TOPPINGS.pepper.lands - 1, 'ovenShut');
  put(TOPPINGS.pepper.lands + 5, 'ovenPepper');
  put(TOPPINGS.cheese.lands - 1, 'ovenShut');
  put(TOPPINGS.cheese.lands + 5, 'ovenCheese');
  put(boom - 13, (a) => `ovenBake${Math.floor(a / 5) % 3}`);
  put(boom - 1, (a) => `ovenShake${Math.floor(a / 2) % 2}`);
  put(boom + 7, (a) => (Math.floor((a - boom) / 2) % 2 ? 'ovenBlast1' : 'ovenBlast0'));
  put(boom + 15, 'ovenSmoky');
  put(boom + 18, 'ovenSink0');
  put(boom + 21, 'ovenSink1');
  put(CONVEYOR.cinematicFaf, 'ovenGone');
  return out;
}

/** The frames Papa lobs each topping and the frame it drops into the chimney (art/finalSmash.ts throws them). */
export const TOPPINGS = {
  pepper: { toss: 40, lands: 50 },
  cheese: { toss: 56, lands: 66 },
};

/** Where the chimney's mouth is, from the oven's floor centre (rig y down). */
export const CHIMNEY: [number, number] = [4.2, -24.1];

export const conveyorSymbols: Record<string, ArtSymbol> = {
  beltStill,
  beltStep0: beltSteps[0]!,
  beltStep1: beltSteps[1]!,
  beltStep2: beltSteps[2]!,
  /** The treads running forwards, away from Papa (the jolt), at 20 fps: a third of a tread every 3 frames. */
  beltFwd: { loop: ['beltStep0', 'beltStep1', 'beltStep2'], fps: 20 },
  /** The treads running back towards him (the catch riding in). */
  beltBack: { loop: ['beltStep2', 'beltStep1', 'beltStep0'], fps: 20 },
  flour0: flourSteps[0]!,
  flour1: flourSteps[1]!,
  flour2: flourSteps[2]!,
  /** The flour billowing, at 12 fps. */
  flour: { loop: ['flour0', 'flour1', 'flour2'], fps: 12 },
  ...drawings,
  /** The oven's whole cinematic, one drawing per frame of its age (fps 60 on the entity's age). */
  ovenFlipbook: { loop: timeline(), fps: 60 },
};

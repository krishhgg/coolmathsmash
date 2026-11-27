import { ellipse } from '../../fireboy/art/parts';
import type { PathShape } from '../../../render/rig/types';
import { WAVE, WAVE_BOXES } from '../finalSmashData';

/**
 * Water effects for Watergirl's placeholder mannequin, drawn by hand in the same frames as Fireboy's fire so
 * the shared clips place them the same way. A jet has its round head on the origin (radius 3 at scale 1) and
 * its tail running up -y to JET_TIP; a splash ball has radius 3.6 and trails towards -x.
 */

const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** A water jet: a round head tapering into a smooth tail that bends by `bend`, scaled by `s` and lowered by `dy`. */
function stream(s: number, dy: number, bend: number): string {
  const p = (x: number, y: number) => `${n(x * s)} ${n(y * s + dy)}`;
  return [
    `M${p(0, 3)}`,
    `C${p(1.9, 3)} ${p(3.1, 1.6)} ${p(3, -0.4)}`,
    `C${p(2.9, -3.2)} ${p(1.6 + bend * 0.4, -6.4)} ${p(0.5 + bend, -10.6)}`,
    `C${p(-0.6 + bend * 0.6, -7.4)} ${p(-2.6, -3.6)} ${p(-3, -0.4)}`,
    `C${p(-3.1, 1.6)} ${p(-1.9, 3)} ${p(0, 3)}Z`,
  ].join('');
}

/** Two drops thrown off beside the tail, nudged by `t`. */
const drops = (t: number): PathShape[] => [
  { d: ellipse(2.6 + t * 0.4, -6.4 - t, 0.55, 0.75), fill: 'fx', stroke: { color: 'fxLine', width: 0.25 } },
  {
    d: ellipse(-2.3 - t * 0.3, -8.2 + t * 0.6, 0.4, 0.55),
    fill: 'fx',
    stroke: { color: 'fxLine', width: 0.22 },
  },
];

const RIPPLE: [number, number][] = [
  [0, 0],
  [0.45, 0.6],
  [-0.45, -0.6],
];

/** Strike jets: a blue stream with a pale core and a white glint, rippling through three drawings. */
export const streams: PathShape[][] = RIPPLE.map(([bend, t]) => [
  ...drops(t),
  { d: stream(1, 0, bend), fill: 'fx', stroke: { color: 'fxLine', width: 0.35 } },
  { d: stream(0.66, 0.9, bend * 0.8), fill: 'fxHot' },
  { d: ellipse(-0.9, -0.4, 0.75, 1.1), fill: 'fxCore' },
]);

/** A splash ball of radius 3.6 with a tapered tail towards -x and a crescent glint. */
function splash(r: number, t: number): string {
  const K = 0.5523;
  return [
    `M0 ${n(-r)}`,
    `C${n(K * r)} ${n(-r)} ${n(r)} ${n(-K * r)} ${n(r)} 0`,
    `C${n(r)} ${n(K * r)} ${n(K * r)} ${n(r)} 0 ${n(r)}`,
    `C${n(-0.9 * r)} ${n(r)} ${n(-1.7 * r)} ${n((0.2 + t * 0.1) * r)} ${n(-2.4 * r)} ${n(t * 0.1 * r)}`,
    `C${n(-1.7 * r)} ${n((-0.3 + t * 0.1) * r)} ${n(-0.9 * r)} ${n(-r)} 0 ${n(-r)}Z`,
  ].join('');
}

export const splashes: PathShape[][] = RIPPLE.map(([bend, t]) => [
  { d: splash(3.6, bend + t), fill: 'fx', stroke: { color: 'fxLine', width: 0.35 } },
  { d: splash(2.4, t), fill: 'fxHot' },
  { d: ellipse(1.2, -1.3, 0.9, 0.6), fill: 'fxCore' },
]);

/** Foam: blobs merged into one cloud with a single outline (outlines first, then fills, as the limbs are inked). */
function foam(blobs: [number, number, number][], line = 0.3): PathShape[] {
  return [
    ...blobs.map(([x, y, r]) => ({ d: ellipse(x, y, r + line, r + line), fill: 'fxLine' })),
    ...blobs.map(([x, y, r]) => ({ d: ellipse(x, y, r, r), fill: 'fxCore' })),
  ];
}

/** An arc of radius `r` round (cx, cy), from angle a0 to a1 (degrees, y down), as one quadratic stroke. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const at = (a: number, k = 1) => {
    const t = (a * Math.PI) / 180;
    return `${n(cx + Math.cos(t) * r * k)} ${n(cy + Math.sin(t) * r * k)}`;
  };
  const span = (((a1 - a0) / 2) * Math.PI) / 180;
  return `M${at(a0)} Q${at((a0 + a1) / 2, 1 / Math.cos(span))} ${at(a1)}`;
}

/** The crest's box (fire1) in the drawing, y down: its centre and radius. */
const CREST = { x: WAVE_BOXES[0]!.x, y: -WAVE_BOXES[0]!.y, r: WAVE_BOXES[0]!.radius };
/** How far the crest's foam stands out past the crest's box: half a unit. */
const FOAM_OUT = 0.5;
const FOAM_LINE = 0.3;

/**
 * Where the wave meets the floor in its drawing (y down from its centre): its back foot, and the floor line, as far
 * below its centre as the entity rides over the floor (WAVE.y), so it stands on the floor in a match.
 */
export const WAVE_FOOT = { back: 11.4, base: WAVE.y };
/** The body's outline, and its base line, half an outline above the floor so the ink rests on it. */
const BODY_LINE = 0.7;
const SOLE = WAVE_FOOT.base - BODY_LINE / 2;

/**
 * Tidal Wave's wave (src/fighters/watergirl/finalSmash.ts), at world scale round the entity's centre, which rides 13
 * units over the floor, drawn inside its two radius-16 boxes (WAVE_BOXES): the curling crest fills fire1's box, 3 up,
 * and the body fire2's, 3 down, along the floor. Its front, the lip and the froth, and its top, the foam cap, stay on
 * the boxes' edges, so a fighter the drawing reaches is one the wave can hit (art/index.test.ts). `t` (0-2) rolls the
 * crest, foam and drips on for the three drawings of the loop.
 */
function waveDrawing(t: number): PathShape[] {
  const lip = 0.3 * Math.sin((t * 2 * Math.PI) / 3);
  const body = [
    `M${n(-WAVE_FOOT.back)} ${n(SOLE)}`,
    `C-13.8 9.4 -15.6 2.4 -14.9 -4.4`,
    `C-14 -11.4 -8.4 -17.6 -0.8 -18.2`,
    `C6.4 -18.6 12.4 -14.8 14.6 -9.4`,
    `C${n(15.6 + lip)} -5.4 ${n(14.6 + lip)} -1.6 ${n(12 + lip)} -1.4`,
    `C12.8 -4 11.4 -6.6 8.6 -6.8`,
    `C5 -7 3.2 -3.4 4 1`,
    `C4.8 5.6 8.4 9.8 12.2 ${n(SOLE - 1)}`,
    `C13 ${n(SOLE - 0.4)} 12.8 ${n(SOLE)} 11.8 ${n(SOLE)}Z`,
  ].join('');
  /** The lit back of the wave, light coming through the water under the crest. */
  const band = [
    `M-10.4 ${n(SOLE - 0.8)}`,
    `C-12.6 8.4 -13.8 1.8 -13.1 -4.6`,
    `C-12.1 -10.4 -7.2 -15.8 -0.8 -16.4`,
    `C4.8 -16.8 9.6 -14.4 12 -10.6`,
    `C9 -12.8 5 -13.2 1.4 -11.6`,
    `C-3.4 -9.4 -6.2 -2 -7.2 4.6`,
    `C-7.8 8.6 -8.8 ${n(SOLE - 1.8)} -10.4 ${n(SOLE - 0.8)}Z`,
  ].join('');
  /** The barrel's dark back wall under the lip. */
  const tube = `M8.6 -6.8C5 -7 3.2 -3.4 4 1C4.4 3.8 6 6.4 8.4 8.4C6.6 5.2 6.2 1.4 7 -1.6C7.6 -4 9 -5.2 11.2 -4.8C10.6 -6.2 9.8 -6.8 8.6 -6.8Z`;
  const k = (i: number) => 0.3 * Math.sin(((t + i) * 2 * Math.PI) / 3);
  /** Foam blobs round the crest's box, each standing FOAM_OUT past its edge whatever its size. */
  const capped = (deg: number, r: number): [number, number, number] => {
    const a = (deg * Math.PI) / 180;
    const d = CREST.r + FOAM_OUT - r - FOAM_LINE;
    return [CREST.x + Math.cos(a) * d, CREST.y + Math.sin(a) * d, r];
  };
  const crest: [number, number, number][] = [
    capped(-148, 1.7 + k(0)),
    capped(-128, 2.1 + k(1)),
    capped(-108, 2.4 + k(2)),
    capped(-88, 2.6 + k(0)),
    capped(-68, 2.5 + k(1)),
    capped(-48, 2.3 + k(2)),
    capped(-30, 2 + k(0)),
    capped(-14, 1.6 + k(1)),
    [12.2 + lip, -1.9, 1.1 + k(2) * 0.5],
  ];
  /** A foam blob `r` round at `x`, resting on the floor line. */
  const resting = (x: number, r: number): [number, number, number] => [x, WAVE_FOOT.base - r - FOAM_LINE, r];
  const base: [number, number, number][] = [
    resting(7.2, 1.2 + k(1)),
    resting(9.6, 1.3 + k(2)),
    resting(11.6, 1 + k(0) * 0.5),
    resting(-7.6, 0.9 + k(2)),
    resting(-10, 1 + k(0)),
  ];
  const drop = (x: number, y: number, r: number): PathShape => ({
    d: ellipse(x, y, r * 0.8, r),
    fill: 'fxCore',
    stroke: { color: 'fxLine', width: 0.3 },
  });
  const flow = (r: number, a0: number, a1: number, w: number): PathShape => ({
    d: arc(4.5, -3.5, r, a0 + t * 40, a1 + t * 40),
    stroke: { color: 'fxLine', width: w },
  });
  return [
    { d: body, fill: 'fx', stroke: { color: 'fxLine', width: BODY_LINE } },
    { d: band, fill: 'fxHot' },
    { d: tube, fill: 'fxLine' },
    flow(9.5, 150, 215, 0.45),
    flow(6.5, 170, 240, 0.4),
    { d: arc(-3.5, 6, 6, 200 - t * 25, 250 - t * 25), stroke: { color: 'fxCore', width: 0.5 } },
    ...foam(crest, FOAM_LINE),
    ...foam(base, FOAM_LINE),
    // Drips falling off the lip into the barrel.
    drop(10.6 + lip, 1.2 + t * 1.6, 0.55),
    drop(9.4, 4 + ((t + 1) % 3) * 1.3, 0.45),
  ];
}

/** Tidal Wave drawings: the crest rolls a third of a cycle between drawings. */
export const waves: PathShape[][] = [0, 1, 2].map(waveDrawing);

/**
 * The swell she raises while she powers up: a mound of water on the floor round her feet (origin on the floor, y
 * down, about 13 wide and 4 high at scale 1) with a foam rim and drops rising off it. `t` (0-2) heaves it.
 */
function swellDrawing(t: number): PathShape[] {
  const h = 0.25 * Math.sin((t * 2 * Math.PI) / 3);
  const mound = [
    `M-6.6 0.3`,
    `C-5.8 -1.4 -4.2 ${n(-3.2 - h)} -1.6 ${n(-3.6 - h)}`,
    `C0.4 ${n(-3.9 + h)} 2.4 ${n(-3.7 - h)} 4.2 ${n(-3 + h)}`,
    `C5.6 -2.3 6.4 -1.2 6.8 0.3Z`,
  ].join('');
  const rim: [number, number, number][] = [
    [-5.4, -0.9, 0.7],
    [-3.4, -2.6 - h, 0.8],
    [-1, -3.4, 0.8],
    [1.6, -3.6 + h, 0.8],
    [4, -2.9, 0.75],
    [6, -1, 0.6],
  ];
  const drop = (x: number, y: number, r: number): PathShape => ({
    d: ellipse(x, y, r * 0.8, r),
    fill: 'fxHot',
    stroke: { color: 'fxLine', width: 0.22 },
  });
  return [
    { d: mound, fill: 'fx', stroke: { color: 'fxLine', width: 0.35 } },
    { d: ellipse(-0.6, -1.8, 3.6, 0.9), fill: 'fxHot' },
    ...foam(rim, 0.22),
    drop(-4.6 - t * 0.2, -5 - t * 0.9, 0.45),
    drop(3.6 + t * 0.2, -5.6 - t * 0.8, 0.5),
    drop(0.4, -6.6 - ((t + 1) % 3) * 0.9, 0.4),
  ];
}

export const swells: PathShape[][] = [0, 1, 2].map(swellDrawing);

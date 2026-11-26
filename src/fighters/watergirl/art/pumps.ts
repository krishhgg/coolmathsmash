import { ellipse } from '../../fireboy/art/parts';
import type { ArtSymbol, PathShape, PropArt, PropPreview } from '../../../render/rig/types';
import { PUMP, entities } from '../entities';
import { STREAM } from '../waterStream';

/**
 * Water Stream's pumps (src/fighters/watergirl/entities.ts), drawn by hand at PUMP.radius on the entity's centre,
 * facing +x with y down: a round slug of water as big as the pump's hitbox, its back drawn out into a tail with a
 * ripple on top, a pale lit top, a white glint and drops shed behind it. Each tier draws the same loop scaled to its
 * own radius, and the prop turns to its flight (align), so the tail trails behind it.
 */

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const K = 0.5523;
const R = PUMP.radius;

/**
 * The slug: a round head on the origin, `rx` across and `ry` high (in R), whose belly sweeps back into a tail with
 * its rounded tip at `tip`, and whose back comes over a ripple at `crest` on the way to the top of the head.
 */
function slug([rx, ry]: [number, number], tip: [number, number], crest: [number, number]): string {
  const p = (x: number, y: number) => `${n(x * R)} ${n(y * R)}`;
  const [tx, ty] = tip;
  const [cx, cy] = crest;
  return [
    `M${p(0, -ry)}`,
    `C${p(K * rx, -ry)} ${p(rx, -K * ry)} ${p(rx, 0)}`,
    `C${p(rx, K * ry)} ${p(K * rx, ry)} ${p(0, ry)}`,
    `C${p(-0.85, ry)} ${p(tx + 0.75, ty + 0.42)} ${p(tx + 0.12, ty + 0.13)}`,
    `C${p(tx - 0.1, ty + 0.05)} ${p(tx - 0.08, ty - 0.13)} ${p(tx + 0.14, ty - 0.15)}`,
    `C${p(tx + 0.5, ty - 0.2)} ${p(cx - 0.35, cy + 0.02)} ${p(cx, cy)}`,
    `C${p(cx + 0.3, cy - 0.02)} ${p(cx + 0.45, cy + 0.12)} ${p(cx + 0.7, cy + 0.04)}`,
    `C${p(cx + 1, cy - 0.16)} ${p(-0.66, -ry)} ${p(0, -ry)}Z`,
  ].join('');
}

/** The light through the top of the water: a lens from the head's upper front back along the tail towards `tip`. */
function sheen([rx, ry]: [number, number], tip: [number, number]): string {
  const p = (x: number, y: number) => `${n(x * R)} ${n(y * R)}`;
  const [tx, ty] = tip;
  return [
    `M${p(0.7 * rx, -0.36 * ry)}`,
    `C${p(0.55 * rx, -0.78 * ry)} ${p(-0.25, -0.86 * ry)} ${p(-0.75, -0.62 * ry)}`,
    `C${p(-1.15, -0.46)} ${p(tx + 0.85, ty - 0.27)} ${p(tx + 0.6, ty - 0.15)}`,
    `C${p(tx + 0.48, ty - 0.09)} ${p(tx + 0.58, ty - 0.01)} ${p(tx + 0.76, ty - 0.04)}`,
    `C${p(-1.0, -0.14)} ${p(-0.3, -0.3 * ry)} ${p(0.7 * rx, -0.36 * ry)}Z`,
  ].join('');
}

/** A crescent glint hugging the head's upper front, between angles a0 and a1 (degrees, y down), `w` thick. */
function glint(r: number, a0: number, a1: number, w: number): string {
  const at = (a: number, k: number) => {
    const t = (a * Math.PI) / 180;
    return `${n(Math.cos(t) * r * k)} ${n(Math.sin(t) * r * k)}`;
  };
  const mid = (a0 + a1) / 2;
  const bow = 1 / Math.cos((((a1 - a0) / 2) * Math.PI) / 180);
  const inner = 1 - w / r;
  return `M${at(a0, 1)}Q${at(mid, bow)} ${at(a1, 1)}Q${at(mid, inner * bow)} ${at(a0, 1)}Z`;
}

/** A drop of radius `r` at (x, y), in R, with a short pointed tail towards -x, as thrown off the pump. */
function drop(x: number, y: number, r: number): PathShape {
  const p = (dx: number, dy: number) => `${n((x + dx * r) * R)} ${n((y + dy * r) * R)}`;
  return {
    d: [
      `M${p(0, -1)}`,
      `C${p(K, -1)} ${p(1, -K)} ${p(1, 0)}`,
      `C${p(1, K)} ${p(K, 1)} ${p(0, 1)}`,
      `C${p(-0.8, 1)} ${p(-1.6, 0.3)} ${p(-2.2, 0)}`,
      `C${p(-1.6, -0.3)} ${p(-0.8, -1)} ${p(0, -1)}Z`,
    ].join(''),
    fill: 'fx',
    stroke: { color: 'fxLine', width: 0.3 },
  };
}

/** The white glint on the head's upper front, and a fleck of light below it. */
const SHINE: PathShape[] = [
  { d: glint(R * 0.74, -100, -28, 0.55), fill: 'fxCore' },
  { d: ellipse(R * 0.66, -R * 0.02, 0.3, 0.3), fill: 'fxCore' },
];

/** One drawing in flight: the head's squash, the tail's tip, the ripple on its back, how far (in R) the drops drift. */
interface Wobble {
  head: [number, number];
  tip: [number, number];
  crest: [number, number];
  t: number;
}

const WOBBLES: Wobble[] = [
  { head: [1.04, 0.98], tip: [-2.5, 0.12], crest: [-1.75, -0.4], t: 0 },
  { head: [1, 1.02], tip: [-2.35, 0.02], crest: [-1.6, -0.48], t: 0.15 },
  { head: [1.02, 1], tip: [-2.6, 0.2], crest: [-1.9, -0.36], t: 0.3 },
];

function pumpDrawing({ head, tip, crest, t }: Wobble): PathShape[] {
  return [
    drop(-1.05 - t, -1.08, 0.15),
    drop(-1.45 - t, 1.02, 0.12),
    drop(tip[0] - 0.3 - t, tip[1] - 0.12, 0.11),
    { d: slug(head, tip, crest), fill: 'fx', stroke: { color: 'fxLine', width: 0.45 } },
    { d: sheen(head, tip), fill: 'fxHot' },
    ...SHINE,
  ];
}

/**
 * The pump on its first frames, still at her hands: the head with only a stub of tail, splashing drops out behind it,
 * so the long tail never crosses her face. The tail grows once the pump has flown clear.
 */
function burstDrawing(): PathShape[] {
  const p = (x: number, y: number) => `${n(x * R)} ${n(y * R)}`;
  const body = [
    `M${p(0, -1)}`,
    `C${p(K, -1)} ${p(1, -K)} ${p(1, 0)}`,
    `C${p(1, K)} ${p(K, 1)} ${p(0, 1)}`,
    `C${p(-0.7, 1)} ${p(-1.15, 0.72)} ${p(-1.38, 0.42)}`,
    `C${p(-1.5, 0.28)} ${p(-1.62, 0.12)} ${p(-1.5, -0.02)}`,
    `C${p(-1.4, -0.12)} ${p(-1.28, -0.12)} ${p(-1.22, -0.18)}`,
    `C${p(-1.3, -0.3)} ${p(-1.25, -0.5)} ${p(-1.08, -0.58)}`,
    `C${p(-0.9, -0.68)} ${p(-0.62, -1)} ${p(0, -1)}Z`,
  ].join('');
  const sheen = [
    `M${p(0.7, -0.36)}`,
    `C${p(0.55, -0.78)} ${p(-0.25, -0.86)} ${p(-0.78, -0.6)}`,
    `C${p(-0.98, -0.5)} ${p(-0.98, -0.3)} ${p(-0.78, -0.3)}`,
    `C${p(-0.35, -0.3)} ${p(0.1, -0.34)} ${p(0.7, -0.36)}Z`,
  ].join('');
  return [
    drop(-0.4, -1.12, 0.12),
    drop(-1.7, -0.3, 0.1),
    drop(-1.75, 0.5, 0.1),
    drop(-1, 1.08, 0.12),
    { d: body, fill: 'fx', stroke: { color: 'fxLine', width: 0.45 } },
    { d: sheen, fill: 'fxHot' },
    ...SHINE,
  ];
}

const DRAWINGS = WOBBLES.map(pumpDrawing);

const symbols: Record<string, ArtSymbol> = {
  pumpBurst: burstDrawing(),
  ...Object.fromEntries(DRAWINGS.map((d, i) => [`pumpFlow${i}`, d])),
  /**
   * Clocked by the pump's age at 20 fps, three frames a drawing: the burst at her hands, then the tail rippling
   * through the in-flight drawings, back on the first for the pump's last frame.
   */
  pump: { loop: ['pumpBurst', 'pumpFlow0', 'pumpFlow1', 'pumpFlow2', 'pumpFlow0'], fps: 20 },
};

/** The first pump of a shoot in the lab, on the 12-degree aim at `speed`, for as long as it lives. */
function firstPump(speed: number): PropPreview {
  const frame = STREAM.chargeFrame + STREAM.firstPump;
  const theta = (STREAM.angle * Math.PI) / 180;
  return {
    frame,
    ...STREAM.nozzle,
    vx: speed * Math.cos(theta),
    vy: speed * Math.sin(theta),
    to: frame + PUMP.lifetime,
  };
}

/** The lab previews the light shoot's first pump uncharged and the heavy shoot's at full charge. */
const PREVIEWS: Record<string, Record<string, PropPreview>> = {
  pump0: { neutralB: firstPump(STREAM.speed) },
  [`pump${PUMP.tiers}`]: { neutralBHeavy: firstPump(STREAM.speed + STREAM.extraSpeed) },
};

/** A prop per pump kind, `pump0` (uncharged) to `pump8` (full charge), each scaled to its hitbox. */
export const pumps: Record<string, PropArt> = Object.fromEntries(
  Array.from({ length: PUMP.tiers + 1 }, (_, tier): [string, PropArt] => {
    const name = `pump${tier}`;
    const preview = PREVIEWS[name];
    return [
      name,
      {
        symbols,
        symbol: 'pump',
        scale: entities[name]!.radius / R,
        align: true,
        ...(preview && { preview }),
      },
    ];
  }),
);

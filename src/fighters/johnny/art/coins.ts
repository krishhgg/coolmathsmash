import type { PathShape } from '../../../render/rig/types';
import { LINE } from './parts';
import { ellipse, poly, smooth, star, type P } from './shapes';

/**
 * Coin Magnet's effect: gold coins pulled in to the magnet's poles, drawn in fx space with the poles at the origin
 * and +x pointing out of the magnet. Six drawings make one 12-frame cycle (two frames each), so the move's charge
 * loop (frames 5-16) plays them round and round. Each coin follows its own curved path from up to 13 units out,
 * speeding up as it comes, flipping as it flies, and vanishes in a sparkle at the poles; field lines ripple inwards.
 */

export const COIN_DRAWINGS = 6;

const COIN_R = 0.85;

/** Where the coins come from (fx space), and a control point that bends each path. */
const PATHS: { from: readonly [number, number]; bend: readonly [number, number]; phase: number }[] = [
  { from: [12.5, -6.8], bend: [5.5, -6.2], phase: 0.04 },
  { from: [13.2, 1.2], bend: [7.5, 3.6], phase: 0.54 },
  { from: [10.5, -2.6], bend: [5.0, -0.2], phase: 0.29 },
  { from: [11.0, 6.4], bend: [4.5, 4.8], phase: 0.79 },
];

/** The part of its cycle a coin is in flight; for the rest it is the sparkle at the poles. */
const FLIGHT = (COIN_DRAWINGS - 1) / COIN_DRAWINGS;

/** A point `t` (0 to 1) along the quadratic curve from `a` through control `b` to the poles. */
function along(a: readonly [number, number], b: readonly [number, number], t: number): [number, number] {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * b[0], u * u * a[1] + 2 * u * t * b[1]];
}

const inked = (d: string, fill: string, line: string, width = LINE): PathShape => ({
  d,
  fill,
  stroke: { color: line, width },
});

/** A coin flipping as it flies: `turn` 0 shows its face, 0.5 its edge. */
function coin([x, y]: readonly [number, number], turn: number, size: number): PathShape[] {
  const r = COIN_R * size;
  const rx = r * Math.max(0.22, Math.abs(Math.cos(turn * Math.PI)));
  const shapes: PathShape[] = [
    inked(ellipse(x + rx * 0.18, y, rx, r), 'coinLo', 'coinLine', 0.1),
    inked(ellipse(x, y, rx, r), 'coin', 'coinLine', 0.1),
  ];
  if (rx > r * 0.45) {
    shapes.push(
      { d: ellipse(x, y, rx * 0.66, r * 0.66), stroke: { color: 'coinLo', width: 0.1 } },
      {
        d: poly([
          [x - rx * 0.12, y - r * 0.4],
          [x + rx * 0.12, y - r * 0.4],
          [x + rx * 0.12, y + r * 0.4],
          [x - rx * 0.12, y + r * 0.4],
        ]),
        fill: 'coinLo',
      },
    );
  }
  shapes.push({ d: ellipse(x - rx * 0.4, y - r * 0.42, rx * 0.28, r * 0.18), fill: 'coinHi' });
  return shapes;
}

/** A speed streak trailing from `tail` to the coin at `head`, half as wide as the coin. */
function streak(head: readonly [number, number], tail: readonly [number, number], size: number): PathShape {
  const [dx, dy] = [head[0] - tail[0], head[1] - tail[1]];
  const len = Math.hypot(dx, dy) || 1;
  const [nx, ny] = [(-dy / len) * COIN_R * size * 0.55, (dx / len) * COIN_R * size * 0.55];
  const points: P[] = [
    [head[0] + nx, head[1] + ny, 0],
    [tail[0], tail[1], 0],
    [head[0] - nx, head[1] - ny, 0],
  ];
  return {
    d: smooth(points),
    fill: {
      type: 'linear',
      x0: head[0],
      y0: head[1],
      x1: tail[0],
      y1: tail[1],
      stops: [
        { offset: 0, color: 'coinHi', alpha: 0.85 },
        { offset: 1, color: 'coinHi', alpha: 0 },
      ],
    },
  };
}

/** A field line: an arc of radius `r` round the poles, out in front of them. */
function fieldLine(r: number, alpha: number): PathShape {
  const points: P[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = ((-38 + i * (76 / 6)) * Math.PI) / 180;
    points.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return { d: smooth(points, false), stroke: { color: 'field', width: 0.16 + 0.06 * alpha } };
}

/** The sparkle a coin makes as the magnet takes it, `size` 1 at its brightest. */
function sparkle(size: number): PathShape[] {
  return [
    inked(star(0.3, 0, 1.3 * size, 0.38 * size, 4, -90), 'coinHi', 'coinLo', 0.06),
    { d: ellipse(0.3, 0, 0.32 * size), fill: '#ffffff' },
  ];
}

/** Drawing `k` of the cycle: every coin at its own point along its path, field lines and any sparkle at the poles. */
function coinsAt(k: number): PathShape[] {
  const shapes: PathShape[] = [];
  for (let j = 0; j < 3; j++) {
    const r = 1.6 + ((j * 3.2 + (COIN_DRAWINGS - k) * 1.6) % 9.6);
    shapes.push(fieldLine(r, 1 - r / 11));
  }
  let caught = 0;
  for (const { from, bend, phase } of PATHS) {
    const t = (k / COIN_DRAWINGS + phase) % 1;
    // Slow far out, fast near the magnet: eased progress along the path over the flight.
    const at = (s: number) => along(from, bend, Math.min(1, s / FLIGHT) ** 1.5);
    if (t >= FLIGHT) {
      caught = Math.max(caught, 1 - (t - FLIGHT) * COIN_DRAWINGS);
      continue;
    }
    const size = 0.75 + 0.25 * Math.min(1, t * 4);
    shapes.push(streak(at(t), at(Math.max(0, t - 0.14)), size), ...coin(at(t), t * 2.5, size));
  }
  if (caught > 0) shapes.push(...sparkle(0.6 + 0.4 * caught));
  return shapes;
}

/** `coins0` to `coins5`, and `coinField`: the field lines alone as the magnet comes up. */
export const coinSymbols: Record<string, PathShape[]> = {
  ...Object.fromEntries(Array.from({ length: COIN_DRAWINGS }, (_, k) => [`coins${k}`, coinsAt(k)])),
  coinField: [fieldLine(2.2, 0.8), fieldLine(4.6, 0.5)],
  coinSparkle: sparkle(1),
};

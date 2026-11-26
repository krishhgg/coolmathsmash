import type { PathShape } from '../../../render/rig/types';
import { ellipse, poly, star, type P } from './shapes';

/**
 * Upgraded Laser's burst, in its own space with the hit's centre on the origin. A crackling energy ring marks the
 * edge of the 14-unit hit, glow fills it, and a spiky cyan star pulses inside, with coin-gold sparks riding the
 * ring. The match plays the loop on the burst's age at 12 fps, five frames a drawing, so its seven drawings cover the
 * burst's 30 frames once: it opens, pulses through the looping hits (ages 1-28) and swells into the finisher (29-30).
 * The hit is the same size all through, so every drawing reaches it; art/index.test.ts checks that.
 */

/** The burst hit's radius: Limit Blade Beam's 14 (upgrade.ts, MEGA_LASER.burstRadius). */
export const BURST_RADIUS = 14;
const R = BURST_RADIUS;

/** Per drawing: the star's reach and the ring's inner edge (fractions of R), the star's turn, the glow's strength. */
const DRAWINGS: { star: number; ring: number; turn: number; glow: number }[] = [
  { star: 0.6, ring: 0.88, turn: 0, glow: 0.7 },
  { star: 0.76, ring: 0.85, turn: 14, glow: 0.85 },
  { star: 0.68, ring: 0.87, turn: 28, glow: 0.75 },
  { star: 0.78, ring: 0.85, turn: 42, glow: 0.85 },
  { star: 0.7, ring: 0.87, turn: 56, glow: 0.75 },
  { star: 0.84, ring: 0.83, turn: 70, glow: 0.9 },
  { star: 0.95, ring: 0.8, turn: 84, glow: 1 },
];

/** A closed zigzag round the origin: `count` points alternating `r` +- `jag`, the first at `deg` degrees. */
function zigzag(r: number, jag: number, count: number, deg: number): P[] {
  return Array.from({ length: count }, (_, i) => {
    const a = ((deg + (i * 360) / count) * Math.PI) / 180;
    const rr = r + (i % 2 ? -jag : jag);
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  });
}

function spark(angle: number, dist: number, size: number): PathShape {
  const a = (angle * Math.PI) / 180;
  const [x, y] = [Math.cos(a) * dist, Math.sin(a) * dist];
  return {
    d: poly([
      [x, y - size],
      [x + size * 0.45, y],
      [x, y + size],
      [x - size * 0.45, y],
    ]),
    fill: 'coin',
    stroke: { color: 'coinLo', width: 0.08 },
  };
}

function burst({ star: reach, ring, turn, glow }: (typeof DRAWINGS)[number]): PathShape[] {
  const crackle = turn / 7;
  return [
    {
      d: ellipse(0, 0, R),
      fill: {
        type: 'radial',
        cx: 0,
        cy: 0,
        r: R,
        stops: [
          { offset: 0, color: 'laserHi', alpha: 0.75 * glow },
          { offset: 0.6, color: 'laser', alpha: 0.4 * glow },
          { offset: 1, color: 'laser', alpha: 0.25 * glow },
        ],
      },
    },
    // The ring: a jagged outer edge just round the hit's edge and a jagged inner edge (the hole) inside it.
    {
      d: poly(zigzag(R * 1.0, R * 0.025, 36, crackle)) + poly(zigzag(R * ring, R * 0.02, 36, crackle + 5)),
      fill: 'laser',
      stroke: { color: 'laserLine', width: 0.16 },
    },
    {
      d:
        poly(zigzag(R * (ring + 0.07), R * 0.012, 36, crackle + 2.5)) +
        poly(zigzag(R * (ring + 0.04), 0, 36, 0)),
      fill: 'laserHi',
    },
    {
      d: star(0, 0, R * reach, R * reach * 0.5, 10, turn - 90),
      fill: 'laser',
      stroke: { color: 'laserLine', width: 0.14 },
    },
    { d: star(0, 0, R * reach * 0.62, R * reach * 0.34, 10, turn - 72), fill: 'laserHi' },
    { d: ellipse(0, 0, R * reach * 0.2), fill: 'shine' },
    ...[0, 60, 120, 180, 240, 300].map((a, i) =>
      spark(a + turn * 2, R * (ring + 1) * 0.5, 0.6 + 0.15 * (i % 2)),
    ),
  ];
}

export const burstSymbols: Record<string, PathShape[]> = Object.fromEntries(
  DRAWINGS.map((d, k) => [`laserBurst${k}`, burst(d)]),
);
export const BURST_LOOP = { loop: DRAWINGS.map((_, k) => `laserBurst${k}`), fps: 12 };

import type { PathShape } from '../../../render/rig/types';
import { ellipse, poly, star } from './shapes';

/**
 * Upgraded Laser's burst, in its own space with the hit's centre on the origin: a spiky cyan energy star in a glow,
 * with coin-gold sparks spinning round it. The match plays the loop on the burst's age at 12 fps, five frames a
 * drawing, so its seven drawings cover the burst's 30 frames once: it opens, pulses through the looping hits (ages
 * 1-28) and swells into the finisher (29-30). The 14-unit hit is wider than the star, as the laser's hit is wider
 * than its bolt.
 */

const DRAWINGS: { r: number; turn: number; glow: number }[] = [
  { r: 5, turn: 0, glow: 0.6 },
  { r: 7, turn: 14, glow: 0.8 },
  { r: 6.4, turn: 28, glow: 0.7 },
  { r: 7.4, turn: 42, glow: 0.8 },
  { r: 6.8, turn: 56, glow: 0.7 },
  { r: 8.6, turn: 70, glow: 0.9 },
  { r: 10.5, turn: 84, glow: 1 },
];

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

function burst({ r, turn, glow }: (typeof DRAWINGS)[number]): PathShape[] {
  return [
    {
      d: ellipse(0, 0, r * 1.35),
      fill: {
        type: 'radial',
        cx: 0,
        cy: 0,
        r: r * 1.35,
        stops: [
          { offset: 0, color: 'laserHi', alpha: 0.7 * glow },
          { offset: 0.55, color: 'laser', alpha: 0.35 * glow },
          { offset: 1, color: 'laser', alpha: 0 },
        ],
      },
    },
    { d: star(0, 0, r, r * 0.52, 10, turn - 90), fill: 'laser', stroke: { color: 'laserLine', width: 0.14 } },
    { d: star(0, 0, r * 0.62, r * 0.36, 10, turn - 72), fill: 'laserHi' },
    { d: ellipse(0, 0, r * 0.22), fill: 'shine' },
    ...[0, 72, 144, 216, 288].map((a, i) =>
      spark(a + turn * 2, r * (1.05 + 0.12 * (i % 2)), 0.55 + 0.1 * glow),
    ),
  ];
}

export const burstSymbols: Record<string, PathShape[]> = Object.fromEntries(
  DRAWINGS.map((d, k) => [`laserBurst${k}`, burst(d)]),
);
export const BURST_LOOP = { loop: DRAWINGS.map((_, k) => `laserBurst${k}`), fps: 12 };

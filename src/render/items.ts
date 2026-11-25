import type { Graphics } from 'pixi.js';
import type { EntityState } from '../sim/entities/types';
import { PLANET_HP, PLANET_RADIUS } from '../sim/items/planet';

/** Colours of the Coolmath planet emblem (src/ui/art/logo.ts), flat-shaded the way the Flash games drew. */
const INK = 0x0b1a33;
const WORLD_DARK = 0x1a8f27;
const WORLD = 0x3fcf3a;
const WORLD_LIGHT = 0xb9ff9a;
const LAND = 0x2aab33;
const RING = 0x2b8ff0;
const RING_LIGHT = 0xbfe3ff;
const HALO = 0x9fdcff;

/** The ring is a tilted ellipse 1.44 x 0.41 world radii, turned 14 degrees anticlockwise, as on the logo. */
const RING_RX = 1.44;
const RING_RY = 0.41;
const RING_TILT = (-14 * Math.PI) / 180;

/** Points along half the ring: the back half (behind the world) or the front half (over it). */
function ringHalf(cx: number, cy: number, r: number, front: boolean, steps = 16): number[] {
  const pts: number[] = [];
  const cos = Math.cos(RING_TILT);
  const sin = Math.sin(RING_TILT);
  for (let i = 0; i <= steps; i++) {
    const t = (front ? 0 : Math.PI) + (Math.PI * i) / steps;
    const ex = RING_RX * r * Math.cos(t);
    const ey = RING_RY * r * Math.sin(t);
    pts.push(cx + ex * cos - ey * sin, cy + ex * sin + ey * cos);
  }
  return pts;
}

function strokeLine(g: Graphics, pts: number[], width: number, color: number, alpha: number): void {
  g.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!);
  g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
}

/** Two continents as fractions of the world radius, inside the lit part of the globe. */
const LANDS = [
  [0.05, -0.35, 0.38, -0.42, 0.52, -0.18, 0.36, 0.05, 0.12, 0.0, 0.0, -0.14],
  [-0.62, 0.12, -0.38, 0.02, -0.18, 0.22, -0.3, 0.46, -0.52, 0.42],
];

/** Cracks from the middle out, shown as the planet loses HP: one under two thirds, three under a third. */
const CRACKS = [
  [-0.05, -0.1, 0.18, -0.32, 0.12, -0.52, 0.3, -0.7],
  [0.0, 0.0, -0.28, 0.12, -0.4, 0.38, -0.62, 0.48],
  [0.06, 0.05, 0.3, 0.2, 0.36, 0.44, 0.58, 0.56],
];

export interface PlanetLook {
  /** HP left as a fraction of a fresh planet's. */
  health: number;
  /** Match frame, for the halo's pulse. */
  frame: number;
  /** Frozen by a hit: drawn flashing white. */
  flash: boolean;
  /** Overall opacity (the blink before it flies away). */
  alpha: number;
}

/**
 * The Coolmath Planet, drawn from scratch after the game's planet emblem: a soft blue halo, the back of the ring, the
 * green world with a dark crescent, light cap, glint and two continents, cracks as it weakens, then the front of the
 * ring. `r` is the world's radius; the ring reaches 1.44 r to the sides. World units, y down.
 */
export function drawPlanet(g: Graphics, cx: number, cy: number, r: number, look: PlanetLook): void {
  const a = look.alpha;
  const pulse = 0.5 + 0.5 * Math.sin((look.frame / 40) * 2 * Math.PI);
  g.circle(cx, cy, r * 2.1).fill({ color: HALO, alpha: (0.1 + 0.08 * pulse) * a });
  g.circle(cx, cy, r * 1.6).fill({ color: HALO, alpha: (0.16 + 0.08 * pulse) * a });

  const back = ringHalf(cx, cy, r, false);
  strokeLine(g, back, r * 0.375, INK, a);
  strokeLine(g, back, r * 0.22, RING, a);

  g.circle(cx, cy, r).fill({ color: WORLD_DARK, alpha: a });
  g.circle(cx - r * 0.12, cy - r * 0.12, r * 0.83).fill({ color: WORLD, alpha: a });
  for (const land of LANDS)
    g.poly(land.map((v, i) => (i % 2 ? cy : cx) + v * r)).fill({ color: LAND, alpha: a });
  g.ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.22, r * 0.14).fill({ color: WORLD_LIGHT, alpha: 0.8 * a });
  g.moveTo(cx - r * 0.6, cy - r * 0.34)
    .quadraticCurveTo(cx - r * 0.35, cy - r * 0.75, cx + r * 0.12, cy - r * 0.84)
    .stroke({ width: r * 0.11, color: 0xffffff, alpha: 0.55 * a, cap: 'round' });

  const cracks = look.health < 1 / 3 ? 3 : look.health < 2 / 3 ? 1 : 0;
  for (const crack of CRACKS.slice(0, cracks)) {
    const pts = crack.map((v, i) => (i % 2 ? cy : cx) + v * r);
    strokeLine(g, pts, r * 0.1, INK, a);
    strokeLine(g, pts, r * 0.035, 0xffffff, 0.85 * a);
  }
  g.circle(cx, cy, r).stroke({ width: r * 0.11, color: INK, alpha: a });
  if (look.flash) g.circle(cx, cy, r).fill({ color: 0xffffff, alpha: 0.65 * a });

  const front = ringHalf(cx, cy, r, true);
  strokeLine(g, front, r * 0.375, INK, a);
  strokeLine(g, front, r * 0.22, RING, a);
  strokeLine(g, front.slice(16, 28), r * 0.05, RING_LIGHT, 0.8 * a);
}

/** The planet entity at its interpolated spot; it blinks through the last 90 frames before it flies away. */
export function drawPlanetEntity(g: Graphics, e: EntityState, x: number, y: number, frame: number): void {
  const left = e.lifetime > 0 ? e.lifetime - e.age : Infinity;
  drawPlanet(g, x, y, PLANET_RADIUS * 0.92, {
    health: e.hp / PLANET_HP,
    frame,
    flash: e.hitlag > 0,
    alpha: left < 90 && frame % 8 < 4 ? 0.35 : 1,
  });
}

/** A colour around the hue wheel (degrees), bright and fairly saturated, for the rainbow glow. */
export function hueColor(deg: number, s = 0.7, v = 1): number {
  const h = (((deg % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const [r, g, b] =
    h < 1
      ? [c, x, 0]
      : h < 2
        ? [x, c, 0]
        : h < 3
          ? [0, c, x]
          : h < 4
            ? [0, x, c]
            : h < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = v - c;
  const byte = (n: number) => Math.round((n + m) * 255);
  return (byte(r) << 16) | (byte(g) << 8) | byte(b);
}

/**
 * Final Smash standby: Ultimate makes the holder glow a shifting rainbow. Drawn behind the fighter as layered
 * aura ellipses around a body `w` wide and `h` tall (feet at 0, y down), with three sparkles circling it.
 */
export function drawFinalGlow(g: Graphics, w: number, h: number, frame: number): void {
  const cy = -h / 2;
  const hue = frame * 4;
  const pulse = 0.5 + 0.5 * Math.sin((frame / 24) * 2 * Math.PI);
  g.ellipse(0, cy, w * 0.5 + 6, h * 0.5 + 6).fill({ color: hueColor(hue), alpha: 0.16 + 0.08 * pulse });
  g.ellipse(0, cy, w * 0.5 + 4, h * 0.5 + 4).fill({ color: hueColor(hue + 60), alpha: 0.22 + 0.08 * pulse });
  g.ellipse(0, cy, w * 0.5 + 2, h * 0.5 + 2).fill({ color: 0xfff8dc, alpha: 0.32 });
  for (let k = 0; k < 3; k++) {
    const t = frame * 0.05 + (k * 2 * Math.PI) / 3;
    const sx = Math.cos(t) * (w * 0.5 + 5);
    const sy = cy + Math.sin(t) * (h * 0.5 + 4);
    const s = 1.1 + 0.6 * Math.abs(Math.sin(frame * 0.15 + k));
    g.poly([sx, sy - s * 1.6, sx + s * 0.4, sy, sx, sy + s * 1.6, sx - s * 0.4, sy]).fill({
      color: hueColor(hue + 120 * k, 0.25),
      alpha: 0.95,
    });
    g.poly([sx - s * 1.6, sy, sx, sy - s * 0.4, sx + s * 1.6, sy, sx, sy + s * 0.4]).fill({
      color: hueColor(hue + 120 * k, 0.25),
      alpha: 0.95,
    });
  }
}

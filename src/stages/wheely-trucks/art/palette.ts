import type { Graphics } from 'pixi.js';
import { mix } from '../../battlefield/art/util';

/** How fast the road slides under the convoy, in game units per frame (the trucks hold still on screen). */
export const ROAD_SPEED = 2;

/** The haze far things fade toward: the sky just above the horizon. */
export const HAZE = 0xcfe7f1;

export const INK = 0x2f3a46;

/** A colour pushed `t` of the way into the haze, for things further from the camera than the playfield. */
export const far = (color: number, t = 0.4) => mix(color, HAZE, t);

export const STEEL = { hi: 0xf2f6f8, mid: 0xc9d4de, lo: 0x95a6b6, line: 0x52606e, rivet: 0x8797a7 };
export const CAB = { hi: 0xffe17a, mid: 0xffc338, lo: 0xe0921f, line: 0x8f5409 };
export const GLASS = { hi: 0x9fd0ee, lo: 0x3b6688 };
export const BUMPER = { hi: 0x5aa2ee, mid: 0x1f56a0, line: 0x0f2d52 };
export const TYRE = { body: 0x2c2c32, line: 0x141418, tread: 0x44454e, shine: 0x6a6b74 };
export const RIM = { body: 0xc8d4de, ring: 0x7d90a2, hub: 0x8fa2b4, lug: 0x5f7284 };
export const STRIPE = { red: 0xd8322b, redLine: 0x9c1a16, gold: 0xf2b230 };
export const EYE = { white: 0xffffff, line: 0x4e4e4e, iris: 0x3066fc, pupil: 0x000000 };

export interface WheelLook {
  r: number;
  tyre: typeof TYRE;
  rim: typeof RIM;
  ink: number;
}

/** A tyre with its rim drawn into separate Graphics so the rim can spin; both centred on (0, 0). */
export function drawTyre(g: Graphics, w: WheelLook): void {
  g.circle(0, 0, w.r)
    .fill(w.tyre.body)
    .stroke({ color: w.ink, width: w.r * 0.07 });
  g.circle(0, 0, w.r * 0.84).stroke({ color: w.tyre.tread, width: w.r * 0.08 });
  g.arc(0, 0, w.r * 0.92, Math.PI * 1.1, Math.PI * 1.45).stroke({
    color: w.tyre.shine,
    width: w.r * 0.07,
    cap: 'round',
  });
}

export function drawRim(g: Graphics, w: WheelLook): void {
  const r = w.r * 0.56;
  g.circle(0, 0, r)
    .fill(w.rim.body)
    .stroke({ color: w.rim.ring, width: w.r * 0.06 });
  g.circle(0, 0, r * 0.62).stroke({ color: w.rim.ring, width: w.r * 0.04 });
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5;
    g.circle(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, w.r * 0.06).fill(w.rim.lug);
  }
  g.circle(0, 0, r * 0.36)
    .fill(w.rim.hub)
    .stroke({ color: w.rim.ring, width: w.r * 0.04 });
  g.rect(-w.r * 0.04, -r * 0.98, w.r * 0.08, r * 0.3).fill(w.rim.lug);
}

/**
 * Two cartoon eyes on a windscreen in three-quarter view, as on Wheely's cars: a big near eye and a narrower far
 * one toward the front, both looking ahead (+x). (x, y) is the near eye's centre, `s` its half-height. With `lid`
 * the eyes are shut: lids of that colour with a lash line.
 */
export function drawEyes(g: Graphics, x: number, y: number, s: number, look = EYE, lid?: number): void {
  const eye = (cx: number, cy: number, rx: number, ry: number, k: number) => {
    if (lid !== undefined) {
      g.ellipse(cx, cy, rx * 1.04, ry * 1.04).fill(lid);
      g.moveTo(cx - rx * 0.9, cy + ry * 0.15)
        .quadraticCurveTo(cx, cy + ry * 0.45, cx + rx * 0.9, cy + ry * 0.15)
        .stroke({ color: look.line, width: s * 0.09, cap: 'round' });
      return;
    }
    g.ellipse(cx, cy, rx, ry)
      .fill(look.white)
      .stroke({ color: look.line, width: s * 0.07 });
    const ix = cx + rx * 0.32;
    const iy = cy + ry * 0.08;
    g.ellipse(ix, iy, rx * 0.5, ry * 0.42).fill(look.iris);
    g.ellipse(ix + rx * 0.06, iy, rx * 0.3 * k, ry * 0.26).fill(look.pupil);
    g.circle(ix - rx * 0.12, iy - ry * 0.12, s * 0.12).fill(look.white);
  };
  eye(x, y, s * 0.78, s, 1);
  eye(x + s * 1.62, y - s * 0.05, s * 0.5, s * 0.9, 0.8);
}

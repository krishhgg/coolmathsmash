import { Container, Graphics } from 'pixi.js';
import {
  REF_CAMERA,
  layerTransform,
  VIEW_H,
  VIEW_W,
  wrap,
  type StageCamera,
} from '../../battlefield/art/parallax';
import { cloud, hash01, mix, vGradient } from '../../battlefield/art/util';
import { HAZE, ROAD_SPEED } from './palette';

/**
 * The backdrop, in screen pixels as seen from the reference camera: a summer sky, clouds, a blue mountain range
 * and the green valley the viaduct crosses. Every layer except the sky slides left as the convoy drives right,
 * by its depth times the road's speed, so the valley and mountains pass at their parallax rates.
 */

/** Screen pixels the road moves per frame at the reference camera. */
const REF_SPEED = ROAD_SPEED * REF_CAMERA.zoom;

interface Band {
  depth: number;
  /** Horizontal repeat of the layer's drawing; it is drawn over [left - tile, right + tile]. */
  tile: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The sky never moves and fills the screen, so no camera sees past the backdrop. */
export const SKY = { depth: 0, left: 0, top: 0, right: VIEW_W, bottom: VIEW_H } as const;
export const CLOUDS: Band = {
  depth: 0.03,
  tile: 1600,
  left: -900,
  right: VIEW_W + 900,
  top: 40,
  bottom: 260,
};
export const MOUNTAINS: Band = {
  depth: 0.06,
  tile: 1500,
  left: -1500,
  right: VIEW_W + 1500,
  top: 250,
  bottom: 900,
};
/** The valley fills everything below the horizon; parallax.test.ts checks it covers the bottom of the screen. */
export const VALLEY: Band = {
  depth: 0.14,
  tile: 1400,
  left: -2100,
  right: VIEW_W + 2100,
  top: 515,
  bottom: 3400,
};

function sky(): Graphics {
  const g = new Graphics({ label: 'sky' });
  g.rect(SKY.left, SKY.top, SKY.right - SKY.left, SKY.bottom - SKY.top).fill(
    vGradient([
      [0, 0x3f9be2],
      [0.45, 0x79c3ef],
      [0.72, 0xb4e0f3],
      [1, HAZE],
    ]),
  );
  return g;
}

function clouds(): Graphics {
  const g = new Graphics({ label: 'clouds' });
  const { tile, left, right } = CLOUDS;
  for (let base = left - tile; base < right + tile; base += tile) {
    for (let i = 0; i < 6; i++) {
      const x = base + (i + 0.2 + hash01(i + 11) * 0.6) * (tile / 6);
      const y = 70 + hash01(i + 41) * 150;
      const w = 130 + hash01(i + 71) * 150;
      cloud(g, x, y, w, w * 0.32, 0xfbfdfe, 0xd5e8f3, i + 5);
    }
  }
  return g;
}

/** A jagged ridge line from x0 to x1 at around `y`, peaks up to `h` high, closed down to `bottom`. */
function ridge(
  g: Graphics,
  x0: number,
  x1: number,
  y: number,
  h: number,
  bottom: number,
  seed: number,
  step: number,
) {
  g.moveTo(x0, bottom).lineTo(x0, y);
  let i = 0;
  for (let x = x0; x < x1; x += step, i++) {
    const peak = y - h * (0.35 + 0.65 * hash01(seed + i));
    const mid = x + step * (0.35 + 0.3 * hash01(seed + i + 97));
    g.lineTo(mid, peak).lineTo(x + step, y - h * 0.3 * hash01(seed + i + 191));
  }
  g.lineTo(x1, bottom).closePath();
}

function mountains(): Graphics {
  const g = new Graphics({ label: 'mountains' });
  const { tile, left, right, bottom } = MOUNTAINS;
  for (let base = left - tile; base < right + tile; base += tile) {
    ridge(g, base, base + tile, 430, 170, bottom, 3, 250);
    g.fill(mix(0x6f9cc4, HAZE, 0.55));
    for (let i = 0; i < 6; i++) {
      const peak = 430 - 170 * (0.35 + 0.65 * hash01(3 + i));
      if (peak > 330) continue;
      const x = base + i * 250 + 250 * (0.35 + 0.3 * hash01(3 + i + 97));
      const d = 430 - peak;
      g.poly([
        x,
        peak,
        x + d * 0.16,
        peak + d * 0.24,
        x + d * 0.05,
        peak + d * 0.2,
        x - d * 0.06,
        peak + d * 0.27,
        x - d * 0.15,
        peak + d * 0.22,
      ]).fill(mix(0xf4f8fb, HAZE, 0.3));
    }
    ridge(g, base - 80, base + tile, 470, 90, bottom, 31, 180);
    g.fill(mix(0x5f93b5, HAZE, 0.45));
  }
  return g;
}

/** A round Flash-style tree: a trunk and a three-puff crown, with a lit side. */
function tree(g: Graphics, x: number, y: number, s: number, leaf: number, shade: number): void {
  g.rect(x - s * 0.09, y - s * 0.55, s * 0.18, s * 0.55).fill(mix(0x7a5636, HAZE, 0.35));
  g.circle(x - s * 0.22, y - s * 0.75, s * 0.32).fill(shade);
  g.circle(x + s * 0.22, y - s * 0.78, s * 0.3).fill(shade);
  g.circle(x, y - s * 1.0, s * 0.36).fill(shade);
  g.circle(x - s * 0.06, y - s * 1.05, s * 0.28).fill(leaf);
  g.circle(x - s * 0.26, y - s * 0.8, s * 0.22).fill(leaf);
}

function valley(): Graphics {
  const g = new Graphics({ label: 'valley' });
  const { tile, left, right, top, bottom } = VALLEY;
  const x0 = left - tile;
  const x1 = right + tile;
  g.rect(x0, top, x1 - x0, bottom - top).fill(
    vGradient([
      [0, mix(0x8fc46a, HAZE, 0.45)],
      [0.04, mix(0x7cbb57, HAZE, 0.3)],
      [0.12, 0x6aa848],
      [1, 0x4a8a3c],
    ]),
  );
  for (let base = x0; base < x1; base += tile) {
    for (let i = 0; i < 9; i++) {
      const x = base + (i / 9) * tile;
      const y = top + 26 + hash01(i + 300) * 120;
      const w = 90 + hash01(i + 333) * 160;
      const h = 14 + hash01(i + 366) * 22;
      const c = [0xa8cf6a, 0x86c25a, 0xc9d77a][i % 3]!;
      g.poly([x, y, x + w, y - 4, x + w + 18, y + h, x + 14, y + h + 3]).fill(mix(c, HAZE, 0.35));
    }
    g.moveTo(base, top + 210)
      .bezierCurveTo(base + 300, top + 150, base + 520, top + 300, base + 760, top + 240)
      .bezierCurveTo(base + 1000, top + 180, base + 1200, top + 260, base + tile, top + 210)
      .stroke({ color: mix(0x8fd0ee, HAZE, 0.2), width: 22, cap: 'round' });
    for (let i = 0; i < 26; i++) {
      const x = base + (i / 26) * tile + hash01(i + 500) * 30;
      tree(
        g,
        x,
        top + 4 + hash01(i + 531) * 6,
        16 + hash01(i + 557) * 10,
        mix(0x7fc65a, HAZE, 0.45),
        mix(0x4f9a43, HAZE, 0.45),
      );
    }
    for (let i = 0; i < 14; i++) {
      const x = base + hash01(i + 700) * tile;
      const y = top + 90 + hash01(i + 733) * 260;
      const s = 22 + hash01(i + 766) * 14;
      tree(g, x, y, s, mix(0x7fc65a, HAZE, 0.25), mix(0x3f8a3a, HAZE, 0.25));
    }
  }
  return g;
}

interface Layer {
  band: Band | null;
  root: Container;
  art: Container;
  /** Extra leftward drift in reference pixels per frame (clouds blow a little faster than they would). */
  drift: number;
}

function layer(band: Band | null, art: Container, drift = 0): Layer {
  const root = new Container({ label: `layer-${band?.depth ?? 0}` });
  root.pivot.set(VIEW_W / 2, VIEW_H / 2);
  root.addChild(art);
  return { band, root, art, drift };
}

export interface Background {
  container: Container;
  update(frame: number, camera: StageCamera): void;
}

export function createBackground(): Background {
  const container = new Container({ label: 'truck-convoy-background' });
  const layers = [
    layer(null, sky()),
    layer(CLOUDS, clouds(), 0.15),
    layer(MOUNTAINS, mountains()),
    layer(VALLEY, valley()),
  ];
  for (const l of layers) container.addChild(l.root);
  return {
    container,
    update(frame, camera) {
      for (const { band, root, art, drift } of layers) {
        const depth = band?.depth ?? 0;
        const t = layerTransform(depth, camera);
        root.position.set(t.x, t.y);
        root.scale.set(t.scale);
        if (band) art.x = -wrap(frame * (REF_SPEED * depth + drift), 0, band.tile);
      }
    },
  };
}

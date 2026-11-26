import { Container, Graphics } from 'pixi.js';
import { wrap } from '../../battlefield/art/parallax';
import { hash01, mix, vGradient } from '../../battlefield/art/util';
import { RAFT, WATER_Y } from '../geometry';
import * as C from './palette';

/**
 * The lagoon in world units: an opaque body of water behind the raft and fighters, from the surface down past the
 * bottom blast zone and wide enough for any camera, and a see-through layer in front that tints whatever is under
 * the surface (the log, a fighter on the ledge or sinking out of play).
 */
export const LAGOON = { left: -900, right: 900, top: -WATER_Y, bottom: 640 } as const;

const WAVE = 6;
const BUBBLES = 9;

function body(): Graphics {
  const g = new Graphics({ label: 'lagoon-body' });
  const { left, right, top, bottom } = LAGOON;
  const at = (y: number) => (y - top) / (bottom - top);
  g.rect(left, top, right - left, bottom - top).fill(
    vGradient([
      [0, C.WATER_TOP],
      [at(30), C.WATER_MID],
      [at(110), C.WATER_DEEP],
      [at(200), C.WATER_ABYSS],
      [1, C.WATER_ABYSS],
    ]),
  );
  return g;
}

/** Soft slanted light shafts from the surface, faded in and out by `update`. */
function shafts(): Graphics[] {
  return [-150, -96, -38, 22, 70, 128, 190].map((x, i) => {
    const g = new Graphics({ label: 'light-shaft' });
    const w = 5 + hash01(i + 900) * 7;
    const len = 46 + hash01(i + 911) * 40;
    const top = LAGOON.top + 0.5;
    g.poly([x, top, x + w, top, x + w + len * 0.32, top + len, x + len * 0.32 - w * 0.4, top + len]).fill({
      color: C.FOAM,
      alpha: 0.07,
    });
    return g;
  });
}

/** Wavelets along the surface: one strip of scallops `WAVE` units apart, slid by `update` so it loops seamlessly. */
function wavelets(y: number, color: number, alpha: number, up: boolean): Graphics {
  const g = new Graphics({ label: 'wavelets' });
  for (let x = LAGOON.left - WAVE; x < LAGOON.right + WAVE; x += WAVE) {
    g.moveTo(x, y).quadraticCurveTo(x + WAVE / 2, y + (up ? -0.9 : 0.9), x + WAVE, y);
  }
  g.stroke({ color, width: 0.35, alpha });
  return g;
}

/** Foam where the log ends meet the water. */
function foam(): Graphics {
  const g = new Graphics({ label: 'foam' });
  for (const side of [-1, 1]) {
    const x = side * (RAFT.right + 0.6);
    g.ellipse(x, LAGOON.top, 2.8, 0.75).fill({ color: C.FOAM, alpha: 0.85 });
    g.ellipse(x + side * 3.4, LAGOON.top + 0.15, 1.5, 0.45).fill({ color: C.FOAM, alpha: 0.6 });
    g.ellipse(x + side * 6, LAGOON.top + 0.1, 0.9, 0.3).fill({ color: C.FOAM, alpha: 0.45 });
  }
  return g;
}

export function createWater(): { back: Container; front: Container; update(frame: number): void } {
  const back = new Container({ label: 'lagoon-back' });
  const light = shafts();
  const bubbles = new Graphics({ label: 'bubbles' });
  back.addChild(body(), ...light, bubbles);

  const front = new Container({ label: 'lagoon-front' });
  const { left, right, top, bottom } = LAGOON;
  const tint = new Graphics({ label: 'underwater-tint' })
    .rect(left, top + 0.3, right - left, bottom - top)
    .fill({ color: C.TINT, alpha: 0.34 });
  const line = new Graphics({ label: 'waterline' })
    .moveTo(left, top)
    .lineTo(right, top)
    .stroke({ color: C.FOAM, width: 0.5, alpha: 0.9 });
  const crests = wavelets(top - 0.15, C.FOAM, 0.8, true);
  const troughs = wavelets(top + 0.9, mix(C.WATER_TOP, C.FOAM, 0.5), 0.6, false);
  const spray = foam();
  front.addChild(tint, troughs, line, crests, spray);

  const update = (frame: number) => {
    crests.x = wrap(frame * 0.045, 0, WAVE);
    troughs.x = wrap(-frame * 0.03, 0, WAVE);
    spray.alpha = 0.75 + 0.25 * Math.sin(frame * 0.05);
    light.forEach((g, i) => {
      g.alpha = 0.55 + 0.45 * Math.sin(frame * 0.012 + i * 1.7);
    });
    bubbles.clear();
    for (let i = 0; i < BUBBLES; i++) {
      const x0 = -160 + hash01(i + 700) * 320;
      const span = 60 + hash01(i + 717) * 40;
      const rise = wrap(frame * (0.08 + hash01(i + 733) * 0.07) + hash01(i + 749) * span, 0, span);
      const y = top + 2 + span - rise;
      const x = x0 + Math.sin(frame * 0.04 + i) * 0.8;
      const r = 0.45 + hash01(i + 761) * 0.6;
      bubbles.circle(x, y, r).stroke({ color: C.FOAM, width: 0.18, alpha: 0.55 });
    }
  };
  update(0);
  return { back, front, update };
}

import { Container, Graphics } from 'pixi.js';
import { vGradient } from '../../battlefield/art/util';
import { ROAD, stage } from '../geometry';
import { EYE, INK, RIM, ROAD_SPEED, TYRE, drawEyes, drawRim, drawTyre, far, type WheelLook } from './palette';

/** Pixi units (y down). The deck slab is the walkable part; everything under it is the hauler in the far lane. */
const SLAB = 2.2;
const CAB_W = 10;
const CAB_BOTTOM = 6;
const RAIL = 7;
const WHEEL = 4.2;

const HAZE_T = 0.42;
const HAULER_WHEEL: WheelLook = {
  r: WHEEL,
  tyre: {
    body: far(TYRE.body, HAZE_T),
    line: far(TYRE.line, HAZE_T),
    tread: far(TYRE.tread, HAZE_T),
    shine: far(TYRE.shine, HAZE_T),
  },
  rim: {
    body: far(RIM.body, HAZE_T),
    ring: far(RIM.ring, HAZE_T),
    hub: far(RIM.hub, HAZE_T),
    lug: far(RIM.lug, HAZE_T),
  },
  ink: far(TYRE.line, HAZE_T),
};
const FAR_EYE = {
  white: far(EYE.white, 0.12),
  line: far(EYE.line, HAZE_T),
  iris: far(EYE.iris, HAZE_T),
  pupil: far(EYE.pupil, HAZE_T),
};

/** Each hauler's cab paint (light, base, shade), pushed into the haze. */
const PAINTS = [
  [0x7fe0c8, 0x34a892, 0x217a69],
  [0xffb39a, 0xe8714f, 0xb44a30],
].map((paint) => paint.map((c) => far(c, 0.5)));

export interface Hauler {
  container: Container;
  /** Show the hauler shifted by (x, y) game units, its wheels at `frame`, braking or not. */
  update(frame: number, x: number, y: number, braking: boolean): void;
}

function body(g: Graphics, x1: number, x2: number, top: number, paint: number[]): void {
  const cab = x2 - CAB_W;
  const line = far(0x3c4a58, HAZE_T);
  const steel = far(0x8796a4, HAZE_T);
  for (const x of [x1 + 2, (x1 + cab) / 2]) {
    g.rect(x - 0.6, top + SLAB, 1.2, RAIL - top - SLAB).fill(steel);
    g.rect(x - 0.6, top + SLAB, 0.4, RAIL - top - SLAB).fill(far(0xc3ced8, HAZE_T));
  }
  for (let x = x1 + 1; x < cab - 2; x += 3.2) {
    g.moveTo(x, top + SLAB)
      .lineTo(x + 1.6, top + SLAB + 2)
      .lineTo(x + 3.2, top + SLAB)
      .stroke({ color: steel, width: 0.45, join: 'round' });
  }
  g.rect(x1, RAIL, cab - x1, 1.3).fill(steel);
  for (let x = x1 + 1.5; x < cab - 1; x += 2.5) g.rect(x, RAIL + 0.35, 1.4, 0.6).fill(far(0x56636f, HAZE_T));
  g.rect(x1 + 0.5, RAIL + 1.3, x2 - x1 - 1, 1.1).fill(far(0x4a5560, HAZE_T));
  cabFront(g, cab, x2, top + SLAB + 1.4, paint, line);
  g.rect(x1 - 0.2, RAIL - 2.6, 1.2, 2.4).fill(far(0x9c2a22, HAZE_T));
}

/** A cab-over cab under the front of the rack: visor, windscreen with eyes, mirror, door and grille. */
function cabFront(g: Graphics, cab: number, x2: number, roof: number, paint: number[], line: number): void {
  const [hi, mid, lo] = paint as [number, number, number];
  const strut = far(0x6f7e8c, HAZE_T);
  for (const x of [cab + 1.4, x2 - 2.2]) g.rect(x, roof - 1.4, 0.8, 1.6).fill(strut);
  g.roundRect(cab, roof, CAB_W, CAB_BOTTOM - roof, 2.2)
    .fill(
      vGradient([
        [0, hi],
        [0.5, mid],
        [1, lo],
      ]),
    )
    .stroke({ color: line, width: 0.3 });
  for (const x of [cab + 3, cab + 5.5, cab + 8]) g.circle(x, roof + 0.5, 0.36).fill(far(0xffb43a, 0.3));
  g.roundRect(cab + 2.8, roof + 1.9, CAB_W - 3.4, 7, 1.1)
    .fill(
      vGradient([
        [0, far(0xa6d6f0, HAZE_T)],
        [1, far(0x41709a, HAZE_T)],
      ]),
    )
    .stroke({ color: line, width: 0.25 });
  g.roundRect(cab + 2.2, roof + 1.1, CAB_W - 1.6, 0.9, 0.4).fill(far(0x3a4652, HAZE_T));
  drawEyes(g, cab + 5.6, roof + 5.4, 2.2, FAR_EYE);
  g.moveTo(x2, roof + 4.6)
    .lineTo(x2 + 1.3, roof + 4.6)
    .stroke({ color: line, width: 0.3 });
  g.roundRect(x2 + 1, roof + 2.8, 0.9, 3.6, 0.3).fill(far(0x3a4652, HAZE_T));
  g.roundRect(cab + 0.8, roof + 10, 6.2, 13, 0.8).stroke({ color: lo, width: 0.3 });
  g.roundRect(cab + 1.4, roof + 10.6, 5, 3.6, 0.6).fill(far(0x6f9cbf, HAZE_T));
  g.rect(cab + 5.2, roof + 16, 1.3, 0.45).fill(lo);
  g.rect(x2 - 2.3, -5.6, 2.3, 4.2).fill(far(0x5c6774, HAZE_T));
  for (let y = -5; y < -1.6; y += 1) g.rect(x2 - 2.1, y, 2.1, 0.4).fill(far(0xa4b0bc, HAZE_T));
  g.roundRect(cab - 0.2, CAB_BOTTOM - 2.4, CAB_W + 0.4, 2.4, 0.6).fill(far(0x1f56a0, HAZE_T));
}

/** The walkable upper deck: a steel slab with the playfield's ink outline, top edge exactly at the platform. */
function slab(g: Graphics, x1: number, x2: number, top: number): void {
  g.roundRect(x1, top, x2 - x1, SLAB, 0.5)
    .fill(
      vGradient([
        [0, 0xf2f6f8],
        [0.3, 0xc4cfd9],
        [1, 0x8494a4],
      ]),
    )
    .stroke({ color: INK, width: 0.45 });
  for (let x = x1 + 2.5; x < x2 - 1; x += 4.2) g.circle(x, top + 1.25, 0.24).fill(0x6c7c8c);
  for (const x of [x1 + 0.3, x2 - 2.3]) g.rect(x, top + 0.45, 2, 1.3).fill(0xf2b230);
}

export function createHauler(index: number): Hauler {
  const p = stage.platforms[index]!;
  const top = -p.y;
  const container = new Container({ label: `hauler-${index}` });
  const g = new Graphics({ label: 'hauler-body' });
  body(g, p.x1, p.x2, top, PAINTS[index % PAINTS.length]!);
  const brake = new Graphics({ label: 'hauler-brake' });
  brake.circle(p.x1 + 0.4, RAIL - 1.4, 2.2).fill({ color: 0xff5a3c, alpha: 0.35 });
  brake.rect(p.x1 - 0.2, RAIL - 2.6, 1.2, 2.4).fill(0xff3b2a);
  container.addChild(g, brake);
  const wheelY = -ROAD.far - WHEEL;
  const rims: Graphics[] = [];
  for (const x of [p.x1 + 5, p.x1 + 14.2, p.x2 - 5]) {
    const tyre = new Graphics();
    drawTyre(tyre, HAULER_WHEEL);
    tyre.position.set(x, wheelY);
    const rim = new Graphics();
    drawRim(rim, HAULER_WHEEL);
    rim.position.set(x, wheelY);
    rims.push(rim);
    container.addChild(tyre, rim);
  }
  const deck = new Graphics({ label: 'hauler-deck' });
  slab(deck, p.x1, p.x2, top);
  container.addChild(deck);
  return {
    container,
    update(frame, x, y, braking) {
      container.position.set(x, -y);
      const spin = (frame * ROAD_SPEED + x) / WHEEL;
      for (const rim of rims) rim.rotation = spin;
      brake.visible = braking;
    },
  };
}

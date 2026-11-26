import { Container, Graphics } from 'pixi.js';
import { flipY, vGradient } from '../../battlefield/art/util';
import { RIG, ROAD, stage } from '../geometry';
import {
  BUMPER,
  CAB,
  GLASS,
  INK,
  RIM,
  ROAD_SPEED,
  STEEL,
  STRIPE,
  TYRE,
  drawEyes,
  drawRim,
  drawTyre,
  type WheelLook,
} from './palette';

/** Everything below is in Pixi units: game x, and y flipped (down is positive). */
const DECK = 2.4;
const BOTTOM = -RIG.bottom;
const CAB_X = RIG.cab;
const FRONT = RIG.right;
const TAIL = RIG.left;

export const CARRIER_WHEEL: WheelLook = { r: 6.2, tyre: TYRE, rim: RIM, ink: TYRE.line };
/** Axles: two under the trailer's tail, two drive axles under the coupling and the steer axle under the cab. */
export const CARRIER_AXLES = [-66, -53, 33, 45.5, 69] as const;
const WHEEL_Y = -ROAD.near - CARRIER_WHEEL.r;

/** The trailer: the hull filled with steel side panels, a red and gold stripe and a wheel emblem. */
function trailer(g: Graphics): void {
  const hull = flipY(stage.solids[0]!.points);
  g.poly(hull).fill(
    vGradient([
      [0, STEEL.hi],
      [0.55, STEEL.mid],
      [1, STEEL.lo],
    ]),
  );
  for (let x = TAIL + 6; x < CAB_X - 3; x += 11) {
    g.moveTo(x, DECK + 1.6)
      .lineTo(x, BOTTOM - 1.6)
      .stroke({ color: 0xaebdca, width: 0.35 });
    g.moveTo(x + 0.4, DECK + 1.6)
      .lineTo(x + 0.4, BOTTOM - 1.6)
      .stroke({ color: 0xf8fbfc, width: 0.22 });
  }
  for (const y of [DECK + 1.5, BOTTOM - 2.2])
    for (let x = TAIL + 2.4; x < CAB_X - 2; x += 3.66) g.circle(x, y, 0.22).fill(STEEL.rivet);
  g.rect(TAIL, 15.4, CAB_X - 1.6 - TAIL, 2.6).fill(STRIPE.red);
  g.rect(TAIL, 17.6, CAB_X - 1.6 - TAIL, 0.4).fill(STRIPE.redLine);
  g.rect(TAIL, 18.6, CAB_X - 1.6 - TAIL, 0.7).fill(STRIPE.gold);
  emblem(g, -12, 9.4);
  g.moveTo(TAIL + 2.6, DECK + 1)
    .lineTo(TAIL + 2.6, BOTTOM - 1)
    .stroke({ color: 0x9aa9b7, width: 0.35 });
  g.roundRect(TAIL + 0.2, 10.6, 1.5, 3.4, 0.4)
    .fill(0xe8312a)
    .stroke({ color: 0x8a1812, width: 0.2 });
  g.roundRect(TAIL + 0.45, 11, 0.8, 1.1, 0.3).fill(0xffb4a8);
}

/** A tyre with three speed streaks behind it, the carrier's paint-job emblem. */
function emblem(g: Graphics, x: number, y: number): void {
  for (const [dy, len] of [
    [-2.2, 9],
    [0, 12.5],
    [2.2, 7.5],
  ] as const) {
    g.roundRect(x - 4 - len, y + dy - 0.45, len, 0.9, 0.45).fill(0x8597a8);
  }
  g.circle(x, y, 4.2).fill(0x46525e).stroke({ color: INK, width: 0.3 });
  g.circle(x, y, 2.4).fill(STRIPE.red).stroke({ color: STRIPE.redLine, width: 0.25 });
  g.circle(x, y, 0.9).fill(0xf6f9fb);
  g.arc(x, y, 3.3, Math.PI * 1.05, Math.PI * 1.5).stroke({ color: 0x7a8794, width: 0.5, cap: 'round' });
}

/** The cab-over cab under the front of the deck: windscreen with eyes, door, grille and Wheely-blue bumper. */
function cab(g: Graphics): void {
  const chamfer = (y: number) => FRONT - Math.max(0, y - (BOTTOM - 4)) * 0.75;
  g.rect(CAB_X - 1.8, DECK, 1.8, BOTTOM - DECK).fill(0x33404d);
  g.rect(CAB_X - 1.8, 12, 1.8, 1.1).fill(0x6e7d8b);
  g.poly([CAB_X, DECK, FRONT, DECK, FRONT, BOTTOM - 4, chamfer(BOTTOM), BOTTOM, CAB_X, BOTTOM]).fill(
    vGradient([
      [0, CAB.hi],
      [0.5, CAB.mid],
      [1, CAB.lo],
    ]),
  );
  g.roundRect(CAB_X + 1.6, DECK + 1.6, 5, 5.6, 0.9)
    .fill(
      vGradient([
        [0, GLASS.hi],
        [1, GLASS.lo],
      ]),
    )
    .stroke({ color: CAB.line, width: 0.3 });
  g.roundRect(CAB_X + 8, DECK + 1.6, FRONT - CAB_X - 8.6, 8.6, 1.6)
    .fill(
      vGradient([
        [0, GLASS.hi],
        [1, GLASS.lo],
      ]),
    )
    .stroke({ color: CAB.line, width: 0.35 });
  g.poly([CAB_X + 9.4, DECK + 2.4, CAB_X + 12.6, DECK + 2.4, CAB_X + 10, DECK + 9]).fill({
    color: 0xffffff,
    alpha: 0.22,
  });
  g.roundRect(CAB_X + 1.4, 13.2, 14, 7.6, 0.8).stroke({ color: 0xc8841f, width: 0.3 });
  g.roundRect(CAB_X + 12, 14.4, 2.2, 0.7, 0.3).fill(CAB.line);
  g.rect(FRONT - 2.4, 13.4, 2.4, 4.6).fill(0x56606c);
  for (let y = 14.1; y < 17.6; y += 1.05) g.rect(FRONT - 2.2, y, 2.2, 0.45).fill(0xa4b0bc);
  g.circle(FRONT - 1.2, 19.3, 0.95)
    .fill(0xfff6c8)
    .stroke({ color: CAB.line, width: 0.25 });
  const top = 20.6;
  g.poly([CAB_X, top, FRONT, top, chamfer(BOTTOM - 0.6), BOTTOM - 0.6, CAB_X, BOTTOM - 0.6])
    .fill(
      vGradient([
        [0, BUMPER.hi],
        [0.45, BUMPER.mid],
        [1, BUMPER.line],
      ]),
    )
    .stroke({ color: BUMPER.line, width: 0.3 });
  g.roundRect(CAB_X + 3, top + 0.7, FRONT - CAB_X - 7, 0.5, 0.25).fill({ color: 0xd6ecff, alpha: 0.7 });
}

/** The deck plate: a pale tread-plate strip whose top edge is the walkable surface. */
function deck(g: Graphics): void {
  g.rect(TAIL, 0, FRONT - TAIL, DECK).fill(
    vGradient([
      [0, 0xf6f9fb],
      [0.35, 0xd3dce4],
      [1, 0x8e9dac],
    ]),
  );
  for (let x = TAIL + 1.2; x < FRONT - 1; x += 2.3) {
    g.moveTo(x, 1.55)
      .lineTo(x + 0.9, 0.85)
      .stroke({ color: 0xa9b6c2, width: 0.28, cap: 'round' });
  }
  g.rect(TAIL, DECK - 0.35, FRONT - TAIL, 0.35).fill(STEEL.line);
}

/** Dark wheel wells cut into the body over each axle. */
function arches(g: Graphics): void {
  for (const x of CARRIER_AXLES) {
    const r = CARRIER_WHEEL.r + 1;
    g.moveTo(x - r, BOTTOM)
      .arc(x, WHEEL_Y, r, Math.PI + Math.asin((WHEEL_Y - BOTTOM) / r), -Math.asin((WHEEL_Y - BOTTOM) / r))
      .closePath()
      .fill(0x242c35);
  }
}

export interface Carrier {
  container: Container;
  update(frame: number): void;
}

/** The car carrier, drawn straight from the hull so its outline is the collision shape. */
export function createCarrier(): Carrier {
  const container = new Container({ label: 'carrier' });
  const body = new Graphics({ label: 'carrier-body' });
  trailer(body);
  cab(body);
  arches(body);
  deck(body);
  body.poly(flipY(stage.solids[0]!.points)).stroke({ color: INK, width: 0.55, join: 'round' });
  const eyes = new Graphics({ label: 'carrier-eyes' });
  drawEyes(eyes, FRONT - 9, DECK + 6, 3.1);
  const lids = new Graphics({ label: 'carrier-lids' });
  drawEyes(lids, FRONT - 9, DECK + 6, 3.1, undefined, CAB.mid);
  container.addChild(body, eyes, lids);
  const rims: Graphics[] = [];
  for (const x of CARRIER_AXLES) {
    const tyre = new Graphics();
    drawTyre(tyre, CARRIER_WHEEL);
    tyre.position.set(x, WHEEL_Y);
    const rim = new Graphics();
    drawRim(rim, CARRIER_WHEEL);
    rim.position.set(x, WHEEL_Y);
    rims.push(rim);
    container.addChild(tyre, rim);
  }
  return {
    container,
    update(frame) {
      const spin = (frame * ROAD_SPEED) / CARRIER_WHEEL.r;
      for (const rim of rims) rim.rotation = spin;
      lids.visible = frame % 222 < 7;
    },
  };
}

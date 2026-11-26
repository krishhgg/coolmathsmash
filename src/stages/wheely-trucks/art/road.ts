import { Container, Graphics } from 'pixi.js';
import { wrap } from '../../battlefield/art/parallax';
import { vGradient } from '../../battlefield/art/util';
import { ROAD } from '../geometry';
import { ROAD_SPEED, far } from './palette';

/**
 * The highway in world units (Pixi y down): two lanes on a viaduct high over the valley, sliding left under the
 * convoy. Wide enough for every camera inside the stage's bounds at the widest zoom.
 */
export const HIGHWAY = {
  left: -720,
  right: 720,
  /** Far edge of the road surface, the near edge, the bottom of the viaduct's side and how deep the piers go. */
  farEdge: -ROAD.far - 5,
  nearEdge: -ROAD.near + 4,
  face: -ROAD.near + 12.5,
  pierBottom: 340,
} as const;

const DASH = { period: 16, length: 7 };
const JOINT = 48;
const PIER = { period: 150, width: 10 };

function surface(g: Graphics): void {
  const { left, right, farEdge, nearEdge, face } = HIGHWAY;
  const w = right - left;
  g.rect(left, farEdge, w, nearEdge - farEdge).fill(
    vGradient([
      [0, far(0x7d8890, 0.25)],
      [1, 0x66717b],
    ]),
  );
  for (const y of [-ROAD.far + 0.4, -ROAD.near - 0.6])
    g.rect(left, y - 1.2, w, 2.4).fill({ color: 0x4f5961, alpha: 0.35 });
  g.rect(left, farEdge + 1.2, w, 0.5).fill({ color: 0xe8eef1, alpha: 0.75 });
  g.rect(left, nearEdge - 1.5, w, 0.7).fill(0xf2cf45);
  g.rect(left, nearEdge, w, face - nearEdge).fill(
    vGradient([
      [0, 0xdcdfd9],
      [0.18, 0xc3c8c3],
      [1, 0x9ea6a6],
    ]),
  );
  g.rect(left, nearEdge, w, 0.6).fill(0xf4f6f2);
  g.rect(left, face, w, 2.6).fill(0x5e676c);
}

function dashes(g: Graphics): void {
  const y = (-ROAD.far - ROAD.near) / 2;
  for (let x = HIGHWAY.left - DASH.period; x < HIGHWAY.right + DASH.period; x += DASH.period)
    g.rect(x, y - 0.4, DASH.length, 0.8).fill(0xf1f4f6);
}

function joints(g: Graphics): void {
  const { nearEdge, face } = HIGHWAY;
  for (let x = HIGHWAY.left - JOINT; x < HIGHWAY.right + JOINT; x += JOINT) {
    g.rect(x, nearEdge + 0.6, 0.5, face - nearEdge - 0.6).fill(0x8d9595);
    g.rect(x + 0.5, nearEdge + 0.6, 0.3, face - nearEdge - 0.6).fill(0xe6e9e4);
    g.circle(x + JOINT / 2, face - 1.6, 0.5).fill(0x7f8888);
  }
}

function piers(g: Graphics): void {
  const { face, pierBottom } = HIGHWAY;
  const top = face + 2.6;
  for (let x = HIGHWAY.left - PIER.period; x < HIGHWAY.right + PIER.period; x += PIER.period) {
    g.rect(x - 8, top, 16, 4).fill(far(0xaab1b2, 0.2));
    g.rect(x - PIER.width / 2, top + 4, PIER.width, pierBottom - top - 4).fill(
      vGradient([
        [0, far(0xb9c0c0, 0.25)],
        [0.5, far(0xa9b2b4, 0.45)],
        [1, far(0x9ba6aa, 0.75)],
      ]),
    );
    g.rect(x - PIER.width / 2, top + 4, 2.2, pierBottom - top - 4).fill({ color: 0xffffff, alpha: 0.18 });
    g.rect(x + PIER.width / 2 - 2, top + 4, 2, pierBottom - top - 4).fill({ color: 0x51606a, alpha: 0.18 });
  }
}

export interface Road {
  /** The surface and the moving lane dashes, drawn behind the trucks. */
  container: Container;
  update(frame: number): void;
}

export function createRoad(): Road {
  const container = new Container({ label: 'highway' });
  const pierLayer = new Graphics({ label: 'piers' });
  piers(pierLayer);
  const deck = new Graphics({ label: 'road-surface' });
  surface(deck);
  const dashLayer = new Graphics({ label: 'lane-dashes' });
  dashes(dashLayer);
  const jointLayer = new Graphics({ label: 'viaduct-joints' });
  joints(jointLayer);
  container.addChild(pierLayer, deck, dashLayer, jointLayer);
  return {
    container,
    update(frame) {
      const travel = frame * ROAD_SPEED;
      dashLayer.x = -wrap(travel, 0, DASH.period);
      jointLayer.x = -wrap(travel, 0, JOINT);
      pierLayer.x = -wrap(travel, 0, PIER.period);
    },
  };
}

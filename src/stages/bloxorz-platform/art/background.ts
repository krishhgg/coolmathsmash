import { Container, FillGradient, Graphics } from 'pixi.js';
import { layerTransform, VIEW_H, VIEW_W, type Rect, type StageCamera } from '../../battlefield/art/parallax';
import { vGradient } from '../../battlefield/art/util';
import { SKY } from './palette';

export const SKY_DEPTH = 0;
export const SKY_BOUNDS = { left: -32, top: -32, right: VIEW_W + 32, bottom: VIEW_H + 32 };
export const VEIL_DEPTH = 0.13;
export const VEIL_BOUNDS = { left: -640, top: 457, right: VIEW_W + 640, bottom: 1190 };

function backdropRect(g: Graphics, bounds: Rect): Graphics {
  return g.rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
}

function plume(core: string, edge: string): FillGradient {
  return new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: [
      { offset: 0, color: core },
      { offset: 0.45, color: core },
      { offset: 1, color: edge },
    ],
    textureSpace: 'local',
  });
}

function smoke(
  g: Graphics,
  fill: FillGradient,
  patches: readonly (readonly [number, number, number, number])[],
) {
  for (const [x, y, rx, ry] of patches) g.ellipse(x, y, rx, ry).fill(fill);
}

export function createBackground() {
  const container = new Container({ label: 'bloxorz-void' });
  const sky = new Graphics({ label: 'ember-sky' });
  backdropRect(sky, SKY_BOUNDS).fill(
    vGradient([
      [0, SKY[0]],
      [0.28, SKY[1]],
      [0.53, SKY[2]],
      [0.77, SKY[3]],
      [1, SKY[4]],
    ]),
  );
  sky.ellipse(415, -38, 760, 310).fill(plume('rgba(211,102,24,0.33)', 'rgba(211,102,24,0)'));
  sky.ellipse(1090, 350, 470, 460).fill(plume('rgba(63,9,11,0.23)', 'rgba(63,9,11,0)'));

  const far = new Graphics({ label: 'distant-smoke' });
  smoke(far, plume('rgba(53,16,20,0.32)', 'rgba(53,16,20,0)'), [
    [-40, 289, 262, 72],
    [111, 341, 282, 54],
    [218, 375, 183, 49],
    [337, 427, 276, 53],
    [1238, 330, 287, 86],
    [1185, 374, 237, 65],
    [1035, 432, 201, 51],
    [924, 479, 247, 47],
  ]);
  smoke(far, plume('rgba(174,61,26,0.27)', 'rgba(174,61,26,0)'), [
    [20, 418, 312, 48],
    [240, 459, 280, 33],
    [1135, 474, 402, 58],
    [1260, 502, 265, 53],
  ]);

  const veil = new Graphics({ label: 'low-void' });
  backdropRect(veil, VEIL_BOUNDS).fill(
    vGradient([
      [0, 'rgba(26,9,19,0)'],
      [0.18, 'rgba(26,9,19,0.20)'],
      [0.45, 'rgba(21,8,17,0.61)'],
      [1, 'rgba(21,8,17,0.85)'],
    ]),
  );

  const near = new Graphics({ label: 'rolling-ash' });
  smoke(near, plume('rgba(18,9,16,0.46)', 'rgba(18,9,16,0)'), [
    [-170, 491, 263, 46],
    [30, 526, 265, 47],
    [124, 566, 245, 56],
    [350, 602, 299, 48],
    [532, 655, 335, 74],
    [703, 690, 334, 46],
    [1103, 615, 281, 53],
    [1376, 570, 304, 82],
  ]);
  smoke(near, plume('rgba(186,66,33,0.2)', 'rgba(186,66,33,0)'), [
    [-14, 575, 214, 26],
    [147, 611, 257, 37],
    [837, 642, 268, 37],
    [1045, 592, 242, 33],
    [1235, 551, 210, 25],
  ]);

  const layers = [
    { node: sky, depth: SKY_DEPTH, drift: 0 },
    { node: far, depth: 0.07, drift: 13 },
    { node: veil, depth: VEIL_DEPTH, drift: 0 },
    { node: near, depth: 0.22, drift: -26 },
  ];
  for (const { node } of layers) {
    node.pivot.set(VIEW_W / 2, VIEW_H / 2);
    container.addChild(node);
  }
  return {
    container,
    update(frame: number, camera: StageCamera) {
      for (const { node, depth, drift } of layers) {
        const t = layerTransform(depth, camera);
        node.position.set(t.x + Math.sin(frame / 298) * drift, t.y + Math.sin(frame / 411) * drift * 0.21);
        node.scale.set(t.scale);
      }
    },
  };
}

import { Container, Graphics } from 'pixi.js';
import { layerTransform, REF_CAMERA, VIEW_H, VIEW_W, type StageCamera } from '../../battlefield/art/parallax';
import { hash01, sparkle, vGradient } from '../../battlefield/art/util';
import { stage } from '../geometry';

export const STAR_FIELD = { depth: 0.07, left: -600, right: 1880, top: -520, bottom: 1240 } as const;

const leftEnd = stage.ledges[0]!;
const rightEnd = stage.ledges[1]!;
export const BACK_RING = {
  depth: 1,
  x: VIEW_W / 2 + ((leftEnd.x + rightEnd.x) / 2 - REF_CAMERA.x) * REF_CAMERA.zoom,
  y: VIEW_H / 2 + (REF_CAMERA.y - leftEnd.y) * REF_CAMERA.zoom,
  half: ((rightEnd.x - leftEnd.x) * REF_CAMERA.zoom) / 2,
} as const;

export function createBackground() {
  const container = new Container({ label: 'coolmath-planet-background' });
  const sky = new Graphics().rect(0, 0, VIEW_W, VIEW_H).fill(
    vGradient([
      [0, 0x191632],
      [0.54, 0x394669],
      [1, 0x33264e],
    ]),
  );
  const stars = new Graphics({ label: 'starfield' });
  const { left, right, top, bottom, depth } = STAR_FIELD;
  for (let i = 0; i < 380; i++) {
    const x = left + hash01(i * 3) * (right - left);
    const y = top + hash01(i * 3 + 1) * (bottom - top);
    const size = hash01(i * 3 + 2);
    stars.circle(x, y, 0.7 + size * 1.05).fill({ color: 0xabbce9, alpha: 0.2 + size * 0.46 });
  }
  for (const [x, y, size] of [
    [93, 220, 5],
    [202, 88, 7],
    [347, 177, 4],
    [567, 93, 6],
    [804, 144, 5],
    [1050, 94, 8],
    [1179, 244, 5],
    [1088, 622, 6],
    [238, 629, 4],
  ] as const)
    sparkle(stars, x, y, size, 0x909bcd);

  const planet = new Container({ label: 'parallax-planet' });
  const orbit = new Container({ label: 'world-aligned-back-ring' });
  const { x, y, half } = BACK_RING;
  const ring = new Graphics();
  ring.position.set(x, y);
  ring
    .moveTo(-half, 0)
    .bezierCurveTo(-half * 0.94, -18, -half * 0.45, -34, 0, -34)
    .bezierCurveTo(half * 0.45, -34, half * 0.94, -18, half, 0)
    .bezierCurveTo(half * 0.89, -12, half * 0.42, -23, 0, -23)
    .bezierCurveTo(-half * 0.42, -23, -half * 0.89, -12, -half, 0)
    .closePath()
    .fill(0x5b8ebc);
  ring
    .moveTo(-half + 24, -6)
    .bezierCurveTo(-half * 0.58, -33, half * 0.58, -33, half - 24, -6)
    .stroke({ width: 1.5, color: 0x91b3cf, alpha: 0.48, cap: 'round' });
  orbit.addChild(ring);

  orbit.pivot.set(VIEW_W / 2, VIEW_H / 2);
  const sphere = new Container({ label: 'green-planet' });
  sphere.position.set(640, 480);
  const r = 213;
  const disc = new Graphics()
    .circle(0, 0, r + 2.6)
    .fill(0x284953)
    .circle(0, 0, r)
    .fill(0x58a44e);
  const shadow = new Graphics()
    .arc(0, 0, r, Math.PI * -0.21, Math.PI * 0.73)
    .bezierCurveTo(-57, 176, 117, 131, 168.3, -130.6)
    .closePath()
    .fill(0x326b4c);
  const bands = new Graphics({ label: 'rotating-globe-bands' });
  bands
    .moveTo(-228, -53)
    .bezierCurveTo(-96, -122, 34, -28, 213, -137)
    .lineTo(238, -104)
    .bezierCurveTo(110, 1, -101, -53, -226, -13)
    .closePath()
    .fill({ color: 0x9cda67, alpha: 0.16 })
    .moveTo(-237, 50)
    .bezierCurveTo(-117, 23, 36, 99, 225, 3)
    .lineTo(237, 63)
    .bezierCurveTo(93, 134, -109, 83, -239, 117)
    .closePath()
    .fill({ color: 0x255e50, alpha: 0.42 })
    .moveTo(-223, 159)
    .bezierCurveTo(-102, 129, 79, 199, 226, 109)
    .lineTo(231, 132)
    .bezierCurveTo(95, 211, -90, 180, -209, 185)
    .closePath()
    .fill({ color: 0x8fbd66, alpha: 0.16 });
  const mask = new Graphics().circle(0, 0, r).fill(0xffffff);
  bands.mask = mask;
  const rim = new Graphics()
    .arc(0, 0, r - 1, Math.PI * 1.01, Math.PI * 1.73)
    .stroke({ width: 3, color: 0xa4df77, alpha: 0.53, cap: 'round' });
  sphere.addChild(disc, mask, bands, shadow, rim);
  planet.addChild(sphere);
  container.addChild(sky, stars, orbit, planet);

  stars.pivot.set(VIEW_W / 2, VIEW_H / 2);
  planet.pivot.set(VIEW_W / 2, VIEW_H / 2);
  return {
    container,
    update(frame: number, camera: StageCamera) {
      for (const [layer, d] of [
        [stars, depth],
        [orbit, BACK_RING.depth],
        [planet, 0.13],
      ] as const) {
        const t = layerTransform(d, camera);
        layer.position.set(t.x, t.y);
        layer.scale.set(t.scale);
      }
      bands.rotation = (frame % 7200) * ((2 * Math.PI) / 7200);
    },
  };
}

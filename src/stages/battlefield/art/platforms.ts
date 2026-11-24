import { Container, FillGradient, Graphics } from 'pixi.js';
import { SOFT_PLATFORMS, SOFT_THICKNESS } from './outline';
import {
  BRASS,
  BRASS_DARK,
  GEM_BLUE,
  GEM_BLUE_DARK,
  GEM_GREEN,
  GEM_GREEN_DARK,
  GEM_RED,
  GEM_RED_DARK,
  INK,
  MORTAR,
  STONE,
  STONE_HIGHLIGHT,
  STONE_LIGHT,
  STONE_MID,
} from './palette';
import { diamond, mix, vGradient } from './util';

/** Left platform glows Fireboy red, the top one Coolmath green, the right one Watergirl blue. */
const GEMS = [
  [GEM_RED, GEM_RED_DARK],
  [GEM_GREEN, GEM_GREEN_DARK],
  [GEM_BLUE, GEM_BLUE_DARK],
] as const;

export interface PlatformsArt {
  container: Container;
  update(frame: number): void;
}

/** The three drop-through platforms: thin temple slabs whose walkable surface sits exactly on the geometry. */
export function createPlatforms(): PlatformsArt {
  const container = new Container({ label: 'soft-platforms' });
  const glows: Graphics[] = [];
  SOFT_PLATFORMS.forEach((p, i) => {
    const [gem, gemDark] = GEMS[i] ?? GEMS[1];
    const g = new Graphics();
    const top = -p.y;
    const t = SOFT_THICKNESS;
    const l = p.left;
    const r = p.right;
    const cx = (l + r) / 2;
    const bracket = [
      cx - 4.8,
      top + t - 0.1,
      cx + 4.8,
      top + t - 0.1,
      cx + 3.1,
      top + t + 1.7,
      cx - 3.1,
      top + t + 1.7,
    ];
    g.poly(bracket).fill(STONE_MID);
    g.poly(bracket).stroke({ width: 0.35, color: INK, join: 'round' });
    const slab = [l, top, r, top, r, top + t * 0.72, r - 0.6, top + t, l + 0.6, top + t, l, top + t * 0.72];
    g.poly(slab).fill(
      vGradient([
        [0, STONE_LIGHT],
        [1, STONE],
      ]),
    );
    g.rect(l, top, r - l, 0.55).fill(STONE_HIGHLIGHT);
    const blocks = 4;
    for (let k = 1; k < blocks; k++) {
      const x = l + ((r - l) * k) / blocks;
      g.moveTo(x, top + 0.55)
        .lineTo(x, top + t)
        .stroke({ width: 0.22, color: MORTAR, alpha: 0.5 });
    }
    for (const side of [-1, 1]) {
      const edge = side < 0 ? l : r;
      const inner = edge - side * 1.4;
      const cap = [edge, top, inner, top, inner, top + t, edge - side * 0.6, top + t, edge, top + t * 0.72];
      g.poly(cap).fill(
        vGradient([
          [0, mix(BRASS, 0xffffff, 0.3)],
          [1, BRASS_DARK],
        ]),
      );
      g.poly(cap).stroke({ width: 0.25, color: INK, join: 'round' });
    }
    g.poly(slab).stroke({ width: 0.5, color: INK, join: 'round' });
    const glow = new Graphics().circle(cx, top + t + 0.75, 2.2).fill(
      new FillGradient({
        type: 'radial',
        center: { x: 0.5, y: 0.5 },
        innerRadius: 0,
        outerCenter: { x: 0.5, y: 0.5 },
        outerRadius: 0.5,
        colorStops: [
          { offset: 0, color: mix(gem, 0xffffff, 0.4) },
          { offset: 1, color: 'rgba(255,255,255,0)' },
        ],
        textureSpace: 'local',
      }),
    );
    const gemG = new Graphics();
    diamond(gemG, cx, top + t + 0.7, 0.8, gem, gemDark, INK, 0.18);
    glows.push(glow);
    container.addChild(g, glow, gemG);
  });
  return {
    container,
    update(frame) {
      glows.forEach((g, i) => (g.alpha = 0.45 + 0.35 * Math.sin(frame * 0.04 + i * 2.1)));
    },
  };
}

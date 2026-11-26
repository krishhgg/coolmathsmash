import { Container, Graphics } from 'pixi.js';
import { flipY, hash01, vGradient } from '../../battlefield/art/util';
import { COURSE, stage } from '../geometry';

const INK = 0x2e2216;
const TURF_LIGHT = 0xa6ea5c;
const TURF = 0x72cc38;
const TURF_DARK = 0x4d9f2a;
const DIRT_TOP = 0xcf9152;
const DIRT = 0xa96a38;
const DIRT_DEEP = 0x744624;
const TIMBER = 0xe2a656;
const TIMBER_DARK = 0xa5672e;
const HURDLE_RED = 0xd8382c;
const CHALK = 0xfbf6ea;
const BEAM = 2.2;

/** The right half of the deck's hull from the ledge down to the keel, in game units (y up). */
const RIGHT_SIDE = stage.solids[0]!.points.filter(([x]) => x >= 0).sort((a, b) => b[1] - a[1]);

/** Half the deck's width at height y (game units), from the hull. */
export function halfWidth(y: number): number {
  for (let i = 1; i < RIGHT_SIDE.length; i++) {
    const [ax, ay] = RIGHT_SIDE[i - 1]!;
    const [bx, by] = RIGHT_SIDE[i]!;
    if (y <= ay && y >= by) return ay === by ? Math.max(ax, bx) : ax + ((bx - ax) * (y - ay)) / (by - ay);
  }
  return 0;
}

/** A checkered band (rows x cols of squares) with its top-left at (x, y), Pixi coordinates. */
function checker(g: Graphics, x: number, y: number, cols: number, rows: number, size: number): void {
  g.rect(x, y, cols * size, rows * size).fill(CHALK);
  for (let r = 0; r < rows; r++)
    for (let c = (r + 1) % 2; c < cols; c += 2) g.rect(x + c * size, y + r * size, size, size).fill(INK);
  g.rect(x, y, cols * size, rows * size).stroke({ color: INK, width: 0.22 });
}

function earth(g: Graphics): void {
  const hull = flipY(stage.solids[0]!.points);
  g.poly(hull).fill(
    vGradient([
      [0, DIRT_TOP],
      [0.45, DIRT],
      [1, DIRT_DEEP],
    ]),
  );
  // Strata that follow the bowl, inset from the hull so they never cross the outline.
  for (const [i, depth] of [9.5, 16, 22.5, 28].entries()) {
    const w = halfWidth(-depth) - 2.2;
    g.moveTo(-w, depth);
    for (let x = -w; x <= w; x += 3) g.lineTo(x, depth + 0.55 * Math.sin(x * 0.27 + i * 1.7));
    g.lineTo(w, depth).stroke({ color: 0x8a532a, width: 0.42, alpha: 0.55, cap: 'round' });
  }
  for (let i = 0; i < 70; i++) {
    const y = 5.5 + hash01(i + 811) * 26;
    const w = halfWidth(-y) - 2.5;
    if (w <= 0) continue;
    const x = (hash01(i + 97) * 2 - 1) * w;
    const r = 0.35 + hash01(i + 33) * 0.75;
    const light = hash01(i + 5) < 0.55;
    g.ellipse(x, y, r * 1.3, r).fill({ color: light ? 0xe3ad72 : 0x7b4b27, alpha: light ? 0.7 : 0.55 });
  }
  // Roots hanging into the earth under the turf.
  for (const x of [-61, -33, -9, 18, 47, 66]) {
    const len = 3.5 + hash01(x + 400) * 3;
    g.moveTo(x, COURSE.turf + 0.5)
      .quadraticCurveTo(x + 1.2, COURSE.turf + len * 0.6, x - 0.4, COURSE.turf + len)
      .stroke({ color: 0x6b4122, width: 0.35, cap: 'round', alpha: 0.7 });
  }
}

/** A crossed pair of checkered race flags on a wooden board, centred on the deck's face. */
function raceBoard(): Container {
  const board = new Container({ label: 'race board' });
  const g = new Graphics();
  board.addChild(g);
  const cx = 0;
  const cy = 13.5;
  const w = 25;
  const h = 10.5;
  g.roundRect(cx - w / 2, cy - h / 2, w, h, 1.4)
    .fill(
      vGradient([
        [0, 0xe8b46a],
        [1, 0xc0823f],
      ]),
    )
    .stroke({ color: INK, width: 0.4 });
  for (const dy of [-1.8, 1.7]) g.rect(cx - w / 2 + 0.6, cy + dy, w - 1.2, 0.22).fill(0xa86c32);
  for (const [nx, ny] of [
    [-w / 2 + 1.4, -h / 2 + 1.3],
    [w / 2 - 1.4, -h / 2 + 1.3],
    [-w / 2 + 1.4, h / 2 - 1.3],
    [w / 2 - 1.4, h / 2 - 1.3],
  ] as const)
    g.circle(cx + nx, cy + ny, 0.38).fill(0x6e5a44);
  for (const side of [-1, 1]) {
    const pole = new Container();
    const stick = new Graphics();
    stick.moveTo(0, 4.2).lineTo(0, -4.4).stroke({ color: INK, width: 0.5, cap: 'round' });
    stick.circle(0, -4.6, 0.45).fill(0xf2c440).stroke({ color: INK, width: 0.18 });
    const flag = new Graphics();
    checker(flag, 0, 0, 4, 3, 1.15);
    flag.position.set(side === 1 ? 0.25 : -4.85, -4.2);
    pole.addChild(flag, stick);
    pole.position.set(cx + side * 2.6, cy + 0.6);
    pole.rotation = side * 0.42;
    board.addChild(pole);
  }
  return board;
}

function turf(g: Graphics): void {
  const { left, right, turf: depth } = COURSE;
  const scallop = 3.2;
  g.moveTo(left, 0).lineTo(right, 0).lineTo(right, depth);
  for (let x = right; x > left + 0.01; x -= scallop) {
    const next = Math.max(left, x - scallop);
    g.quadraticCurveTo((x + next) / 2, depth + 2.1, next, depth);
  }
  g.closePath().fill(
    vGradient([
      [0, TURF_LIGHT],
      [0.22, TURF],
      [1, TURF_DARK],
    ]),
  );
  // Mowed race lanes: alternating light bands across the lip.
  for (let x = left + 10; x < right - 10; x += 20)
    g.rect(x, 0.7, 10, depth - 0.9).fill({ color: 0xffffff, alpha: 0.1 });
  g.rect(left, 0, right - left, 0.6).fill(0xd2fa98);
  // Start (left) and finish (right) lines painted on the lip.
  checker(g, left + 4.2, 0.65, 4, 2, 1.3);
  checker(g, right - 4.2 - 5.2, 0.65, 4, 2, 1.3);
  for (let i = 0; i < 30; i++) {
    const x = left + 6 + i * 5 + hash01(i + 71) * 3;
    if (Math.abs(Math.abs(x) - 72.6) < 4.5) continue;
    g.poly([x - 0.7, depth + 0.4, x, depth - 1.1, x + 0.7, depth + 0.4]).fill({
      color: TURF_DARK,
      alpha: 0.8,
    });
  }
}

/** A drop-through race beam: a timber hurdle rail with red and white striped end caps. */
function raceBeam(p: { x1: number; x2: number; y: number }): Graphics {
  const g = new Graphics({ label: 'race beam' });
  const { x1, x2 } = p;
  const y = -p.y;
  const cap = 4.4;
  g.rect(x1, y, x2 - x1, BEAM).fill(
    vGradient([
      [0, TIMBER],
      [1, TIMBER_DARK],
    ]),
  );
  for (const [i, gy] of [0.75, 1.45].entries())
    g.moveTo(x1 + cap + 1, y + gy)
      .lineTo(x2 - cap - 1, y + gy + (i ? -0.12 : 0.1))
      .stroke({ color: 0xb87436, width: 0.18, alpha: 0.8 });
  for (const end of [x1, x2 - cap]) {
    const block = cap / 3;
    for (let b = 0; b < 3; b++) g.rect(end + b * block, y, block, BEAM).fill(b === 1 ? CHALK : HURDLE_RED);
    g.moveTo(end, y)
      .lineTo(end, y + BEAM)
      .moveTo(end + cap, y)
      .lineTo(end + cap, y + BEAM)
      .stroke({
        color: INK,
        width: 0.22,
      });
  }
  g.rect(x1, y, x2 - x1, 0.45).fill({ color: 0xffffff, alpha: 0.35 });
  g.rect(x1, y, x2 - x1, BEAM).stroke({ color: INK, width: 0.42, join: 'round' });
  return g;
}

export function createPlayfield(): Container {
  const container = new Container({ label: 'duck-life-course-playfield' });
  const ground = new Graphics({ label: 'earth' });
  earth(ground);
  const grass = new Graphics({ label: 'turf and outline' });
  turf(grass);
  grass.poly(flipY(stage.solids[0]!.points)).stroke({ color: INK, width: 0.62, join: 'round' });
  container.addChild(ground, raceBoard(), grass, ...stage.platforms.map(raceBeam));
  return container;
}

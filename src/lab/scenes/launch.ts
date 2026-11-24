import { Container, Graphics, Text } from 'pixi.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../config';
import { getFighter } from '../../fighters/registry';
import { isTumble, knockback } from '../../sim/combat/formulas';
import { createMatch, stepMatch } from '../../sim/match';
import { getStage } from '../../stages/registry';
import type { LabScene } from '../types';

interface Hit {
  damage: number;
  kbg: number;
  bkb: number;
  angle: number;
  fighter: string;
}

const PERCENTS = [0, 40, 80, 120, 160, 200];
const COLORS = ['#9aa3b5', '#7ed957', '#4fb3ff', '#ffd54a', '#ff8a3d', '#ff4d4d'];
const ZOOM = 2.1;
const CY = 26;
const sx = (x: number) => VIEW_WIDTH / 2 + x * ZOOM;
const sy = (y: number) => VIEW_HEIGHT / 2 - (y - CY) * ZOOM;

/** Simulate one launch with the real match step: hit at the centre of Battlefield, then fly until hitstun ends or KO. */
function fly(hit: Hit, percent: number): { points: { x: number; y: number }[]; ko: boolean } {
  const m = createMatch({ seed: 1, stage: 'battlefield', stocks: 3, ports: [{ fighter: hit.fighter }] });
  const f = m.fighters[0]!;
  Object.assign(f, { pos: { x: 0, y: 1 }, prevPos: { x: 0, y: 1 } });
  const idle = [{ x: 0, y: 0, cx: 0, cy: 0, buttons: 0 }];
  for (let i = 0; i < 30; i++) stepMatch(m, idle);
  f.damage = percent;
  const kb = knockback({
    percent,
    damage: hit.damage,
    kbg: hit.kbg,
    bkb: hit.bkb,
    weight: getFighter(hit.fighter).stats.weight,
  });
  Object.assign(f, {
    launch: { kb, angle: hit.angle, dir: 1, setKnockback: false },
    action: isTumble(kb) ? 'tumble' : 'hitstun',
    actionFrame: 0,
  });
  const points = [{ ...f.pos }];
  for (let i = 0; i < 240 && f.action !== 'ko' && (f.launch || f.hitstun > 0); i++) {
    stepMatch(m, idle);
    points.push({ ...f.pos });
  }
  return { points, ko: f.action === 'ko' };
}

function label(text: string, x: number, y: number, fill = '#e8ecf4', size = 16): Text {
  const t = new Text({ text, style: { fontFamily: 'monospace', fontSize: size, fill } });
  t.position.set(x, y);
  return t;
}

function draw(root: Container, hit: Hit): void {
  root.removeChildren();
  const stage = getStage('battlefield');
  const g = new Graphics();
  root.addChild(g);
  const b = stage.blastZones;
  g.rect(sx(b.left), sy(b.top), (b.right - b.left) * ZOOM, (b.top - b.bottom) * ZOOM).stroke({
    color: '#ff4d4d',
    width: 2,
    alpha: 0.8,
  });
  for (const solid of stage.solids) g.poly(solid.points.flatMap(([x, y]) => [sx(x), sy(y)])).fill('#5b4a3a');
  for (const p of stage.platforms) g.rect(sx(p.x1), sy(p.y) - 2, (p.x2 - p.x1) * ZOOM, 4).fill('#d9d2c0');
  root.addChild(label('blast zone', sx(b.left) + 6, sy(b.bottom) - 22, '#ff8080', 14));
  root.addChild(
    label(
      `Launches of ${hit.damage}% / BKB ${hit.bkb} / KBG ${hit.kbg} / angle ${hit.angle} on ${getFighter(hit.fighter).name} (one dot per frame of hitstun)`,
      20,
      12,
    ),
  );
  PERCENTS.forEach((percent, i) => {
    const { points, ko } = fly(hit, percent);
    const color = COLORS[i]!;
    g.moveTo(sx(points[0]!.x), sy(points[0]!.y));
    for (const p of points) g.lineTo(sx(p.x), sy(p.y));
    g.stroke({ color, width: 2, alpha: 0.6 });
    for (const p of points) g.circle(sx(p.x), sy(p.y), 2.5).fill(color);
    root.addChild(label(`${percent}%${ko ? '  KO' : ''}`, 20, 44 + i * 22, color));
    const end = points.at(-1)!;
    if (!ko) g.circle(sx(end.x), sy(end.y), 5).stroke({ color, width: 2 });
  });
}

const root = new Container();
let hit: Hit = { damage: 17, kbg: 102, bkb: 30, angle: 45, fighter: 'fireboy' };

/** Real simulated launch trajectories (knockback, 0.051 decay, gravity, balloon speed-up) at rising %. */
export const scene: LabScene = {
  title: 'Launch trajectories',
  mount(app) {
    app.stage.addChild(root);
    draw(root, hit);
  },
  api: {
    /** Redraw for another hit, e.g. hit({ angle: 361, damage: 12 }). */
    hit: (h: Partial<Hit>) => {
      hit = { ...hit, ...h };
      draw(root, hit);
      return hit;
    },
  },
};

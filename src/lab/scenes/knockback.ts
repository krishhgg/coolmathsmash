import { Container, Graphics, Text } from 'pixi.js';
import { hitstunFrames, isTumble, knockback, launch, speedUp } from '../../sim/combat/formulas';
import type { LabScene } from '../types';

const TARGETS = [
  { name: 'Pichu (62)', weight: 62, gravity: 0.14, color: '#ffd54a' },
  { name: 'Fox (77)', weight: 77, gravity: 0.23, color: '#ff8a3d' },
  { name: 'Mario (98)', weight: 98, gravity: 0.087, color: '#ff4d4d' },
  { name: 'Bowser (135)', weight: 135, gravity: 0.125, color: '#7ed957' },
];

const label = (text: string, x: number, y: number, size = 16, fill = '#e8ecf4') => {
  const t = new Text({ text, style: { fontFamily: 'monospace', fontSize: size, fill } });
  t.position.set(x, y);
  return t;
};

interface Hit {
  damage: number;
  kbg: number;
  bkb: number;
  angle: number;
}

/** Charts the Ultimate formulas for one hit: knockback and hitstun against target %, per weight class. */
function draw(root: Container, hit: Hit): void {
  root.removeChildren();
  const g = new Graphics();
  root.addChild(g);
  const plot = { x: 90, y: 90, w: 700, h: 520 };
  const maxP = 200;
  const maxKb = 400;
  const px = (p: number) => plot.x + (p / maxP) * plot.w;
  const py = (kb: number) => plot.y + plot.h - (Math.min(kb, maxKb) / maxKb) * plot.h;

  root.addChild(
    label(
      `Knockback vs target %  (damage ${hit.damage}, BKB ${hit.bkb}, KBG ${hit.kbg}, angle ${hit.angle})`,
      plot.x,
      30,
      20,
    ),
  );
  for (let p = 0; p <= maxP; p += 25) {
    g.moveTo(px(p), plot.y)
      .lineTo(px(p), plot.y + plot.h)
      .stroke({ color: '#3a4150', width: 1 });
    root.addChild(label(`${p}%`, px(p) - 14, plot.y + plot.h + 8, 14, '#9aa3b5'));
  }
  for (let kb = 0; kb <= maxKb; kb += 50) {
    g.moveTo(plot.x, py(kb))
      .lineTo(plot.x + plot.w, py(kb))
      .stroke({ color: '#3a4150', width: 1 });
    root.addChild(label(String(kb), plot.x - 44, py(kb) - 8, 14, '#9aa3b5'));
  }
  g.moveTo(plot.x, py(80))
    .lineTo(plot.x + plot.w, py(80))
    .stroke({ color: '#ffffff', width: 2, alpha: 0.7 });
  root.addChild(label('tumble (kb 80)', plot.x + plot.w - 150, py(80) - 22, 14));

  TARGETS.forEach((t, i) => {
    for (let p = 0; p <= maxP; p++) {
      const kb = knockback({ percent: p, damage: hit.damage, kbg: hit.kbg, bkb: hit.bkb, weight: t.weight });
      if (p === 0) g.moveTo(px(p), py(kb));
      else g.lineTo(px(p), py(kb));
    }
    g.stroke({ color: t.color, width: 3 });
    root.addChild(label(t.name, plot.x + 16, plot.y + 10 + i * 22, 16, t.color));
  });

  const table = { x: 840, y: 90 };
  root.addChild(label('Mario at each %:', table.x, table.y - 34, 18));
  root.addChild(label('  %    kb  hitstun  acts  launch deg', table.x, table.y, 15, '#9aa3b5'));
  [0, 25, 50, 75, 100, 125, 150, 175, 200].forEach((p, row) => {
    const kb = knockback({ percent: p, damage: hit.damage, kbg: hit.kbg, bkb: hit.bkb, weight: 98 });
    const stun = hitstunFrames(kb);
    const l = launch({ kb, angle: hit.angle, aerial: false, gravity: 0.087 });
    const acts = isTumble(kb) ? speedUp(stun + 1).actionable : stun + 1;
    const line = `${String(p).padStart(3)}  ${kb.toFixed(1).padStart(5)}  ${String(stun).padStart(7)}  ${String(acts).padStart(4)}  ${l.effectiveAngle.toFixed(1).padStart(10)}`;
    root.addChild(label(line, table.x, table.y + 28 + row * 26, 15, isTumble(kb) ? '#ffffff' : '#9aa3b5'));
  });
  root.addChild(
    label(
      'acts = actionable frame after\nballoon speed-up (tumble only)',
      table.x,
      table.y + 290,
      14,
      '#9aa3b5',
    ),
  );
}

const root = new Container();
let hit: Hit = { damage: 17, kbg: 102, bkb: 30, angle: 361 };

export const scene: LabScene = {
  title: 'Knockback formula chart',
  mount(app) {
    app.stage.addChild(root);
    draw(root, hit);
  },
  api: {
    /** Redraw for another hit, e.g. hit({ damage: 12, bkb: 40 }). */
    hit: (h: Partial<Hit>) => {
      hit = { ...hit, ...h };
      draw(root, hit);
      return hit;
    },
  },
};

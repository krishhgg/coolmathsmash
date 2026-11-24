import { Container, Graphics, Text } from 'pixi.js';
import { VIEW_HEIGHT } from '../../config';
import { Btn } from '../../input/types';
import type { PlayerState } from '../../sim/match';

export const PORT_COLORS = ['#ff4b4b', '#3d8bff', '#ffd43b', '#3ccf5a'];
const BUTTONS: [label: string, bit: number][] = [
  ['A', Btn.Attack],
  ['B', Btn.Special],
  ['J', Btn.Jump],
  ['S', Btn.Shield],
  ['Z', Btn.Grab],
];
const buttonPos = (k: number) => [142 + (k % 3) * 24, 30 + Math.floor(k / 3) * 26] as const;
const labelStyle = { fontFamily: 'Arial', fontWeight: 'bold', fill: '#ffffff' } as const;

/** Per-port controller readout (main stick, C-stick, buttons) for playtesting, captures and judges. */
export class InputDisplay {
  readonly container = new Container();
  private readonly panels: Graphics[] = [];

  private addPanel(i: number): Graphics {
    const panel = new Container();
    panel.position.set(16 + i * 230, VIEW_HEIGHT - 92);
    const g = new Graphics();
    const title = new Text({ text: `P${i + 1}`, style: { ...labelStyle, fontSize: 14 } });
    title.position.set(8, 4);
    panel.addChild(g, title);
    BUTTONS.forEach(([label], k) => {
      const t = new Text({ text: label, style: { ...labelStyle, fontSize: 11 } });
      t.anchor.set(0.5);
      t.position.set(...buttonPos(k));
      panel.addChild(t);
    });
    this.container.addChild(panel);
    return g;
  }

  update(players: readonly PlayerState[]): void {
    players.forEach((p, i) => {
      const g = (this.panels[i] ??= this.addPanel(i));
      const color = PORT_COLORS[i % PORT_COLORS.length]!;
      const { x, y, cx, cy, buttons } = p.control.cur;
      g.clear();
      g.roundRect(0, 0, 214, 80, 10).fill({ color: '#000000', alpha: 0.55 }).stroke({ color, width: 2 });
      g.circle(52, 44, 24).stroke({ color: '#ffffff', width: 2, alpha: 0.6 });
      g.circle(52 + (x / 100) * 22, 44 - (y / 100) * 22, 7).fill(color);
      g.circle(110, 44, 16).stroke({ color: '#ffd43b', width: 2, alpha: 0.6 });
      g.circle(110 + (cx / 100) * 14, 44 - (cy / 100) * 14, 5).fill('#ffd43b');
      BUTTONS.forEach(([, bit], k) => {
        const on = (buttons & bit) !== 0;
        g.circle(...buttonPos(k), 10)
          .fill({ color: on ? color : '#ffffff', alpha: on ? 1 : 0.15 })
          .stroke({ color: '#ffffff', width: 1.5, alpha: 0.7 });
      });
    });
  }
}

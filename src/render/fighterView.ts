import { Container, Graphics, Text } from 'pixi.js';
import { isIntangible } from '../sim/actions/registry';
import { SHIELD_MAX } from '../sim/constants';
import type { FighterState } from '../sim/fighter';
import type { FighterDef } from '../fighters/types';
import { PORT_COLORS } from './debug/inputDisplay';

/**
 * Placeholder fighter drawing (capsule + eye) until the rig renderer lands. World units, y down inside.
 */
export class FighterView {
  readonly container = new Container();
  private readonly body = new Graphics();
  private readonly shield = new Graphics();
  private readonly tag = new Text({
    text: '',
    style: { fontFamily: 'Arial', fontSize: 28, fontWeight: 'bold', fill: '#ffffff' },
  });
  private readonly label = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 22, fill: '#ffffff' },
  });

  constructor(
    private readonly def: FighterDef,
    port: number,
  ) {
    const { height: h, width: w } = def.stats;
    const color = PORT_COLORS[port % PORT_COLORS.length]!;
    this.body
      .roundRect(-w / 2, -h, w, h, w / 2)
      .fill('#ff7a1a')
      .stroke({ color: '#3a1300', width: 0.6 })
      .circle(w * 0.18, -h * 0.72, 1.3)
      .fill('#ffffff')
      .circle(w * 0.26, -h * 0.72, 0.6)
      .fill('#000000');
    this.tag.text = `P${port + 1}`;
    this.tag.style.fill = color;
    for (const t of [this.tag, this.label]) {
      t.anchor.set(0.5, 1);
      t.scale.set(0.12);
    }
    this.tag.position.set(0, -h - 2);
    this.label.position.set(0, -h - 5.5);
    this.label.visible = false;
    this.container.addChild(this.shield, this.body, this.tag, this.label);
    this.shieldColor = color;
  }

  private readonly shieldColor: string;

  update(f: FighterState, alpha: number, frame: number, debug: boolean): void {
    const out = f.action === 'ko' || f.action === 'out';
    this.container.visible = !out;
    if (out) return;
    const x = f.prevPos.x + (f.pos.x - f.prevPos.x) * alpha;
    const y = f.prevPos.y + (f.pos.y - f.prevPos.y) * alpha;
    this.container.position.set(x, -y);
    this.body.scale.x = f.facing;
    const squash = f.action === 'crouch' || f.action === 'jumpSquat' || f.action === 'land' ? 0.7 : 1;
    this.body.scale.y = squash;
    this.body.alpha = isIntangible(f) && frame % 8 < 4 ? 0.45 : 1;
    this.shield.clear();
    if (f.action === 'shield' || f.action === 'shieldStun') {
      const r = this.def.stats.shieldSize * ((f.shieldHp / SHIELD_MAX) * 0.85 + 0.15);
      this.shield.circle(0, -this.def.stats.height / 2, r).fill({ color: this.shieldColor, alpha: 0.45 });
    }
    this.label.visible = debug;
    if (debug) this.label.text = `${f.action} ${f.actionFrame}`;
  }
}

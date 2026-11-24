import { ColorMatrixFilter, Container, FillGradient, Graphics, Text, TextStyle } from 'pixi.js';
import { hudFontFamily } from './font';
import { iconView } from './icon';
import { brighten, damageColor, formatDamage, hitEffect, portColor } from './style';
import type { HudPlayer } from './types';

const INK = 0x15110c;
const PORTRAIT = { x: 58, y: 66, size: 92, tilt: -0.12 } as const;
const NUMBER = { right: 244, base: 100 } as const;
const BAR = { left: 92, right: 248, top: 104, bottom: 124 } as const;
const STOCK_Y = 136;
const STOCK_SIZE = 16;

function mixColor(a: number, b: number, t: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 255;
    const cb = (b >> shift) & 255;
    out |= Math.round(ca + (cb - ca) * t) << shift;
  }
  return out;
}

const numberFill = new FillGradient({
  type: 'linear',
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  colorStops: [
    { offset: 0, color: 0xffffff },
    { offset: 0.55, color: 0xf4f4f4 },
    { offset: 1, color: 0xbdbdbd },
  ],
  textureSpace: 'local',
});

function numberStyle(size: number): TextStyle {
  return new TextStyle({
    fontFamily: hudFontFamily(),
    fontSize: size,
    fill: numberFill,
    stroke: { color: INK, width: size * 0.13, join: 'round' },
    dropShadow: {
      color: 0x000000,
      alpha: 0.55,
      angle: Math.PI / 2,
      blur: 0,
      distance: Math.max(2, size * 0.06),
    },
    padding: 6,
  });
}

/**
 * One player's damage card, Ultimate layout in Flash dress: tilted port-coloured portrait, big italic damage with
 * a smaller tenth, name bar with the port stripe, and stock icons. Rebuilds pieces only when their inputs change.
 */
export class DamageCard {
  readonly container = new Container({ label: 'damage-card' });
  private readonly portrait = new Container({ label: 'portrait' });
  private readonly emblem = new Graphics({ label: 'emblem' });
  private readonly burst = new Graphics({ label: 'burst' });
  private readonly number = new Container({ label: 'damage' });
  private readonly whole = new Text({ text: '0', style: numberStyle(64), anchor: { x: 1, y: 1 } });
  private readonly tenth = new Text({ text: '.0%', style: numberStyle(30), anchor: { x: 1, y: 1 } });
  private readonly bar = new Graphics({ label: 'name-bar' });
  private readonly nameText = new Text({
    text: '',
    style: new TextStyle({ fontFamily: hudFontFamily(), fontSize: 17, fill: 0xffffff, letterSpacing: 0.6 }),
    anchor: { x: 1, y: 0.5 },
  });
  private readonly portText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: hudFontFamily(),
      fontSize: 15,
      fill: 0xffffff,
      stroke: { color: INK, width: 3, join: 'round' },
    }),
    anchor: { x: 0, y: 0.5 },
  });
  private readonly stocks = new Container({ label: 'stocks' });
  private readonly grey = new ColorMatrixFilter();
  private fonts = '';
  private shown = {
    port: -1,
    icon: '\0',
    name: '\0',
    damage: NaN,
    stocks: -1,
    maxStocks: -1,
    eliminated: false,
  };

  constructor() {
    this.grey.desaturate();
    this.burst.star(0, 0, 12, 58, 30).fill({ color: 0xfff6b0 });
    this.burst.star(0, 0, 12, 40, 20, 0.3).fill({ color: 0xffffff });
    this.number.addChild(this.whole, this.tenth);
    this.number.pivot.set(-72, -26);
    this.number.skew.set(-0.2, 0);
    this.container.addChild(
      this.emblem,
      this.portrait,
      this.bar,
      this.nameText,
      this.portText,
      this.burst,
      this.number,
      this.stocks,
    );
    this.nameText.position.set(BAR.right - 12, (BAR.top + BAR.bottom) / 2 + 1);
    this.portText.position.set(BAR.left + 8, (BAR.top + BAR.bottom) / 2 + 1);
  }

  update(p: HudPlayer, frame: number): void {
    const s = this.shown;
    const family = hudFontFamily();
    if (family.join() !== this.fonts) {
      this.fonts = family.join();
      for (const t of [this.whole, this.tenth, this.nameText, this.portText]) t.style.fontFamily = family;
      s.name = '\0';
      s.damage = NaN;
    }
    if (p.port !== s.port || (p.icon ?? '') !== s.icon) {
      this.drawPortrait(p);
      this.drawEmblem(portColor(p.port));
      this.drawBar(p.port);
    }
    if (p.name !== s.name || p.port !== s.port) {
      this.nameText.text = p.name.toUpperCase();
      const room = BAR.right - BAR.left - 52;
      this.nameText.scale.set(1);
      if (this.nameText.width > room) this.nameText.scale.set(room / this.nameText.width);
      this.portText.text = `P${p.port + 1}`;
      this.portText.style.fill = portColor(p.port);
    }
    if (p.damage !== s.damage) {
      const { whole, tenth } = formatDamage(p.damage);
      this.whole.text = whole;
      this.tenth.text = tenth;
      this.tenth.position.set(0, 0);
      this.whole.position.set(-this.tenth.width + 8, 3);
    }
    if (
      p.stocks !== s.stocks ||
      p.maxStocks !== s.maxStocks ||
      p.eliminated !== s.eliminated ||
      (p.icon ?? '') !== s.icon ||
      p.port !== s.port
    )
      this.drawStocks(p);
    if (p.eliminated !== s.eliminated || s.port === -1) {
      this.container.filters = p.eliminated ? [this.grey] : [];
      this.container.alpha = p.eliminated ? 0.55 : 1;
      this.number.visible = !p.eliminated;
    }
    Object.assign(s, {
      port: p.port,
      icon: p.icon ?? '',
      name: p.name,
      damage: p.damage,
      stocks: p.stocks,
      maxStocks: p.maxStocks,
      eliminated: p.eliminated,
    });

    const fx = p.eliminated ? hitEffect(0, -1, p.port) : hitEffect(frame, p.hitFrame, p.port);
    const color = brighten(damageColor(p.damage), fx.flash * 0.85);
    this.whole.tint = color;
    this.tenth.tint = color;
    this.number.position.set(NUMBER.right - 72 + fx.dx, NUMBER.base - 26 + fx.dy);
    this.number.scale.set(fx.scale);
    this.burst.visible = fx.burst >= 0;
    if (fx.burst >= 0) {
      this.burst.position.set(NUMBER.right - 70, NUMBER.base - 30);
      this.burst.scale.set(0.5 + fx.burst * 0.9);
      this.burst.alpha = 0.85 * (1 - fx.burst);
      this.burst.rotation = fx.burst * 0.6;
    }
    this.portrait.position.set(PORTRAIT.x + fx.dx * 0.35, PORTRAIT.y + fx.dy * 0.35);
  }

  private drawPortrait(p: HudPlayer): void {
    for (const child of this.portrait.removeChildren()) child.destroy({ children: true });
    const color = portColor(p.port);
    const half = PORTRAIT.size / 2;
    const frame = new Graphics();
    frame.roundRect(-half - 4, -half - 4, PORTRAIT.size + 8, PORTRAIT.size + 8, 15).fill(INK);
    frame.roundRect(-half, -half, PORTRAIT.size, PORTRAIT.size, 12).fill(
      new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: mixColor(color, 0xffffff, 0.35) },
          { offset: 0.6, color },
          { offset: 1, color: mixColor(color, 0x000000, 0.4) },
        ],
        textureSpace: 'local',
      }),
    );
    const inside = new Container();
    const mask = new Graphics().roundRect(-half, -half, PORTRAIT.size, PORTRAIT.size, 12).fill(0xffffff);
    const rays = new Graphics();
    for (let i = 0; i < 14; i++) {
      const a0 = (i / 14) * Math.PI * 2;
      const a1 = a0 + Math.PI / 14;
      rays.poly([0, 0, Math.cos(a0) * 90, Math.sin(a0) * 90, Math.cos(a1) * 90, Math.sin(a1) * 90]).fill({
        color: 0xffffff,
        alpha: 0.13,
      });
    }
    rays.position.set(0, 10);
    const head = iconView(p.icon, PORTRAIT.size * 0.92);
    head.position.set(0, 6);
    const gloss = new Graphics()
      .ellipse(-8, -half + 10, half * 0.95, 20)
      .fill({ color: 0xffffff, alpha: 0.18 });
    inside.addChild(rays, head, gloss);
    inside.mask = mask;
    const rim = new Graphics()
      .roundRect(-half + 2.5, -half + 2.5, PORTRAIT.size - 5, PORTRAIT.size - 5, 10)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.4 });
    this.portrait.addChild(frame, inside, mask, rim);
    this.portrait.rotation = PORTRAIT.tilt;
  }

  /** The Coolmath planet in port colour behind the number, where Ultimate shows the series symbol. */
  private drawEmblem(color: number): void {
    const g = this.emblem.clear();
    const cx = 196;
    const cy = 42;
    const tilt = -0.28;
    const ring = (from: number, to: number) => {
      for (let i = 0; i <= 32; i++) {
        const t = from + ((to - from) * i) / 32;
        const ex = Math.cos(t) * 44;
        const ey = Math.sin(t) * 11;
        const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
        const y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    };
    const dark = mixColor(color, 0x000000, 0.45);
    ring(Math.PI, Math.PI * 2);
    g.stroke({ width: 9, color: dark, cap: 'round' });
    ring(Math.PI, Math.PI * 2);
    g.stroke({ width: 5, color, cap: 'round' });
    g.circle(cx, cy, 27).fill(dark);
    g.circle(cx, cy, 24).fill(color);
    g.ellipse(cx - 8, cy - 10, 10, 6).fill({ color: 0xffffff, alpha: 0.35 });
    ring(0, Math.PI);
    g.stroke({ width: 9, color: dark, cap: 'round' });
    ring(0, Math.PI);
    g.stroke({ width: 5, color, cap: 'round' });
    g.alpha = 0.5;
  }

  private drawBar(port: number): void {
    const g = this.bar.clear();
    const slant = 6;
    g.poly([
      BAR.left + slant,
      BAR.top,
      BAR.right,
      BAR.top,
      BAR.right - slant,
      BAR.bottom,
      BAR.left,
      BAR.bottom,
    ]).fill({
      color: 0x15151c,
      alpha: 0.88,
    });
    g.poly([
      BAR.left,
      BAR.bottom,
      BAR.right - slant,
      BAR.bottom,
      BAR.right - slant - 1.2,
      BAR.bottom + 4,
      BAR.left - 1.2,
      BAR.bottom + 4,
    ]).fill(portColor(port));
  }

  private drawStocks(p: HudPlayer): void {
    for (const child of this.stocks.removeChildren()) child.destroy({ children: true });
    const left = BAR.left + 6 + STOCK_SIZE / 2;
    const remaining = p.eliminated ? 0 : Math.max(0, p.stocks);
    if (p.maxStocks > 5) {
      const icon = iconView(p.icon, STOCK_SIZE);
      icon.position.set(left, STOCK_Y);
      const count = new Text({
        text: `× ${remaining}`,
        style: new TextStyle({
          fontFamily: hudFontFamily(),
          fontSize: 15,
          fill: 0xffffff,
          stroke: { color: INK, width: 3, join: 'round' },
        }),
        anchor: { x: 0, y: 0.5 },
      });
      count.position.set(left + STOCK_SIZE / 2 + 4, STOCK_Y);
      this.stocks.addChild(icon, count);
      return;
    }
    for (let i = 0; i < Math.max(p.maxStocks, remaining); i++) {
      const icon = iconView(p.icon, STOCK_SIZE);
      icon.position.set(left + i * (STOCK_SIZE + 3), STOCK_Y);
      if (i >= remaining) {
        icon.alpha = 0.3;
        icon.tint = 0x333333;
      }
      this.stocks.addChild(icon);
    }
  }
}
